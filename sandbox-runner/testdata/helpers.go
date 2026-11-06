package testdata

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// CreateTestGitRepo initializes a temporary git repository with an initial commit for testing.
// Returns the absolute path to the created repository and a cleanup function.
func CreateTestGitRepo(t *testing.T) (string, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "genai-lab-test-git-*")
	if err != nil {
		t.Fatalf("failed to create temp git dir: %v", err)
	}

	cleanup := func() {
		_ = os.RemoveAll(dir)
	}

	runGit := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=Test Runner",
			"GIT_AUTHOR_EMAIL=test@genai-lab.local",
			"GIT_COMMITTER_NAME=Test Runner",
			"GIT_COMMITTER_EMAIL=test@genai-lab.local",
		)
		out, err := cmd.CombinedOutput()
		if err != nil {
			cleanup()
			t.Fatalf("git command failed (%v): %s", err, string(out))
		}
	}

	runGit("init")
	runGit("config", "user.name", "Test Runner")
	runGit("config", "user.email", "test@genai-lab.local")

	readme := filepath.Join(dir, "README.md")
	if err := os.WriteFile(readme, []byte("# Test Repo\n"), 0o644); err != nil {
		cleanup()
		t.Fatalf("failed to write README.md: %v", err)
	}

	runGit("add", "README.md")
	runGit("commit", "-m", "initial commit")

	return dir, cleanup
}
