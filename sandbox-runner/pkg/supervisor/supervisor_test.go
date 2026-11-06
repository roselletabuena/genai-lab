package supervisor_test

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata"
)

// mockDockerAPI for supervisor tests
type mockDockerAPI struct {
	sandbox.DockerAPI
	createCount  int32
	activeCount  int32
	maxActive    int32
	simulateWait time.Duration
	lastEnv      []string
}

func (m *mockDockerAPI) ContainerCreate(
	ctx context.Context,
	config *container.Config,
	hostConfig *container.HostConfig,
	networkingConfig *network.NetworkingConfig,
	platform *v1.Platform,
	containerName string,
) (container.CreateResponse, error) {
	atomic.AddInt32(&m.createCount, 1)
	if config != nil {
		m.lastEnv = config.Env
	}
	cur := atomic.AddInt32(&m.activeCount, 1)
	for {
		max := atomic.LoadInt32(&m.maxActive)
		if cur <= max || atomic.CompareAndSwapInt32(&m.maxActive, max, cur) {
			break
		}
	}
	return container.CreateResponse{ID: "mock-container-id"}, nil
}

func (m *mockDockerAPI) ContainerStart(ctx context.Context, containerID string, options container.StartOptions) error {
	return nil
}

func (m *mockDockerAPI) ContainerWait(ctx context.Context, containerID string, condition container.WaitCondition) (<-chan container.WaitResponse, <-chan error) {
	statusCh := make(chan container.WaitResponse, 1)
	errCh := make(chan error, 1)

	go func() {
		defer atomic.AddInt32(&m.activeCount, -1)
		if m.simulateWait > 0 {
			select {
			case <-time.After(m.simulateWait):
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			}
		}
		statusCh <- container.WaitResponse{StatusCode: 0}
	}()

	return statusCh, errCh
}

func (m *mockDockerAPI) ContainerLogs(ctx context.Context, container string, options container.LogsOptions) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(nil)), nil
}

func (m *mockDockerAPI) ContainerKill(ctx context.Context, containerID string, signal string) error {
	return nil
}

func (m *mockDockerAPI) ContainerRemove(ctx context.Context, containerID string, options container.RemoveOptions) error {
	return nil
}

