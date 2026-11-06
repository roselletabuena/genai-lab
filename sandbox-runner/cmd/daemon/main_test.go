package main

import (
	"flag"
	"os"
	"testing"
	"time"
)

func TestParseConfig_Defaults(t *testing.T) {
	// Set required secret env
	_ = os.Setenv("GITHUB_WEBHOOK_SECRET", "test-secret")
	defer os.Unsetenv("GITHUB_WEBHOOK_SECRET")

	fs := flag.NewFlagSet("daemon", flag.ContinueOnError)
	cfg, err := parseConfig(fs, []string{})
	if err != nil {
		t.Fatalf("unexpected error parsing default config: %v", err)
	}

	if cfg.Port != 8080 {
		t.Errorf("expected default port 8080, got %d", cfg.Port)
	}
	if cfg.Secret != "test-secret" {
		t.Errorf("expected secret from env, got %s", cfg.Secret)
	}
	if cfg.Concurrency != 3 {
		t.Errorf("expected default concurrency 3, got %d", cfg.Concurrency)
	}
	if cfg.QueueCapacity != 50 {
		t.Errorf("expected default queue capacity 50, got %d", cfg.QueueCapacity)
	}
	if cfg.TaskTimeout != 10*time.Minute {
		t.Errorf("expected default timeout 10m, got %v", cfg.TaskTimeout)
	}
	if cfg.MockLLM != false {
		t.Errorf("expected default MockLLM false, got %v", cfg.MockLLM)
	}
}

func TestParseConfig_FlagsOverride(t *testing.T) {
	fs := flag.NewFlagSet("daemon", flag.ContinueOnError)
	args := []string{
		"--port=9090",
		"--secret=flag-secret",
		"--concurrency=5",
		"--queue-size=100",
		"--timeout=5m",
		"--repo=/custom/repo",
		"--worktree-base=/custom/wt",
		"--audit-dir=/custom/audit",
		"--image=golang:1.22",
		"--test-cmd=go test ./...",
		"--mock-llm",
	}

	cfg, err := parseConfig(fs, args)
	if err != nil {
		t.Fatalf("unexpected error parsing flags: %v", err)
	}

	if cfg.Port != 9090 || cfg.Secret != "flag-secret" || cfg.Concurrency != 5 || cfg.QueueCapacity != 100 || !cfg.MockLLM {
		t.Errorf("unexpected parsed config values: %+v", cfg)
	}
	if cfg.TaskTimeout != 5*time.Minute {
		t.Errorf("expected 5m timeout, got %v", cfg.TaskTimeout)
	}
	if cfg.BaseRepo != "/custom/repo" || cfg.WorktreeBase != "/custom/wt" || cfg.AuditDir != "/custom/audit" {
		t.Errorf("unexpected directory config: %+v", cfg)
	}
}

func TestParseConfig_EnvOverride(t *testing.T) {
	_ = os.Setenv("GITHUB_WEBHOOK_SECRET", "env-secret")
	_ = os.Setenv("DAEMON_PORT", "8088")
	_ = os.Setenv("MOCK_LLM", "true")
	defer func() {
		_ = os.Unsetenv("GITHUB_WEBHOOK_SECRET")
		_ = os.Unsetenv("DAEMON_PORT")
		_ = os.Unsetenv("MOCK_LLM")
	}()

	fs := flag.NewFlagSet("daemon", flag.ContinueOnError)
	cfg, err := parseConfig(fs, []string{})
	if err != nil {
		t.Fatalf("unexpected error parsing env config: %v", err)
	}
	if cfg.Port != 8088 {
		t.Errorf("expected port 8088 from DAEMON_PORT, got %d", cfg.Port)
	}
	if !cfg.MockLLM {
		t.Errorf("expected MockLLM true from MOCK_LLM=true, got %v", cfg.MockLLM)
	}
}

func TestParseConfig_MissingSecret_Error(t *testing.T) {
	_ = os.Unsetenv("GITHUB_WEBHOOK_SECRET")
	fs := flag.NewFlagSet("daemon", flag.ContinueOnError)

	_, err := parseConfig(fs, []string{})
	if err == nil {
		t.Errorf("expected error when secret is not provided via flag or env")
	}
}
