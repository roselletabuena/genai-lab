---
name: git-stacked-pr-rebase
description: Rebase a stack of dependent branches and pull requests (PR 2 branched off PR 1, PR 3 off PR 2) after something underneath them changes - the bottom PR was squash-merged or rebase-merged, a lower branch was amended or force-pushed, or the trunk moved. Use this whenever the user mentions stacked PRs, a PR stack, chained or dependent branches, "my stack", restacking, or says a PR "was merged and now the next one shows the wrong commits or conflicts" - and also when a plain `git rebase` of a child branch replays commits that already landed on main.
---

# Rebasing a stack of PRs

A stack is a chain of branches where each one is built on the one below it, and each
PR targets the branch beneath it (the bottom one targets the trunk):

```text
main ── B1 ── B2 ── B3        PR #1: B1 -> main
                              PR #2: B2 -> B1
                              PR #3: B3 -> B2
```

The stack stays reviewable only while every branch contains exactly its own commits on
top of its parent. Anything that rewrites a lower branch breaks that for every branch
above it, and git does not fix the upper ones for you. This skill is how to put the
stack back in shape without losing work or duplicating commits.

## Why a plain `git rebase main` goes wrong

After **squash-merge** or **rebase-merge**, the trunk holds *new* commits with the same
content as B1's, not B1's actual commits. `git rebase main` on B2 then tries to replay
B1's old commits on top of their own squashed copy and conflicts on work that already
landed. (`git cherry` will not rescue you: it matches by patch, and a squash of several
commits has a different patch from any one of them.)

The fix is `git rebase --onto`, which says: *take only the commits after the old parent,
and replay them onto the new base.* Everything depends on knowing the **old parent tip
as a commit SHA, captured before anything moves.**

## The workflow

### 1. Survey and pin the old tips

```bash
git fetch --prune
git status --porcelain                      # must be clean, or the rebase will refuse / mix in WIP
git worktree list                           # see step 3 - this matters
git log --oneline --graph --decorate --boundary <trunk>..<tip-branch>
```

Establish the stack **bottom to top**. The most reliable source is the PRs' own base
chain, because branch ancestry alone cannot tell a stack from two branches that happen
to share a commit:

```bash
gh pr list --author "@me" --json number,headRefName,baseRefName,state
```

Follow `baseRefName` links upward from the trunk. If `gh` is unavailable, use
`git merge-base --is-ancestor <lower> <upper>` between candidates, and confirm the order
with the user when it is ambiguous.

Then record every branch's current tip - these SHAs are what `--onto` needs, and they
double as your undo:

```bash
for b in B1 B2 B3; do echo "$b $(git rev-parse $b)"; done
git branch backup/B1-pre-restack B1        # one backup ref per branch, before touching anything
git branch backup/B2-pre-restack B2
git branch backup/B3-pre-restack B3
```

Keep the backups until the user has confirmed the result. Only delete them when asked.

### 2. Name the cause, then pick the command

What changed underneath decides the command. Say which case you are in before running it.

| What changed | New base | Old parent tip (`<old>`) |
|---|---|---|
| Bottom PR was squash/rebase-merged | `origin/<trunk>` | B1's tip SHA from step 1 |
| Trunk moved, nothing merged | `origin/<trunk>` | the trunk commit B1 was branched from (`git merge-base <trunk> B1`) |
| A middle branch (say B2) was amended | the new B2 | B2's *old* tip SHA from step 1 |

### 3. Rebase the whole stack from the top

With git 2.38 or newer, one command moves every branch in the stack, because
`--update-refs` also repoints each intermediate branch that sits inside the range:

```bash
git checkout <tip-branch>                                  # e.g. B3
git rebase --update-refs --onto <new-base> <old> <tip-branch>
```

For the common case, B1 squash-merged into `main`:

```bash
git rebase --update-refs --onto origin/main <B1-old-tip-sha> B3
```

B2 and B3 now sit directly on `origin/main`, with B1's commits gone.

**Check `git worktree list` first.** `--update-refs` silently skips a branch that is
checked out in another worktree: no error, the rebase reports success, and that branch
is left on its old commits while the ones above it moved. Either remove or switch that
worktree, or use the fallback below.

**Fallback - one branch at a time, bottom up.** Use it on git older than 2.38, for a
branch in another worktree, or to review each branch as it goes. Each branch's `<old>` is
its parent's *old* tip, which is why you pinned the SHAs; the parent's ref has already
moved by the time you reach the next branch:

```bash
git rebase --onto origin/main <B1-old-tip-sha> B2
git rebase --onto B2          <B2-old-tip-sha> B3
```

### 4. Conflicts

Resolve at the lowest branch where one appears, because everything above it replays on
top of that resolution. A conflict can legitimately recur on the next branch up.

```bash
git status                                  # which files, and which commit is being applied
# edit, then:
git add <resolved-files>
GIT_EDITOR=true git rebase --continue       # GIT_EDITOR=true skips the message editor, which hangs in a non-interactive shell
```

Do not resolve by taking one side wholesale to make the conflict go away - the other
side is somebody's real work. If the resolution is not obvious, stop and ask. If the
rebase is going badly, `git rebase --abort` returns the stack to where it started.

### 5. Verify before anything is pushed

A rebase should change *where* commits sit, not *what* they contain. `range-diff` shows
whether that held, branch by branch:

```bash
git range-diff <old-parent-tip>..<B2-old-tip> origin/main..B2
```

`=` on each line means the commit is unchanged; `!` means its content differs, which
is expected only where you resolved a conflict. A commit that appears on only one side
is a dropped or duplicated change - investigate it before continuing.

Also confirm each branch holds only its own commits (`git log --oneline <parent>..<branch>`)
and, where the project has a fast check, that each branch still builds. Branch order
matters for review, so a broken middle branch matters even if the tip passes.

### 6. Publish - with the user's go-ahead

Everything above is local and reversible. Pushing is not: the rebased branches have new
commit IDs, so every one needs a force-push, and anyone who has pulled them is affected.
Confirm with the user before pushing unless they already asked you to.

```bash
git push --force-with-lease=B1:<expected-remote-sha> origin B1
```

Never a bare `--force`. Name the expected remote SHA in the lease: a plain
`--force-with-lease` is defeated by any `git fetch` that ran since you last looked, since
the fetch updates the remote-tracking ref the lease compares against.

Then fix the PR bases. When B1's PR was merged and its branch deleted, GitHub usually
retargets PR #2 to the trunk on its own; if it did not, or the stack was reordered:

```bash
gh pr edit <pr-number> --base <new-base-branch>
```

Push and retarget bottom-up so each PR's diff is correct as soon as it is looked at.

## Guardrails

- **Pin the SHAs and make backup refs before the first rebase.** After a branch moves,
  its old tip is only recoverable through the reflog, and that is a bad thing to depend on.
- **Do not rebase branches other people have pushed commits to** without asking. The
  force-push will orphan their work.
- **Never use bare `--force`.** Use `--force-with-lease` with an explicit expected SHA.
- **If the repo uses a stacking tool** - Graphite (`gt`), git-town, Sapling, spr - use
  its restack command instead; it tracks stack metadata that raw git commands will leave
  stale. Check whether `gt` is installed or a git-town config exists before starting.
- **Report plainly what happened.** State which branches were rebased, which conflicted
  and how you resolved them, which were skipped, and whether anything is unpushed. A
  stack the user believes is updated but is not is worse than one they know is stale.
- **If nothing needs restacking, say so.** When every branch already sits on its parent,
  the right outcome is no commands run.
