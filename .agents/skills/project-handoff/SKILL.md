---
name: project-handoff
description: Maintain the canonical cross-device continuation state after meaningful project work.
---
# Project Handoff

Target: `docs/handoff/CURRENT_HANDOFF.md`

## Startup
1. Read the handoff if it exists.
2. Read repository `AGENTS.md`.
3. Verify important state against the actual workspace.
4. If the handoff conflicts with verified state, trust verified state and record the discrepancy later.

## Before final response
Update the handoff with verified current state:
- Last updated / status
- Project / repository / branch / HEAD when available
- Session objective
- Completed work
- Created / modified / deleted files
- Important decisions / architecture
- Verification and actual test/build results
- Known issues / blockers
- Work that must not be repeated
- Exact next action
- Additional next actions
- Environment/config requirements
- Git/workspace state
- Cross-device readiness: `READY`, `READY_WITH_WARNINGS`, or `BLOCKED`

Use explicit states such as `PASS`, `FAIL`, `NOT RUN`, `NOT VERIFIED`, `BLOCKED`, `UNKNOWN`.

Never include API keys, passwords, tokens, cookies, private keys, session material, or `.env` values. Prefer repository-relative paths.

Meaningful project-changing work is not complete until the handoff has been updated.
