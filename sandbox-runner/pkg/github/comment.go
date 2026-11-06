package github

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/audit"
)

// PRTarget identifies the pull request receiving feedback.
type PRTarget struct {
	RepoFullName      string
	PullRequestNumber int
	HeadCommitSHA     string
}

// Commenter posts and updates pull request feedback comments idempotently.
type Commenter struct {
	client *Client
}

// NewCommenter creates a Commenter backed by client.
func NewCommenter(client *Client) *Commenter {
	return &Commenter{client: client}
}

type prResponse struct {
	State string `json:"state"`
}

type issueComment struct {
	ID   int64  `json:"id"`
	Body string `json:"body"`
}

type reviewComment struct {
	ID   int64  `json:"id"`
	Body string `json:"body"`
}

// Post validates and posts (or updates in place) the summary comment and optional suggestion review comment.
func (c *Commenter) Post(ctx context.Context, target PRTarget, report *FeedbackReport) audit.FeedbackOutcome {
	if c == nil || c.client == nil || !c.client.HasToken() {
		return audit.FeedbackOutcome{
			Status:   audit.FeedbackSkipped,
			Reason:   "no_credentials",
			Attempts: 0,
		}
	}
	if report == nil {
		return audit.FeedbackOutcome{
			Status:   audit.FeedbackSkipped,
			Reason:   "no_report",
			Attempts: 0,
		}
	}
	if err := ValidateReport(report); err != nil {
		return audit.FeedbackOutcome{
			Status:   audit.FeedbackSkipped,
			Reason:   "no_report",
			Attempts: 0,
		}
	}

	// Second-pass defense-in-depth secret scrubbing before any network call.
	body := Redact(report.MarkdownBody)
	if report.Verdict == VerdictFailed && ContainsCodeProposalFence(body) {
		return audit.FeedbackOutcome{
			Status:   audit.FeedbackFailed,
			Reason:   "unsafe_failed_body",
			Attempts: 0,
		}
	}

	totalAttempts := 0

	// Step 1: Check PR state.
	var pr prResponse
	attempts, err := c.client.doJSON(
		ctx,
		"GET",
		fmt.Sprintf("/repos/%s/pulls/%d", target.RepoFullName, target.PullRequestNumber),
		nil,
		&pr,
	)
	totalAttempts += attempts
	if err != nil {
		return failureOutcome(err, totalAttempts)
	}
	if !strings.EqualFold(pr.State, "open") {
		return audit.FeedbackOutcome{
			Status:   audit.FeedbackSkipped,
			Reason:   "pr_closed",
			Attempts: totalAttempts,
		}
	}

	// Step 2: Find existing marker-tagged summary comment (paginated).
	existingID, listAttempts, err := c.findExistingSummaryComment(ctx, target)
	totalAttempts += listAttempts
	if err != nil {
		return failureOutcome(err, totalAttempts)
	}

	// Step 3: Create or update summary comment.
	var summaryResp issueComment
	status := audit.FeedbackPosted
	if existingID != 0 {
		status = audit.FeedbackUpdated
		a, err := c.client.doJSON(
			ctx,
			"PATCH",
			fmt.Sprintf("/repos/%s/issues/comments/%d", target.RepoFullName, existingID),
			map[string]any{"body": body},
			&summaryResp,
		)
		totalAttempts += a
		if err != nil {
			return failureOutcome(err, totalAttempts)
		}
	} else {
		a, err := c.client.doJSON(
			ctx,
			"POST",
			fmt.Sprintf("/repos/%s/issues/%d/comments", target.RepoFullName, target.PullRequestNumber),
			map[string]any{"body": body},
			&summaryResp,
		)
		totalAttempts += a
		if err != nil {
			return failureOutcome(err, totalAttempts)
		}
	}
	summaryID := summaryResp.ID

	// Step 4 & 5: Upsert or delete suggestion review comment.
	var suggestionID *int64
	suggID, suggAttempts, suggErr := c.syncSuggestionComment(ctx, target, report)
	totalAttempts += suggAttempts
	if suggErr == nil && suggID != 0 {
		suggestionID = &suggID
	}

	return audit.FeedbackOutcome{
		Status:              status,
		SummaryCommentID:    &summaryID,
		SuggestionCommentID: suggestionID,
		Attempts:            totalAttempts,
	}
}

