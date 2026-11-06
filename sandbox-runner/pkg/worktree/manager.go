package worktree

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
)

// WorktreeContext is an alias to the domain type in supervisor.
type WorktreeContext = supervisor.WorktreeContext

// Manager handles ephemeral git worktree creation, tracking, and pruning.
type Manager struct {
	baseDir string
	git     GitExecutor
	mu      sync.RWMutex
	active  map[string]*WorktreeContext
}

// NewManager initializes a new worktree Manager.
func NewManager(baseDir string, git GitExecutor) *Manager {
	if git == nil {
		git = NewOSGitExecutor()
	}
	return &Manager{
		baseDir: baseDir,
		git:     git,
		active:  make(map[string]*WorktreeContext),
	}
}

// Create provisions an isolated, detached git worktree at baseDir/<jobID> checked out to commitSHA.
func (m *Manager) Create(ctx context.Context, repoPath, commitSHA, jobID string) (*WorktreeContext, error) {
	if repoPath == "" {
		return nil, fmt.Errorf("repoPath cannot be empty")
	}
	if commitSHA == "" {
		return nil, fmt.Errorf("commitSHA cannot be empty")
	}
	if jobID == "" {
		return nil, fmt.Errorf("jobID cannot be empty")
	}

	absRepo, err := filepath.Abs(repoPath)
	if err != nil {
		return nil, fmt.Errorf("invalid repoPath: %w", err)
	}

	if err := os.MkdirAll(m.baseDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to create base worktree directory %s: %w", m.baseDir, err)
	}

	worktreePath := filepath.Join(m.baseDir, jobID)

	// Ensure any stale directory at the target path is purged
	_ = os.RemoveAll(worktreePath)

	// git worktree add --detach <worktreePath> <commitSHA>
	_, err = m.git.Exec(ctx, absRepo, "worktree", "add", "--detach", worktreePath, commitSHA)
	if err != nil {
		return nil, fmt.Errorf("failed to add git worktree: %w", err)
	}

	wt := &WorktreeContext{
		JobID:        jobID,
		WorktreePath: worktreePath,
		BaseRepoPath: absRepo,
		CommitSHA:    commitSHA,
		CreatedAt:    time.Now().UTC(),
		CleanedUp:    false,
	}

	m.mu.Lock()
	m.active[jobID] = wt
	m.mu.Unlock()

	return wt, nil
}

// Prune cleanly detaches, removes, and prunes the worktree from git and disk.
func (m *Manager) Prune(ctx context.Context, wt *WorktreeContext) error {
	if wt == nil || wt.CleanedUp {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var firstErr error

	// 1. git worktree remove --force <worktreePath>
	if _, err := m.git.Exec(ctx, wt.BaseRepoPath, "worktree", "remove", "--force", wt.WorktreePath); err != nil {
		firstErr = fmt.Errorf("git worktree remove failed: %w", err)
	}

	// 2. git worktree prune
	_, _ = m.git.Exec(ctx, wt.BaseRepoPath, "worktree", "prune")

	// 3. Fallback filesystem cleanup in case git left locked files or directories
	if err := os.RemoveAll(wt.WorktreePath); err != nil && firstErr == nil {
		firstErr = fmt.Errorf("filesystem cleanup of %s failed: %w", wt.WorktreePath, err)
	}

	wt.CleanedUp = true
	delete(m.active, wt.JobID)

	return firstErr
}

// PruneAll prunes all currently active worktrees, returning any encountered errors.
func (m *Manager) PruneAll(ctx context.Context) []error {
	m.mu.RLock()
	activeList := make([]*WorktreeContext, 0, len(m.active))
	for _, wt := range m.active {
		activeList = append(activeList, wt)
	}
	m.mu.RUnlock()

	var errs []error
	for _, wt := range activeList {
		if err := m.Prune(ctx, wt); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}
