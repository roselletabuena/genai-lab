#!/usr/bin/env bash
# A small web app with no account-management features yet and no planned epics, so the
# skill has only the one-line request to work from.
set -eu

git init -q -b main .
git config user.email dev@example.com
git config user.name "Dana Reyes"
git config commit.gpgsign false

cat > README.md <<'EOF'
# Shopfront

An online store for independent sellers. Customers browse, check out and track orders.

## Status

Customers can sign up and sign in with an email address and password. There is no account
page yet: nothing can be changed after sign-up.
EOF

git add -A
git commit -q -m "Initial commit"
