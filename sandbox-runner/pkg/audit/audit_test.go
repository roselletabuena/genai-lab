package audit_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
)

func TestAuditWriter_Write_Success(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "audit-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	writer := audit.NewWriter(tempDir)

	rec := &audit.Record{
		JobID:             "job-pr55-abc1234",
		RepoFullName:      "roselletabuena/genai-lab",
		PullRequestNumber: 55,
		CommitSHA:         "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
		TargetBranch:      "feat/GL-55",
		Status:            "Completed",
		ExitCode:          0,
		DurationMs:        450,
		TimedOut:          false,
		Stdout:            "All 5 tests passed",
		Stderr:            "",
		Timestamp:         time.Now().UTC(),
	}

	filePath, err := writer.Write(rec)
	if err != nil {
		t.Fatalf("writer.Write returned unexpected error: %v", err)
	}

	expectedPath := filepath.Join(tempDir, "job-pr55-abc1234.json")
	if filePath != expectedPath {
		t.Errorf("expected file path %s, got %s", expectedPath, filePath)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read persisted audit file: %v", err)
	}

	var parsed audit.Record
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal written audit JSON: %v", err)
	}

	if parsed.JobID != rec.JobID || parsed.Status != "Completed" || parsed.ExitCode != 0 {
		t.Errorf("unmarshaled record does not match written record: %+v", parsed)
	}
}

func TestAuditWriter_Write_ValidationErrors(t *testing.T) {
	writer := audit.NewWriter("/tmp/dummy")

	if _, err := writer.Write(nil); err == nil {
		t.Errorf("expected error for nil record, got nil")
	}

	if _, err := writer.Write(&audit.Record{}); err == nil {
		t.Errorf("expected error for empty JobID, got nil")
	}
}

func TestAuditWriter_FeedbackOmittedWhenNilAndPersistedOnUpdate(t *testing.T) {
	tempDir := t.TempDir()
	writer := audit.NewWriter(tempDir)

	rec := &audit.Record{
		JobID:             "job-fb-1",
		RepoFullName:      "org/repo",
		PullRequestNumber: 12,
		CommitSHA:         "deadbeef",
		Status:            "Completed",
		ExitCode:          0,
		DurationMs:        120,
		Timestamp:         time.Now().UTC(),
	}
	filePath, err := writer.Write(rec)
	if err != nil {
		t.Fatalf("Write failed: %v", err)
	}

	raw, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	var rawMap map[string]any
	if err := json.Unmarshal(raw, &rawMap); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if _, hasFeedback := rawMap["feedback"]; hasFeedback {
		t.Errorf("expected feedback field omitted when nil, got %v", rawMap["feedback"])
	}

	summaryID := int64(9001)
	suggID := int64(9002)
	outcome := audit.FeedbackOutcome{
		Status:              audit.FeedbackPosted,
		SummaryCommentID:    &summaryID,
		SuggestionCommentID: &suggID,
		Attempts:            1,
	}
	if err := writer.Update("job-fb-1", outcome); err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	updatedRaw, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("ReadFile after Update failed: %v", err)
	}
	var updated audit.Record
	if err := json.Unmarshal(updatedRaw, &updated); err != nil {
		t.Fatalf("Unmarshal updated failed: %v", err)
	}
	if updated.Feedback == nil {
		t.Fatalf("expected Feedback populated after Update")
	}
	if updated.Feedback.Status != audit.FeedbackPosted || updated.Feedback.Attempts != 1 {
		t.Errorf("unexpected Feedback: %+v", updated.Feedback)
	}
	if updated.Feedback.SummaryCommentID == nil || *updated.Feedback.SummaryCommentID != 9001 {
		t.Errorf("unexpected SummaryCommentID: %v", updated.Feedback.SummaryCommentID)
	}
	if updated.Feedback.SuggestionCommentID == nil || *updated.Feedback.SuggestionCommentID != 9002 {
		t.Errorf("unexpected SuggestionCommentID: %v", updated.Feedback.SuggestionCommentID)
	}
}