func (c *Commenter) findExistingSummaryComment(ctx context.Context, target PRTarget) (int64, int, error) {
	totalAttempts := 0
	for page := 1; page <= 20; page++ {
		path := fmt.Sprintf(
			"/repos/%s/issues/%d/comments?per_page=100&page=%d",
			target.RepoFullName,
			target.PullRequestNumber,
			page,
		)
		var comments []issueComment
		a, err := c.client.doJSON(ctx, "GET", path, nil, &comments)
		totalAttempts += a
		if err != nil {
			return 0, totalAttempts, err
		}
		for _, ic := range comments {
			if strings.Contains(ic.Body, MarkerPrefix) {
				return ic.ID, totalAttempts, nil
			}
		}
		if len(comments) == 0 {
			break
		}
	}
	return 0, totalAttempts, nil
}

func (c *Commenter) findExistingSuggestionComment(ctx context.Context, target PRTarget) (int64, int, error) {
	path := fmt.Sprintf("/repos/%s/pulls/%d/comments?per_page=100", target.RepoFullName, target.PullRequestNumber)
	var comments []reviewComment
	a, err := c.client.doJSON(ctx, "GET", path, nil, &comments)
	if err != nil {
		return 0, a, err
	}
	for _, rc := range comments {
		if strings.Contains(rc.Body, SuggestionMarker) {
			return rc.ID, a, nil
		}
	}
	return 0, a, nil
}

func (c *Commenter) syncSuggestionComment(ctx context.Context, target PRTarget, report *FeedbackReport) (int64, int, error) {
	existingID, totalAttempts, err := c.findExistingSuggestionComment(ctx, target)
	if err != nil {
		return 0, totalAttempts, err
	}

	hasEligibleSuggestion := report.Verdict == VerdictVerifiedFix && report.Suggestion != nil
	if !hasEligibleSuggestion {
		if existingID != 0 {
			a, delErr := c.client.doJSON(
				ctx,
				"DELETE",
				fmt.Sprintf("/repos/%s/pulls/comments/%d", target.RepoFullName, existingID),
				nil,
				nil,
			)
			totalAttempts += a
			return 0, totalAttempts, delErr
		}
		return 0, totalAttempts, nil
	}

	sugg := report.Suggestion
	replacement := Redact(sugg.Replacement)
	suggBody := fmt.Sprintf("%s\n```suggestion\n%s\n```\n", SuggestionMarker, replacement)

	if existingID != 0 {
		var updated reviewComment
		a, patchErr := c.client.doJSON(
			ctx,
			"PATCH",
			fmt.Sprintf("/repos/%s/pulls/comments/%d", target.RepoFullName, existingID),
			map[string]any{"body": suggBody},
			&updated,
		)
		totalAttempts += a
		return updated.ID, totalAttempts, patchErr
	}

	payload := map[string]any{
		"body":      suggBody,
		"commit_id": target.HeadCommitSHA,
		"path":      sugg.Path,
		"line":      sugg.Line,
		"side":      "RIGHT",
	}
	if sugg.StartLine > 0 && sugg.StartLine < sugg.Line {
		payload["start_line"] = sugg.StartLine
		payload["start_side"] = "RIGHT"
	}
	var created reviewComment
	a, postErr := c.client.doJSON(
		ctx,
		"POST",
		fmt.Sprintf("/repos/%s/pulls/%d/comments", target.RepoFullName, target.PullRequestNumber),
		payload,
		&created,
	)
	totalAttempts += a
	return created.ID, totalAttempts, postErr
}

func failureOutcome(err error, attempts int) audit.FeedbackOutcome {
	reason := "unknown_error"
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.Reason != "" {
		reason = apiErr.Reason
	}
	return audit.FeedbackOutcome{
		Status:   audit.FeedbackFailed,
		Reason:   reason,
		Attempts: attempts,
	}
}