func TestSupervisor_ConcurrentWorkerExecution(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	tempBase, err := os.MkdirTemp("", "sup-wt-*")
	if err != nil {
		t.Fatalf("failed to create wt base: %v", err)
	}
	defer os.RemoveAll(tempBase)

	auditDir, err := os.MkdirTemp("", "sup-audit-*")
	if err != nil {
		t.Fatalf("failed to create audit base: %v", err)
	}
	defer os.RemoveAll(auditDir)

	mockDocker := &mockDockerAPI{simulateWait: 50 * time.Millisecond}
	runner := sandbox.NewRunner(mockDocker)
	wtMgr := worktree.NewManager(tempBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(auditDir)
	queue := supervisor.NewBoundedQueue(10)

	cfg := supervisor.Config{
		Concurrency: 2,
		TaskTimeout: 5 * time.Second,
		TestCommand: []string{"echo", "ok"},
		Image:       "node:24-alpine",
	}

	sup := supervisor.NewSupervisor(cfg, queue, runner, wtMgr, auditWriter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sup.Start(ctx)

	// Push 4 jobs
	for i := 1; i <= 4; i++ {
		job := &supervisor.RemediationJob{
			ID:                "job-test-" + string(rune('0'+i)),
			RepoURL:           repoDir,
			RepoFullName:      "roselletabuena/genai-lab",
			HeadCommitSHA:     "HEAD",
			PullRequestNumber: 50 + i,
			Status:            supervisor.StatusQueued,
		}
		_ = queue.Push(job)
	}

	// Wait for all 4 jobs to complete
	deadline := time.Now().Add(5 * time.Second)
	for {
		files, _ := os.ReadDir(auditDir)
		if len(files) == 4 || time.Now().After(deadline) {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	files, err := os.ReadDir(auditDir)
	if err != nil || len(files) != 4 {
		t.Fatalf("expected 4 audit records in %s, found %d", auditDir, len(files))
	}

	// Max active containers should not exceed concurrency limit of 2
	maxActive := atomic.LoadInt32(&mockDocker.maxActive)
	if maxActive > 2 {
		t.Errorf("expected max active containers <= 2, got %d", maxActive)
	}

	_ = sup.Shutdown(context.Background())
}

func TestSupervisor_TaskTimeoutEnforcement(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	tempBase, err := os.MkdirTemp("", "sup-wt-timeout-*")
	if err != nil {
		t.Fatalf("failed to create wt base: %v", err)
	}
	defer os.RemoveAll(tempBase)

	auditDir, err := os.MkdirTemp("", "sup-audit-timeout-*")
	if err != nil {
		t.Fatalf("failed to create audit base: %v", err)
	}
	defer os.RemoveAll(auditDir)

	// Docker wait will simulate a 2-second freeze
	mockDocker := &mockDockerAPI{simulateWait: 2 * time.Second}
	runner := sandbox.NewRunner(mockDocker)
	wtMgr := worktree.NewManager(tempBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(auditDir)
	queue := supervisor.NewBoundedQueue(5)

	// Task timeout set to 50 milliseconds
	cfg := supervisor.Config{
		Concurrency: 1,
		TaskTimeout: 50 * time.Millisecond,
		TestCommand: []string{"echo", "ok"},
		Image:       "node:24-alpine",
	}

	sup := supervisor.NewSupervisor(cfg, queue, runner, wtMgr, auditWriter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sup.Start(ctx)

	job := &supervisor.RemediationJob{
		ID:                "job-timeout-1",
		RepoURL:           repoDir,
		RepoFullName:      "roselletabuena/genai-lab",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 99,
		Status:            supervisor.StatusQueued,
	}
	_ = queue.Push(job)

	// Wait for audit file
	time.Sleep(300 * time.Millisecond)

	auditFile := filepath.Join(auditDir, "job-timeout-1.json")
	if _, err := os.Stat(auditFile); err != nil {
		t.Fatalf("expected audit file for timed out job: %v", err)
	}

	_ = sup.Shutdown(context.Background())
}

func TestSupervisor_MockLLMEnvironmentInjection(t *testing.T) {
	repoDir, cleanupRepo := testdata.CreateTestGitRepo(t)
	defer cleanupRepo()

	tempBase, err := os.MkdirTemp("", "sup-wt-mockllm-*")
	if err != nil {
		t.Fatalf("failed to create wt base: %v", err)
	}
	defer os.RemoveAll(tempBase)

	auditDir, err := os.MkdirTemp("", "sup-audit-mockllm-*")
	if err != nil {
		t.Fatalf("failed to create audit base: %v", err)
	}
	defer os.RemoveAll(auditDir)

	mockDocker := &mockDockerAPI{}
	runner := sandbox.NewRunner(mockDocker)
	wtMgr := worktree.NewManager(tempBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(auditDir)
	queue := supervisor.NewBoundedQueue(5)

	cfg := supervisor.Config{
		Concurrency: 1,
		TaskTimeout: 5 * time.Second,
		TestCommand: []string{"remediation-agent", "run", "--cmd", "npm test", "--mock-llm"},
		Image:       "node:24-alpine",
		MockLLM:     true,
	}

	sup := supervisor.NewSupervisor(cfg, queue, runner, wtMgr, auditWriter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sup.Start(ctx)

	job := &supervisor.RemediationJob{
		ID:                "job-mockllm-1",
		RepoURL:           repoDir,
		RepoFullName:      "roselletabuena/genai-lab",
		HeadCommitSHA:     "HEAD",
		PullRequestNumber: 58,
		Status:            supervisor.StatusQueued,
	}
	_ = queue.Push(job)

	deadline := time.Now().Add(3 * time.Second)
	auditFile := filepath.Join(auditDir, "job-mockllm-1.json")
	for {
		if _, err := os.Stat(auditFile); err == nil || time.Now().After(deadline) {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	if _, err := os.Stat(auditFile); err != nil {
		t.Fatalf("expected audit file for mock-llm job: %v", err)
	}

	foundMockLLMEnv := false
	for _, envVar := range mockDocker.lastEnv {
		if envVar == "MOCK_LLM=true" {
			foundMockLLMEnv = true
			break
		}
	}
	if !foundMockLLMEnv {
		t.Errorf("expected MOCK_LLM=true in container env when MockLLM is enabled, got %v", mockDocker.lastEnv)
	}

	_ = sup.Shutdown(context.Background())
}
