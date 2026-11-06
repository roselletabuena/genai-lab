package supervisor_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata"
)

func TestSupervisor_GracefulShutdown(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	tempBase, err := os.MkdirTemp("", "sup-wt-shutdown-*")
	if err != nil {
		t.Fatalf("failed to create wt base: %v", err)
	}
	defer os.RemoveAll(tempBase)

	auditDir, err := os.MkdirTemp("", "sup-audit-shutdown-*")
	if err != nil {
		t.Fatalf("failed to create audit base: %v", err)
	}
	defer os.RemoveAll(auditDir)

	mockDocker := &mockDockerAPI{simulateWait: 10 * time.Millisecond}
	runner := sandbox.NewRunner(mockDocker)
	wtMgr := worktree.NewManager(tempBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(auditDir)
	queue := supervisor.NewBoundedQueue(10)

	cfg := supervisor.Config{
		Concurrency: 2,
		TaskTimeout: 2 * time.Second,
		TestCommand: []string{"echo", "ok"},
		Image:       "node:24-alpine",
	}

	sup := supervisor.NewSupervisor(cfg, queue, runner, wtMgr, auditWriter)

	ctx, cancel := context.WithCancel(context.Background())
	sup.Start(ctx)

	// Push 2 jobs
	_ = queue.Push(&supervisor.RemediationJob{
		ID:                "job-shutdown-1",
		RepoURL:           repoDir,
		RepoFullName:      "roselletabuena/genai-lab",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 101,
	})
	_ = queue.Push(&supervisor.RemediationJob{
		ID:                "job-shutdown-2",
		RepoURL:           repoDir,
		RepoFullName:      "roselletabuena/genai-lab",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 102,
	})

	// Cancel context to initiate shutdown
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer shutdownCancel()

	if err := sup.Shutdown(shutdownCtx); err != nil {
		t.Fatalf("supervisor.Shutdown failed: %v", err)
	}

	// Active worktrees should be 0
	activeWTs := wtMgr.PruneAll(context.Background())
	if len(activeWTs) != 0 {
		t.Errorf("expected 0 active worktrees after shutdown, got errors: %v", activeWTs)
	}
}
