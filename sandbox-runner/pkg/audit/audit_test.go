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
