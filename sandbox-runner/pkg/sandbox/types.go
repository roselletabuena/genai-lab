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

	// NetworkDisabled disables container networking (--network=none) for complete sandbox isolation.
	// Defaults to true for test executions unless AllowNetwork is explicitly set.
	NetworkDisabled bool `json:"network_disabled"`

	// AllowNetwork explicitly opts into container network access (e.g., for pre-test dependency setup).
	// When false (default), ApplySecurityDefaults enforces NetworkDisabled=true (--network=none).
	AllowNetwork bool `json:"allow_network,omitempty"`

	// MemoryLimitBytes caps container RAM in bytes (defaults and caps to 512 MB).
	MemoryLimitBytes int64 `json:"memory_limit_bytes,omitempty"`

	// NanoCPUs caps container CPU quota in units of 10^-9 CPUs (defaults and caps to 1.0 core = 1e9).
	NanoCPUs int64 `json:"nano_cpus,omitempty"`

	// User specifies the non-root UID:GID under which the container process runs (defaults to "1000:1000").
	User string `json:"user,omitempty"`
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
