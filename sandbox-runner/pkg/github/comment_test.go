package github_test

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata/githubmock"
)

func stringsReader(s string) io.Reader {
	return strings.NewReader(s)
}

func TestCommenter_FirstPostCreatesSummaryAndSuggestionWithRequiredHeaders(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "secret-token-value",
	})
	commenter := github.NewCommenter(client)

	rep, err := github.DecodeReport(strings.NewReader(loadFixture(t, "suggestion_report.json")))
	if err != nil {
		t.Fatal(err)
	}

	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 42,
		HeadCommitSHA:     "commit-sha-42",
	}, rep)
	if outcome.Status != audit.FeedbackPosted {
		t.Fatalf("expected status posted, got %+v", outcome)
	}
	if outcome.SummaryCommentID == nil || outcome.SuggestionCommentID == nil {
		t.Fatalf("expected both summary and suggestion comment IDs populated: %+v", outcome)
	}

	issues := srv.GetIssueComments()
	if len(issues) != 1 || !strings.Contains(issues[0].Body, "<!-- remediation-agent:pr-feedback run=job-102 -->") {
		t.Errorf("unexpected issue comments: %+v", issues)
	}

	reviews := srv.GetReviewComments()
	if len(reviews) != 1 {
		t.Fatalf("expected 1 review comment, got %d", len(reviews))
	}
	rc := reviews[0]
	if rc.CommitID != "commit-sha-42" || rc.Path != "src/math_utils.py" || rc.Line != 8 || rc.Side != "RIGHT" {
		t.Errorf("unexpected review comment metadata: %+v", rc)
	}
	if !strings.Contains(rc.Body, "<!-- remediation-agent:pr-suggestion -->") || !strings.Contains(rc.Body, "```suggestion\n    return a + b\n```") {
		t.Errorf("unexpected review comment body: %s", rc.Body)
	}

	// Verify headers on recorded requests.
	for _, req := range srv.GetRequests() {
		if req.Headers.Get("Authorization") != "Bearer secret-token-value" {
			t.Errorf("missing/wrong Authorization header on %s %s", req.Method, req.Path)
		}
		if req.Headers.Get("Accept") != "application/vnd.github+json" {
			t.Errorf("missing Accept header on %s %s", req.Method, req.Path)
		}
		if req.Headers.Get("X-GitHub-Api-Version") != "2022-11-28" {
			t.Errorf("missing X-GitHub-Api-Version header on %s %s", req.Method, req.Path)
		}
		if req.Headers.Get("User-Agent") != "genai-lab-remediation" {
			t.Errorf("missing User-Agent header on %s %s", req.Method, req.Path)
		}
	}
}

func TestCommenter_SkipsWhenPRClosedOrNoCredentials(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()
	srv.PRState = "closed"

	rep, _ := github.DecodeReport(strings.NewReader(loadFixture(t, "verified_fix_report.json")))

	// Case 1: Closed PR -> skipped/pr_closed, zero comment calls.
	client := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
	commenter := github.NewCommenter(client)
	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 9,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome.Status != audit.FeedbackSkipped || outcome.Reason != "pr_closed" {
		t.Errorf("expected skipped/pr_closed, got %+v", outcome)
	}
	if len(srv.GetIssueComments()) != 0 {
		t.Errorf("expected zero comments on closed PR")
	}

	// Case 2: Empty GITHUB_TOKEN -> skipped/no_credentials, zero HTTP requests.
	beforeCount := len(srv.GetRequests())
	t.Setenv("GITHUB_TOKEN", "")
	noTokClient := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: ""})
	noTokCommenter := github.NewCommenter(noTokClient)
	outcome2 := noTokCommenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 9,
		HeadCommitSHA:     "sha",
	}, rep)
	if outcome2.Status != audit.FeedbackSkipped || outcome2.Reason != "no_credentials" || outcome2.Attempts != 0 {
		t.Errorf("expected skipped/no_credentials with 0 attempts, got %+v", outcome2)
	}
	if len(srv.GetRequests()) != beforeCount {
		t.Errorf("expected zero HTTP requests when token is empty")
	}
}

func TestCommenter_UpsertsOnPage2AndDeletesStaleSuggestionOnFailure(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()
	srv.PageSize = 2

	// Pre-populate 2 unrelated comments on page 1 so the marker comment lands on page 2.
	srv.IssueComments = []githubmock.IssueComment{
		{ID: 1, Body: "human comment 1"},
		{ID: 2, Body: "human comment 2"},
	}

	client := github.NewClient(github.ClientConfig{BaseURL: srv.URL, Token: "tok"})
	commenter := github.NewCommenter(client)
	target := github.PRTarget{RepoFullName: "org/repo", PullRequestNumber: 15, HeadCommitSHA: "sha-1"}

	// First run: verified fix with suggestion -> creates issue comment #3 (on page 2) + review comment.
	suggReport, _ := github.DecodeReport(strings.NewReader(loadFixture(t, "suggestion_report.json")))
	first := commenter.Post(context.Background(), target, suggReport)
	if first.Status != audit.FeedbackPosted {
		t.Fatalf("expected first post to be posted, got %+v", first)
	}
	if len(srv.GetIssueComments()) != 3 || len(srv.GetReviewComments()) != 1 {
		t.Fatalf("unexpected comment counts after first post")
	}

	// Same job reposted -> idempotent PATCH on existing comment, no duplicate created.
	repost := commenter.Post(context.Background(), target, suggReport)
	if repost.Status != audit.FeedbackUpdated {
		t.Fatalf("expected repost to be updated, got %+v", repost)
	}
	if len(srv.GetIssueComments()) != 3 || len(srv.GetReviewComments()) != 1 {
		t.Errorf("expected no duplicate comments after repost")
	}

	// Later run fails -> updates summary comment in place AND deletes the stale suggestion review comment (C4).
	failedReport, _ := github.DecodeReport(strings.NewReader(loadFixture(t, "failed_report.json")))
	later := commenter.Post(context.Background(), target, failedReport)
	if later.Status != audit.FeedbackUpdated {
		t.Fatalf("expected later run to update existing comment, got %+v", later)
	}
	issues := srv.GetIssueComments()
	if len(issues) != 3 {
		t.Fatalf("expected still 3 issue comments total, got %d", len(issues))
	}
	if !strings.Contains(issues[2].Body, fmt.Sprintf("run=%s", failedReport.JobID)) ||
		!strings.Contains(issues[2].Body, "No change is proposed") {
		t.Errorf("expected summary comment updated in place with failed body, got: %s", issues[2].Body)
	}
	if len(srv.GetReviewComments()) != 0 {
		t.Errorf("expected stale suggestion review comment deleted when later run fails, got %+v", srv.GetReviewComments())
	}
}
