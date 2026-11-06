package sandbox

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/pkg/stdcopy"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

// mockDockerAPI implements DockerAPI for test isolation without requiring a live daemon.
type mockDockerAPI struct {
	createdConfig     *container.Config
	createdHostConfig *container.HostConfig
	createResp        container.CreateResponse
	createErr         error

	startID  string
	startErr error

	waitStatus container.WaitResponse
	waitErr    error
	waitDelay  time.Duration

	logsReader io.ReadCloser
	logsErr    error

	killID     string
	killSignal string
	killErr    error

	removeID  string
	removeErr error
}

func (m *mockDockerAPI) ContainerCreate(
	ctx context.Context,
	config *container.Config,
	hostConfig *container.HostConfig,
	networkingConfig *network.NetworkingConfig,
	platform *v1.Platform,
	containerName string,
) (container.CreateResponse, error) {
	m.createdConfig = config
	m.createdHostConfig = hostConfig
	if m.createErr != nil {
		return container.CreateResponse{}, m.createErr
	}
	return m.createResp, nil
}

func (m *mockDockerAPI) ContainerStart(
	ctx context.Context,
	containerID string,
	options container.StartOptions,
) error {
	m.startID = containerID
	return m.startErr
}

func (m *mockDockerAPI) ContainerWait(
	ctx context.Context,
	containerID string,
	condition container.WaitCondition,
) (<-chan container.WaitResponse, <-chan error) {
	statusCh := make(chan container.WaitResponse, 1)
	errCh := make(chan error, 1)

	go func() {
		if m.waitDelay > 0 {
			select {
			case <-time.After(m.waitDelay):
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			}
		}

		if m.waitErr != nil {
			errCh <- m.waitErr
		} else {
			statusCh <- m.waitStatus
		}
	}()

	return statusCh, errCh
}

func (m *mockDockerAPI) ContainerLogs(
	ctx context.Context,
	container string,
	options container.LogsOptions,
) (io.ReadCloser, error) {
	if m.logsErr != nil {
		return nil, m.logsErr
	}
	return m.logsReader, nil
}

func (m *mockDockerAPI) ContainerKill(
	ctx context.Context,
	containerID string,
	signal string,
) error {
	m.killID = containerID
	m.killSignal = signal
	return m.killErr
}

func (m *mockDockerAPI) ContainerRemove(
	ctx context.Context,
	containerID string,
	options container.RemoveOptions,
) error {
	m.removeID = containerID
	return m.removeErr
}

// helper to create multiplexed Docker log stream bytes using stdcopy header convention
func createDockerLogStream(stdoutText, stderrText string) io.ReadCloser {
	buf := new(bytes.Buffer)
	stdoutWriter := stdcopy.NewStdWriter(buf, stdcopy.Stdout)
	stderrWriter := stdcopy.NewStdWriter(buf, stdcopy.Stderr)

	if len(stdoutText) > 0 {
		_, _ = stdoutWriter.Write([]byte(stdoutText))
	}
	if len(stderrText) > 0 {
		_, _ = stderrWriter.Write([]byte(stderrText))
	}

	return io.NopCloser(buf)
}

