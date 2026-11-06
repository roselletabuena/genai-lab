package github_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/github"
	"github.com/roselletabuena/genai-lab/sandbox-runner/testdata/githubmock"
)

func TestChangedLines_ParsesRightSideRangesAndWritesJSON(t *testing.T) {
	srv := githubmock.NewServer()
	defer srv.Close()

	srv.PRFiles = []githubmock.PRFile{
		{
			Filename: "src/math_utils.py",
			Patch:    "@@ -4,3 +5,8 @@\n context\n+added\n@@ -20,1 +30,2 @@\n+more",
		},
		{
			Filename: "binary.dat",
			Patch:    "", // large or binary file with no patch
		},
	}

	client := github.NewClient(github.ClientConfig{
		BaseURL: srv.URL,
		Token:   "test-token",
	})
	commenter := github.NewCommenter(client)

	ranges, err := commenter.ChangedLines(context.Background(), "org/repo", 7)
	if err != nil {
		t.Fatalf("ChangedLines returned error: %v", err)
	}
	spans, ok := ranges["src/math_utils.py"]
	if !ok || len(spans) != 2 {
		t.Fatalf("expected 2 spans for src/math_utils.py, got %+v", ranges)
	}
	if spans[0] != [2]int{5, 12} || spans[1] != [2]int{30, 31} {
		t.Errorf("unexpected spans: %+v", spans)
	}
	if _, hasBinary := ranges["binary.dat"]; hasBinary {
		t.Errorf("expected file without patch to have no ranges")
	}

	outPath := filepath.Join(t.TempDir(), "job-1.pr-files.json")
	if err := github.WritePRFilesJSON(outPath, ranges); err != nil {
		t.Fatalf("WritePRFilesJSON failed: %v", err)
	}
	raw, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	var decoded map[string][][2]int
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if len(decoded["src/math_utils.py"]) != 2 {
		t.Errorf("unexpected JSON content: %s", string(raw))
	}
}
