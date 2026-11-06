package webhook_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
)

func TestParseEvent_CheckRunFailure(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_failure.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	event, shouldRemediate, err := webhook.ParseEvent("check_run", "deliv-123", "sha256=dummy", data)
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if !shouldRemediate {
		t.Fatalf("expected check_run failure to trigger remediation")
	}
	if event.PullRequestNumber != 55 {
		t.Errorf("expected PR number 55, got %d", event.PullRequestNumber)
	}
	if event.HeadCommitSHA != "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2" {
		t.Errorf("unexpected commit SHA: %s", event.HeadCommitSHA)
	}
	if event.TargetBranch != "feat/GL-55-webhook-worktree-supervisor" {
		t.Errorf("unexpected target branch: %s", event.TargetBranch)
	}
	if event.CheckRunConclusion != "failure" {
		t.Errorf("unexpected conclusion: %s", event.CheckRunConclusion)
	}
}

func TestParseEvent_CheckRunSuccess_Ignored(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_success.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	_, shouldRemediate, err := webhook.ParseEvent("check_run", "deliv-124", "sha256=dummy", data)
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if shouldRemediate {
		t.Fatalf("expected check_run success NOT to trigger remediation")
	}
}

func TestParseEvent_WorkflowRunFailure(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "workflow_run_failure.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	event, shouldRemediate, err := webhook.ParseEvent("workflow_run", "deliv-125", "sha256=dummy", data)
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if !shouldRemediate {
		t.Fatalf("expected workflow_run failure to trigger remediation")
	}
	if event.PullRequestNumber != 55 {
		t.Errorf("expected PR number 55, got %d", event.PullRequestNumber)
	}
}

func TestParseEvent_UnknownEvent_Ignored(t *testing.T) {
	data := []byte(`{"zen":"Keep it logically awesome."}`)
	_, shouldRemediate, err := webhook.ParseEvent("ping", "deliv-ping", "sha256=dummy", data)
	if err != nil {
		t.Fatalf("ping event should parse without error: %v", err)
	}
	if shouldRemediate {
		t.Fatalf("ping event should NOT trigger remediation")
	}
}

func TestParseEvent_MalformedJSON(t *testing.T) {
	_, _, err := webhook.ParseEvent("check_run", "deliv-err", "sha256=dummy", []byte(`{invalid-json`))
	if err == nil {
		t.Fatalf("expected error on malformed JSON, got nil")
	}
}
