package webhook_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/roselletabuena/genai-lab/sandbox-runner/pkg/webhook"
)

func computeHMAC(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature_Valid(t *testing.T) {
	secret := "my-secret-key-12345"
	payload := `{"action":"completed"}`
	sig := computeHMAC(secret, payload)

	if !webhook.VerifySignature([]byte(payload), sig, secret) {
		t.Fatalf("expected signature verification to succeed")
	}
}

func TestVerifySignature_TamperedPayload(t *testing.T) {
	secret := "my-secret-key-12345"
	payload := `{"action":"completed"}`
	sig := computeHMAC(secret, payload)

	tampered := `{"action":"opened"}`
	if webhook.VerifySignature([]byte(tampered), sig, secret) {
		t.Fatalf("expected signature verification to fail for tampered payload")
	}
}

func TestVerifySignature_WrongSecret(t *testing.T) {
	secret := "my-secret-key-12345"
	payload := `{"action":"completed"}`
	sig := computeHMAC(secret, payload)

	if webhook.VerifySignature([]byte(payload), sig, "different-secret") {
		t.Fatalf("expected signature verification to fail for wrong secret")
	}
}

func TestVerifySignature_MissingPrefix(t *testing.T) {
	secret := "my-secret-key-12345"
	payload := `{"action":"completed"}`
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	rawHex := hex.EncodeToString(mac.Sum(nil))

	if webhook.VerifySignature([]byte(payload), rawHex, secret) {
		t.Fatalf("expected verification to fail without sha256= prefix")
	}
}

func TestVerifySignature_InvalidHex(t *testing.T) {
	secret := "my-secret-key-12345"
	payload := `{"action":"completed"}`

	if webhook.VerifySignature([]byte(payload), "sha256=not-a-valid-hex-string!!", secret) {
		t.Fatalf("expected verification to fail for non-hex signature")
	}
}

func TestVerifySignature_EmptyInputs(t *testing.T) {
	if webhook.VerifySignature(nil, "sha256=abcd", "secret") {
		t.Fatalf("expected verification to fail on nil payload")
	}
	if webhook.VerifySignature([]byte("hello"), "", "secret") {
		t.Fatalf("expected verification to fail on empty signature")
	}
	if webhook.VerifySignature([]byte("hello"), "sha256=abcd", "") {
		t.Fatalf("expected verification to fail on empty secret")
	}
}
