package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/worktree"
)

// DaemonConfig holds all configuration parameters for the webhook daemon.
type DaemonConfig struct {
	Port          int
	Secret        string
	BaseRepo      string
	WorktreeBase  string
	AuditDir      string
	Concurrency   int
	QueueCapacity int
	TaskTimeout   time.Duration
	Image         string
	TestCommand   string
}

func envOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func parseConfig(fs *flag.FlagSet, args []string) (*DaemonConfig, error) {
	cfg := &DaemonConfig{}

	fs.IntVar(&cfg.Port, "port", 8088, "HTTP server listening port")
	fs.StringVar(&cfg.Secret, "secret", envOrDefault("GITHUB_WEBHOOK_SECRET", ""), "HMAC SHA-256 webhook secret (or env GITHUB_WEBHOOK_SECRET)")
	fs.StringVar(&cfg.BaseRepo, "repo", envOrDefault("BASE_REPO_PATH", "."), "Host path to base git repository")
	fs.StringVar(&cfg.WorktreeBase, "worktree-base", envOrDefault("WORKTREE_BASE_DIR", filepathDefaultWorktrees()), "Host path for ephemeral git worktrees")
	fs.StringVar(&cfg.AuditDir, "audit-dir", envOrDefault("AUDIT_DIR", "./audit-logs"), "Directory where JSON audit records are persisted")
	fs.IntVar(&cfg.Concurrency, "concurrency", 3, "Maximum concurrent worker container tasks")
	fs.IntVar(&cfg.QueueCapacity, "queue-size", 50, "Capacity of bounded job queue")
	fs.DurationVar(&cfg.TaskTimeout, "timeout", 10*time.Minute, "Per-task container execution timeout")
	fs.StringVar(&cfg.Image, "image", envOrDefault("CONTAINER_IMAGE", "node:24-alpine"), "Container image for test execution")
	fs.StringVar(&cfg.TestCommand, "test-cmd", envOrDefault("TEST_COMMAND", "npm test"), "Default test command executed in sandbox")

	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	if cfg.Secret == "" {
		return nil, errors.New("webhook secret must be configured via --secret flag or GITHUB_WEBHOOK_SECRET environment variable")
	}

	return cfg, nil
}

func filepathDefaultWorktrees() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "/tmp/genai-lab-worktrees"
	}
	return fmt.Sprintf("%s/.genai-lab/worktrees", home)
}

func main() {
	cfg, err := parseConfig(flag.CommandLine, os.Args[1:])
	if err != nil {
		log.Fatalf("[daemon] configuration error: %v", err)
	}

	dockerClient, err := sandbox.NewDefaultDockerClient()
	if err != nil {
		log.Fatalf("[daemon] failed to initialize Docker client: %v", err)
	}

	runner := sandbox.NewRunner(dockerClient)
	wtMgr := worktree.NewManager(cfg.WorktreeBase, worktree.NewOSGitExecutor())
	auditWriter := audit.NewWriter(cfg.AuditDir)
	queue := supervisor.NewBoundedQueue(cfg.QueueCapacity)
	enqueuer := supervisor.NewQueueEnqueuer(queue, cfg.BaseRepo)
	handler := webhook.NewHandler(cfg.Secret, enqueuer)

	var testCmdSlice []string
	if cfg.TestCommand != "" {
		testCmdSlice = strings.Fields(cfg.TestCommand)
	}

	supCfg := supervisor.Config{
		Concurrency:     cfg.Concurrency,
		TaskTimeout:     cfg.TaskTimeout,
		TestCommand:     testCmdSlice,
		Image:           cfg.Image,
		NetworkDisabled: true,
	}

	sup := supervisor.NewSupervisor(supCfg, queue, runner, wtMgr, auditWriter)

	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()

	sup.Start(rootCtx)
	log.Printf("[daemon] worker supervisor started with %d workers (queue size: %d, timeout: %v)", cfg.Concurrency, cfg.QueueCapacity, cfg.TaskTimeout)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: handler,
	}

	// Channel listening for OS signals (SIGINT, SIGTERM)
	stopSig := make(chan os.Signal, 1)
	signal.Notify(stopSig, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[daemon] listening for GitHub webhooks on http://0.0.0.0:%d/webhook", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[daemon] HTTP server error: %v", err)
		}
	}()

	// Block until signal received
	sig := <-stopSig
	log.Printf("[daemon] shutdown signal received (%v), starting graceful drain...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[daemon] HTTP server shutdown warning: %v", err)
	}

	if err := sup.Shutdown(shutdownCtx); err != nil {
		log.Printf("[daemon] worker supervisor shutdown warning: %v", err)
	}

	log.Printf("[daemon] shutdown complete. Exiting.")
}
