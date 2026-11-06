package github_test

import (
	"context"
	"strings"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata/githubmock"
)

func TestRedact_ScrubsTokensAndAssignments(t *testing.T) {
	input := strings.Join([]string{
		"leaked ghp_1234567890abcdefghijklmnopqrstuvwx here",
		"pat github_pat_11AABBCCDDEEFF00112233445566778899aabbccddeeff",
		"aws AKIAIOSFODNN7EXAMPLE",
		"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload",
		"API_SECRET = super-secret-val",
		"export DB_PASSWORD=my-db-pass",
		"safe_line = visible",
	}, "\n")

	out := github.Redact(input)
	for _, secret := range []string{
		"ghp_1234567890abcdefghijklmnopqrstuvwx",
		"github_pat_11AABBCCDDEEFF00112233445566778899aabbccddeeff",
		"AKIAIOSFODNN7EXAMPLE",
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
		"super-secret-val",
		"my-db-pass",
	} {
		if strings.Contains(out, secret) {
			t.Errorf("expected secret %q to be redacted, got:\n%s", secret, out)
		}
	}
	if !strings.Contains(out, "safe_line = visible") {
		t.Errorf("expected non-secret line preserved, got:\n%s", out)
	}
}

func TestCommenter_AppliesSecondPassRedactionToBodyAndSuggestion(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "test-token",
	})
	commenter := github.NewCommenter(client)

	testLog := "ok"
	rep := &github.FeedbackReport{
		SchemaVersion: "1.0",
		Verdict:       github.VerdictVerifiedFix,
		JobID:         "job-sec",
		SessionID:     "sess-sec",
		Diagnosis:     "bug",
		DurationMs:    100,
		Attempts: []github.AttemptSummary{
			{AttemptNumber: 1, Outcome: "verified_success", DurationMs: 100},
		},
		Diff: &github.VerifiedDiff{
			UnifiedDiff: "--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-x\n+y\n",
			TargetFiles: []string{"a.py"},
		},
		TestLog: &testLog,
		Suggestion: &github.SuggestionSpec{
			Path:        "a.py",
			StartLine:   1,
			Line:        1,
			Replacement: "TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwx",
		},
		MarkdownBody: "<!-- remediation-agent:pr-feedback run=job-sec -->\nBody with AKIAIOSFODNN7EXAMPLE\n",
	}

	outcome := commenter.Post(context.Background(), github.PRTarget{
		RepoFullName:      "org/repo",
		PullRequestNumber: 1,
		HeadCommitSHA:     "sha1",
	}, rep)
	if outcome.Status != audit.FeedbackPosted {
		t.Fatalf("expected posted, got %+v", outcome)
	}

	issues := srv.GetIssueComments()
	if len(issues) != 1 || strings.Contains(issues[0].Body, "AKIAIOSFODNN7EXAMPLE") {
		t.Errorf("expected issue comment body redacted, got: %+v", issues)
	}
	reviews := srv.GetReviewComments()
	if len(reviews) != 1 || strings.Contains(reviews[0].Body, "ghp_1234567890abcdefghijklmnopqrstuvwx") {
		t.Errorf("expected suggestion replacement redacted, got: %+v", reviews)
	}
}
