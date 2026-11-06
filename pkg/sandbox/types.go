package sandbox

import (
	"time"
)

// Config defines the execution parameters for a containerized test run.
type Config struct {
	// RepoPath is the host filesystem path to the repository to be mounted.
	RepoPath string `json:"repo_path"`

	// TestCmd is the command and arguments to execute inside the container.
	TestCmd []string `json:"test_cmd"`

	// Image is the Docker container image to execute the test suite in.
	Image string `json:"image"`

	// Timeout is the maximum execution duration before forceful termination.
	Timeout time.Duration `json:"timeout"`

	// WorkDir is the working directory inside the container (defaults to /workspace).
	WorkDir string `json:"work_dir"`

	// Env contains explicit environment variables (KEY=VALUE) passed to the container.
	// Host environment variables are strictly NOT inherited.
	Env []string `json:"env"`

	// NetworkDisabled disables container networking for complete sandbox isolation.
	NetworkDisabled bool `json:"network_disabled"`
}

// RunResult represents the structured JSON envelope returned after test execution.
type RunResult struct {
	ExitCode    int    `json:"exit_code"`
	Stdout      string `json:"stdout"`
	Stderr      string `json:"stderr"`
	DurationMs  int64  `json:"duration_ms"`
	TimedOut    bool   `json:"timed_out"`
	Error       string `json:"error,omitempty"`
	ContainerID string `json:"container_id,omitempty"`
}
