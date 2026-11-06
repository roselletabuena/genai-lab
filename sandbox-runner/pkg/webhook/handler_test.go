package webhook_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
)

type mockEnqueuer struct {
	enqueueFn func(event *webhook.WebhookEvent) (string, error)
}

func (m *mockEnqueuer) Enqueue(event *webhook.WebhookEvent) (string, error) {
	if m.enqueueFn != nil {
		return m.enqueueFn(event)
	}
	return "job-test-12345", nil
}

func TestWebhookHandler_Unauthorized(t *testing.T) {
	enqueuer := &mockEnqueuer{}
	handler := webhook.NewHandler("correct-secret", enqueuer)

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(`{"action":"completed"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "check_run")
	req.Header.Set("X-Hub-Signature-256", "sha256=invalid0000000000000000000000000000000000000000000000000000000000")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got %d", rec.Code)
	}
}

func TestWebhookHandler_IgnoredEvent_200OK(t *testing.T) {
	secret := "correct-secret"
	enqueuer := &mockEnqueuer{}
	handler := webhook.NewHandler(secret, enqueuer)

	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_success.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "check_run")
	req.Header.Set("X-GitHub-Delivery", "deliv-success")
	req.Header.Set("X-Hub-Signature-256", sig)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK for ignored non-failing event, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

func TestWebhookHandler_FailingEvent_202Accepted(t *testing.T) {
	secret := "correct-secret"
	enqueuer := &mockEnqueuer{
		enqueueFn: func(event *webhook.WebhookEvent) (string, error) {
			if event.PullRequestNumber != 55 {
				t.Errorf("expected PR number 55, got %d", event.PullRequestNumber)
			}
			return "job-pr55-abc1234", nil
		},
	}
	handler := webhook.NewHandler(secret, enqueuer)

	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_failure.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "check_run")
	req.Header.Set("X-GitHub-Delivery", "deliv-failure")
	req.Header.Set("X-Hub-Signature-256", sig)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202 Accepted, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "job-pr55-abc1234") {
		t.Errorf("expected response to contain job id, got %s", rec.Body.String())
	}
}

func TestWebhookHandler_QueueFull_429TooManyRequests(t *testing.T) {
	secret := "correct-secret"
	enqueuer := &mockEnqueuer{
		enqueueFn: func(event *webhook.WebhookEvent) (string, error) {
			return "", webhook.ErrQueueFull
		},
	}
	handler := webhook.NewHandler(secret, enqueuer)

	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_failure.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "check_run")
	req.Header.Set("X-GitHub-Delivery", "deliv-failure")
	req.Header.Set("X-Hub-Signature-256", sig)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 Too Many Requests, got %d", rec.Code)
	}
	retryAfter := rec.Header().Get("Retry-After")
	if retryAfter != "60" {
		t.Errorf("expected Retry-After: 60 header, got '%s'", retryAfter)
	}
}

func TestHealthzHandler(t *testing.T) {
	handler := webhook.NewHandler("secret", &mockEnqueuer{})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /healthz, got %d", rec.Code)
	}
}

func TestWebhookHandler_CloudflareTunnelAndGHForwardHeaders_LatencyUnder100ms(t *testing.T) {
	secret := "cloudflare-tunnel-secret"
	enqueuer := &mockEnqueuer{
		enqueueFn: func(event *webhook.WebhookEvent) (string, error) {
			return "job-cf-tunnel-001", nil
		},
	}
	handler := webhook.NewHandler(secret, enqueuer)

	fixturePath := filepath.Join("..", "..", "testdata", "webhooks", "check_run_failure.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(string(data)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", "check_run")
	req.Header.Set("X-GitHub-Delivery", "cf-tunnel-deliv-001")
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("Cf-Connecting-Ip", "192.0.2.1")
	req.Header.Set("Cf-Ray", "89abcdef01234567-SIN")
	req.Header.Set("X-Forwarded-Proto", "https")

	start := time.Now()
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	elapsed := time.Since(start)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202 Accepted via Cloudflare Tunnel headers, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	if elapsed >= 100*time.Millisecond {
		t.Errorf("expected webhook response latency < 100ms (AC3), took %v", elapsed)
	}
	if !strings.Contains(rec.Body.String(), "job-cf-tunnel-001") {
		t.Errorf("expected response to contain job id, got %s", rec.Body.String())
	}
}
