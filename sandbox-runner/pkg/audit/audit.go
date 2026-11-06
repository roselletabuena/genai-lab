package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Record represents a persistent machine-readable audit envelope of a container remediation run.
type Record struct {
	JobID             string    `json:"job_id"`
	RepoFullName      string    `json:"repo_full_name"`
	PullRequestNumber int       `json:"pull_request_number"`
	CommitSHA         string    `json:"commit_sha"`
	TargetBranch      string    `json:"target_branch,omitempty"`
	Status            string    `json:"status"`
	ExitCode          int       `json:"exit_code"`
	DurationMs        int64     `json:"duration_ms"`
	TimedOut          bool      `json:"timed_out"`
	Stdout            string    `json:"stdout,omitempty"`
	Stderr            string    `json:"stderr,omitempty"`
	Error             string    `json:"error,omitempty"`
	Timestamp         time.Time `json:"timestamp"`
}

// Writer writes audit records to a target filesystem directory.
type Writer struct {
	baseDir string
}

// NewWriter initializes a new audit Writer pointing to baseDir.
func NewWriter(baseDir string) *Writer {
	return &Writer{baseDir: baseDir}
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
