# Linking stories

Read this when a story has dependencies, when you are writing several stories at once, and
before creating links in a tracker.

## Link types and direction

| Link | Reads as | Test sentence |
|---|---|---|
| **Parent** | "Belongs to epic E" | The epic is done when its stories are done |
| **Depends on** | "Is blocked by S" | *This* cannot be finished until *S* is done |
| **Blocks** | "Is a blocker for S" | *S* cannot be finished until *this* is done |
| **Relates to** | "Is related to S" | They touch the same area but either can go first |

"Depends on" and "blocks" are the same link seen from opposite ends. Direction is the
commonest error, so after creating any link read it back from both stories and confirm each
side tells the truth.

## Worked example: the Chatbot epic

| Story | Parent | Depends on | Blocks | Relates to |
|---|---|---|---|---|
| `1.1 BE` Return a bot reply for a submitted message | Chatbot | none | `1.2 FE` | none |
| `1.2 FE` Send a message and see the reply | Chatbot | `1.1 BE` | `1.3 FE` | `1.4 FS` |
| `1.3 FE` See earlier messages when reopening the chat | Chatbot | `1.2 FE` | none | none |
| `1.4 FS` Hand off to a human agent when the bot cannot answer | Chatbot | none | none | `1.2 FE` |

Every "blocks" cell has a matching "depends on" cell in the other row, ORDER never runs
backwards along a dependency, and the one "relates to" pair shares a component without any
ordering constraint.

## Checks before linking

- **Cycles.** Follow each "depends on" chain; if it returns to the starting story there is a
  cycle. Two stories that need each other are one story, or the seam is wrong.
- **ORDER.** Within an epic, a story's ORDER is higher than every story it depends on.
- **Over-linking.** Keep only links that carry a real constraint. Four or more dependencies
  on one story usually means it is mis-sliced. Do not add "relates to" for stories that are
  merely in the same epic: the parent link already says that.
- **External dependencies.** A prerequisite with no ticket (another team, a vendor, a
  decision) is written as an external dependency with an owner, never as an invented link.
- **Cross-epic links.** Allowed, but name the other epic in the "why" so the reader knows the
  constraint crosses a boundary.
- **Closed or duplicate items.** Do not depend on a story that is closed as won't-do or a
  duplicate; link to the one that replaced it.
- **Paired stack stories** (same ORDER): they can start in parallel against the agreed
  contract. Use "depends on" only if the `FE` story cannot be verified end to end without the
  `BE` one; otherwise "relates to" and put the contract in both.

## Tracker mapping

Link type names and directions differ by server and project, so read them from the server's
metadata and do not hard-code them.

**Jira.** The parent is set through the project's parent or epic-link field. Dependencies
use the project's blocking link type (commonly "Blocks", reading "blocks" one way and "is
blocked by" the other) and relationships use its relates link type. Create the link from the
side the server expects, then read it back from both issues. If the project has a test issue
type or a test-management add-on, create the test cases there and link them to the story;
otherwise keep the table in the description.

**GitHub Issues.** Make the story a sub-issue of the epic's parent issue if the server
exposes sub-issues. Use blocked-by and blocking relationships if it exposes those. If not,
write `Blocked by #N`, `Blocks #N` and `Related to #N` lines in the body; these create
cross-references but do not enforce ordering, so say so in the report.

## Creating several stories

1. Draft all stories and their links as a table like the one above, using ORDER as the local reference.
2. Check cycles, ORDER and two-way consistency across the whole set.
3. **Phase 1 (Create Issues)**: Create tickets in dependency order, upstream first, setting the parent epic and details. Build a map of `local ORDER -> newly created key`.
4. **Phase 2 (Create Issue Links - Mandatory)**: For each dependency edge in the table, call the tracker's linking tool (e.g. `createJiraIssueLink` with `linkType="Blocks"`, `inwardIssue: upstream`, `outwardIssue: downstream`). Never stop after Phase 1—ticket creation does not automatically link dependencies!
5. **Phase 3 (Verify & Read back)**: Read every link back to confirm both sides show the link, then replace the local ORDER references in the saved draft with the real keys.

## Reporting

Give a table of key, title and links for each story, and mark any link that is planned rather
than created.
