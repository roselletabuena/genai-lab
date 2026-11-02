---
name: user-story-creator
description: Write a well-formed user story - a consistently formatted title (`1.2 FE [Chatbot] Send a message and see the reply`), an As a / I want / so that statement, Given/When/Then acceptance criteria, test cases traced back to those criteria, and checked links to its parent epic and to the stories it depends on, blocks or relates to - and optionally create and link it in Jira or GitHub Issues. Use this whenever the user asks to write, draft, create, refine or split a user story, ticket or story card, turns an epic, spec or feature idea into stories, or asks for acceptance criteria, test cases or story links. Do not use it for an epic (use epic-creator), a bug report, or work with no user value, and do not invent ticket keys, dependencies, limits or test data.
compatibility: Works standalone, or with an issue-tracker MCP server (Jira, GitHub Issues) to create and link the tickets
license: MIT
---

# Creating user stories

A weak story fails in three places. The title cannot be scanned or sorted, so the backlog
is unreadable. The acceptance criteria are vague, so nobody can say when it is done and the
tests get written afterwards from the code. And the links are missing or backwards, so a
story starts before its prerequisite or ships without the thing it was meant to unblock.
This skill fixes all three: a fixed title format, criteria written to be tested, test cases
derived from those criteria, and links that are checked before they are made.

## 1. Check it is a story

A story is one user-visible increment that a single team can finish within a sprint and
that has a testable outcome. Check before writing:

- **Too big** - "and" joining two capabilities, several roles or workflows, or more than
  about 8 scenarios. Split it (see below), or if it is several stories' worth, say it is an
  epic and use `epic-creator` if it is installed.
- **Not a story** - a bug, or technical work with no user value. Say so and offer a task, a
  spike or a bug report. Write an *enabler* story only when it names who benefits and has a
  testable result.
- **Splitting** - cut vertically by workflow step, business rule, data variation or
  interface, simple case first. Never by layer ("schema", "API", "UI").

## 2. Gather context

- Read the parent epic or spec, and the **sibling stories**: they decide the ORDER and the
  links. Match the project's existing title style, template and numbering if it has one.
- With a tracker MCP server, fetch the parent epic and neighbouring stories so every link
  points at a real item.
- Ask only for what you cannot infer, in **one batch of at most four questions**: the role,
  the outcome, the parent epic and what must come before or after, and the stack. Otherwise
  proceed and record each gap as a labelled assumption.

## 3. Write the title

```text
ORDER STACK [FEATURE] Title
1.2 FE [Chatbot] Send a message and see the reply
```

| Part | Rule |
|---|---|
| **ORDER** | `<epic number>.<sequence>`: the epic's number in the plan, then the planned delivery order inside it. It is a sequence, not an identity; the tracker key is the identity. Never renumber existing stories: insert with a letter (`1.2a`) or leave gaps. If the tracker sorts by title text, zero-pad the sequence (`1.01` to `1.12`) so `1.10` does not sort before `1.2`. |
| **STACK** | One uppercase token from the team's own list, with no colon after it. Default: `FE`, `BE`, `FS` (full stack), `MOB`, `DATA`, `INFRA`. Set the tracker's component or label to the same value; the prefix is the readable copy, the field is the source of truth. |
| **FEATURE** | The feature or epic name in square brackets, spelled identically on every story in the epic. |
| **Title** | A verb-first capability from the user's point of view, ideally under 60 characters. No "As a ...", no implementation detail, no "and" joining two capabilities, no ticket key. For a `BE` story the user may be a calling client. |

The order is deliberate: short fixed-width tokens first and free text last, so a list sorted
by title reads in delivery order and the titles line up. Keep the prefix under about 20
characters, since boards and chat truncate from the right.

| Weak | Better |
|---|---|
| `1.2 FE [Chatbot] As a customer I want to send a message` | `1.2 FE [Chatbot] Send a message and see the reply` |
| `1.1 BE [Chatbot] Add POST /messages endpoint` | `1.1 BE [Chatbot] Return a bot reply for a submitted message` |
| `1.3 FE [Chatbot] History and typing indicator` | Two stories, one per capability, each with its own ORDER |

**Prefer one `FS` story** per vertical slice. If the team assigns FE and BE separately,
write one story per stack for the *same* slice (`1.1 BE [Chatbot] ...` and `1.1 FE [Chatbot]
...`): they share an ORDER, each has criteria and tests for its own layer, each names the
other and the contract between them, and the slice is done only when both are. Never create
a stack story that delivers nothing verifiable on its own, such as a `BE` story that only
creates tables.

## 4. Write the story

```markdown
As a <specific role>, I want <capability>, so that <benefit>.
```

- **Role** is specific ("returning customer", "support agent"), never "user".
- **Benefit** is the value, not the capability restated.
- Check it against INVEST: independent, negotiable, valuable, estimable, small, testable.
  Whichever fails is the thing to fix.
- Add short context (why now), an **out of scope** line when a neighbouring story covers the
  rest, a link to the design, and non-functional needs that really apply. Leave the *how*
  to the team unless it is a true constraint.

