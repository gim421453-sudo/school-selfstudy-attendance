# Current Project Handoff

Last updated: 2026-10-18 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `4c12d59` (PR #1 docs cleanup merged)
- Branch: `test/rules-scenarios-14` (created from `4c12d59`)
- HEAD: this session's commit on `test/rules-scenarios-14` (parent `4c12d59`); committed and pushed by Claude at the user's explicit request

## Session objective

Check the 14 Firestore Rules scenarios in `CODEX_HANDOFF.md` against the current rules model, add tests only for scenarios that had none, and rewrite the scenario list for the current model.

## Completed this session

- Ran `npm run test:rules` before any change: 16/16 passed.
- Mapped the 14 scenarios to existing tests. Gaps: grade_admin student/class create+update ALLOW, scoped teacher and other-grade admin student/class DENY, grade_admin `users` and `staffAssignments` writes DENY (scenarios 5–8).
- Added one test: `lets only the scoped grade admin write students and classes, and only the owner write users and staff assignments`. Re-ran `npm run test:rules`: 17/17 passed.
- `firestore.rules` not changed (no test showed a defect).
- Rewrote the scenario section of `CODEX_HANDOFF.md` as a table (current model, expected result, test names). Scenario 7 changed from ALLOW to DENY because `users` writes are owner-only now. 11, 12 and the UI part of 14 cannot be checked by Rules tests.
- `AGENTS.md`: added the rules-test baseline and the emulator port note.
- Previous session (conflict-marker cleanup, `OWNER`, `CLAUDE.md`) is merged in PR #1; the AGENTS.md backup file was removed there.

## Files changed

### Created

None

### Modified

- `src/tests/firestore.rules.test.ts`
- `CODEX_HANDOFF.md`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

None

## Decisions / architecture

- Tests only; rules unchanged. If a future test exposes a defect, report the defect and a proposed fix and wait for user approval before editing `firestore.rules`.
- `settings/access` (homeroom statistics policy) is not referenced by the rules; homeroom statistics scope is enforced only through attendance read rules plus the UI.

## Verification

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 29 files passed / 1 skipped, 159 tests passed / 17 skipped (rules suite skips without the emulator)
- Rules/security tests: `npm run test:rules` RUN on the Firestore Emulator, 17/17 passed (before the new test: 16/16)
- Deploy: NOT RUN

## Known issues / blockers

- Scenario 11 (Excel apply button blocked by name/duplicate/out-of-range errors): parser unit tests exist; the UI button and out-of-range dates are NOT VERIFIED.
- Scenario 12 (bulk present then one absent counts as one absence): no test reproduces it exactly; NOT VERIFIED.
- Some older rules tests use the legacy unscoped data shape and only assert DENY (e.g. `allows a grade admin to manage master data and statistics` asserts that legacy grade_admin writes fail). The name no longer matches the content; consider renaming later.
- The intro sections of `CODEX_HANDOFF.md` (v0.2 feature list, first-run commands) were not reviewed in this session.

## Do not repeat

- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not install dependencies or deploy Firebase resources without a new explicit request.

## Exact next action

User reviews the pushed branch `test/rules-scenarios-14` and opens a PR to `master` (no PR opened yet).

## Additional next actions

- `npm audit` was not run (NOT RUN); run `npm run verify` before merging if a full check is wanted.
- Cover scenarios 11 and 12 with UI or unit tests if needed.
- Review `artifacts/ui-audit/ui-inventory.md` when starting the broader UI redesign.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: OpenJDK 21) and the Firebase Emulator (`firebase emulators:exec --only firestore`, test projectId `school-selfstudy-attendance-rules`); no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moved them to 4547/4546 automatically. Firestore 8080 and Auth 9099 are free.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `test/rules-scenarios-14` from `master` (`4c12d59`); 4 files committed and pushed to `origin/test/rules-scenarios-14` by Claude at the user's explicit request (2026-10-18). No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch is pushed but not merged; master does not have these changes yet.
- `npm audit` not run.
