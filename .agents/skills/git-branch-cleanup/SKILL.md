---
name: git-branch-cleanup
description: Safely clean up stale local and remote git branches - find which branches are really merged (including squash-merged and rebase-merged ones that `git branch --merged` misses), which have unpushed or unmerged work, and delete only the safe ones with a restore list. Use this whenever the user asks to clean up, prune, tidy or delete old, merged, stale or leftover branches, says their branch list is a mess, or asks "which branches can I delete". Do not use a blanket `git branch -D` or a pipe of `git branch --merged` into `xargs`; a branch that looks finished can hold the only copy of someone's work.
---

# Cleaning up branches

The risk in branch cleanup is deleting a branch whose commits exist nowhere else. Git helps
with `git branch -d`, which refuses to delete unmerged branches - but that protection also
refuses **squash-merged** branches, so people reach for `-D`, which refuses nothing. The
way through is to classify every branch by evidence first, and only then delete.

## Why `git branch --merged` is not enough

`--merged` lists branches whose tip is an *ancestor* of the target. A squash-merge or
rebase-merge creates new commits on the trunk instead, so the original branch's tip is never
an ancestor, even though its work has landed. On a team that squash-merges, `--merged`
finds almost nothing, and `git branch -d` then refuses everything. Also, `--merged` with
no argument means "merged into the **current** branch", not into the trunk.

## 1. Survey

```bash
git fetch --prune                                  # drops remote-tracking refs for branches deleted on the remote
git symbolic-ref --short refs/remotes/origin/HEAD  # the trunk, e.g. origin/main (do not assume "main")
git worktree list                                  # branches checked out elsewhere cannot be deleted
git for-each-ref --format='%(refname:short)|%(upstream:short)|%(upstream:track)|%(committerdate:short)|%(subject)' refs/heads
```

In that output, `[gone]` in the track column means the branch had a remote and it was
deleted - typically because its PR was merged and the host auto-deletes branches. It is a
strong hint, not proof.

## 2. Classify each local branch

Skip, and never delete: the current branch, the trunk, long-lived branches (`main`, `master`,
`develop`, `release/*`, `hotfix/*`), any branch checked out in another worktree, and any
branch with an open PR.

For every other branch, take the first row that matches:

| Evidence | Class | Action |
|---|---|---|
| `git merge-base --is-ancestor <branch> <trunk>` succeeds | **Merged** (fast-forward or merge commit) | Safe: `git branch -d`. |
| The synthesized-squash check below says all content is on the trunk | **Squash/rebase-merged** | Safe after the check; needs `-D`. |
| A merged PR whose head SHA equals the branch tip (`gh`, below) | **Merged via PR** | Safe. |
| `[gone]` but the check above found content not on the trunk | **Has work after the merge** | **Keep.** Report it. |
| No upstream, and commits not on the trunk | **Never pushed** | **Keep.** It may be the only copy. |
| Has an upstream and `git log @{u}..<branch>` is non-empty | **Unpushed commits** | **Keep.** |
| Anything else | **Unmerged** | Keep and ask. |

### Checking a squash-merge without `gh`

`git cherry` compares by patch, and a squash is one patch for many commits, so run it on
the branch's *net* change instead: build a single synthetic commit with the branch's final tree
on top of the merge-base, then ask whether the trunk already contains that patch.

```bash
b=<branch>; t=origin/main
base=$(git merge-base "$t" "$b")
synthetic=$(git commit-tree "$b^{tree}" -p "$base" -m _)
git cherry "$t" "$synthetic"        # "- <sha>" = the trunk already has this patch;  "+ <sha>" = it does not
```

Run the ancestor check first: a branch that is already an ancestor of the trunk produces an
*empty* synthetic patch, which `git cherry` reports as `+`, so it would look unmerged.

`-` means the work landed. `+` means it did not, which includes a branch that was squashed
and then got *another commit afterward*. That is exactly the case where a `[gone]` branch
must not be deleted. The check can give a false `+` if later trunk commits edited the
same lines; treat `+` as "keep and ask", never as "delete anyway".

### Checking via the host

```bash
gh pr list --state merged --head <branch> --json number,mergedAt,headRefOid
git rev-parse <branch>
```

Delete only if `headRefOid` equals the local tip. If the local branch has moved on, the
extra commits were never in the PR.

## 3. Present the plan, then delete

Show a table before deleting anything: branch, class, evidence, action. Ask for
confirmation unless the user already said to go ahead. Record every deleted tip so the
cleanup is undoable:

```bash
git rev-parse <branch> >> /path/outside/repo/deleted-branches.txt   # "name sha" per line
git branch -d <branch>          # for merged-class branches
git branch -D <branch>          # only for squash-merged ones verified above
```

Restore any of them with `git branch <name> <sha>`. Tell the user where the list is.

## Remote branches

Deleting remote branches affects other people. Do it only for branches the user owns and has
asked you to remove, one verified branch at a time:

```bash
git push origin --delete <branch>
```

Do not delete other people's remote branches, even stale-looking ones. Stale
*remote-tracking* refs (`origin/foo` for a branch that no longer exists) are local clutter
and are safe to clear with `git fetch --prune`.

## Report

State what was deleted, what was kept and the reason for each ("2 commits never pushed",
"has a commit added after the PR merged"), and where the restore list is. The kept branches
are the useful part of the report; a user who believes a branch was cleaned when it was
skipped will not look for it.

## Guardrails

- **Never** `git branch -D $(git branch --merged)` or any `xargs` bulk delete without the classification above.
- **`-D` only on verified squash-merged branches.** Using it to silence "not fully merged" is the failure this skill exists to prevent.
- **A branch with no upstream and unique commits is never auto-deleted.**
- **If you cannot tell, keep it** and ask. A leftover branch costs nothing.
- **Stashes and tags are out of scope** unless the user asks.
