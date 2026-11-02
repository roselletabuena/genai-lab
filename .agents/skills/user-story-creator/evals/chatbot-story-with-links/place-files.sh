#!/usr/bin/env bash
# A helpdesk app with one planned epic. The epic file lists four stories in delivery order,
# with notes that make the correct links for story 1.2 derivable from the repo:
#
#   1.2 depends on 1.1   (needs the endpoint 1.1 exposes)
#   1.2 blocks 1.3       (1.3 reuses the message list built in 1.2)
#   1.2 relates to 1.4   (shares the composer; either can be built first)
#
# There is no issue tracker, so no ticket keys exist and none should be invented.
set -eu

git init -q -b main .
git config user.email dev@example.com
git config user.name "Dana Reyes"
git config commit.gpgsign false

mkdir -p docs/epics

cat > README.md <<'EOF'
# Helpdesk

Customer support software for small online shops. Customers open a chat on the shop's
site, and support agents answer from a shared inbox.
EOF

cat > docs/epics/chatbot.md <<'EOF'
# Epic 1: Chatbot

Let customers get instant answers to common questions from a chatbot in the chat widget,
and reach a human when the bot cannot help.

## Constraints

- A message is 1 to 500 characters.
- The chat widget is keyboard-accessible and works with screen readers.

## Stories (planned delivery order)

Titles use the form `ORDER STACK [FEATURE] Title`.

| Order | Stack | Story | Notes |
| :--- | :--- | :--- | :--- |
| 1.1 | BE | Return a bot reply for a submitted message | Exposes the endpoint the widget calls to send a message and get a reply. |
| 1.2 | FE | Send a message and see the reply | Needs the endpoint from 1.1. Builds the message list and the message composer. |
| 1.3 | FE | See earlier messages when reopening the chat | Reuses the message list built in 1.2. |
| 1.4 | FS | Hand off to a human agent when the bot cannot answer | Shares the message composer with 1.2; either can be built first. |
EOF

git add -A
git commit -q -m "Plan the chatbot epic"
