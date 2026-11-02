#!/usr/bin/env bash
# A tiny marketing site with one typo on the pricing page ("Pricng"). Fixing it is a
# one-line change, which is the point: it is not an epic.
set -eu

git init -q -b main .
git config user.email dev@example.com
git config user.name "Dana Reyes"
git config commit.gpgsign false

mkdir -p site

cat > site/pricing.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Pricng - Ledgerly</title>
  </head>
  <body>
    <h1>Pricng</h1>
    <ul>
      <li>Starter - $12 per user per month</li>
      <li>Team - $29 per user per month</li>
    </ul>
  </body>
</html>
EOF

git add -A
git commit -q -m "Add pricing page"
