package supervisor

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
)

// BoundedQueue provides a thread-safe buffered channel FIFO task queue with backpressure detection.
type BoundedQueue struct {
	ch     chan *RemediationJob
	mu     sync.Mutex
	closed bool
}

// NewBoundedQueue initializes a new queue with the specified capacity buffer.
func NewBoundedQueue(capacity int) *BoundedQueue {
	if capacity <= 0 {
		capacity = 50
	}
	return &BoundedQueue{
		ch: make(chan *RemediationJob, capacity),
	}
}

// Push attempts to enqueue a job without blocking. Returns webhook.ErrQueueFull when saturated.
func (q *BoundedQueue) Push(job *RemediationJob) error {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return fmt.Errorf("queue is closed")
	}
	q.mu.Unlock()

	select {
	case q.ch <- job:
		return nil
	default:
		return webhook.ErrQueueFull
	}
}

// Pop blocks until a job is available or the queue is closed and empty.
func (q *BoundedQueue) Pop() (*RemediationJob, bool) {
	job, ok := <-q.ch
	return job, ok
}

// Len returns the current number of enqueued jobs.
func (q *BoundedQueue) Len() int {
	return len(q.ch)
}

// Cap returns the maximum capacity of the queue buffer.
func (q *BoundedQueue) Cap() int {
	return cap(q.ch)
}

// Close gracefully closes the job channel, preventing new pushes while allowing pending jobs to be drained.
func (q *BoundedQueue) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()
	if !q.closed {
		q.closed = true
		close(q.ch)
	}
}

// QueueEnqueuer adapts BoundedQueue to webhook.Enqueuer interface.
type QueueEnqueuer struct {
	queue    *BoundedQueue
	baseRepo string
}

// NewQueueEnqueuer creates a new adapter submitting jobs to queue.
func NewQueueEnqueuer(queue *BoundedQueue, baseRepo string) *QueueEnqueuer {
	return &QueueEnqueuer{
		queue:    queue,
		baseRepo: baseRepo,
	}
}

// Enqueue builds a RemediationJob from a WebhookEvent and pushes it to the bounded queue.
func (e *QueueEnqueuer) Enqueue(event *webhook.WebhookEvent) (string, error) {
	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	suffix := hex.EncodeToString(randBytes)

	commitPrefix := event.HeadCommitSHA
	if len(commitPrefix) > 7 {
		commitPrefix = commitPrefix[:7]
	}
	jobID := fmt.Sprintf("job-pr%d-%s-%s", event.PullRequestNumber, commitPrefix, suffix)

	repoPath := e.baseRepo
	if repoPath == "" {
		repoPath = event.RepositoryURL
	}

	job := &RemediationJob{
		ID:                jobID,
		RepoURL:           repoPath,
		RepoFullName:      event.RepoFullName,
		TargetBranch:      event.TargetBranch,
		HeadCommitSHA:     event.HeadCommitSHA,
		PullRequestNumber: event.PullRequestNumber,
		Status:            StatusQueued,
		EnqueuedAt:        time.Now().UTC(),
	}

	if err := e.queue.Push(job); err != nil {
		return "", err
	}

	return jobID, nil
}
