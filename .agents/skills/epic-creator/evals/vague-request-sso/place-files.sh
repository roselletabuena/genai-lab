#!/usr/bin/env bash
# A small B2B invoicing app with email/password login only. There is no issue tracker and
# no existing epics, so the skill has to write the epic from a one-line request and the
# little the repo says about the product.
set -eu

git init -q -b main .
git config user.email dev@example.com
git config user.name "Dana Reyes"
git config commit.gpgsign false

mkdir -p src/auth

cat > README.md <<'EOF'
# Ledgerly

Invoicing for small and mid-sized businesses. Teams create, send and track invoices, and
accountants get read-only access to their clients' books.

## Status

Accounts are per company. Every user signs in with an email address and a password; there
is no other way in. Password resets are handled by support on request.

## Layout

- `src/auth/`   login, sessions and password handling
- `src/web/`    the customer-facing app
EOF

cat > src/auth/login.py <<'EOF'
def login(email: str, password: str) -> str:
    """Return a session token for a valid email/password pair."""
    raise NotImplementedError


def create_session(user_id: int) -> str:
    raise NotImplementedError
EOF

git add -A
git commit -q -m "Initial commit"
