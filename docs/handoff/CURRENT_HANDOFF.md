# Current Project Handoff

Last updated: 2026-11-12 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `c465aca` (PR #6 dead-code removal merged)
- Branch: `feat/hide-stats-menu` (PR #7, open), with `origin/master` merged in (merge commit, no rebase)
- HEAD: merge commit on that branch

## Session objective

1. Remove duty/statistics code that no route uses (PR #6, merged).
2. Hide the self-study statistics menu from users the statistics page would turn away (PR #7, open).

## Completed this session

### Dead code removal (PR #6, merged)

- Deleted `src/pages/DutySchedulePage.tsx` and `src/pages/StatsPage.tsx` and their `lazy(...)` declarations in `src/App.tsx`; no `<Route>` rendered them (`/duty`, `/stats` already redirect).
- `src/lib/excel.ts`: removed `parseDutyWorkbook`, `parseDutyWorkbookBuffer`, `parseDutyWorkbookByPeriod`, `dutyPeriodRowsToAssignments` and the private helpers left unused by that (`parseDutyRows`, `normalizeDateCell`, `validDate`, `DUTY_HEADERS`).
- `src/tests/excel.test.ts`: 15 duty-parser tests removed with the code; the 4 generic workbook safety checks now call `readSafeWorkbook`/`readSafeWorkbookBuffer` directly.

### Statistics menu (PR #7)

- `visibleNavigation` (`src/navigation.ts`) takes the access settings as a new last argument and shows `/self-study-statistics` only when `statisticsClassScope(...)` (the same function the statistics page uses) returns non-null. Owner/grade admin always; homeroom teacher only with `statsVisibility = "grade_admin_and_homeroom"` and an active own class; `null` settings (loading or read failure) hide it.
- `Layout` loads the current grade's classes and passes them plus the settings; removed the dead `/stats` filter and the `canViewStats` import.
- Side effect, approved by the user (2026-11-11): a homeroom teacher who is not a grade admin now also sees `/self-study-history` (before, `Layout` passed no classes).
- One new test in `src/tests/scope.test.ts` (failed first).
- Merged `origin/master` into the branch; conflicts only in `AGENTS.md` (test baseline line, set to the real merged result) and this file (both sections combined).

## Files changed

### Created

None

### Modified

- `src/navigation.ts`, `src/components/Layout.tsx`, `src/tests/scope.test.ts` (PR #7)
- `src/App.tsx`, `src/lib/excel.ts`, `src/tests/excel.test.ts` (PR #6)
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

- `src/pages/DutySchedulePage.tsx`, `src/pages/StatsPage.tsx` (PR #6)

## Decisions / architecture

- The menu reuses `statisticsClassScope`; no second permission check. `firestore.rules` unchanged.
- Further dead-code candidates found but NOT deleted (not in the agreed list):
  - `src/pages/HistoryPage.tsx`, `src/pages/AttendancePage.tsx` (no route renders them)
  - `src/services/duty.ts` (`listDutyAssignmentsByRange`, `saveDutyAssignment`, `saveDutyAssignmentsBulk`; no callers)
  - `dutyRowsToAssignments`, `DutyImportRow`, duty template helpers in `src/lib/excel.ts` (check callers first)
  - `canViewStats` (`src/domain/access.ts`): after PR #7 only `src/tests/access.test.ts` uses it.
- 5 high audit findings remain from `@grpc/grpc-js` under firebase (even firebase 13.2.0 pins `~1.9.0`); `--force` would downgrade firebase, not applied.

## Verification

On the merged branch (`feat/hide-stats-menu` + `origin/master` `c465aca`):

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 155 passed / 17 skipped
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- Manual UI check in a browser: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- Manual UI check of the homeroom statistics toggle and menu still pending.
- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Merge PR #7 (`feat/hide-stats-menu` → `master`), then rerun build/test/test:rules on `master`.

## Additional next actions

- Decide whether to remove the further dead-code candidates listed above.
- Manual check on Emulator/demo data: toggle in `/admin`, then log in as a homeroom teacher with the policy on and off and check the menu and `/self-study-statistics`.
- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- `feat/hide-stats-menu` = PR #7 commit `5fa3982` + merge of `origin/master` (`c465aca`). Not merged to master yet.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- PR #7 not merged.
- Manual UI check not run.
