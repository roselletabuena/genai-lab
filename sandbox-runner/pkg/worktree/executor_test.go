package worktree_test

import (
	"context"
	"strings"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata"
)

func TestOSGitExecutor_Exec(t *testing.T) {
	repoDir, cleanup := testdata.CreateTestGitRepo(t)
	defer cleanup()

	executor := worktree.NewOSGitExecutor()
	ctx := context.Background()

	out, err := executor.Exec(ctx, repoDir, "status", "--porcelain")
	if err != nil {
		t.Fatalf("unexpected git exec error: %v, out: %s", err, string(out))
	}
	if strings.TrimSpace(string(out)) != "" {
		t.Errorf("expected clean git status, got %s", string(out))
	}
}

func TestOSGitExecutor_CommandError(t *testing.T) {
	executor := worktree.NewOSGitExecutor()
	ctx := context.Background()

	_, err := executor.Exec(ctx, ".", "invalid-git-subcommand-xyz")
	if err == nil {
		t.Fatalf("expected error on invalid git command, got nil")
	}
}
