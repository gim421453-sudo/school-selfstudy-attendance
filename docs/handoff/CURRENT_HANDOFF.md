# Current Project Handoff

Last updated: 2026-11-11 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `80325b8` (PR #5 non-breaking `npm audit fix` merged)
- Branch: `feat/hide-stats-menu` (created from `80325b8`)
- HEAD: this session's commit on that branch

## Session objective

Hide the self-study statistics menu from users the statistics page would turn away (homeroom policy off, settings not loaded, no homeroom class).

## Completed this session

- `visibleNavigation` (`src/navigation.ts`) takes the access settings as a new last argument and shows `/self-study-statistics` only when `statisticsClassScope(...)` (the same function the statistics page uses) returns non-null. Owner/grade admin always see it; a homeroom teacher sees it only with `statsVisibility = "grade_admin_and_homeroom"` and an active own class; `null` settings (loading or read failure) hide it (fail-closed).
- `Layout` now loads the classes of the current grade (`listClasses`) and passes them plus the settings to `visibleNavigation`. Removed the dead `/stats` filter (no menu item has that path) and the `canViewStats` import.
- Side effect, intended by the existing `selfStudyHistory` flag: because `Layout` now passes classes, a homeroom teacher who is not a grade admin also sees `/self-study-history` (before, `Layout` passed no classes, so that item was hidden from them).
- Test: one new test in `src/tests/scope.test.ts` (failed first: the menu showed for a homeroom teacher with the policy off).

## Files changed

### Created

None

### Modified

- `src/navigation.ts`
- `src/components/Layout.tsx`
- `src/tests/scope.test.ts`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

None

## Decisions / architecture

- No second permission check: the menu reuses `statisticsClassScope`.
- `firestore.rules` unchanged; the menu is display only, the page and rules still enforce access.
- Earlier (PR #5): 5 high audit findings remain from `@grpc/grpc-js` under firebase (even firebase 13.2.0 pins `~1.9.0`); `--force` would downgrade firebase, not applied.

## Verification

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 170 passed / 17 skipped
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- Manual UI check in a browser: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- Manual UI check of the toggle and the menu still pending.
- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Review and open a PR `feat/hide-stats-menu` → `master`. Separate branch `chore/remove-dead-code` (dead duty/statistics code) is the next task.

## Additional next actions

- Manual check on Emulator/demo data: toggle in `/admin`, then log in as a homeroom teacher with the policy on and off and check the menu and `/self-study-statistics`.
- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `feat/hide-stats-menu` from `master` (`80325b8`). No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch not merged.
- Manual UI check not run.
