package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

const (
	// MarkerPrefix identifies the summary PR comment managed by the remediation system.
	MarkerPrefix = "<!-- remediation-agent:pr-feedback"
	// SuggestionMarker identifies the review suggestion comment managed by the remediation system.
	SuggestionMarker = "<!-- remediation-agent:pr-suggestion -->"
	// MaxReportBytes caps raw JSON report size at 1 MiB.
	MaxReportBytes = 1 << 20
	// MaxBodyChars caps rendered Markdown comment length at 60,000 characters.
	MaxBodyChars = 60000
	// SchemaVersion is the supported FeedbackReport contract version.
	SchemaVersion = "1.0"
)

// Verdict discriminates the outcome of a remediation session.
type Verdict string

const (
	VerdictVerifiedFix    Verdict = "verified_fix"
	VerdictNoChangeNeeded Verdict = "no_change_needed"
	VerdictFailed         Verdict = "failed"
)

// AttemptSummary describes one remediation attempt.
type AttemptSummary struct {
	AttemptNumber int     `json:"attempt_number"`
	Outcome       string  `json:"outcome"`
	FailureReason *string `json:"failure_reason,omitempty"`
	DurationMs    int64   `json:"duration_ms"`
}

// VerifiedDiff carries the verified unified diff and target files.
type VerifiedDiff struct {
	UnifiedDiff string   `json:"unified_diff"`
	TargetFiles []string `json:"target_files"`
	CommitURL   *string  `json:"commit_url,omitempty"`
}

// SuggestionSpec describes a single-file line range replacement for a PR review comment.
type SuggestionSpec struct {
	Path        string `json:"path"`
	StartLine   int    `json:"start_line"`
	Line        int    `json:"line"`
	Replacement string `json:"replacement"`
}

// FeedbackReport is the typed contract decoded from the Python agent formatter.
type FeedbackReport struct {
	SchemaVersion string           `json:"schema_version"`
	Verdict       Verdict          `json:"verdict"`
	JobID         string           `json:"job_id"`
	SessionID     string           `json:"session_id"`
	Diagnosis     string           `json:"diagnosis"`
	DurationMs    int64            `json:"duration_ms"`
	Attempts      []AttemptSummary `json:"attempts"`
	MarkdownBody  string           `json:"markdown_body"`
	Diff          *VerifiedDiff    `json:"diff,omitempty"`
	TestLog       *string          `json:"test_log,omitempty"`
	Suggestion    *SuggestionSpec  `json:"suggestion,omitempty"`
}

// DecodeReport strictly decodes and validates a FeedbackReport JSON payload.
func DecodeReport(r io.Reader) (*FeedbackReport, error) {
	limited := io.LimitReader(r, MaxReportBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("failed to read report: %w", err)
	}
	if len(raw) > MaxReportBytes {
		return nil, fmt.Errorf("report exceeds maximum size of %d bytes", MaxReportBytes)
	}

	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var rep FeedbackReport
	if err := dec.Decode(&rep); err != nil {
		return nil, fmt.Errorf("invalid report JSON: %w", err)
	}
	if err := ValidateReport(&rep); err != nil {
		return nil, err
	}
	return &rep, nil
}

// ValidateReport enforces contract invariants on a decoded FeedbackReport.
func ValidateReport(rep *FeedbackReport) error {
	if rep == nil {
		return fmt.Errorf("report cannot be nil")
	}
	if rep.SchemaVersion != SchemaVersion {
		return fmt.Errorf("unsupported schema_version %q", rep.SchemaVersion)
	}
	if strings.TrimSpace(rep.JobID) == "" {
		return fmt.Errorf("job_id is required")
	}
	if strings.TrimSpace(rep.SessionID) == "" {
		return fmt.Errorf("session_id is required")
	}
	diagLen := utf8.RuneCountInString(rep.Diagnosis)
	if diagLen < 1 || diagLen > 4000 {
		return fmt.Errorf("diagnosis length must be between 1 and 4000 characters")
	}
	if rep.DurationMs < 0 {
		return fmt.Errorf("duration_ms must be non-negative")
	}
	if len(rep.Attempts) > 3 {
		return fmt.Errorf("attempts cannot exceed 3")
	}
	for _, a := range rep.Attempts {
		if a.AttemptNumber < 1 || a.AttemptNumber > 3 {
			return fmt.Errorf("attempt_number %d out of range 1..3", a.AttemptNumber)
		}
		switch a.Outcome {
		case "verified_success", "verified_failure", "failed_to_apply":
		default:
			return fmt.Errorf("invalid attempt outcome %q", a.Outcome)
		}
		if a.DurationMs < 0 {
			return fmt.Errorf("attempt duration_ms must be non-negative")
		}
	}

	if utf8.RuneCountInString(rep.MarkdownBody) > MaxBodyChars {
		return fmt.Errorf("markdown_body exceeds maximum length of %d characters", MaxBodyChars)
	}
	if strings.Count(rep.MarkdownBody, MarkerPrefix) != 1 {
		return fmt.Errorf("markdown_body must contain the feedback marker exactly once")
	}

	switch rep.Verdict {
	case VerdictVerifiedFix:
		if rep.Diff == nil || strings.TrimSpace(rep.Diff.UnifiedDiff) == "" || len(rep.Diff.TargetFiles) == 0 {
			return fmt.Errorf("verified_fix requires non-empty diff and target_files")
		}
		if rep.TestLog == nil {
			return fmt.Errorf("verified_fix requires test_log")
		}
		if len(rep.Attempts) == 0 || rep.Attempts[len(rep.Attempts)-1].Outcome != "verified_success" {
			return fmt.Errorf("verified_fix requires final attempt outcome verified_success")
		}
		if rep.Suggestion != nil {
			if strings.TrimSpace(rep.Suggestion.Path) == "" || rep.Suggestion.StartLine < 1 || rep.Suggestion.Line < rep.Suggestion.StartLine {
				return fmt.Errorf("invalid suggestion spec")
			}
		}
	case VerdictNoChangeNeeded:
		if rep.Diff != nil || rep.Suggestion != nil {
			return fmt.Errorf("no_change_needed must not include diff or suggestion")
		}
		if rep.TestLog == nil {
			return fmt.Errorf("no_change_needed requires test_log")
		}
	case VerdictFailed:
		if rep.Diff != nil || rep.Suggestion != nil || rep.TestLog != nil {
			return fmt.Errorf("failed report must not include diff, suggestion, or test_log")
		}
		if ContainsCodeProposalFence(rep.MarkdownBody) {
			return fmt.Errorf("failed report markdown_body must not contain diff/suggestion fences or commit links")
		}
	default:
		return fmt.Errorf("unknown verdict %q", rep.Verdict)
	}
	return nil
}

// ContainsCodeProposalFence returns true if body contains a diff/suggestion code fence or a commit link.
func ContainsCodeProposalFence(body string) bool {
	lower := strings.ToLower(body)
	return strings.Contains(lower, "```diff") ||
		strings.Contains(lower, "```suggestion") ||
		strings.Contains(lower, "[view commit](")
}
