## 📌 Jira Ticket
- **Issue**: [{{JIRA_KEY}}](https://the-three-devsketeers.atlassian.net/browse/{{JIRA_KEY}})
- **Issue Type**: {{ISSUE_TYPE}}
- **Story Points**: {{STORY_POINTS}}
- **Parent Epic**: {{PARENT_EPIC}}

---

## 🎯 Executive Summary
{{SUMMARY_DESCRIPTION}}

---

## 🧱 Key Architectural & Code Changes
- **Module / Feature Slice**: `{{FEATURE_SLICE}}`
- **Key Changes**:
{{KEY_CHANGES_BULLETS}}

---

## 🧪 Testing & Verification Report
- [x] **Unit & Integration Tests**: `npm run test` ({{TEST_PASS_COUNT}} tests passing)
- [x] **TypeScript Strict Typecheck**: `npm run typecheck` (0 errors)
- [x] **ESLint Linting**: `npx eslint .` (0 warnings/errors)
- [x] **Environment Validation**: Verified zero raw `process.env` bypasses (§IV)

```text
{{TEST_OUTPUT_SNIPPET}}
```

---

## 🏛️ Electa Constitution Compliance Checklist
- [x] **§I: Feature-Sliced Architecture**: Code strictly encapsulated under `src/features/` or shared primitives under `src/components/shared/`.
- [x] **§II: Route Handler Security & Authorization**: Session verified via `getSession()` and all payloads parsed via Zod.
- [x] **§III: Zero Regressions**: All existing and new test suites pass with zero regressions.
- [x] **§IV: Centralized Environment Variables**: All environment variables validated in `src/env.ts`.
- [x] **§V: WCAG 2.2 AA Accessibility**: Semantic HTML, accessible color contrast, keyboard navigation, and ARIA labels.
- [x] **§VI: Atomic Conventional Commits**: All changes committed as single-purpose, bisectable Conventional Commits.

---

## 📸 Visual Evidence / UI Preview
{{VISUAL_EVIDENCE_OR_NOTE}}
