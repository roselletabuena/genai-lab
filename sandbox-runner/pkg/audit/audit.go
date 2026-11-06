package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// FeedbackStatus represents the outcome of posting the PR feedback comment.
type FeedbackStatus string

const (
	FeedbackPosted  FeedbackStatus = "posted"
	FeedbackUpdated FeedbackStatus = "updated"
	FeedbackSkipped FeedbackStatus = "skipped"
	FeedbackFailed  FeedbackStatus = "failed"
)

// FeedbackOutcome records the result of posting or updating the PR feedback comment.
type FeedbackOutcome struct {
	Status              FeedbackStatus `json:"status"`
	Reason              string         `json:"reason,omitempty"`
	SummaryCommentID    *int64         `json:"summary_comment_id,omitempty"`
	SuggestionCommentID *int64         `json:"suggestion_comment_id,omitempty"`
	Attempts            int            `json:"attempts"`
}

// Record represents a persistent machine-readable audit envelope of a container remediation run.
type Record struct {
	JobID             string           `json:"job_id"`
	RepoFullName      string           `json:"repo_full_name"`
	PullRequestNumber int              `json:"pull_request_number"`
	CommitSHA         string           `json:"commit_sha"`
	TargetBranch      string           `json:"target_branch,omitempty"`
	Status            string           `json:"status"`
	ExitCode          int              `json:"exit_code"`
	DurationMs        int64            `json:"duration_ms"`
	TimedOut          bool             `json:"timed_out"`
	Stdout            string           `json:"stdout,omitempty"`
	Stderr            string           `json:"stderr,omitempty"`
	Error             string           `json:"error,omitempty"`
	Timestamp         time.Time        `json:"timestamp"`
	Feedback          *FeedbackOutcome `json:"feedback,omitempty"`
}

// Writer writes audit records to a target filesystem directory.
type Writer struct {
	baseDir string
}

// NewWriter initializes a new audit Writer pointing to baseDir.
func NewWriter(baseDir string) *Writer {
	return &Writer{baseDir: baseDir}
}

// BaseDir returns the base directory where audit records and sidecar files live.
func (w *Writer) BaseDir() string {
	return w.baseDir
}

// Write persists the audit Record to a JSON file named <job_id>.json in baseDir.
// Returns the absolute file path where the record was written.
func (w *Writer) Write(rec *Record) (string, error) {
	if rec == nil {
		return "", fmt.Errorf("audit record cannot be nil")
	}
	if rec.JobID == "" {
		return "", fmt.Errorf("audit record job_id cannot be empty")
	}

	if err := os.MkdirAll(w.baseDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create audit directory %s: %w", w.baseDir, err)
	}

	filePath := filepath.Join(w.baseDir, fmt.Sprintf("%s.json", rec.JobID))
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal audit record JSON: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return "", fmt.Errorf("failed to write audit record to %s: %w", filePath, err)
	}

	return filePath, nil
}

// Update reads the existing <job_id>.json audit record, attaches outcome to Feedback, and rewrites it.
func (w *Writer) Update(jobID string, outcome FeedbackOutcome) error {
	if jobID == "" {
		return fmt.Errorf("job_id cannot be empty")
	}
	filePath := filepath.Join(w.baseDir, fmt.Sprintf("%s.json", jobID))
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read audit record %s: %w", filePath, err)
	}
	var rec Record
	if err := json.Unmarshal(raw, &rec); err != nil {
		return fmt.Errorf("failed to unmarshal audit record %s: %w", filePath, err)
	}
	rec.Feedback = &outcome
	_, err = w.Write(&rec)
	return err
}
