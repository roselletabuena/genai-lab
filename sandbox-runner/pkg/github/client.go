package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the production GitHub REST API base URL.
	DefaultBaseURL = "https://api.github.com"
	// DefaultTimeout is the per-request HTTP timeout.
	DefaultTimeout = 30 * time.Second
	// MaxRetries is the maximum number of attempts per logical request.
	MaxRetries = 4
	// MaxRateLimitWait is the maximum duration the client will wait on Retry-After / X-RateLimit-Reset.
	MaxRateLimitWait = 60 * time.Second
	// APIVersion is the GitHub REST API version header value.
	APIVersion = "2022-11-28"
	// UserAgent identifies the remediation supervisor to GitHub.
	UserAgent = "genai-lab-remediation"
)

// Sleeper abstracts time.Sleep so unit tests can verify backoff deterministically without waiting.
type Sleeper func(d time.Duration)

// ClientConfig configures the GitHub REST API client.
type ClientConfig struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
	Sleeper    Sleeper
	Now        func() time.Time
	Jitter     func(max time.Duration) time.Duration
}

// Client is a minimal, dependency-free GitHub REST API client with bounded retries and rate-limit handling.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
	sleep      Sleeper
	now        func() time.Time
	jitter     func(max time.Duration) time.Duration
}

// APIError represents a non-2xx response from the GitHub REST API.
type APIError struct {
	StatusCode  int
	Reason      string
	RateLimited bool
	Retryable   bool
	Attempts    int
}

func (e *APIError) Error() string {
	return fmt.Sprintf("github api error: status=%d reason=%s attempts=%d", e.StatusCode, e.Reason, e.Attempts)
}

// NewClient constructs a Client, reading GITHUB_TOKEN and GITHUB_API_URL when not explicitly provided in cfg.
func NewClient(cfg ClientConfig) *Client {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		if envURL := strings.TrimRight(os.Getenv("GITHUB_API_URL"), "/"); envURL != "" {
			baseURL = envURL
		} else {
			baseURL = DefaultBaseURL
		}
	}
	token := cfg.Token
	if token == "" {
		token = os.Getenv("GITHUB_TOKEN")
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: DefaultTimeout}
	}
	sl := cfg.Sleeper
	if sl == nil {
		sl = time.Sleep
	}
	nowFn := cfg.Now
	if nowFn == nil {
		nowFn = time.Now
	}
	jitterFn := cfg.Jitter
	if jitterFn == nil {
		jitterFn = func(max time.Duration) time.Duration {
			if max <= 0 {
				return 0
			}
			return time.Duration(rand.Int63n(int64(max)))
		}
	}
	return &Client{
		baseURL:    baseURL,
		token:      token,
		httpClient: hc,
		sleep:      sl,
		now:        nowFn,
		jitter:     jitterFn,
	}
}

// HasToken reports whether a non-empty GitHub token is configured.
func (c *Client) HasToken() bool {
	return strings.TrimSpace(c.token) != ""
}

// String prevents accidental token leakage if Client is formatted.
func (c *Client) String() string {
	return fmt.Sprintf("github.Client{baseURL:%q, hasToken:%v}", c.baseURL, c.HasToken())
}

// doJSON executes an HTTP request with retry/backoff and decodes the response body if out != nil.
// Returns the total number of attempts used.
func (c *Client) doJSON(ctx context.Context, method, path string, in any, out any) (int, error) {
	var bodyBytes []byte
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return 0, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyBytes = b
	}

	url := c.baseURL + path
	baseBackoffs := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second}

	for attempt := 1; attempt <= MaxRetries; attempt++ {
		var bodyReader io.Reader
		if bodyBytes != nil {
			bodyReader = bytes.NewReader(bodyBytes)
		}
		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return attempt, err
		}
		req.Header.Set("Authorization", "Bearer "+c.token)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", APIVersion)
		req.Header.Set("User-Agent", UserAgent)
		if bodyBytes != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if attempt == MaxRetries || ctx.Err() != nil {
				return attempt, &APIError{
					StatusCode: 0,
					Reason:     "network_error",
					Retryable:  true,
					Attempts:   attempt,
				}
			}
			backoff := baseBackoffs[attempt-1] + c.jitter(250*time.Millisecond)
			c.sleep(backoff)
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out != nil && len(respBody) > 0 {
				if err := json.Unmarshal(respBody, out); err != nil {
					return attempt, fmt.Errorf("failed to decode response JSON: %w", err)
				}
			}
			return attempt, nil
		}

		// Rate limit handling (429 or 403 with Retry-After / X-RateLimit-Reset).
		if wait, isRateLimit := c.parseRateLimitWait(resp.Header, resp.StatusCode); isRateLimit {
			if wait > MaxRateLimitWait || attempt == MaxRetries {
				return attempt, &APIError{
					StatusCode:  resp.StatusCode,
					Reason:      "rate_limited",
					RateLimited: true,
					Retryable:   false,
					Attempts:    attempt,
				}
			}
			c.sleep(wait)
			continue
		}

		// Transient 5xx errors retry with exponential backoff.
		if resp.StatusCode >= 500 && resp.StatusCode <= 599 {
			if attempt == MaxRetries {
				return attempt, &APIError{
					StatusCode: resp.StatusCode,
					Reason:     fmt.Sprintf("http_%d", resp.StatusCode),
					Retryable:  true,
					Attempts:   attempt,
				}
			}
			backoff := baseBackoffs[attempt-1] + c.jitter(250*time.Millisecond)
			c.sleep(backoff)
			continue
		}

		// Non-retryable 4xx (401, 403 without rate limit headers, 404, 422, etc.).
		return attempt, &APIError{
			StatusCode: resp.StatusCode,
			Reason:     fmt.Sprintf("http_%d", resp.StatusCode),
			Retryable:  false,
			Attempts:   attempt,
		}
	}

	return MaxRetries, &APIError{Reason: "retries_exhausted", Attempts: MaxRetries}
}

func (c *Client) parseRateLimitWait(h http.Header, status int) (time.Duration, bool) {
	if status != http.StatusTooManyRequests && status != http.StatusForbidden {
		return 0, false
	}
	if ra := strings.TrimSpace(h.Get("Retry-After")); ra != "" {
		if secs, err := strconv.Atoi(ra); err == nil && secs >= 0 {
			return time.Duration(secs) * time.Second, true
		}
	}
	if reset := strings.TrimSpace(h.Get("X-RateLimit-Reset")); reset != "" {
		if ts, err := strconv.ParseInt(reset, 10, 64); err == nil {
			wait := time.Until(time.Unix(ts, 0))
			if !c.now().IsZero() {
				wait = time.Unix(ts, 0).Sub(c.now())
			}
			if wait < 0 {
				wait = 0
			}
			return wait, true
		}
	}
	if status == http.StatusTooManyRequests {
		return 1 * time.Second, true
	}
	return 0, false
}
