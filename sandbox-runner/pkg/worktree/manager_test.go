package worktree_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata"
)

type mockGitExecutor struct {
	execFn func(ctx context.Context, workDir string, args ...string) ([]byte, error)
	calls  [][]string
}

func (m *mockGitExecutor) Exec(ctx context.Context, workDir string, args ...string) ([]byte, error) {
	m.calls = append(m.calls, args)
	if m.execFn != nil {
		return m.execFn(ctx, workDir, args...)
	}
	return []byte("ok"), nil
}

func TestWorktreeManager_Create_And_Prune_Mock(t *testing.T) {
	tempBase, err := os.MkdirTemp("", "wt-base-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempBase)

	mockGit := &mockGitExecutor{}
	mgr := worktree.NewManager(tempBase, mockGit)
	ctx := context.Background()

	wt, err := mgr.Create(ctx, "/repo/base", "c9a8f21e0123456789abcdef0123456789abcdef", "job-pr55-abc")
	if err != nil {
		t.Fatalf("unexpected error creating worktree: %v", err)
	}

	if wt.JobID != "job-pr55-abc" {
		t.Errorf("unexpected job ID: %s", wt.JobID)
	}
	expectedPath := filepath.Join(tempBase, "job-pr55-abc")
	if wt.WorktreePath != expectedPath {
		t.Errorf("expected worktree path %s, got %s", expectedPath, wt.WorktreePath)
	}

	// Verify git command arguments: git worktree add --detach <path> <commit>
	if len(mockGit.calls) == 0 {
		t.Fatalf("expected git worktree add command to be executed")
	}
	addCall := mockGit.calls[0]
	if addCall[0] != "worktree" || addCall[1] != "add" || addCall[2] != "--detach" {
		t.Errorf("unexpected git command arguments: %v", addCall)
	}

	// Now prune
	if err := mgr.Prune(ctx, wt); err != nil {
		t.Fatalf("unexpected error pruning worktree: %v", err)
	}
	if !wt.CleanedUp {
		t.Errorf("expected wt.CleanedUp to be true")
	}

	// Verify git worktree remove was called
	foundRemove := false
	for _, call := range mockGit.calls {
		if len(call) >= 3 && call[0] == "worktree" && call[1] == "remove" {
			foundRemove = true
			break
		}
	}
	if !foundRemove {
		t.Errorf("expected git worktree remove to be called")
	}
}

func TestWorktreeManager_Create_ValidationErrors(t *testing.T) {
	mgr := worktree.NewManager("/tmp/wt", &mockGitExecutor{})
	ctx := context.Background()

	if _, err := mgr.Create(ctx, "", "sha", "job1"); err == nil {
		t.Errorf("expected error on empty repoPath")
	}
	if _, err := mgr.Create(ctx, "/repo", "", "job1"); err == nil {
		t.Errorf("expected error on empty commitSHA")
	}
	if _, err := mgr.Create(ctx, "/repo", "sha", ""); err == nil {
		t.Errorf("expected error on empty jobID")
	}
}

func TestWorktreeManager_Integration_RealGit(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	wtBase, err := os.MkdirTemp("", "wt-real-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(wtBase)

	executor := worktree.NewOSGitExecutor()
	ctx := context.Background()

	// Get latest commit SHA from repo
	out, err := executor.Exec(ctx, repoDir, "rev-parse", "HEAD")
	if err != nil {
		t.Fatalf("failed to get HEAD sha: %v", err)
	}
	commitSHA := strings.TrimSpace(string(out))

	mgr := worktree.NewManager(wtBase, executor)
	wt, err := mgr.Create(ctx, repoDir, commitSHA, "job-real-001")
	if err != nil {
		t.Fatalf("failed to create real worktree: %v", err)
	}

	// Verify README.md exists in worktree
	readmeInWt := filepath.Join(wt.WorktreePath, "README.md")
	if _, err := os.Stat(readmeInWt); err != nil {
		t.Fatalf("expected README.md in worktree directory: %v", err)
	}

	// Prune real worktree
	if err := mgr.Prune(ctx, wt); err != nil {
		t.Fatalf("failed to prune real worktree: %v", err)
	}

	// Verify worktree directory is removed
	if _, err := os.Stat(wt.WorktreePath); !os.IsNotExist(err) {
		t.Fatalf("expected worktree directory to be removed, but still exists")
	}
}
