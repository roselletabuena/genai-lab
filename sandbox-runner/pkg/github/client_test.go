package github_test

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata/githubmock"
)

func TestClient_RetriesOn502WithExponentialBackoff(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	srv.EnqueueError(502, "", `{"message":"bad gateway"}`)
	srv.EnqueueError(503, "", `{"message":"unavailable"}`)

	var sleeps []time.Duration
	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "tok",
		Sleeper: func(d time.Duration) { sleeps = append(sleeps, d) },
		Jitter:  func(max time.Duration) time.Duration { return 0 },
	})
	commenter := github.NewCommenter(client)

	rep, err := github.DecodeReport(stringsReader(loadFixture(t, "verified_fix_report.json")))
	if err != nil {
		t.Fatal(err)
	}

	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 1,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome.Status != audit.FeedbackPosted {
		t.Fatalf("expected posted after retries, got %+v", outcome)
	}
	if len(sleeps) != 2 || sleeps[0] != 1*time.Second || sleeps[1] != 2*time.Second {
		t.Errorf("expected sleeps [1s, 2s], got %v", sleeps)
	}
}

func TestClient_RateLimitWaitsWhenWithin60sAndFailsWhenOver60s(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	// Case 1: Retry-After <= 60s waits and succeeds.
	srv.EnqueueError(429, "15", `{"message":"rate limited"}`)
	var sleeps []time.Duration
	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "tok",
		Sleeper: func(d time.Duration) { sleeps = append(sleeps, d) },
	})
	commenter := github.NewCommenter(client)
	rep, _ := github.DecodeReport(stringsReader(loadFixture(t, "verified_fix_report.json")))

	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 1,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome.Status != audit.FeedbackPosted {
		t.Fatalf("expected posted after rate limit wait, got %+v", outcome)
	}
	if len(sleeps) != 1 || sleeps[0] != 15*time.Second {
		t.Errorf("expected 15s rate-limit sleep, got %v", sleeps)
	}

	// Case 2: Retry-After > 60s gives up immediately with reason=rate_limited.
	srv.EnqueueError(403, strconv.Itoa(120), `{"message":"secondary rate limit"}`)
	outcome2 := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 1,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome2.Status != audit.FeedbackFailed || outcome2.Reason != "rate_limited" {
		t.Errorf("expected failed/rate_limited when Retry-After > 60s, got %+v", outcome2)
	}
}

func TestClient_Plain403And404AreNonRetryable(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	srv.EnqueueError(403, "", `{"message":"resource not accessible by integration"}`)
	var sleeps []time.Duration
	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "tok",
		Sleeper: func(d time.Duration) { sleeps = append(sleeps, d) },
	})
	commenter := github.NewCommenter(client)
	rep, _ := github.DecodeReport(stringsReader(loadFixture(t, "verified_fix_report.json")))

	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 1,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome.Status != audit.FeedbackFailed || outcome.Reason != "http_403" || outcome.Attempts != 1 {
		t.Errorf("expected single-attempt failed/http_403, got %+v", outcome)
	}
	if len(sleeps) != 0 {
		t.Errorf("expected zero sleeps on non-retryable 403, got %v", sleeps)
	}
}
