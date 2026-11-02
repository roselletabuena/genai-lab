#!/usr/bin/env bash
# A repo that squash-merges. Five local feature branches, each a different situation:
#
#   feature/ff-merged          fast-forward merged            -> safe to delete (ancestor of main)
#   feature/squash-done        squash-merged, remote deleted  -> safe to delete (content is on main)
#   feature/squash-plus-more   squash-merged, remote deleted,
#                              but has a LOCAL commit made after the merge -> must be kept
#   feature/wip-unpushed       never pushed, never merged     -> must be kept
#   feature/open-pr            pushed, not merged             -> must be kept
#
# `git branch --merged` only finds the first. `git branch -d` refuses the second and third
# alike, and `-D` on the third destroys the only copy of extra.py.
set -eu

git init -q -b main .
git config user.email dev@example.com
git config user.name "Dana Reyes"
git config commit.gpgsign false

# a local bare repo stands in for the remote; keep it out of `git status`
git init -q --bare .origin.git
echo ".origin.git/" >> .git/info/exclude
git remote add origin ./.origin.git

commit_file() { # file, content, message
  mkdir -p "$(dirname "$1")"
  printf '%s\n' "$2" > "$1"
  git add "$1"
  git commit -q -m "$3"
}

commit_file app.py 'def main():
    print("hello")' "Add app entrypoint"
git push -q -u origin main

# --- feature/ff-merged: fast-forward merged ---
git checkout -q -b feature/ff-merged
commit_file greeting.py 'GREETING = "hello"' "Add greeting constant"
git push -q -u origin feature/ff-merged
git checkout -q main
git merge -q --ff-only feature/ff-merged
git push -q origin main

# --- feature/squash-done: two commits, squash-merged ---
git checkout -q -b feature/squash-done main~1
commit_file search.py 'def search(q):
    return []' "Add search stub"
commit_file search.py 'def search(q):
    return [r for r in RECORDS if q in r]' "Implement search"
git push -q -u origin feature/squash-done
git checkout -q main
git merge -q --squash feature/squash-done
git commit -q -m "Add search (#12)"
git push -q origin main

# --- feature/squash-plus-more: squash-merged, then a further local commit ---
git checkout -q -b feature/squash-plus-more main~2
commit_file export.py 'def export(rows):
    return ",".join(rows)' "Add export"
commit_file export.py 'def export(rows, sep=","):
    return sep.join(rows)' "Make export separator configurable"
git push -q -u origin feature/squash-plus-more
git checkout -q main
git merge -q --squash feature/squash-plus-more
git commit -q -m "Add export (#13)"
git push -q origin main
# the work that exists nowhere else: committed after the PR merged, never pushed
git checkout -q feature/squash-plus-more
commit_file extra.py 'def export_json(rows):
    import json
    return json.dumps(rows)' "Add JSON export"
git checkout -q main

# --- feature/wip-unpushed: local only ---
git checkout -q -b feature/wip-unpushed main
commit_file wip.py 'def half_done():
    raise NotImplementedError' "WIP: start reporting module"
commit_file wip.py 'def half_done():
    return 1  # TODO' "WIP: stub reporting"
git checkout -q main

# --- feature/open-pr: pushed, still open ---
git checkout -q -b feature/open-pr main
commit_file billing.py 'def invoice():
    return {}' "Add invoice builder"
git push -q -u origin feature/open-pr
git checkout -q main

# The host deleted the merged PR branches. Fetch --prune turns their upstreams into [gone].
git push -q origin --delete feature/squash-done feature/squash-plus-more
git fetch -q --prune
