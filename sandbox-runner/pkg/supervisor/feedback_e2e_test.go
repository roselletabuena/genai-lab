package supervisor_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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

func TestEndToEndFeedback(t *testing.T) {
	t.Run("verified", func(t *testing.T) {
		repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
		defer cleanupRepo()

		wtBase := t.TempDir()
		auditDir := t.TempDir()

		srv := githubmock.NewServer()
		defer srv.Close()
		srv.PRFiles = []githubmock.PRFile{
			{Filename: "src/math_utils.py", Patch: "@@ -5,5 +5,5 @@\n context\n"},
		}

		// Pre-stage <job_id>.feedback.json from fixture so supervisor posts it upon completion.
		fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "testdata", "feedback", "suggestion_report.json"))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(auditDir, "job-102.feedback.json"), fixtureBytes, 0o644); err != nil {
			t.Fatal(err)
		}

		ghClient := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
		commenter := github.NewCommenter(ghClient)

		sup := supervisor.NewSupervisor(supervisor.Config{
			Concurrency: 1,
			TaskTimeout: 5 * time.Second,
			TestCommand: []string{"echo", "ok"},
			Commenter:   commenter,
		}, supervisor.NewBoundedQueue(5), sandbox.NewRunner(&mockDockerAPI{}), worktree.NewManager(wtBase, worktree.NewOSGitExecutor()), audit.NewWriter(auditDir))

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		sup.Start(ctx)
		defer func() { _ = sup.Shutdown(context.Background()) }()

		start := time.Now()
		job := &supervisor.RemediationJob{
			ID:                "job-102",
			RepoURL:           repoDir,
			RepoFullName:      "org/repo",
			HeadCommitSHA:     "HEAD",
			PullRequestNumber: 21,
			Status:            supervisor.StatusQueued,
		}
		_ = os.MkdirAll(auditDir, 0o755)
		q := supervisor.NewBoundedQueue(5)
		sup2 := supervisor.NewSupervisor(supervisor.Config{
			Concurrency: 1,
			TaskTimeout: 5 * time.Second,
			TestCommand: []string{"echo", "ok"},
			Commenter:   commenter,
		}, q, sandbox.NewRunner(&mockDockerAPI{}), worktree.NewManager(wtBase, worktree.NewOSGitExecutor()), audit.NewWriter(auditDir))
		sup2.Start(ctx)
		defer func() { _ = sup2.Shutdown(context.Background()) }()
		_ = q.Push(job)

		rec := waitForAuditFeedback(t, filepath.Join(auditDir, "job-102.json"))
		elapsed := time.Since(start)
		if elapsed > 30*time.Second {
			t.Errorf("SC-004 violated: normal path took %v (> 30s)", elapsed)
		}
		if rec.Feedback.Status != audit.FeedbackPosted {
			t.Fatalf("expected feedback.status=posted, got %+v", rec.Feedback)
		}
		if len(srv.GetIssueComments()) != 1 || len(srv.GetReviewComments()) != 1 {
			t.Errorf("expected 1 summary comment and 1 suggestion comment, got %d and %d",
				len(srv.GetIssueComments()), len(srv.GetReviewComments()))
		}
	})

	t.Run("failed", func(t *testing.T) {
		repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
		defer cleanupRepo()

		wtBase := t.TempDir()
		auditDir := t.TempDir()

		srv := githubmock.NewServer()
		defer srv.Close()

		fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "testdata", "feedback", "failed_report.json"))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(auditDir, "job-200.feedback.json"), fixtureBytes, 0o644); err != nil {
			t.Fatal(err)
		}

		ghClient := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
		commenter := github.NewCommenter(ghClient)
		q := supervisor.NewBoundedQueue(5)

		sup := supervisor.NewSupervisor(supervisor.Config{
			Concurrency: 1,
			TaskTimeout: 5 * time.Second,
			TestCommand: []string{"echo", "ok"},
			Commenter:   commenter,
		}, q, sandbox.NewRunner(&mockDockerAPI{}), worktree.NewManager(wtBase, worktree.NewOSGitExecutor()), audit.NewWriter(auditDir))

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		sup.Start(ctx)
		defer func() { _ = sup.Shutdown(context.Background()) }()

		_ = q.Push(&supervisor.RemediationJob{
			ID:                "job-200",
			RepoURL:           repoDir,
			RepoFullName:      "org/repo",
			HeadCommitSHA:     "HEAD",
			PullRequestNumber: 22,
			Status:            supervisor.StatusQueued,
		})

		rec := waitForAuditFeedback(t, filepath.Join(auditDir, "job-200.json"))
		if rec.Feedback.Status != audit.FeedbackPosted {
			t.Fatalf("expected feedback.status=posted, got %+v", rec.Feedback)
		}
		issues := srv.GetIssueComments()
		if len(issues) != 1 {
			t.Fatalf("expected 1 failure comment, got %d", len(issues))
		}
		if strings.Contains(issues[0].Body, "```diff") || strings.Contains(issues[0].Body, "```suggestion") {
			t.Errorf("failed comment must never propose code: %s", issues[0].Body)
		}
		if len(srv.GetReviewComments()) != 0 {
			t.Errorf("expected 0 suggestion review comments on failure, got %d", len(srv.GetReviewComments()))
		}
	})
}
