package github

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// LineRanges maps a repository-relative file path to inclusive [start, end] line ranges on the RIGHT side.
type LineRanges map[string][][2]int

var hunkRightHeader = regexp.MustCompile(`^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@`)

type pullFileResponse struct {
	Filename string `json:"filename"`
	Patch    string `json:"patch"`
}

// ChangedLines fetches the files changed by a pull request and parses right-side changed line ranges.
// Missing patches or API errors degrade gracefully so suggestion blocks are simply omitted.
func (c *Commenter) ChangedLines(ctx context.Context, repoFullName string, prNumber int) (LineRanges, error) {
	if c == nil || c.client == nil || !c.client.HasToken() {
		return LineRanges{}, nil
	}
	ranges := make(LineRanges)
	for page := 1; page <= 10; page++ {
		path := fmt.Sprintf("/repos/%s/pulls/%d/files?per_page=100&page=%d", repoFullName, prNumber, page)
		var files []pullFileResponse
		_, err := c.client.doJSON(ctx, "GET", path, nil, &files)
		if err != nil {
			return LineRanges{}, err
		}
		if len(files) == 0 {
			break
		}
		for _, f := range files {
			if f.Filename == "" || f.Patch == "" {
				continue
			}
			spans := ParsePatchRightRanges(f.Patch)
			if len(spans) > 0 {
				ranges[f.Filename] = append(ranges[f.Filename], spans...)
			}
		}
		if len(files) < 100 {
			break
		}
	}
	return ranges, nil
}

// ParsePatchRightRanges extracts inclusive [start, end] line ranges on the RIGHT side of a unified diff patch.
func ParsePatchRightRanges(patch string) [][2]int {
	var out [][2]int
	for _, line := range strings.Split(patch, "\n") {
		m := hunkRightHeader.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		start, err := strconv.Atoi(m[1])
		if err != nil || start < 1 {
			continue
		}
		count := 1
		if m[2] != "" {
			if parsed, err := strconv.Atoi(m[2]); err == nil {
				count = parsed
			}
		}
		if count <= 0 {
			continue
		}
		out = append(out, [2]int{start, start + count - 1})
	}
	return out
}

// WritePRFilesJSON writes LineRanges to path as JSON ({ "file": [[start, end], ...] }).
func WritePRFilesJSON(path string, ranges LineRanges) error {
	if ranges == nil {
		ranges = LineRanges{}
	}
	data, err := json.MarshalIndent(ranges, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal pr-files JSON: %w", err)
	}
	return os.WriteFile(path, data, 0o644)
}
