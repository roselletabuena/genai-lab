---
name: epic-creator
description: Write a well-formed agile epic - a user-outcome problem statement, measurable success metrics with honest baselines, explicit scope and non-goals, epic-level acceptance criteria, and thin vertical-slice child stories - and optionally create it in Jira or GitHub Issues. Use this whenever the user asks to write, draft, create, plan or break down an epic, turns a feature idea, PRD or spec into trackable work, or says "we need an epic for ...". Do not use it for a single story, task or bug report (say it is not an epic instead), and do not pad an epic with invented metrics, layer-by-layer tasks, or a solution that has no stated problem.
compatibility: Works standalone, or with an issue-tracker MCP server (Jira, GitHub Issues) to create the tickets
license: MIT
---

# Creating epics

A bad epic fails quietly and expensively. It is a bucket of tasks with no outcome, a
solution with no problem, a goal nobody can measure, or a project too big to ever close -
and every story under it inherits the flaw. The way through is to decide whether the work
is an epic at all, write the outcome before the plan, and slice it into stories that each
deliver something end to end.

## 1. Decide whether it is an epic

| Level | Test | Typical size |
|---|---|---|
| Initiative / theme | A strategic goal that spans several epics | Several quarters |
| **Epic** | Delivers one user or business outcome, splits into roughly 3-12 stories, has one owner, and can be declared done | Weeks to one quarter |
| Story | One user-visible increment a single team finishes within a sprint | Days |
| Task / bug | Work with no standalone user value | Hours to days |

If the request is really a story or task, say so and offer to write that instead of
inflating it. If it is an initiative, propose the first epic and list the others as
candidates. A label such as "Tech debt", "Backend" or "Q4 work" is a bucket, not an epic -
nothing ever finishes it. Ask what outcome is hiding inside it.

## 2. Gather context

- Read the repo and docs for the product's own vocabulary and for **existing epics**; match
  their format and directory. When the epic changes existing behaviour, read the relevant
  code so the slicing reflects what is really there.
- With a tracker MCP server, search for duplicates and a parent initiative. Link to them
  rather than recreating them.
- Ask only for what you cannot infer, in **one batch of at most four questions**: who the
  user is, the problem or desired outcome, how success will be measured, and hard
  constraints (deadline, compliance, dependencies). If they go unanswered, or the session
  is non-interactive, proceed and record each gap as a labelled assumption.

## 3. Write the epic

| Section | Rule |
|---|---|
| **Title** | An outcome-focused verb phrase ("Let enterprise admins sign in with their company identity provider"). Never "Phase 2", a component name, or a tracker label. |
| **Problem and why now** | Whose pain, what evidence, why this quarter. No solution in this section. |
| **Users** | Named roles or personas, not "users". |
| **Outcome hypothesis** | "We believe [change] for [users] will [outcome]. We will know we are right when [metric moves]." |
| **Success metrics** | Each has a baseline, target, by-when and how it is measured; include a leading and a lagging signal where possible. A baseline or target you were not given is written **"to be measured"**, never a made-up number. |
| **Scope** | In scope, out of scope, non-goals. Out of scope is never empty: name what a reasonable reader would assume is included. |
| **Epic acceptance criteria** | Done conditions at the outcome level, testable, with no implementation detail. |
| **Cross-cutting needs** | Security, accessibility, performance, analytics events, rollout (flag, staged), migration, docs. Write "not applicable" rather than omitting a line. |
| **Dependencies, risks, assumptions, open questions** | Name an owner for each dependency, and state the riskiest assumption and which story tests it first. |

Keep it to *what* and *why*. The *how* belongs to the stories and their specs; name a
technology only when it is a real constraint.

## 4. Slice into child stories

Slice **vertically**: each story cuts through every layer it needs and delivers something a
user can see or a reviewer can verify end to end. Stories named "database schema", "build
the API", "frontend", "write tests" or "Phase 2" are horizontal slices - nothing works
until all of them land, so nothing can be shown, tested or cut.

- **First story is a walking skeleton**: the thinnest end-to-end path, even if crude.
- **Order by value and risk.** Put the riskiest assumption early. A genuine unknown becomes
  a time-boxed spike with a question to answer, not a story with a vague estimate.