## 5. Write the acceptance criteria

Number them (`AC1`, `AC2`, ...) as Given/When/Then scenarios, one observable behaviour each,
3-8 per story. Cover the **happy path, each alternative path, the error path, boundaries and
empty states, permissions**, and any accessibility, performance or security need that
applies. Use concrete values, never "valid input" or "quickly". If a number you need was not
given, write it as an open question, not a guess. Patterns and a worked example are in
`references/acceptance-criteria-and-test-cases.md`.

## 6. Write the test cases

Derive them **from the criteria, not from the code**. Every criterion gets at least one test
case, and every test case traces to a criterion; a test with no criterion means a missing
criterion or scope creep, so flag it.

| ID | AC | Type | Preconditions and data | Steps | Expected result | Level |
|---|---|---|---|---|---|---|
| `TC-1.2-01` | AC1 | Functional | Chat open, bot available | Send "Where is my order?" | Message shown, reply shown below it | E2E |

- Use boundary values and equivalence classes for inputs, one negative case per validation
  rule, and one case per role for permissions.
- Pick the lowest level that gives confidence: rules as unit tests, contracts as integration
  tests, only the critical journey as E2E. If the project keeps tests in a test-management
  tool, create them there and link them; otherwise keep the table in the story.

## 7. Link the story

| Link | Meaning | Use when |
|---|---|---|
| **Parent** | The epic it belongs to | Always, exactly one |
| **Depends on** (is blocked by) | Cannot be finished or verified until the other is done | A real hard prerequisite |
| **Blocks** | The mirror: others cannot finish until this is done | The mirror of the above |
| **Relates to** | Same area, no ordering constraint | Shared component, design or paired story |

- **Link only real items**: an existing key, or a sibling's ORDER in the same epic. Never
  invent a key. A dependency with no ticket is written as an external dependency with an
  owner, not as a link.
- **Check the direction.** Say "*this* cannot be finished until *that* is done": if true,
  *this* depends on *that*. Direction is the most common mistake, so read each link back from
  both sides.
- **Every link is two-way**: if A blocks B, B depends on A. Write both sides in the draft.
- **No self-links and no cycles.** Two stories that depend on each other are one story, or
  the seam is wrong; re-slice.
- **ORDER must agree with the links**: a story never has a lower ORDER than one it depends on.
- **Do not over-link.** "Relates to" is not a dumping ground, and a story with four or more
  dependencies is probably mis-sliced.
- **Paired FE/BE stories** may start in parallel against an agreed contract. Link as depends
  on only if the `FE` story cannot be verified without the `BE` one; otherwise relates to.

When writing several stories, list all of them with their links first, check order, direction
and cycles on the whole set, then write each one. See `references/linking-stories.md`.

## 8. Run the quality gate

| Check | If it fails |
|---|---|
| Title is `ORDER STACK [FEATURE] Title`, verb-first, no "As a", no key | Rewrite it |
| Role is specific and the benefit is real | Name the role and the value |
| One capability, 3-8 scenarios | Split the story |
| Every criterion is observable and testable | Rewrite it; remove vague words |
| Happy, alternative, error and boundary paths are covered | Add the missing scenario |
| Every criterion has a test case and every test case a criterion | Add the test, or the criterion |
| Tests use concrete data and expected results | Replace "valid input" with the value |
| Links are real, two-way, correctly directed and acyclic, and agree with ORDER | Fix or remove them |
| No invented keys, limits, numbers or roles | Replace with an open question |

## 9. Deliver

Use the host project's story template if one exists; otherwise fill
`templates/user-story-template.md`. Show the draft in the conversation. Write it to a file
only if the user asks or the repo already keeps stories in files, and say where.

## 10. Create it in a tracker (optional)

Only with a tracker MCP server **and** the user's approval of the final draft.

1. Preview the stories, their titles and every link. Wait for a yes unless told to go ahead.
2. Search for duplicates, then read the project's issue types and **link types** from the
   server. Do not guess names or IDs.
3. Create in dependency order, upstream first, so every link points at a real key. Set the
   parent, the stack label or component, and put the story, criteria and test cases in the
   description (or in linked test issues).
4. **Create only.** Never edit, re-rank or close existing tickets, and never remove their links.
5. If a call fails partway, stop, list which keys exist, and ask before retrying.
6. Read each link back from both sides, then replace the local ORDER references in the draft
   with the real keys.

## Report

Give the story (or its keys and links), the link table, the assumptions you made and the open
questions. Say which links are planned rather than created. A user who thinks a dependency was
linked when it was only noted will start the stories in the wrong order.

## Guardrails

- **Never invent** ticket keys, limits, thresholds, test data or roles. Unknown is a valid value.
- **Never write criteria or tests that cannot fail**, such as "works correctly" or "handles
  errors gracefully".
- **Never link to something you have not verified exists**, and never create a cycle.
- **Never create or modify tickets or links without confirmation**, and never edit someone
  else's story to make yours fit.
- **If it is not a story, say so**, and offer the right thing instead.
