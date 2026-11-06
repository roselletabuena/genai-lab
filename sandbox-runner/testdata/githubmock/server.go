package githubmock

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
)

// RecordedRequest captures an HTTP request received by the mock server.
type RecordedRequest struct {
	Method  string
	Path    string
	Query   string
	Headers http.Header
	Body    string
}

// IssueComment represents a GitHub issue/PR summary comment stored in the mock server.
type IssueComment struct {
	ID   int64  `json:"id"`
	Body string `json:"body"`
}

// ReviewComment represents a GitHub PR review comment stored in the mock server.
type ReviewComment struct {
	ID        int64  `json:"id"`
	Body      string `json:"body"`
	CommitID  string `json:"commit_id"`
	Path      string `json:"path"`
	StartLine int    `json:"start_line,omitempty"`
	Line      int    `json:"line"`
	Side      string `json:"side"`
}

// PRFile represents an entry returned by GET /repos/{o}/{r}/pulls/{n}/files.
type PRFile struct {
	Filename string `json:"filename"`
	Patch    string `json:"patch,omitempty"`
}

//QueuedError represents a scripted error response for the next matching request.
type QueuedError struct {
	Status     int
	RetryAfter string
	Body       string
}

// Server wraps an httptest.Server simulating GitHub PR, issue-comment, review-comment, and files APIs.
type Server struct {
	*httptest.Server
	mu             sync.Mutex
	PRState        string
	PRFiles        []PRFile
	IssueComments  []IssueComment
	ReviewComments []ReviewComment
	Requests       []RecordedRequest
	NextErrors     []QueuedError
	PageSize       int
	nextID         int64
}

// NewServer starts a new mock GitHub API server with an open PR by default.
func NewServer() *Server {
	s := &Server{
		PRState:  "open",
		PageSize: 100,
		nextID:   1000,
	}
	s.Server = httptest.NewServer(http.HandlerFunc(s.handle))
	return s
}

// EnqueueError queues a scripted error response to be returned on subsequent requests.
func (s *Server) EnqueueError(status int, retryAfter, body string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.NextErrors = append(s.NextErrors, QueuedError{
		Status:     status,
		RetryAfter: retryAfter,
		Body:       body,
	})
}

// GetRequests returns a snapshot of recorded requests.
func (s *Server) GetRequests() []RecordedRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]RecordedRequest, len(s.Requests))
	copy(out, s.Requests)
	return out
}

// GetIssueComments returns a snapshot of current issue comments.
func (s *Server) GetIssueComments() []IssueComment {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]IssueComment, len(s.IssueComments))
	copy(out, s.IssueComments)
	return out
}

