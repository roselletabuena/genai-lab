package supervisor

import (
	"time"
)

// JobStatus represents the state of a remediation task lifecycle.
type JobStatus string

const (
	StatusQueued    JobStatus = "Queued"
	StatusRunning   JobStatus = "Running"
	StatusCompleted JobStatus = "Completed"
	StatusFailed    JobStatus = "Failed"
	StatusTimedOut  JobStatus = "TimedOut"
)

// RemediationJob represents a queued remediation task to be executed in an isolated worktree.
type RemediationJob struct {
	ID                string    `json:"id"`
	RepoURL           string    `json:"repo_url"`
	RepoFullName      string    `json:"repo_full_name"`
	TargetBranch      string    `json:"target_branch"`
	HeadCommitSHA     string    `json:"head_commit_sha"`
	PullRequestNumber int       `json:"pull_request_number"`
	Status            JobStatus `json:"status"`
	EnqueuedAt        time.Time `json:"enqueued_at"`
	StartedAt         time.Time `json:"started_at"`
	FinishedAt        time.Time `json:"finished_at"`
	ErrorMessage      string    `json:"error_message,omitempty"`
}

// WorktreeContext tracks an allocated ephemeral working directory.
type WorktreeContext struct {
	JobID        string    `json:"job_id"`
	WorktreePath string    `json:"worktree_path"`
	BaseRepoPath string    `json:"base_repo_path"`
	CommitSHA    string    `json:"commit_sha"`
	CreatedAt    time.Time `json:"created_at"`
	CleanedUp    bool      `json:"cleaned_up"`
}
