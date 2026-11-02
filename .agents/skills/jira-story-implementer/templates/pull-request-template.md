## 📌 Jira Ticket
- **Issue**: [{{JIRA_KEY}}](https://the-three-devsketeers.atlassian.net/browse/{{JIRA_KEY}})
- **Issue Type**: {{ISSUE_TYPE}}
- **Story Points**: {{STORY_POINTS}}
- **Parent Epic**: [{{PARENT_EPIC_KEY}}](https://the-three-devsketeers.atlassian.net/browse/{{PARENT_EPIC_KEY}}) - {{PARENT_EPIC_TITLE}}

---

## 🎯 Executive Summary
{{SUMMARY_DESCRIPTION}}

---

## 🧱 Key Architectural & Code Changes
- **Module / Feature Slice**: `{{FEATURE_SLICE}}`
- **Key Changes**:
{{KEY_CHANGES_BULLETS}}

---

## 📋 Acceptance Criteria Checklist
{{ACCEPTANCE_CRITERIA_CHECKLIST}}

---

## 🧪 Testing & Quality Verification Report
- [x] **TypeScript Strict Build / Typecheck**: (0 errors)
- [x] **Formatting Check**: Prettier check passed
- [x] **Unit & Integration Tests**: (All tests passing)

```text
{{TEST_OUTPUT_SNIPPET}}
```

---

## 🔒 Security & Standards Compliance
- [x] Constant-time comparisons for secrets / authentication headers (`crypto.timingSafeEqual`)
- [x] Case-insensitive header lookups
- [x] Fail-closed error handling when configuration or credentials are missing
- [x] Zero regressions against existing APIs and test suites
- [x] All commits follow Conventional Commits and atomic single-responsibility principles