// GetReviewComments returns a snapshot of current PR review comments.
func (s *Server) GetReviewComments() []ReviewComment {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]ReviewComment, len(s.ReviewComments))
	copy(out, s.ReviewComments)
	return out
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	rawBody, _ := io.ReadAll(r.Body)
	_ = r.Body.Close()

	s.mu.Lock()
	s.Requests = append(s.Requests, RecordedRequest{
		Method:  r.Method,
		Path:    r.URL.Path,
		Query:   r.URL.RawQuery,
		Headers: r.Header.Clone(),
		Body:    string(rawBody),
	})

	if len(s.NextErrors) > 0 {
		errResp := s.NextErrors[0]
		s.NextErrors = s.NextErrors[1:]
		s.mu.Unlock()
		if errResp.RetryAfter != "" {
			w.Header().Set("Retry-After", errResp.RetryAfter)
		}
		w.WriteHeader(errResp.Status)
		_, _ = w.Write([]byte(errResp.Body))
		return
	}
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected prefix: repos/{owner}/{repo}/...
	if len(parts) < 4 || parts[0] != "repos" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	tail := parts[3:]

	switch {
	// GET /repos/{o}/{r}/pulls/{n}
	case len(tail) == 2 && tail[0] == "pulls" && r.Method == http.MethodGet:
		s.mu.Lock()
		state := s.PRState
		s.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"state": state})
		return

	// GET /repos/{o}/{r}/pulls/{n}/files
	case len(tail) == 3 && tail[0] == "pulls" && tail[2] == "files" && r.Method == http.MethodGet:
		s.mu.Lock()
		files := make([]PRFile, len(s.PRFiles))
		copy(files, s.PRFiles)
		s.mu.Unlock()
		_ = json.NewEncoder(w).Encode(files)
		return

	// GET or POST /repos/{o}/{r}/issues/{n}/comments
	case len(tail) == 3 && tail[0] == "issues" && tail[2] == "comments":
		if r.Method == http.MethodGet {
			s.handleListIssueComments(w, r)
			return
		}
		if r.Method == http.MethodPost {
			var payload struct {
				Body string `json:"body"`
			}
			_ = json.Unmarshal(rawBody, &payload)
			s.mu.Lock()
			s.nextID++
			c := IssueComment{ID: s.nextID, Body: payload.Body}
			s.IssueComments = append(s.IssueComments, c)
			s.mu.Unlock()
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(c)
			return
		}

	// PATCH /repos/{o}/{r}/issues/comments/{id}
	case len(tail) == 3 && tail[0] == "issues" && tail[1] == "comments" && r.Method == http.MethodPatch:
		id, _ := strconv.ParseInt(tail[2], 10, 64)
		var payload struct {
			Body string `json:"body"`
		}
		_ = json.Unmarshal(rawBody, &payload)
		s.mu.Lock()
		defer s.mu.Unlock()
		for i := range s.IssueComments {
			if s.IssueComments[i].ID == id {
				s.IssueComments[i].Body = payload.Body
				_ = json.NewEncoder(w).Encode(s.IssueComments[i])
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
		return

	// GET or POST /repos/{o}/{r}/pulls/{n}/comments
	case len(tail) == 3 && tail[0] == "pulls" && tail[2] == "comments":
		if r.Method == http.MethodGet {
			s.mu.Lock()
			list := make([]ReviewComment, len(s.ReviewComments))
			copy(list, s.ReviewComments)
			s.mu.Unlock()
			_ = json.NewEncoder(w).Encode(list)
			return
		}
		if r.Method == http.MethodPost {
			var rc ReviewComment
			_ = json.Unmarshal(rawBody, &rc)
			s.mu.Lock()
			s.nextID++
			rc.ID = s.nextID
			s.ReviewComments = append(s.ReviewComments, rc)
			s.mu.Unlock()
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(rc)
			return
		}

	// PATCH or DELETE /repos/{o}/{r}/pulls/comments/{id}
	case len(tail) == 3 && tail[0] == "pulls" && tail[1] == "comments":
		id, _ := strconv.ParseInt(tail[2], 10, 64)
		if r.Method == http.MethodPatch {
			var payload struct {
				Body string `json:"body"`
			}
			_ = json.Unmarshal(rawBody, &payload)
			s.mu.Lock()
			defer s.mu.Unlock()
			for i := range s.ReviewComments {
				if s.ReviewComments[i].ID == id {
					s.ReviewComments[i].Body = payload.Body
					_ = json.NewEncoder(w).Encode(s.ReviewComments[i])
					return
				}
			}
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method == http.MethodDelete {
			s.mu.Lock()
			defer s.mu.Unlock()
			for i := range s.ReviewComments {
				if s.ReviewComments[i].ID == id {
					s.ReviewComments = append(s.ReviewComments[:i], s.ReviewComments[i+1:]...)
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			w.WriteHeader(http.StatusNotFound)
			return
		}
	}

	w.WriteHeader(http.StatusNotFound)
	_, _ = fmt.Fprintf(w, `{"message":"unhandled %s %s"}`, r.Method, r.URL.Path)
}

func (s *Server) handleListIssueComments(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	s.mu.Lock()
	if perPage <= 0 {
		perPage = s.PageSize
	}
	if s.PageSize > 0 && s.PageSize < perPage {
		perPage = s.PageSize
	}
	total := len(s.IssueComments)
	start := (page - 1) * perPage
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}
	slice := make([]IssueComment, end-start)
	copy(slice, s.IssueComments[start:end])
	s.mu.Unlock()

	_ = json.NewEncoder(w).Encode(slice)
}
