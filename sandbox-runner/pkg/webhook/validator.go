package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
)

// VerifySignature validates a GitHub HMAC SHA-256 signature against the payload and shared secret.
// It uses subtle.ConstantTimeCompare to protect against timing attacks.
func VerifySignature(payload []byte, signatureHeader, secret string) bool {
	if len(payload) == 0 || signatureHeader == "" || secret == "" {
		return false
	}

	const prefix = "sha256="
	if !strings.HasPrefix(signatureHeader, prefix) {
		return false
	}

	receivedHex := signatureHeader[len(prefix):]
	receivedMAC, err := hex.DecodeString(receivedHex)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedMAC := mac.Sum(nil)

	return subtle.ConstantTimeCompare(receivedMAC, expectedMAC) == 1
}
