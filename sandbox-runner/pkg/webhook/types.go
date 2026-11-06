package webhook

import (
	"time"
)

// WebhookEvent represents an incoming GitHub webhook delivery parsed after signature verification.
type WebhookEvent struct {
	EventType          string    `json:"event_type"`
	DeliveryID         string    `json:"delivery_id"`
	Signature          string    `json:"signature"`
	RepositoryURL      string    `json:"repository_url"`
	RepoFullName       string    `json:"repo_full_name"`
	TargetBranch       string    `json:"target_branch"`
	HeadCommitSHA      string    `json:"head_commit_sha"`
	PullRequestNumber  int       `json:"pull_request_number"`
	CheckRunConclusion string    `json:"check_run_conclusion"`
	ReceivedAt         time.Time `json:"received_at"`
}

// GitHubCheckRunPayload represents the relevant subset of a GitHub check_run webhook event.
type GitHubCheckRunPayload struct {
	Action   string `json:"action"`
	CheckRun struct {
		ID           int64  `json:"id"`
		Name         string `json:"name"`
		HeadSHA      string `json:"head_sha"`
		Status       string `json:"status"`
		Conclusion   string `json:"conclusion"`
		PullRequests []struct {
			Number int `json:"number"`
			Head   struct {
				Ref string `json:"ref"`
				SHA string `json:"sha"`
			} `json:"head"`
		} `json:"pull_requests"`
	} `json:"check_run"`
	WorkflowRun struct {
		ID           int64  `json:"id"`
		Name         string `json:"name"`
		HeadSHA      string `json:"head_sha"`
		HeadBranch   string `json:"head_branch"`
		Conclusion   string `json:"conclusion"`
		PullRequests []struct {
			Number int `json:"number"`
		} `json:"pull_requests"`
	} `json:"workflow_run"`
	Repository struct {
		FullName      string `json:"full_name"`
		CloneURL      string `json:"clone_url"`
		DefaultBranch string `json:"default_branch"`
	} `json:"repository"`
}