- **3-12 stories.** Fewer usually means it is a story; more means split the epic and say
  where the seam is.
- Each story is independently shippable or demonstrable, in the form below.

```markdown
### S1. <title> (walking skeleton)
As a <role>, I want <capability>, so that <benefit>.
- Acceptance: <2-4 headline criteria>
- Depends on: <story or external dependency, or "none">
- Proves / risk: <what unknown this slice removes, or "none">
```

Splitting patterns (workflow steps, business-rule variations, data variations, interfaces,
operations, simple-then-complex) and before/after examples are in
`references/slicing-patterns.md`. Read it when a story will not split cleanly.

## 5. Run the quality gate

Check the draft against this before showing it, and fix rather than apologise:

| Check | If it fails |
|---|---|
| The *why* is clear without reading the stories | Rewrite the problem section; move solution text out of it |
| At least one metric measures an outcome, not "ship X" | Replace the output with the change it should cause |
| Out of scope is non-empty and specific | Name the nearby things that are deliberately excluded |
| Every story is a vertical slice | Re-slice with `references/slicing-patterns.md` |
| There is a done condition, so the epic can be closed | Add acceptance criteria, or split the epic |
| 3-12 stories | Too few: it is a story. Too many: split the epic |
| No invented numbers, names, dates or stakeholders | Replace with "to be measured" or an open question |

## 6. Deliver

Use the host project's own epic template if one exists (an `epics/` directory, `.github/ISSUE_TEMPLATE`,
or earlier epics); otherwise fill `templates/epic-template.md`. Show the draft in the
conversation. Write it to a file only if the user asks or the repo already keeps epics in a
directory, and say where you put it.

## 7. Create it in a tracker (optional)

Only when a tracker MCP server is available **and** the user has approved the final draft.
Tickets are visible to the whole team and tedious to undo.

1. Preview what will be created ("1 epic + N stories in <project>", with titles, and the inter-story dependency link table). Wait for a yes unless the user already said to go ahead.
2. Check for duplicates, then read the project's issue types, parent fields, and **link types** (e.g. `listJiraIssueLinkTypes`) from the server's metadata. Do not guess field IDs or assume the tracker has an "Epic" type.
3. **Phase 1 — Create Epic and Child Stories**: Create the epic first, then each story linked to it via `parent` in slicing order (upstream first). Maintain a map of `local slice ID -> tracker key`. The epic body goes in the epic's description; each story's acceptance criteria in its own.
4. **Phase 2 — Mandatory Inter-Story Linking**:
   - Creating stories under an epic does **NOT** establish dependencies between them.
   - You MUST immediately execute the tracker's linking tool (e.g. `createJiraIssueLink` via `executeWrite` with `linkType: "Blocks"`, `inwardIssue: <upstreamKey>`, `outwardIssue: <downstreamKey>`) for every dependency defined in the story slices.
   - Never exit leaving child stories unlinked when inter-story dependencies were planned.
5. **Phase 3 — Verify Link Graph**: Read back the created issues (e.g. `getJiraIssue` with `view: "evidence"`) to confirm `issuelinks` exist and the direction is correct.
6. **Create only.** Never edit, re-rank, transition or close existing tickets.
7. If a call fails partway, stop, report which keys exist, and ask before retrying. A blind retry creates duplicates.

Field mapping for Jira and GitHub Issues is in `references/tracker-mapping.md`.

## Report

Give the epic (or the created keys and links), the assumptions you made, the open
questions, and any quality-gate check you could not satisfy. The gaps are the useful part: a
user who thinks a metric was real when you left it "to be measured" will plan around a
number that does not exist.

## Guardrails

- **Never invent** baselines, metrics, dates, stakeholders or customer evidence. Unknown is
  a valid value; a fabricated number gets planned around.
- **Never slice by technical layer** or by phase, and never end a story list with a
  "testing" or "hardening" story that holds all the verification.
- **Never create or modify tickets without confirmation.**
- **Never bury the problem under the solution.** If you cannot state who is hurt and how,
  you do not yet have an epic.
- **If you cannot tell whether it is an epic**, say so and ask. A story called an epic costs
  the team more than a clarifying question does.
