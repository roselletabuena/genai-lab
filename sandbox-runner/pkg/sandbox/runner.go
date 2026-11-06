package sandbox

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
)

var (
	// ErrInvalidRepoPath is returned when the specified repository path does not exist or is not a directory.
	ErrInvalidRepoPath = errors.New("invalid repository path: directory does not exist")

	// ErrEmptyTestCmd is returned when no test command is specified.
	ErrEmptyTestCmd = errors.New("invalid test command: command must not be empty")
)

// Runner orchestrates ephemeral Docker container execution for isolated test runs.
type Runner struct {
	api DockerAPI
}

// NewRunner initializes a new sandbox Runner using the provided DockerAPI implementation.
func NewRunner(api DockerAPI) *Runner {
	return &Runner{api: api}
}

// Run executes the test command in an isolated Docker container according to Config.
func (r *Runner) Run(ctx context.Context, cfg Config) (*RunResult, error) {
	if cfg.RepoPath == "" {
		return nil, ErrInvalidRepoPath
	}

	absPath, err := filepath.Abs(cfg.RepoPath)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidRepoPath, err)
	}

	info, err := os.Stat(absPath)
	if err != nil || !info.IsDir() {
		return nil, ErrInvalidRepoPath
	}

	if len(cfg.TestCmd) == 0 {
		return nil, ErrEmptyTestCmd
	}

	// Apply sensible defaults
	if cfg.Image == "" {
		cfg.Image = "node:24-alpine"
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 60 * time.Second
	}
	if cfg.WorkDir == "" {
		cfg.WorkDir = "/workspace"
	}

	// Host environment variables are strictly NOT passed through (AC4).
	// Only explicit cfg.Env variables are provided.
	containerEnv := make([]string, len(cfg.Env))
	copy(containerEnv, cfg.Env)

	containerConfig := &container.Config{
		Image:           cfg.Image,
		Cmd:             cfg.TestCmd,
		WorkingDir:      cfg.WorkDir,
		Env:             containerEnv,
		NetworkDisabled: cfg.NetworkDisabled,
		Tty:             false, // Non-TTY enables stdcopy header multiplexing for stdout & stderr
	}

	// Host isolation: bind mount only the target repo into cfg.WorkDir (AC4)
	hostConfig := &container.HostConfig{
		Binds:       []string{fmt.Sprintf("%s:%s", absPath, cfg.WorkDir)},
		SecurityOpt: []string{"no-new-privileges:true"},
	}

	createResp, err := r.api.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create sandbox container: %w", err)
	}

	containerID := createResp.ID

	// Always ensure container teardown upon execution completion
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = r.api.ContainerRemove(cleanupCtx, containerID, container.RemoveOptions{
			Force:         true,
			RemoveVolumes: true,
		})
	}()

	if err := r.api.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start sandbox container: %w", err)
	}

	startTime := time.Now()

	// Execution timeout context (AC3)
	execCtx, cancelExec := context.WithTimeout(ctx, cfg.Timeout)
	defer cancelExec()

	statusCh, errCh := r.api.ContainerWait(execCtx, containerID, container.WaitConditionNotRunning)

	var exitCode int
	var timedOut bool
	var execError string

	select {
	case err := <-errCh:
		if err != nil {
			if errors.Is(execCtx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
				timedOut = true
				exitCode = -1
				execError = fmt.Sprintf("execution timeout: exceeded %s", cfg.Timeout)
				_ = r.api.ContainerKill(context.Background(), containerID, "SIGKILL")
			} else {
				return nil, fmt.Errorf("container wait error: %w", err)
			}
		}
	case waitResp := <-statusCh:
		exitCode = int(waitResp.StatusCode)
	case <-execCtx.Done():
		timedOut = true
		exitCode = -1
		execError = fmt.Sprintf("execution timeout: exceeded %s", cfg.Timeout)
		_ = r.api.ContainerKill(context.Background(), containerID, "SIGKILL")
	}

	durationMs := time.Since(startTime).Milliseconds()

	// Collect stdout and stderr logs (AC2)
	var stdoutBuf, stderrBuf bytes.Buffer
	logCtx, cancelLogs := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelLogs()

	logsReader, logErr := r.api.ContainerLogs(logCtx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if logErr == nil && logsReader != nil {
		defer logsReader.Close()
		// Docker stdcopy demultiplexes standard streams
		_, _ = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, logsReader)
		// If stdcopy parsed nothing but reader has data (e.g. raw stream in mock), fallback copy
		if stdoutBuf.Len() == 0 && stderrBuf.Len() == 0 {
			rawBuf := new(bytes.Buffer)
			_, _ = io.Copy(rawBuf, logsReader)
			if rawBuf.Len() > 0 {
				stdoutBuf.Write(rawBuf.Bytes())
			}
		}
	}

	return &RunResult{
		ExitCode:    exitCode,
		Stdout:      stdoutBuf.String(),
		Stderr:      stderrBuf.String(),
		DurationMs:  durationMs,
		TimedOut:    timedOut,
		Error:       execError,
		ContainerID: containerID,
	}, nil
}
