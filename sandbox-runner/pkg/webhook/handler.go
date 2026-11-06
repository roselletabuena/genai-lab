package webhook

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

// ErrQueueFull is returned when the internal remediation job queue has reached capacity.
var ErrQueueFull = errors.New("job queue capacity reached")

// Enqueuer abstracts task submission to the worker queue.
type Enqueuer interface {
	Enqueue(event *WebhookEvent) (string, error)
}

// Handler manages HTTP routing for webhook delivery and health checking.
type Handler struct {
	secret    string
	enqueuer  Enqueuer
	mux       *http.ServeMux
	startTime time.Time
}

// NewHandler initializes a new webhook and healthz HTTP handler.
func NewHandler(secret string, enqueuer Enqueuer) *Handler {
	h := &Handler{
		secret:    secret,
		enqueuer:  enqueuer,
		mux:       http.NewServeMux(),
		startTime: time.Now().UTC(),
	}

	h.mux.HandleFunc("/webhook", h.handleWebhook)
	h.mux.HandleFunc("/healthz", h.handleHealthz)

	return h
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

func (h *Handler) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method_not_allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Protect against oversized payload attacks (10MB maximum ceiling)
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "bad_request",
			"message": "payload exceeds maximum allowed limit or cannot be read",
		})
		return
	}

	sigHeader := r.Header.Get("X-Hub-Signature-256")
	if !VerifySignature(body, sigHeader, h.secret) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "unauthorized",
			"message": "invalid or missing HMAC SHA-256 signature",
		})
		return
	}

	eventType := r.Header.Get("X-GitHub-Event")
	deliveryID := r.Header.Get("X-GitHub-Delivery")

	event, shouldRemediate, err := ParseEvent(eventType, deliveryID, sigHeader, body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "bad_request",
			"message": err.Error(),
		})
		return
	}

	if !shouldRemediate {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ignored",
			"reason": "event conclusion is not a qualifying failure on a pull request",
		})
		return
	}

	jobID, err := h.enqueuer.Enqueue(event)
	if err != nil {
		if errors.Is(err, ErrQueueFull) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":   "too_many_requests",
				"message": "job queue capacity reached, retry after 60 seconds",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "internal_server_error",
			"message": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":      "queued",
		"job_id":      jobID,
		"delivery_id": deliveryID,
		"message":     "remediation job successfully enqueued",
	})
}

func (h *Handler) handleHealthz(w http.ResponseWriter, r *http.Request) {
	uptime := int64(time.Since(h.startTime).Seconds())
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "healthy",
		"uptime_seconds": uptime,
	})
}
