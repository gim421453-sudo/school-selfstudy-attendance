---
name: project-handoff
description: >
  Maintain the project's canonical cross-device continuation state after meaningful
  development, debugging, testing, configuration, architecture, migration, or planning work.
  This skill is mandatory before finishing project-changing work so another Codex or ChatGPT
  session on another device can safely continue.
---

# Project Handoff

## Purpose

Maintain:

`docs/handoff/CURRENT_HANDOFF.md`

as the canonical changing state for cross-device continuation.

Do NOT use this `SKILL.md` as the changing project log.

- `SKILL.md` = stable workflow rules
- `CURRENT_HANDOFF.md` = current verified project state
- development logs = human-readable historical/blog records

## Startup procedure

Before meaningful work:

1. Read `docs/handoff/CURRENT_HANDOFF.md` if it exists.
2. Read repository-level `AGENTS.md`.
3. Inspect the actual workspace/repository state relevant to the task.
4. Verify important handoff claims before relying on them.
5. If the handoff is stale or conflicts with verified state:
   - continue from verified state;
   - note the discrepancy in the next handoff update.

## Completion procedure

Before the final response of any meaningful project-changing task:

1. Review what actually changed in this session.
2. Review verification that actually ran.
3. Inspect relevant Git/workspace state when available.
4. Update `docs/handoff/CURRENT_HANDOFF.md`.
5. Keep the handoff concise enough to scan, but complete enough to continue.
6. Confirm cross-device readiness as one of:
   - `READY`
   - `READY_WITH_WARNINGS`
   - `BLOCKED`
7. Only then give the final response.

## Required handoff fields

Always maintain these sections:

- Last updated
- Status
- Project
- Session objective
- Completed this session
- Files changed
- Decisions / architecture
- Verification
- Known issues / blockers
- Do not repeat
- Exact next action
- Additional next actions
- Environment / configuration
- Git / workspace state
- Cross-device readiness

If a section has no content, write `None` rather than deleting the section.

## Verification rules

Never claim something happened unless verified.

Use explicit markers where useful:

- `VERIFIED`
- `PASS`
- `FAIL`
- `NOT RUN`
- `NOT VERIFIED`
- `BLOCKED`
- `UNKNOWN`

Examples:

Bad:
- "Tests pass" when tests were not run.

Good:
- "Unit tests: NOT RUN"
- "Build: PASS — verified in this session"

## File path rules

Prefer repository-relative paths.

Bad:

`C:\Users\USER\Documents\Project\src\App.tsx`

Good:

`src/App.tsx`

Machine-specific absolute paths may be recorded only when essential for continuation.

## Security rules

Never write actual secret values into the handoff.

Forbidden:

- API keys
- OAuth tokens
- access/refresh tokens
- passwords
- private keys
- cookies
- session tokens
- `.env` values
- service-account private material

Allowed:

- `.env.local is required`
- `FIREBASE_PROJECT_ID must be configured`
- `Cloudflare Worker secrets must already exist`
- `Google OAuth redirect URI must include the production domain`

## Git policy

Git may be inspected for documentation accuracy.

Do not perform destructive or publishing Git actions merely to update the handoff.

If the user has a standing policy to perform Git operations manually, respect it.

## Historical logs

Do not rewrite historical development logs on every task.

Only update:

`docs/handoff/CURRENT_HANDOFF.md`

unless the task explicitly requests development-log generation.

## Cross-device continuation

Another session should be able to:

1. synchronize/open the repository,
2. read `AGENTS.md`,
3. read `docs/handoff/CURRENT_HANDOFF.md`,
4. verify the recorded state,
5. start from `Exact next action`.

## Final gate

Meaningful project-changing work is not complete until the handoff has been updated.

Final response should include:

`Cross-device handoff updated.`

If that cannot be done, explain the exact reason instead of pretending it was updated.
