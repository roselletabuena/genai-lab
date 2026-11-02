# {{ORDER}} {{STACK}} [{{FEATURE}}] {{TITLE}}

- **Tracker**: {{STORY_KEY_OR_LINK}}
- **Parent epic**: {{EPIC_KEY_OR_NAME}}
- **Stack**: {{STACK}}
- **Estimate**: {{ESTIMATE}}

## Story

As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}.

## Context

{{CONTEXT}}

**Out of scope**: {{OUT_OF_SCOPE}}

**Design / spec**: {{DESIGN_LINK}}

## Acceptance criteria

<!--
  One observable behaviour per scenario, 3-8 in total. Cover the happy path, alternative
  paths, the error path, boundaries and empty states, and permissions. Concrete values only.
  A limit or number you were not given is an open question, not a guess.
-->

**AC1. {{SCENARIO_TITLE}}**
- Given {{PRECONDITION}}
- When {{ACTION}}
- Then {{OBSERVABLE_RESULT}}

## Test cases

<!--
  Derived from the criteria. Every AC has at least one test case and every test case
  traces to an AC.
-->

| ID | AC | Type | Preconditions and data | Steps | Expected result | Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-{{ORDER}}-01 | AC1 | Functional | {{PRECONDITIONS_AND_DATA}} | {{STEPS}} | {{EXPECTED_RESULT}} | {{UNIT_INTEGRATION_E2E_MANUAL}} |

## Links

<!--
  Real items only: an existing key, or a sibling's ORDER in the same epic. Every link is
  two-way and the direction is checked. A dependency with no ticket goes under
  "External dependencies", not here.
-->

| Link | Item | Why |
| :--- | :--- | :--- |
| Parent | {{EPIC_KEY_OR_NAME}} | {{WHY}} |
| Depends on | {{UPSTREAM_STORY}} | {{WHY_IT_MUST_BE_DONE_FIRST}} |
| Blocks | {{DOWNSTREAM_STORY}} | {{WHY_IT_WAITS_ON_THIS}} |
| Relates to | {{RELATED_STORY}} | {{SHARED_AREA_OR_CONTRACT}} |

**External dependencies** (owner): {{EXTERNAL_DEPENDENCIES}}

## Non-functional notes

{{NON_FUNCTIONAL_NOTES_OR_NONE}}

## Open questions

{{OPEN_QUESTIONS_BULLETS}}

## Definition of ready

- [ ] Title follows `ORDER STACK [FEATURE] Title`
- [ ] Role and benefit are specific
- [ ] Acceptance criteria are testable and cover happy, alternative, error and boundary paths
- [ ] Test cases trace to every criterion
- [ ] Links are real, two-way and acyclic, and agree with ORDER
- [ ] Small enough to finish in one sprint
