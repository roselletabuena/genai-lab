package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestCLIArgumentValidation(t *testing.T) {
	// Build or run binary without arguments to verify error handling
	cmd := exec.Command("go", "run", ".", "-repo", ".")
	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("expected command to fail when no test command is specified, but it succeeded: %s", string(output))
	}

	outStr := string(output)
	if !strings.Contains(outStr, "test command is required") {
		t.Errorf("expected output to mention 'test command is required', got: %s", outStr)
	}
}
