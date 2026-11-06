package webhook

import (
	"encoding/json"
	"fmt"
	"time"
)

// ParseEvent parses GitHub webhook payload bytes into a WebhookEvent and determines
// whether it qualifies for automated container remediation.
func ParseEvent(eventType, deliveryID, signature string, payload []byte) (*WebhookEvent, bool, error) {
	var raw GitHubCheckRunPayload
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, false, fmt.Errorf("failed to parse webhook payload JSON: %w", err)
	}

	event := &WebhookEvent{
		EventType:     eventType,
		DeliveryID:    deliveryID,
		Signature:     signature,
		RepositoryURL: raw.Repository.CloneURL,
		RepoFullName:  raw.Repository.FullName,
		ReceivedAt:    time.Now().UTC(),
	}

	switch eventType {
	case "check_run":
		cr := raw.CheckRun
		event.HeadCommitSHA = cr.HeadSHA
		event.CheckRunConclusion = cr.Conclusion

		if len(cr.PullRequests) > 0 {
			event.PullRequestNumber = cr.PullRequests[0].Number
			event.TargetBranch = cr.PullRequests[0].Head.Ref
			if event.HeadCommitSHA == "" {
				event.HeadCommitSHA = cr.PullRequests[0].Head.SHA
			}
		}

		// Qualify only completed check_runs with failure or timed_out on pull requests
		isFailure := cr.Conclusion == "failure" || cr.Conclusion == "timed_out"
		isCompleted := raw.Action == "completed" || cr.Status == "completed"
		shouldRemediate := isCompleted && isFailure && event.PullRequestNumber > 0

		return event, shouldRemediate, nil

	case "workflow_run":
		wr := raw.WorkflowRun
		event.HeadCommitSHA = wr.HeadSHA
		event.TargetBranch = wr.HeadBranch
		event.CheckRunConclusion = wr.Conclusion

		if len(wr.PullRequests) > 0 {
			event.PullRequestNumber = wr.PullRequests[0].Number
		}

		isFailure := wr.Conclusion == "failure"
		isCompleted := raw.Action == "completed"
		shouldRemediate := isCompleted && isFailure && event.PullRequestNumber > 0

		return event, shouldRemediate, nil

	default:
		// Ping or unsupported events parse successfully but do not trigger remediation
		return event, false, nil
	}
}