func TestSandboxRunner(t *testing.T) {
	// Create a temporary valid directory for repo path tests
	tempDir, err := os.MkdirTemp("", "sandbox-test-repo-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// AC1: Isolated Docker container is spun up with repo mounted and command executed
	t.Run("AC1: Spuns up isolated container with repository mounted and command set", func(t *testing.T) {
		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-12345"},
			waitStatus: container.WaitResponse{StatusCode: 0},
			logsReader: createDockerLogStream("PASS: all tests passed\n", ""),
		}

		runner := NewRunner(mockAPI)
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{"npm", "test"},
			Image:    "node:24-alpine",
			Timeout:  10 * time.Second,
		}

		res, err := runner.Run(context.Background(), cfg)
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		if res.ExitCode != 0 {
			t.Errorf("expected exit code 0, got %d", res.ExitCode)
		}
		if res.ContainerID != "c-12345" {
			t.Errorf("expected container id c-12345, got %s", res.ContainerID)
		}
		if mockAPI.startID != "c-12345" {
			t.Errorf("expected container start for c-12345, got %s", mockAPI.startID)
		}
		if mockAPI.createdConfig.Image != "node:24-alpine" {
			t.Errorf("expected image node:24-alpine, got %s", mockAPI.createdConfig.Image)
		}
		if len(mockAPI.createdConfig.Cmd) != 2 || mockAPI.createdConfig.Cmd[0] != "npm" || mockAPI.createdConfig.Cmd[1] != "test" {
			t.Errorf("expected Cmd ['npm', 'test'], got %v", mockAPI.createdConfig.Cmd)
		}
		if mockAPI.createdConfig.WorkingDir != "/workspace" {
			t.Errorf("expected working dir /workspace, got %s", mockAPI.createdConfig.WorkingDir)
		}

		// Verify removal cleanup
		if mockAPI.removeID != "c-12345" {
			t.Errorf("expected container removal for c-12345, got %s", mockAPI.removeID)
		}
	})

	// AC2: Tests fail -> exit code, stdout, stderr captured in structured JSON envelope
	t.Run("AC2: Captures failing test exit code, stdout, stderr in structured JSON envelope", func(t *testing.T) {
		stdoutMsg := "Running tests...\nFAIL test/app.test.js\n"
		stderrMsg := "AssertionError: expected 200 got 500\n"

		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-failed-test"},
			waitStatus: container.WaitResponse{StatusCode: 1},
			logsReader: createDockerLogStream(stdoutMsg, stderrMsg),
		}

		runner := NewRunner(mockAPI)
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{"npm", "test"},
		}

		res, err := runner.Run(context.Background(), cfg)
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		if res.ExitCode != 1 {
			t.Errorf("expected exit code 1, got %d", res.ExitCode)
		}
		if res.Stdout != stdoutMsg {
			t.Errorf("expected stdout %q, got %q", stdoutMsg, res.Stdout)
		}
		if res.Stderr != stderrMsg {
			t.Errorf("expected stderr %q, got %q", stderrMsg, res.Stderr)
		}
		if res.TimedOut {
			t.Errorf("expected TimedOut to be false, got true")
		}

		// Verify JSON envelope serialization
		jsonBytes, err := json.Marshal(res)
		if err != nil {
			t.Fatalf("failed to marshal JSON envelope: %v", err)
		}

		var envelope RunResult
		if err := json.Unmarshal(jsonBytes, &envelope); err != nil {
			t.Fatalf("failed to unmarshal JSON envelope: %v", err)
		}

		if envelope.ExitCode != 1 || envelope.Stdout != stdoutMsg || envelope.Stderr != stderrMsg {
			t.Errorf("envelope data does not match result: %+v", envelope)
		}
	})

	// AC3: Test hangs -> exceeds configured timeout, killed forcefully, returns timeout error
	t.Run("AC3: Forcefully kills hanging container on timeout and returns timeout error", func(t *testing.T) {
		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-hanging-test"},
			waitDelay:  500 * time.Millisecond, // simulated hang
			logsReader: createDockerLogStream("Starting server...\nWaiting forever...\n", ""),
		}

		runner := NewRunner(mockAPI)
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{"sleep", "100"},
			Timeout:  50 * time.Millisecond, // short timeout
		}

		res, err := runner.Run(context.Background(), cfg)
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		if !res.TimedOut {
			t.Errorf("expected TimedOut true, got false")
		}
		if res.ExitCode != -1 {
			t.Errorf("expected exit code -1 for timed out execution, got %d", res.ExitCode)
		}
		if !strings.Contains(res.Error, "timeout") {
			t.Errorf("expected timeout error message, got %q", res.Error)
		}
		if mockAPI.killID != "c-hanging-test" {
			t.Errorf("expected container kill for c-hanging-test, got %s", mockAPI.killID)
		}
		if mockAPI.killSignal != "SIGKILL" {
			t.Errorf("expected SIGKILL signal, got %s", mockAPI.killSignal)
		}
	})

	// AC4: Host filesystem outside target directory and host environment variables are strictly inaccessible
	t.Run("AC4: Enforces strict host filesystem and environment variable isolation", func(t *testing.T) {
		// Set a dummy host environment variable
		_ = os.Setenv("SECRET_HOST_KEY", "super-secret-host-value")
		defer os.Unsetenv("SECRET_HOST_KEY")

		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-isolated"},
			waitStatus: container.WaitResponse{StatusCode: 0},
			logsReader: createDockerLogStream("isolated", ""),
		}

		runner := NewRunner(mockAPI)
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{"env"},
			Env:      []string{"EXPLICIT_VAR=1"}, // only explicit vars
		}

		_, err := runner.Run(context.Background(), cfg)
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		// Check environment isolation: host env must NOT leak into container
		for _, envVar := range mockAPI.createdConfig.Env {
			if strings.HasPrefix(envVar, "SECRET_HOST_KEY=") {
				t.Errorf("HOST ENVIRONMENT LEAK DETECTED: %s is present in container env", envVar)
			}
		}
		if len(mockAPI.createdConfig.Env) != 1 || mockAPI.createdConfig.Env[0] != "EXPLICIT_VAR=1" {
			t.Errorf("expected only explicit env ['EXPLICIT_VAR=1'], got %v", mockAPI.createdConfig.Env)
		}

		// Check filesystem mount isolation: only tempDir must be mounted to /workspace
		if len(mockAPI.createdHostConfig.Binds) != 1 {
			t.Fatalf("expected exactly 1 bind mount, got %d: %v", len(mockAPI.createdHostConfig.Binds), mockAPI.createdHostConfig.Binds)
		}

		expectedAbs, _ := filepath.Abs(tempDir)
		mountStr := mockAPI.createdHostConfig.Binds[0]
		if !strings.HasPrefix(mountStr, expectedAbs) || !strings.Contains(mountStr, ":/workspace") {
			t.Errorf("expected bind mount pointing %s to :/workspace, got %s", expectedAbs, mountStr)
		}

		// Check security options: no-new-privileges
		hasNoNewPrivileges := false
		for _, opt := range mockAPI.createdHostConfig.SecurityOpt {
			if opt == "no-new-privileges:true" {
				hasNoNewPrivileges = true
			}
		}
		if !hasNoNewPrivileges {
			t.Errorf("expected SecurityOpt 'no-new-privileges:true' in host config, got %v", mockAPI.createdHostConfig.SecurityOpt)
		}
	})

	// Validation tests: invalid repo path or empty test command
	t.Run("Validation: Rejects non-existent repo path", func(t *testing.T) {
		runner := NewRunner(&mockDockerAPI{})
		cfg := Config{
			RepoPath: filepath.Join(tempDir, "does-not-exist"),
			TestCmd:  []string{"npm", "test"},
		}

		_, err := runner.Run(context.Background(), cfg)
		if err == nil {
			t.Fatalf("expected error for non-existent repo path, got nil")
		}
		if !errors.Is(err, ErrInvalidRepoPath) && !strings.Contains(err.Error(), "repo path") {
			t.Errorf("expected ErrInvalidRepoPath, got: %v", err)
		}
	})

	t.Run("Validation: Rejects empty test command", func(t *testing.T) {
		runner := NewRunner(&mockDockerAPI{})
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{},
		}

		_, err := runner.Run(context.Background(), cfg)
		if err == nil {
			t.Fatalf("expected error for empty test command, got nil")
		}
		if !errors.Is(err, ErrEmptyTestCmd) && !strings.Contains(err.Error(), "test command") {
			t.Errorf("expected ErrEmptyTestCmd, got: %v", err)
		}
	})
}
