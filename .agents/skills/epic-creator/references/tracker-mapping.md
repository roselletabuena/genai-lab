# Creating the epic in a tracker

Read this only after the user has approved the final draft and a tracker MCP server is
available. Tool names, issue types and field names differ by server and by project, so read
them from the server's own tool list and project metadata. Do not rely on the names below
being exact, and never hard-code field IDs.

## What maps to what

| Epic section | Jira | GitHub Issues |
|---|---|---|
| Title | Summary | Title |
| Problem, hypothesis, metrics, scope, epic acceptance criteria, cross-cutting needs, risks | Epic description | Parent issue body |
| Child stories | Stories linked to the epic | Sub-issues of the parent, or a task list in its body |
| Owner | Assignee (or the epic's owner field, if the project has one) | Assignee |
| Target window | Due date or fix version | Milestone |
| Story acceptance criteria | Story description | Sub-issue body |
| Story order and dependencies | Issue links (blocks / is blocked by), rank | Mentions in the body, task-list order |

## Jira

- Check that the project has an **Epic** issue type and which type to use for children
  (usually Story; a spike may be a Task or Spike type if the project defines one).
- Newer projects link a child to its epic with the **parent** field; older company-managed
  projects use an **Epic Link** custom field. Read the project's create metadata to see
  which one applies. If neither is present, say so rather than creating unlinked issues.
- Check what format the create tool expects for the description (Markdown, wiki markup or
  structured document format) and convert the epic body to that. Do not paste raw Markdown
  where it will render as literal characters.
- Search the project for an existing epic with the same intent before creating one.

## GitHub Issues

- GitHub has no Epic issue type. Create one **parent issue**, label it `epic` (create the label
  only if the user agrees), and put the epic body in it.
- Prefer **sub-issues** if the server exposes them. Otherwise create the stories as separate
  issues and add a task list to the parent body (`- [ ] #123`), so progress shows on the
  parent.
- Use a **milestone** for the target window if the repository already uses milestones.
- Search open issues for the same intent before creating anything.

## Other trackers

Linear, Azure DevOps, Shortcut and similar tools follow the same shape: one parent item
carrying the epic body, child items linked to it, and the project's own fields for owner and
date. Map the sections in the table above and read the field names from the server.

## After creating

Report each created item as key, title and link, in slicing order. Add the keys to the
saved markdown epic if one was written, so the file and the tracker agree.
