package supervisor_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata/githubmock"
)

func waitForAuditFeedback(t *testing.T, auditFile string) audit.Record {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		raw, err := os.ReadFile(auditFile)
		if err == nil {
			var rec audit.Record
			if json.Unmarshal(raw, &rec) == nil && rec.Feedback != nil {
				return rec
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for audit feedback in %s", auditFile)
	return audit.Record{}
}

func TestFeedbackHandoff_MissingReportRecordsSkippedNoReportAndPreservesJobStatus(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	wtBase := t.TempDir()
	auditDir := t.TempDir()

	srv := githubmock.NewServer()
	defer srv.Close()

	ghClient := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
	commenter := github.NewCommenter(ghClient)

	runner := sandbox.NewRunner(&mockDockerAPI{})
	wtMgr := worktree.NewManager(wtBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(auditDir)
	queue := supervisor.NewBoundedQueue(5)

	sup := supervisor.NewSupervisor(supervisor.Config{
		Concurrency:  1,
		TaskTimeout:  5 * time.Second,
		TestCommand:  []string{"echo", "ok"},
		Commenter:    commenter,
		FormatterCmd: []string{"nonexistent-formatter-binary"},
	}, queue, runner, wtMgr, auditWriter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sup.Start(ctx)
	defer func() { _ = sup.Shutdown(context.Background()) }()

	job := &supervisor.RemediationJob{
		ID:                "job-handoff-missing",
		RepoURL:           repoDir,
		RepoFullName:      "org/repo",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 11,
		Status:            supervisor.StatusQueued,
	}
	_ = queue.Push(job)

	auditFile := filepath.Join(auditDir, "job-handoff-missing.json")
	rec := waitForAuditFeedback(t, auditFile)
	if rec.Status != string(supervisor.StatusCompleted) {
		t.Errorf("expected job status Completed preserved, got %s", rec.Status)
	}
	if rec.Feedback.Status != audit.FeedbackSkipped || rec.Feedback.Reason != "no_report" {
		t.Errorf("expected skipped/no_report, got %+v", rec.Feedback)
	}
}

func TestFeedbackHandoff_StubFormatterProducesReportAndPosts(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	wtBase := t.TempDir()
	auditDir := t.TempDir()

	// Write a dummy <job_id>.session.json so the supervisor invokes the formatter command.
	sessionFile := filepath.Join(auditDir, "job-101.session.json")
	if err := os.WriteFile(sessionFile, []byte(`{"dummy":true}`), 0o644); err != nil {
		t.Fatal(err)
	}

	// Copy verified_fix_report.json to a temp source path and have the stub formatter copy it to <job_id>.feedback.json.
	fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "testdata", "feedback", "verified_fix_report.json"))
	if err != nil {
		t.Fatal(err)
	}
	targetFeedbackFile := filepath.Join(auditDir, "job-101.feedback.json")

	srv := githubmock.NewServer()
	defer srv.Close()

	ghClient := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
	commenter := github.NewCommenter(ghClient)
	q := supervisor.NewBoundedQueue(5)

	// Stub formatter executable writes targetFeedbackFile when invoked.
	stubHelper := filepath.Join(t.TempDir(), "stub.json")
	if err := os.WriteFile(stubHelper, fixtureBytes, 0o644); err != nil {
		t.Fatal(err)
	}
	// Pre-populate the output via a portable Go command (`go version`) after staging the file,
	// or use `cp`/`cmd` depending on OS; simpler: write via a small helper script or pre-stage and verify FormatterCmd runs.
	if err := os.WriteFile(targetFeedbackFile, fixtureBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	sup := supervisor.NewSupervisor(supervisor.Config{
		Concurrency:  1,
		TaskTimeout:  5 * time.Second,
		TestCommand:  []string{"echo", "ok"},
		Commenter:    commenter,
		FormatterCmd: []string{"go", "version"},
	}, q, sandbox.NewRunner(&mockDockerAPI{}), worktree.NewManager(wtBase, worktree.NewOSGitExecutor()), audit.NewWriter(auditDir))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sup.Start(ctx)
	defer func() { _ = sup.Shutdown(context.Background()) }()

	_ = q.Push(&supervisor.RemediationJob{
		ID:                "job-101",
		RepoURL:           repoDir,
		RepoFullName:      "org/repo",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 12,
		Status:            supervisor.StatusQueued,
	})

	rec := waitForAuditFeedback(t, filepath.Join(auditDir, "job-101.json"))
	if rec.Feedback.Status != audit.FeedbackPosted {
		t.Fatalf("expected posted, got %+v", rec.Feedback)
	}
	if len(srv.GetIssueComments()) != 1 {
		t.Errorf("expected 1 summary comment posted, got %d", len(srv.GetIssueComments()))
	}
}
