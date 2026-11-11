# Cross-device continuation policy

<!-- PROJECT_HANDOFF_POLICY_START -->

## Session startup

Before performing meaningful project work:

1. Read `docs/handoff/CURRENT_HANDOFF.md` when present.
2. Read and follow the `project-handoff` skill.
3. Treat the handoff file as continuation context, not unquestionable truth.
4. Verify important state against the actual repository/workspace before making changes.
5. If the handoff conflicts with verified repository state, trust the verified state and record the discrepancy in the next handoff update.

## Mandatory session handoff

After any meaningful:

- implementation
- bug fix
- refactor
- configuration change
- architecture/design work
- testing/debugging
- deployment preparation
- migration work
- project planning that changes future implementation

you MUST use the `project-handoff` skill before giving the final response.

Update:

`docs/handoff/CURRENT_HANDOFF.md`

This is a completion requirement, not an optional documentation step.

Do not finish the task first and leave the handoff for a later session.

## Handoff scope

The handoff must capture enough verified state for another device or session to continue without asking the user to restate prior work.

At minimum record:

- session objective
- completed work
- files changed
- decisions made
- verification/tests
- known issues
- exact next action
- environment/config requirements
- cross-device readiness

## Secrets

Never place secret values, credentials, tokens, passwords,
private keys, cookies, session data, or `.env` contents in handoff documentation.

Allowed:

- environment variable names
- secret file names
- service names
- Firebase/GCP/Cloudflare project aliases or IDs when non-secret
- configuration requirements

## Git policy

Codex may inspect Git state when necessary for accurate documentation.

Actual Git operations such as:

- clone
- init
- add
- commit
- pull
- push
- remote changes

are performed by the user unless the user explicitly changes this policy.

## Final response requirement

After updating the handoff, include a short confirmation:

`Cross-device handoff updated.`

If the handoff could not be updated, explicitly state why.

<!-- PROJECT_HANDOFF_POLICY_END -->

<!-- PROJECT_DOCUMENTATION_POLICY_START -->
## Automatic project documentation
Before finishing meaningful project-changing work, use the `project-docs-manager` skill and read `PROJECT_DOCS.config`.

Managed documents:
- `README.md`
- `CHANGELOG.md`
- `docs/deployment/DEPLOYMENT.md`
- development logs under the configured root
- `docs/handoff/CURRENT_HANDOFF.md`

Rules:
1. README: update only when project purpose, setup, usage, major features, architecture, configuration, supported platforms, or useful repository structure materially changes.
2. CHANGELOG: update only for meaningful release-relevant changes. Use `Unreleased` when no verified release version is known.
3. Deployment docs: update only when build/release, hosting, environment, migration, domain/routing, rollback/recovery, or production verification behavior changes.
4. Development-log automation is controlled by `DEVLOG_AUTO_UPDATE` in `PROJECT_DOCS.config`.
5. When `DEVLOG_AUTO_UPDATE=false`, do not create or update development logs unless the user explicitly requests one.
6. Cross-device handoff remains mandatory after meaningful project-changing work.
7. Preserve existing project-specific documentation; never replace it with generic content unnecessarily.
8. Never write secret values into managed documents.
<!-- PROJECT_DOCUMENTATION_POLICY_END -->

## Verification commands (package.json scripts)

- `npm run build` — `tsc -b && vite build`
- `npm test` — `vitest run`
- `npm run test:rules` — Firestore Rules tests; runs on the Firebase Emulator (Java required), never against production
- `npm run verify` — build, test, test:rules, then `npm audit` (audit needs network)
- Unit test baseline (2026-10-19): `npm test` 169 passed / 17 skipped (the rules suite skips without the emulator).
- Rules test baseline (2026-10-18): 17 tests in `src/tests/firestore.rules.test.ts`, all passing. The scenario-to-test map lives in `CODEX_HANDOFF.md` ("검증해야 할 핵심 시나리오").
- Windows excluded TCP ranges cover the emulator hub (4400) and logging (4500) defaults; the Firebase CLI moves them automatically (seen: 4547/4546). Firestore 8080 and Auth 9099 are outside the excluded ranges. If a port clash stops the emulator, report it — do not change Windows port reservations.

## Ownership

- `OWNER` file at repo root = `Claude`. Claude edits files; Codex reads only.
