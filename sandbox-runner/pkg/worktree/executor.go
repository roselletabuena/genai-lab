package worktree

import (
	"context"
	"fmt"
	"os/exec"
)

// GitExecutor abstracts git command execution for mocking and process management.
type GitExecutor interface {
	Exec(ctx context.Context, workDir string, args ...string) ([]byte, error)
}

// OSGitExecutor executes git commands using standard os/exec.
type OSGitExecutor struct{}

// NewOSGitExecutor initializes a new OSGitExecutor.
func NewOSGitExecutor() *OSGitExecutor {
	return &OSGitExecutor{}
}

// Exec executes a git command in workDir with the provided arguments and context cancellation.
func (e *OSGitExecutor) Exec(ctx context.Context, workDir string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	if workDir != "" {
		cmd.Dir = workDir
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		return out, fmt.Errorf("git %v failed in %s: %w (output: %s)", args, workDir, err, string(out))
	}

	return out, nil
}
