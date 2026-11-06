package supervisor_test

import (
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/supervisor"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
)

func TestBoundedQueue_Push_Pop(t *testing.T) {
	q := supervisor.NewBoundedQueue(3)

	job1 := &supervisor.RemediationJob{ID: "job-1"}
	job2 := &supervisor.RemediationJob{ID: "job-2"}

	if err := q.Push(job1); err != nil {
		t.Fatalf("unexpected error pushing job1: %v", err)
	}
	if err := q.Push(job2); err != nil {
		t.Fatalf("unexpected error pushing job2: %v", err)
	}

	if q.Len() != 2 {
		t.Errorf("expected queue length 2, got %d", q.Len())
	}

	out1, ok := q.Pop()
	if !ok || out1.ID != "job-1" {
		t.Errorf("expected out1 to be job-1, got %+v", out1)
	}

	out2, ok := q.Pop()
	if !ok || out2.ID != "job-2" {
		t.Errorf("expected out2 to be job-2, got %+v", out2)
	}
}

func TestBoundedQueue_Saturation_Error(t *testing.T) {
	q := supervisor.NewBoundedQueue(2)

	_ = q.Push(&supervisor.RemediationJob{ID: "job-1"})
	_ = q.Push(&supervisor.RemediationJob{ID: "job-2"})

	// 3rd push should fail with webhook.ErrQueueFull
	err := q.Push(&supervisor.RemediationJob{ID: "job-3"})
	if err != webhook.ErrQueueFull {
		t.Fatalf("expected ErrQueueFull on saturated queue, got %v", err)
	}
}

func TestBoundedQueue_Close(t *testing.T) {
	q := supervisor.NewBoundedQueue(2)
	_ = q.Push(&supervisor.RemediationJob{ID: "job-1"})
	q.Close()

	// Can still pop enqueued item
	out, ok := q.Pop()
	if !ok || out.ID != "job-1" {
		t.Errorf("expected to pop job-1 after close, got %+v", out)
	}

	// Next pop should return false
	_, ok = q.Pop()
	if ok {
		t.Errorf("expected pop on empty closed queue to return false")
	}

	// Push after close should fail
	err := q.Push(&supervisor.RemediationJob{ID: "job-after-close"})
	if err == nil {
		t.Errorf("expected push to closed queue to return error")
	}
}

func TestBoundedQueue_EnqueueAdapter(t *testing.T) {
	q := supervisor.NewBoundedQueue(5)
	adapter := supervisor.NewQueueEnqueuer(q, "base-repo-path")

	event := &webhook.WebhookEvent{
		PullRequestNumber: 55,
		HeadCommitSHA:     "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
		TargetBranch:      "feat/test",
		RepoFullName:      "roselletabuena/genai-lab",
		RepositoryURL:     "https://github.com/roselletabuena/genai-lab.git",
		ReceivedAt:        time.Now().UTC(),
	}

	jobID, err := adapter.Enqueue(event)
	if err != nil {
		t.Fatalf("unexpected error enqueuing event: %v", err)
	}
	if jobID == "" {
		t.Fatalf("expected non-empty jobID")
	}

	job, ok := q.Pop()
	if !ok || job.ID != jobID {
		t.Fatalf("expected job to be enqueued in queue")
	}
	if job.PullRequestNumber != 55 || job.Status != supervisor.StatusQueued {
		t.Errorf("unexpected job fields: %+v", job)
	}
}
