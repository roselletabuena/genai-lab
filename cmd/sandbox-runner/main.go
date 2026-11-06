package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/roselletabuena/genai-lab/pkg/sandbox"
)

type stringSliceFlag []string

func (s *stringSliceFlag) String() string {
	return strings.Join(*s, ",")
}

func (s *stringSliceFlag) Set(val string) error {
	*s = append(*s, val)
	return nil
}

func main() {
	repoPath := flag.String("repo", ".", "Path to the repository to mount inside the container")
	cmdStr := flag.String("cmd", "", "Test command to execute (e.g. 'npm test')")
	image := flag.String("image", "node:24-alpine", "Docker image to run tests in")
	timeoutStr := flag.String("timeout", "60s", "Maximum execution timeout (e.g. 30s, 60s, 2m)")
	jsonOutput := flag.Bool("json", true, "Output structured JSON envelope to stdout")

	var envFlags stringSliceFlag
	flag.Var(&envFlags, "env", "Explicit environment variables (KEY=VAL) to pass to container (may be repeated)")

	flag.Parse()

	// If extra arguments were passed after flags and -cmd was not provided, use them as cmd
	var testCmd []string
	if *cmdStr != "" {
		testCmd = strings.Fields(*cmdStr)
	} else if flag.NArg() > 0 {
		testCmd = flag.Args()
	}

	if len(testCmd) == 0 {
		fmt.Fprintln(os.Stderr, "Error: test command is required (via -cmd flag or positional arguments)")
		flag.Usage()
		os.Exit(1)
	}

	timeout, err := time.ParseDuration(*timeoutStr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid timeout duration %q: %v\n", *timeoutStr, err)
		os.Exit(1)
	}

	dockerClient, err := sandbox.NewDefaultDockerClient()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to initialize Docker client: %v\n", err)
		os.Exit(1)
	}

	runner := sandbox.NewRunner(dockerClient)
	cfg := sandbox.Config{
		RepoPath: *repoPath,
		TestCmd:  testCmd,
		Image:    *image,
		Timeout:  timeout,
		Env:      envFlags,
	}

	result, runErr := runner.Run(context.Background(), cfg)
	if runErr != nil {
		fmt.Fprintf(os.Stderr, "Runner error: %v\n", runErr)
		os.Exit(1)
	}

	if *jsonOutput {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(result); err != nil {
			fmt.Fprintf(os.Stderr, "Error encoding JSON envelope: %v\n", err)
			os.Exit(1)
		}
	} else {
		if result.Stdout != "" {
			fmt.Print(result.Stdout)
		}
		if result.Stderr != "" {
			fmt.Fprint(os.Stderr, result.Stderr)
		}
		if result.TimedOut {
			fmt.Fprintf(os.Stderr, "\n[TIMEOUT] %s\n", result.Error)
		}
	}

	os.Exit(result.ExitCode)
}
