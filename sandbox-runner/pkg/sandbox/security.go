package sandbox

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
)

const (
	// DefaultMemoryLimitBytes caps sandbox container memory at 512 MB (536,870,912 bytes).
	DefaultMemoryLimitBytes int64 = 512 * 1024 * 1024

	// DefaultNanoCPUs caps sandbox container CPU usage at 1.0 CPU core (1,000,000,000 NanoCPUs).
	DefaultNanoCPUs int64 = 1_000_000_000

	// DefaultCPUPeriodMicros is the standard Linux CFS scheduler period (100,000 microseconds).
	DefaultCPUPeriodMicros int64 = 100_000

	// DefaultCPUQuotaMicros restricts execution to 1.0 CPU core per CFS period (100,000 microseconds).
	DefaultCPUQuotaMicros int64 = 100_000

	// DefaultExecutionTimeout is the hard execution bound before SIGKILL is issued (60 seconds).
	DefaultExecutionTimeout = 60 * time.Second

	// DefaultNonRootUser is the unprivileged UID:GID under which sandbox containers execute.
	DefaultNonRootUser = "1000:1000"

	// NetworkModeNone disables all container networking (--network=none).
	NetworkModeNone container.NetworkMode = "none"

	// SecurityOptNoNewPrivileges prevents processes inside the container from gaining additional privileges.
	SecurityOptNoNewPrivileges = "no-new-privileges:true"
)

// ApplySecurityDefaults populates security guardrail defaults on Config when unset or out of bounds.
// It enforces:
//   - 512 MB memory cap (capping any higher value down to DefaultMemoryLimitBytes)
//   - 1.0 CPU core quota (capping any higher value down to DefaultNanoCPUs)
//   - 60-second execution timeout bound (capping any higher value down to DefaultExecutionTimeout)
//   - Non-root execution user (DefaultNonRootUser, rejecting root specifications)
//   - Egress network isolation (--network=none) unless explicitly opted out via AllowNetwork
func ApplySecurityDefaults(cfg *Config) {
	if cfg.Image == "" {
		cfg.Image = "node:24-alpine"
	}
	if cfg.WorkDir == "" {
		cfg.WorkDir = "/workspace"
	}
	if cfg.Timeout <= 0 || cfg.Timeout > DefaultExecutionTimeout {
		cfg.Timeout = DefaultExecutionTimeout
	}
	if cfg.MemoryLimitBytes <= 0 || cfg.MemoryLimitBytes > DefaultMemoryLimitBytes {
		cfg.MemoryLimitBytes = DefaultMemoryLimitBytes
	}
	if cfg.NanoCPUs <= 0 || cfg.NanoCPUs > DefaultNanoCPUs {
		cfg.NanoCPUs = DefaultNanoCPUs
	}
	if !isNonRootUser(cfg.User) {
		cfg.User = DefaultNonRootUser
	}
	if !cfg.AllowNetwork {
		cfg.NetworkDisabled = true
	}
}

// isNonRootUser returns true if userSpec is non-empty and does not resolve to root (0 or "root").
func isNonRootUser(userSpec string) bool {
	trimmed := strings.TrimSpace(userSpec)
	if trimmed == "" {
		return false
	}
	parts := strings.Split(trimmed, ":")
	uidPart := strings.ToLower(strings.TrimSpace(parts[0]))
	if uidPart == "" || uidPart == "0" || uidPart == "root" {
		return false
	}
	return true
}

// SanitizeEnv filters explicit KEY=VALUE pairs, stripping empty entries, invalid formats,
// or null-byte injection payloads. Host environment variables (os.Environ) are never inherited.
func SanitizeEnv(explicitEnv []string) []string {
	if len(explicitEnv) == 0 {
		return []string{}
	}
	sanitized := make([]string, 0, len(explicitEnv))
	for _, entry := range explicitEnv {
		if strings.ContainsRune(entry, '\x00') {
			continue
		}
		eqIdx := strings.IndexByte(entry, '=')
		if eqIdx <= 0 {
			continue
		}
		key := strings.TrimSpace(entry[:eqIdx])
		if key == "" {
			continue
		}
		sanitized = append(sanitized, key+"="+entry[eqIdx+1:])
	}
	return sanitized
}

// BuildContainerConfig constructs a hardened Docker container.Config enforcing non-root UID,
// sanitized environment variables, and egress network isolation.
func BuildContainerConfig(cfg Config) *container.Config {
	ApplySecurityDefaults(&cfg)

	return &container.Config{
		Image:           cfg.Image,
		Cmd:             cfg.TestCmd,
		WorkingDir:      cfg.WorkDir,
		User:            cfg.User,
		Env:             SanitizeEnv(cfg.Env),
		NetworkDisabled: cfg.NetworkDisabled,
		Tty:             false, // Non-TTY enables stdcopy header multiplexing for stdout & stderr
	}
}

// BuildHostConfig constructs a hardened Docker container.HostConfig enforcing:
//   - 512 MB Memory & MemorySwap ceiling (disabling swap overcommit)
//   - 1.0 CPU core quota (NanoCPUs and CFS CPUQuota/CPUPeriod)
//   - Outbound network isolation (--network=none) when NetworkDisabled is active
//   - Strict single-directory bind mount to cfg.WorkDir
//   - Privilege escalation prevention (no-new-privileges:true and CapDrop ALL)
func BuildHostConfig(absRepoPath string, cfg Config) *container.HostConfig {
	ApplySecurityDefaults(&cfg)

	cleanRepoPath := filepath.Clean(absRepoPath)
	networkMode := container.NetworkMode("default")
	if cfg.NetworkDisabled {
		networkMode = NetworkModeNone
	}

	cpuQuota := (cfg.NanoCPUs * DefaultCPUPeriodMicros) / DefaultNanoCPUs
	if cpuQuota <= 0 || cpuQuota > DefaultCPUQuotaMicros {
		cpuQuota = DefaultCPUQuotaMicros
	}

	return &container.HostConfig{
		Binds:       []string{fmt.Sprintf("%s:%s", cleanRepoPath, cfg.WorkDir)},
		NetworkMode: networkMode,
		SecurityOpt: []string{SecurityOptNoNewPrivileges},
		CapDrop:     []string{"ALL"},
		Resources: container.Resources{
			Memory:     cfg.MemoryLimitBytes,
			MemorySwap: cfg.MemoryLimitBytes,
			NanoCPUs:   cfg.NanoCPUs,
			CPUPeriod:  DefaultCPUPeriodMicros,
			CPUQuota:   cpuQuota,
		},
	}
}
