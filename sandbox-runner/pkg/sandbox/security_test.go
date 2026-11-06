package sandbox

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
)

func TestSecurityGuardrails(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "sandbox-sec-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// AC1: Given container configuration, when instantiated, then memory is capped at 512 MB and CPU quota is restricted to 1.0 cores.
	t.Run("AC1: Enforces 512 MB memory cap and 1.0 CPU core quota in HostConfig", func(t *testing.T) {
		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-sec-quotas"},
			waitStatus: container.WaitResponse{StatusCode: 0},
			logsReader: createDockerLogStream("ok\n", ""),
		}

		runner := NewRunner(mockAPI)
		_, err := runner.Run(context.Background(), Config{
			RepoPath: tempDir,
			TestCmd:  []string{"npm", "test"},
		})
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		res := mockAPI.createdHostConfig.Resources
		expectedMem := int64(512 * 1024 * 1024)
		if res.Memory != expectedMem {
			t.Errorf("expected Memory limit %d (512 MB), got %d", expectedMem, res.Memory)
		}
		if res.MemorySwap != expectedMem {
			t.Errorf("expected MemorySwap limit %d (512 MB), got %d", expectedMem, res.MemorySwap)
		}

		expectedNanoCPUs := int64(1_000_000_000)
		if res.NanoCPUs != expectedNanoCPUs {
			t.Errorf("expected NanoCPUs %d (1.0 core), got %d", expectedNanoCPUs, res.NanoCPUs)
		}
		if res.CPUPeriod != 100_000 {
			t.Errorf("expected CPUPeriod 100000, got %d", res.CPUPeriod)
		}
		if res.CPUQuota != 100_000 {
			t.Errorf("expected CPUQuota 100000 (1.0 core), got %d", res.CPUQuota)
		}
	})

	t.Run("AC1: Clamps excessive memory or CPU requests to 512 MB and 1.0 core ceilings", func(t *testing.T) {
		cfg := Config{
			RepoPath:         tempDir,
			TestCmd:          []string{"npm", "test"},
			MemoryLimitBytes: 4 * 1024 * 1024 * 1024, // 4 GB attempt
			NanoCPUs:         8_000_000_000,          // 8 cores attempt
		}

		hostCfg := BuildHostConfig(tempDir, cfg)
		if hostCfg.Resources.Memory != DefaultMemoryLimitBytes {
			t.Errorf("expected excessive Memory to be clamped to %d, got %d", DefaultMemoryLimitBytes, hostCfg.Resources.Memory)
		}
		if hostCfg.Resources.NanoCPUs != DefaultNanoCPUs {
			t.Errorf("expected excessive NanoCPUs to be clamped to %d, got %d", DefaultNanoCPUs, hostCfg.Resources.NanoCPUs)
		}
		if hostCfg.Resources.CPUQuota != DefaultCPUQuotaMicros {
			t.Errorf("expected excessive CPUQuota to be clamped to %d, got %d", DefaultCPUQuotaMicros, hostCfg.Resources.CPUQuota)
		}
	})

	// AC2: Given repository dependency resolution is complete, when running test executions,
	// then container networking is set to none (--network=none) and runs without root privileges.
	t.Run("AC2: Enforces --network=none and non-root UID execution by default", func(t *testing.T) {
		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-sec-net"},
			waitStatus: container.WaitResponse{StatusCode: 0},
			logsReader: createDockerLogStream("ok\n", ""),
		}

		runner := NewRunner(mockAPI)
		_, err := runner.Run(context.Background(), Config{
			RepoPath: tempDir,
			TestCmd:  []string{"npm", "test"},
		})
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		if !mockAPI.createdConfig.NetworkDisabled {
			t.Errorf("expected container.Config.NetworkDisabled to be true")
		}
		if mockAPI.createdHostConfig.NetworkMode != NetworkModeNone {
			t.Errorf("expected HostConfig.NetworkMode %q, got %q", NetworkModeNone, mockAPI.createdHostConfig.NetworkMode)
		}
		if mockAPI.createdConfig.User != DefaultNonRootUser {
			t.Errorf("expected non-root User %q, got %q", DefaultNonRootUser, mockAPI.createdConfig.User)
		}
	})

	t.Run("AC2: Rejects root user specifications and enforces non-root UID fallback", func(t *testing.T) {
		for _, rootSpec := range []string{"", "0", "0:0", "root", "root:root", " 0:1000 "} {
			cfg := BuildContainerConfig(Config{
				RepoPath: tempDir,
				TestCmd:  []string{"id"},
				User:     rootSpec,
			})
			if cfg.User != DefaultNonRootUser {
				t.Errorf("for user spec %q, expected fallback to %q, got %q", rootSpec, DefaultNonRootUser, cfg.User)
			}
		}

		// Custom non-root UID should be preserved
		customCfg := BuildContainerConfig(Config{
			RepoPath: tempDir,
			TestCmd:  []string{"id"},
			User:     "65532:65532",
		})
		if customCfg.User != "65532:65532" {
			t.Errorf("expected custom non-root UID '65532:65532' to be preserved, got %q", customCfg.User)
		}
	})

	// AC3: Given malicious test payloads attempting environment variable exfiltration or host traversal,
	// then no host secrets or outer filesystems are accessible.
	t.Run("AC3: Blocks host env exfiltration, null-byte env injection, and outer filesystem traversal", func(t *testing.T) {
		_ = os.Setenv("AWS_SECRET_ACCESS_KEY", "top-secret-aws-token")
		_ = os.Setenv("GITHUB_TOKEN", "ghp_supersecret")
		defer os.Unsetenv("AWS_SECRET_ACCESS_KEY")
		defer os.Unsetenv("GITHUB_TOKEN")

		// Attempt relative path traversal in RepoPath
		nestedRepo := filepath.Join(tempDir, "subdir", "..")
		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-sec-traversal"},
			waitStatus: container.WaitResponse{StatusCode: 0},
			logsReader: createDockerLogStream("clean\n", ""),
		}

		runner := NewRunner(mockAPI)
		_, err := runner.Run(context.Background(), Config{
			RepoPath: nestedRepo,
			TestCmd:  []string{"sh", "-c", "env && ls -la .."},
			Env: []string{
				"NODE_ENV=test",
				"MALICIOUS_NULL=foo\x00bar",
				"INVALID_NO_EQUALS",
				"=EMPTY_KEY",
			},
		})
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}

		// Only sanitized explicit env var must be present
		if len(mockAPI.createdConfig.Env) != 1 || mockAPI.createdConfig.Env[0] != "NODE_ENV=test" {
			t.Errorf("expected only ['NODE_ENV=test'], got %v", mockAPI.createdConfig.Env)
		}

		for _, env := range mockAPI.createdConfig.Env {
			if strings.Contains(env, "AWS_SECRET_ACCESS_KEY") || strings.Contains(env, "GITHUB_TOKEN") {
				t.Errorf("host secret leaked into container env: %s", env)
			}
		}

		// Verify bind mount is canonicalized to tempDir -> /workspace only
		if len(mockAPI.createdHostConfig.Binds) != 1 {
			t.Fatalf("expected 1 bind mount, got %v", mockAPI.createdHostConfig.Binds)
		}
		expectedBind := filepath.Clean(tempDir) + ":/workspace"
		if mockAPI.createdHostConfig.Binds[0] != expectedBind {
			t.Errorf("expected canonical bind %q, got %q", expectedBind, mockAPI.createdHostConfig.Binds[0])
		}

		// Verify Linux capabilities are dropped and privilege escalation is disabled
		if len(mockAPI.createdHostConfig.CapDrop) != 1 || mockAPI.createdHostConfig.CapDrop[0] != "ALL" {
			t.Errorf("expected CapDrop ['ALL'], got %v", mockAPI.createdHostConfig.CapDrop)
		}
	})

	// AC4: Given execution bounds, when any test command runs longer than 60 seconds, then SIGKILL is issued immediately.
	t.Run("AC4: Caps execution timeout at 60 seconds maximum and issues SIGKILL on timeout", func(t *testing.T) {
		cfg := Config{
			RepoPath: tempDir,
			TestCmd:  []string{"sleep", "120"},
			Timeout:  5 * time.Minute, // Attempt to exceed 60s bound
		}
		ApplySecurityDefaults(&cfg)
		if cfg.Timeout != 60*time.Second {
			t.Errorf("expected timeout >60s to be capped at 60s, got %v", cfg.Timeout)
		}

		mockAPI := &mockDockerAPI{
			createResp: container.CreateResponse{ID: "c-sec-timeout"},
			waitDelay:  250 * time.Millisecond,
			logsReader: createDockerLogStream("", ""),
		}
		runner := NewRunner(mockAPI)
		res, err := runner.Run(context.Background(), Config{
			RepoPath: tempDir,
			TestCmd:  []string{"sleep", "120"},
			Timeout:  40 * time.Millisecond,
		})
		if err != nil {
			t.Fatalf("unexpected runner error: %v", err)
		}
		if !res.TimedOut {
			t.Errorf("expected TimedOut=true")
		}
		if mockAPI.killID != "c-sec-timeout" || mockAPI.killSignal != "SIGKILL" {
			t.Errorf("expected immediate SIGKILL on c-sec-timeout, got id=%q sig=%q", mockAPI.killID, mockAPI.killSignal)
		}
	})
}
