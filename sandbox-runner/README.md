# sandbox-runner

An isolated Docker-based test runner CLI and library written in Go.

## Overview

`sandbox-runner` executes test commands inside containerized, isolated Docker environments. It enforces:

- Volume mounting of the target repository with host directory isolation.
- Configurable execution timeouts with forceful container cleanup.
- Environment variable sanitization.
- Structured JSON output envelope capturing command status, stdout, stderr, and exit code.

## Layout

```text
sandbox-runner/
├── cmd/
│   └── sandbox-runner/
│       ├── main.go          # CLI entrypoint
│       └── main_test.go     # CLI argument validation tests
├── pkg/
│   └── sandbox/
│       ├── client.go        # Docker client interface and abstraction
│       ├── runner.go        # Execution engine and container lifecycle
│       ├── runner_test.go   # Unit and integration test suite
│       └── types.go         # Domain models and envelope types
├── go.mod                   # Go module definition
├── go.sum                   # Go checksums
└── README.md
```

## Usage

### Run Tests

```bash
# Run unit and integration tests
go test -v ./...
```

### CLI Execution

```bash
# Execute npm test inside an isolated container
go run ./cmd/sandbox-runner -repo . -cmd "npm test" -timeout 60s -image "node:24-alpine"
```
