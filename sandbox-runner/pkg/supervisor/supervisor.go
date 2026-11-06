package supervisor

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox"
)

// Config defines the operational parameters for the worker supervisor.
type Config struct {
	Concurrency     int           `json:"concurrency"`
	TaskTimeout     time.Duration `json:"task_timeout"`
	TestCommand     []string      `json:"test_command"`
	Image           string        `json:"image"`
	NetworkDisabled bool          `json:"network_disabled"`
}

// WorktreeCreator abstracts worktree creation and teardown for the supervisor.
type WorktreeCreator interface {
	Create(ctx context.Context, repoPath, commitSHA, jobID string) (*WorktreeContext, error)
	Prune(ctx context.Context, wt *WorktreeContext) error
	PruneAll(ctx context.Context) []error
}

// Supervisor orchestrates concurrent worker goroutines executing container tasks in ephemeral worktrees.
type Supervisor struct {
	cfg           Config
	queue         *BoundedQueue
	runner        *sandbox.Runner
	worktreeMgr   WorktreeCreator
	auditWriter   *audit.Writer
	wg            sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc
	activeWorkers int32
}

// NewSupervisor initializes a new worker pool Supervisor.
func NewSupervisor(
	cfg Config,
	queue *BoundedQueue,
	runner *sandbox.Runner,
	worktreeMgr WorktreeCreator,
	auditWriter *audit.Writer,
) *Supervisor {
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 3
	}
	if cfg.TaskTimeout <= 0 {
		cfg.TaskTimeout = 10 * time.Minute
	}
	if len(cfg.TestCommand) == 0 {
		cfg.TestCommand = []string{"npm", "test"}
	}
	if cfg.Image == "" {
		cfg.Image = "node:24-alpine"
	}

	return &Supervisor{
		cfg:         cfg,
		queue:       queue,
		runner:      runner,
		worktreeMgr: worktreeMgr,
		auditWriter: auditWriter,
	}
}

// Start spawns the configured worker pool goroutines.
func (s *Supervisor) Start(parentCtx context.Context) {
	s.ctx, s.cancel = context.WithCancel(parentCtx)

	for i := 0; i < s.cfg.Concurrency; i++ {
		s.wg.Add(1)
		go s.workerLoop(i + 1)
	}
}

func (s *Supervisor) workerLoop(workerID int) {
	defer s.wg.Done()

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		job, ok := s.queue.Pop()
		if !ok {
			return // Queue closed and empty
		}

		atomic.AddInt32(&s.activeWorkers, 1)
		s.processJob(job)
		atomic.AddInt32(&s.activeWorkers, -1)
	}
}

func (s *Supervisor) processJob(job *RemediationJob) {
	job.Status = StatusRunning
	job.StartedAt = time.Now().UTC()

	// Enforce per-task execution timeout context
	taskCtx, taskCancel := context.WithTimeout(s.ctx, s.cfg.TaskTimeout)
	defer taskCancel()

	// 1. Provision ephemeral git worktree
	wt, err := s.worktreeMgr.Create(taskCtx, job.RepoURL, job.HeadCommitSHA, job.ID)
	if err != nil {
		s.recordFailure(job, fmt.Errorf("failed to create worktree: %w", err))
		return
	}

	// 2. Guarantee worktree pruning immediately upon function exit
	defer func() {
		pruneCtx, pruneCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer pruneCancel()
		if err := s.worktreeMgr.Prune(pruneCtx, wt); err != nil {
			log.Printf("[supervisor] warning: worktree prune failed for %s: %v", wt.WorktreePath, err)
		}
	}()

	// 3. Execute container test runner
	runCfg := sandbox.Config{
		RepoPath:        wt.WorktreePath,
		TestCmd:         s.cfg.TestCommand,
		Image:           s.cfg.Image,
		Timeout:         s.cfg.TaskTimeout,
		NetworkDisabled: s.cfg.NetworkDisabled,
	}

	result, err := s.runner.Run(taskCtx, runCfg)
	job.FinishedAt = time.Now().UTC()

	// 4. Determine final job status
	var (
		exitCode   int
		durationMs int64
		timedOut   bool
		stdout     string
		stderr     string
		errStr     string
	)

	if result != nil {
		exitCode = result.ExitCode
		durationMs = result.DurationMs
		timedOut = result.TimedOut
		stdout = result.Stdout
		stderr = result.Stderr
		errStr = result.Error
	}

	if timedOut || taskCtx.Err() == context.DeadlineExceeded {
		job.Status = StatusTimedOut
		timedOut = true
	} else if err != nil || exitCode != 0 {
		job.Status = StatusFailed
		if err != nil {
			errStr = err.Error()
		}
	} else {
		job.Status = StatusCompleted
	}

	// 5. Persist audit record prior to worktree removal
	rec := &audit.Record{
		JobID:             job.ID,
		RepoFullName:      job.RepoFullName,
		PullRequestNumber: job.PullRequestNumber,
		CommitSHA:         job.HeadCommitSHA,
		TargetBranch:      job.TargetBranch,
		Status:            string(job.Status),
		ExitCode:          exitCode,
		DurationMs:        durationMs,
		TimedOut:          timedOut,
		Stdout:            stdout,
		Stderr:            stderr,
		Error:             errStr,
		Timestamp:         job.FinishedAt,
	}

	if _, writeErr := s.auditWriter.Write(rec); writeErr != nil {
		log.Printf("[supervisor] warning: failed to write audit record for %s: %v", job.ID, writeErr)
	}
}

func (s *Supervisor) recordFailure(job *RemediationJob, err error) {
	job.Status = StatusFailed
	job.FinishedAt = time.Now().UTC()
	job.ErrorMessage = err.Error()

	rec := &audit.Record{
		JobID:             job.ID,
		RepoFullName:      job.RepoFullName,
		PullRequestNumber: job.PullRequestNumber,
		CommitSHA:         job.HeadCommitSHA,
		TargetBranch:      job.TargetBranch,
		Status:            string(job.Status),
		ExitCode:          -1,
		Error:             err.Error(),
		Timestamp:         job.FinishedAt,
	}
	_, _ = s.auditWriter.Write(rec)
}

// ActiveWorkers returns the count of currently running worker tasks.
func (s *Supervisor) ActiveWorkers() int {
	return int(atomic.LoadInt32(&s.activeWorkers))
}

// Shutdown initiates graceful termination: closes the queue, signals workers, and cleans up worktrees.
func (s *Supervisor) Shutdown(ctx context.Context) error {
	s.queue.Close()
	if s.cancel != nil {
		s.cancel()
	}

	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		return ctx.Err()
	}

	// Fallback: prune all remaining active worktrees
	pruneCtx, pruneCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer pruneCancel()
	_ = s.worktreeMgr.PruneAll(pruneCtx)

	return nil
}
