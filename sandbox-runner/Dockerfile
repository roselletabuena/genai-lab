# Build stage for the Go webhook supervisor daemon and sandbox-runner CLI
FROM golang:1.22-alpine AS go-builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src/sandbox-runner
COPY sandbox-runner/go.mod sandbox-runner/go.sum ./
RUN go mod download

COPY sandbox-runner/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/daemon ./cmd/daemon && \
    CGO_ENABLED=0 GOOS=linux go build -o /out/sandbox-runner ./cmd/sandbox-runner

# Runtime stage with Go binaries, Python 3.12+ agent environment, and Git 2.20+
FROM python:3.12-alpine

RUN apk add --no-cache git docker-cli ca-certificates bash curl

COPY --from=go-builder /out/daemon /usr/local/bin/daemon
COPY --from=go-builder /out/sandbox-runner /usr/local/bin/sandbox-runner

WORKDIR /workspace/agent
COPY agent/pyproject.toml agent/README.md ./
COPY agent/src/ ./src/
RUN pip install --no-cache-dir -e .

WORKDIR /workspace
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/daemon"]
