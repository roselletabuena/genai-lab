# Acceptance criteria and test cases

Read this when the criteria feel vague, when you are unsure what tests a criterion needs, or
when a story seems to have too many scenarios.

## Writing criteria

Use Given/When/Then scenarios with a short title. One observable behaviour per scenario.
For a set of simple rules (validation, permissions) a checklist of testable statements is
fine; do not force Given/When/Then onto a rule that reads clearly without it.

### Coverage checklist

| Path | Ask |
|---|---|
| **Happy path** | What does success look like, step by step? |
| **Alternative paths** | What other valid ways reach the same outcome? |
| **Error path** | What if input is invalid, the service fails, the request times out? |
| **Boundaries and empty** | Zero, one, the maximum, one past the maximum; the empty state |
| **Permissions** | Which roles may, may not, and what do the others see? |
| **State** | First use versus returning; already done versus not yet |
| **Non-functional** | Accessibility (keyboard, screen reader), a stated performance budget, authorisation and data exposure |

### Vague words to replace

| Vague | Write instead |
|---|---|
| "quickly", "fast" | "within N seconds" with N from the requirement; if unknown, an open question |
| "user-friendly", "intuitive" | An observable behaviour: what the user sees or can do |
| "valid input" | The actual value or class: "an email address in the form name@domain" |
| "appropriate error", "handles errors gracefully" | The message shown and what state the user is left in |
| "etc.", "and so on" | The complete list |
| "works correctly" | The observable result |

Leave out implementation detail (tables, endpoints, component names). Link the design for
layout instead of describing pixels.

## Deriving test cases

Test from the criteria, so the tests describe the behaviour the team agreed, not whatever
the code happens to do.

| Technique | Use it for |
|---|---|
| **Equivalence classes** | Inputs where many values behave the same: test one from each class |
| **Boundary values** | Any limit: test the value just inside, on, and just past it |
| **Decision table** | Combinations of conditions that change the outcome |
| **State transitions** | Behaviour that depends on prior state |
| **Error guessing** | Typical failures: timeouts, duplicates, retries, concurrent use, stale data |

### Level by stack

Pick the lowest level that still gives confidence.

| Stack | Typical levels |
|---|---|
| `FE` | Unit tests for logic, component tests for each state (empty, loading, error), accessibility checks, one E2E test for the critical journey |
| `BE` | Unit tests for rules, API contract tests (status codes, response shape), authorisation tests, idempotency and retry cases |
| `FS` | The above for both layers, plus E2E for the journey |
| `DATA` | Validation, reconciliation against the source, behaviour on bad records |
| `INFRA` | Smoke test, rollback, and failure of the dependency |

### Test case fields

`TC-<ORDER>-<nn>` for the ID, then the AC it covers, the type (functional, negative,
boundary, accessibility, security, performance), preconditions and exact data, the steps,
the expected result, and the level. Steps are specific enough that two people would run them
the same way. Expected results are observable, never "works".

### Traceability

Check both directions before showing the story:

- Every criterion has at least one test case.
- Every test case traces to a criterion. An orphan test means a missing criterion (add it)
  or scope creep (remove the test).

## Worked example

`1.2 FE [Chatbot] Send a message and see the reply`. The 500-character limit is a value
from the example epic, not a default; in real work take it from the requirement or ask.

**Criteria**

| AC | Scenario | Given / When / Then |
|---|---|---|
| AC1 | Send a message | Given the chat is open and the bot is available, when the customer sends "Where is my order?", then the message appears in the conversation and the bot's reply appears below it. |
| AC2 | Empty message | Given the composer is empty or only spaces, when the customer tries to send, then nothing is sent and the send control is disabled. |
| AC3 | Length limit | Given a message of 500 characters, then it can be sent. Given 501, then sending is blocked, "Messages can be up to 500 characters" is shown, and the text is kept. |
| AC4 | Bot unavailable | Given the reply service fails, when the customer sends a message, then the message stays visible marked "Not sent" with a "Try again" action, and retrying does not create a duplicate. |
| AC5 | Accessibility | Given a keyboard-only or screen-reader user, then the composer and send control are operable by keyboard and each new reply is announced. |

**Test cases**

| ID | AC | Type | Preconditions and data | Steps | Expected result | Level |
|---|---|---|---|---|---|---|
| TC-1.2-01 | AC1 | Functional | Chat open, stub bot replies "Your order shipped" | Type "Where is my order?", send | Message shown, then the reply below it | E2E |
| TC-1.2-02 | AC2 | Negative | Composer holds three spaces | Press send | No request made, control disabled | Component |
| TC-1.2-03 | AC3 | Boundary | Message of exactly 500 characters | Send | Sent and shown | Component |
| TC-1.2-04 | AC3 | Boundary | Message of 501 characters | Try to send | Blocked, limit message shown, text kept | Component |
| TC-1.2-05 | AC4 | Negative | Stub service returns an error | Send a message | Message marked "Not sent", "Try again" shown | Integration |
| TC-1.2-06 | AC4 | Negative | As TC-1.2-05, then the service recovers | Press "Try again" | One copy of the message, one reply | Integration |
| TC-1.2-07 | AC5 | Accessibility | Keyboard only, screen reader on | Tab to composer, type, send with Enter | Operable without a mouse, reply announced | Manual |

Note what the set shows: both sides of the 500-character boundary are tested, each failure
path has a test, and the only manual test is the one that needs a human with a screen reader.
