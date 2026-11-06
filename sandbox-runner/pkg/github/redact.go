package github

import (
	"regexp"
)

// RedactedPlaceholder replaces any detected secret or credential.
const RedactedPlaceholder = "[REDACTED]"

var (
	secretTokenPatterns = []*regexp.Regexp{
		regexp.MustCompile(`\bgh[pousr]_[A-Za-z0-9]{20,}\b`),
		regexp.MustCompile(`\bgithub_pat_[A-Za-z0-9_]{20,}\b`),
		regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`),
		regexp.MustCompile(`(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}`),
	}

	secretAssignmentPattern = regexp.MustCompile(
		`(?im)^([ \t]*(?:export[ \t]+)?[A-Za-z0-9_.-]*(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY)[A-Za-z0-9_.-]*[ \t]*[=:][ \t]*)(\S.*)$`,
	)
)

// Redact scrubs secret tokens and credential assignments from text before it is sent to GitHub.
func Redact(text string) string {
	for _, pat := range secretTokenPatterns {
		text = pat.ReplaceAllString(text, RedactedPlaceholder)
	}
	return secretAssignmentPattern.ReplaceAllString(text, "${1}"+RedactedPlaceholder)
}
