package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func repoRootDir(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}
	return filepath.Clean(filepath.Join(wd, "..", "..", ".."))
}

func findBash() (string, bool) {
	candidates := []string{
		`C:\Program Files\Git\bin\bash.exe`,
		`C:\Program Files\Git\usr\bin\bash.exe`,
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c, true
		}
	}
	p, err := exec.LookPath("bash")
	if err != nil {
		return "", false
	}
	// Avoid WSL bash stub on Windows when no WSL distro is installed
	if strings.Contains(strings.ToLower(p), "system32") {
		return "", false
	}
	return p, true
}

func TestIngressScriptsAndComposeAssets_ExistAndValid(t *testing.T) {
	root := repoRootDir(t)

	requiredFiles := []string{
		filepath.Join(root, "scripts", "ingress-cloudflared.sh"),
		filepath.Join(root, "scripts", "ingress-gh-webhook.sh"),
		filepath.Join(root, "scripts", "start-local-stack.sh"),
		filepath.Join(root, "infra", "cloudflared", "config.example.yml"),
		filepath.Join(root, "sandbox-runner", "Dockerfile"),
		filepath.Join(root, "docker-compose.yml"),
	}

	for _, f := range requiredFiles {
		info, err := os.Stat(f)
		if err != nil || info.IsDir() {
			t.Fatalf("expected required ingress asset %s to exist: %v", f, err)
		}
	}

	// Verify docker-compose.yml contains remediation-daemon, cloudflared, and /var/run/docker.sock
	composeBytes, err := os.ReadFile(filepath.Join(root, "docker-compose.yml"))
	if err != nil {
		t.Fatalf("failed to read docker-compose.yml: %v", err)
	}
	composeStr := string(composeBytes)
	for _, token := range []string{"remediation-daemon:", "cloudflared:", "/var/run/docker.sock:/var/run/docker.sock", "http://remediation-daemon:8080"} {
		if !strings.Contains(composeStr, token) {
			t.Errorf("expected docker-compose.yml to contain %q", token)
		}
	}

	// Verify cloudflared config example targets http://127.0.0.1:8080
	cfConfigBytes, err := os.ReadFile(filepath.Join(root, "infra", "cloudflared", "config.example.yml"))
	if err != nil {
		t.Fatalf("failed to read cloudflared config: %v", err)
	}
	if !strings.Contains(string(cfConfigBytes), "http://127.0.0.1:8080") {
		t.Errorf("expected cloudflared config to target http://127.0.0.1:8080")
	}

	bashBin, ok := findBash()
	if !ok {
		t.Skip("skipping bash script execution check: Git bash not found")
	}

	// AC1: Verify cloudflared dry-run command targets http://127.0.0.1:8080
	cfCmd := exec.Command(bashBin, filepath.Join(root, "scripts", "ingress-cloudflared.sh"), "--dry-run")
	cfOut, err := cfCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("ingress-cloudflared.sh --dry-run failed: %v (%s)", err, string(cfOut))
	}
	if !strings.Contains(string(cfOut), "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080") {
		t.Errorf("unexpected cloudflared dry-run output: %s", string(cfOut))
	}

	// AC2: Verify gh webhook forward dry-run command matches specification
	ghCmd := exec.Command(bashBin, filepath.Join(root, "scripts", "ingress-gh-webhook.sh"), "--dry-run")
	ghOut, err := ghCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("ingress-gh-webhook.sh --dry-run failed: %v (%s)", err, string(ghOut))
	}
	if !strings.Contains(string(ghOut), "gh webhook forward --events=check_run,workflow_run --url=http://127.0.0.1:8080/webhook") {
		t.Errorf("unexpected gh webhook forward dry-run output: %s", string(ghOut))
	}

	// AC4: Verify start-local-stack.sh --check-only readiness check
	stackCmd := exec.Command(bashBin, filepath.Join(root, "scripts", "start-local-stack.sh"), "--check-only")
	stackOut, err := stackCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("start-local-stack.sh --check-only failed: %v (%s)", err, string(stackOut))
	}
	if !strings.Contains(string(stackOut), "Readiness check passed") {
		t.Errorf("expected readiness check passed message, got: %s", string(stackOut))
	}
}
