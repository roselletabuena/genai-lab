package github_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
)

func loadFixture(t *testing.T, name string) string {
	t.Helper()
	p := filepath.Join("..", "..", "testdata", "feedback", name)
	data, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", name, err)
	}
	return string(data)
}

func TestDecodeReport_ValidFixtures(t *testing.T) {
	for _, name := range []string{"verified_fix_report.json", "suggestion_report.json", "failed_report.json"} {
		raw := loadFixture(t, name)
		rep, err := github.DecodeReport(strings.NewReader(raw))
		if err != nil {
			t.Fatalf("DecodeReport(%s) returned unexpected error: %v", name, err)
		}
		if rep.SchemaVersion != "1.0" || rep.JobID == "" {
			t.Errorf("unexpected decoded report for %s: %+v", name, rep)
		}
	}
}

func TestDecodeReport_RejectsInvalidPayloads(t *testing.T) {
	validFailed := loadFixture(t, "failed_report.json")

	cases := []struct {
		name string
		body string
	}{
		{
			name: "unknown_field",
			body: strings.Replace(validFailed, `"verdict": "failed"`, `"verdict": "failed", "extra": 123`, 1),
		},
		{
			name: "missing_job_id",
			body: strings.Replace(validFailed, `"job_id": "job-200"`, `"job_id": ""`, 1),
		},
		{
			name: "markdown_body_exceeds_60000",
			body: strings.Replace(validFailed, "No change is proposed.", strings.Repeat("x", 60005), 1),
		},
		{
			name: "failed_with_diff_field",
			body: strings.Replace(
				validFailed,
				`"verdict": "failed"`,
				`"verdict": "failed", "diff": {"unified_diff": "--- a/x\n+++ b/x\n", "target_files": ["x.py"]}`,
				1,
			),
		},
		{
			name: "failed_with_diff_fence_in_body",
			body: strings.Replace(validFailed, "No change is proposed.", "```diff\\n+bad\\n```", 1),
		},
		{
			name: "failed_with_suggestion_fence_in_body",
			body: strings.Replace(validFailed, "No change is proposed.", "```suggestion\\n+bad\\n```", 1),
		},
		{
			name: "failed_with_commit_link_in_body",
			body: strings.Replace(validFailed, "No change is proposed.", "[View commit](https://example.com)", 1),
		},
		{
			name: "missing_marker",
			body: strings.Replace(validFailed, "<!-- remediation-agent:pr-feedback run=job-200 -->", "no marker", 1),
		},
		{
			name: "duplicated_marker",
			body: strings.Replace(
				validFailed,
				"<!-- remediation-agent:pr-feedback run=job-200 -->",
				"<!-- remediation-agent:pr-feedback run=job-200 -->\\n<!-- remediation-agent:pr-feedback run=job-200 -->",
				1,
			),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := github.DecodeReport(strings.NewReader(tc.body)); err == nil {
				t.Errorf("expected error for %s, got nil", tc.name)
			}
		})
	}
}
