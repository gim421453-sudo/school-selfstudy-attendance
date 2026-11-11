# Current Project Handoff

Last updated: 2026-11-11 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `80325b8` (PR #5 non-breaking `npm audit fix` merged)
- Branch: `chore/remove-dead-code` (created from `80325b8`)
- HEAD: this session's commit on that branch
- Sibling branch from the same base: `feat/hide-stats-menu` (statistics menu follows the homeroom statistics policy). Both edit this file and `AGENTS.md`; whichever merges second needs a small conflict fix there.

## Session objective

Remove duty/statistics code that no route uses.

## Completed this session

- Deleted `src/pages/DutySchedulePage.tsx` and `src/pages/StatsPage.tsx`, and their `lazy(...)` declarations in `src/App.tsx`. No `<Route>` rendered them (`/duty` and `/stats` already redirect to `/my-supervision` and `/self-study-statistics`).
- `src/lib/excel.ts`: removed `parseDutyWorkbook`, `parseDutyWorkbookBuffer`, `parseDutyWorkbookByPeriod`, `dutyPeriodRowsToAssignments` (used only by `DutySchedulePage`) and the private helpers left unused by that (`parseDutyRows`, `normalizeDateCell`, `validDate`, `DUTY_HEADERS`).
- `src/tests/excel.test.ts`: removed the 15 duty-parser tests. The 4 generic workbook safety checks (row limit, column limit, non-xlsx payload, extension) now call `readSafeWorkbook`/`readSafeWorkbookBuffer` directly, so that coverage is kept.
- Evidence: before deleting, `grep` found no other references; after deleting, `npx tsc -b` passed and `grep` finds none of the removed names in `src/`.

## Files changed

### Created

None

### Modified

- `src/App.tsx`
- `src/lib/excel.ts`
- `src/tests/excel.test.ts`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

- `src/pages/DutySchedulePage.tsx`
- `src/pages/StatsPage.tsx`

## Decisions / architecture

- Only the listed items and code used solely by them were deleted. Further candidates found but NOT deleted (not in the agreed list):
  - `src/pages/HistoryPage.tsx`, `src/pages/AttendancePage.tsx`: not rendered by any route (`/history`, `/attendance` redirect), still compiled.
  - `src/services/duty.ts` (`listDutyAssignmentsByRange`, `saveDutyAssignment`, `saveDutyAssignmentsBulk`): no callers left.
  - `dutyRowsToAssignments`, `DutyImportRow`, `createDutyTemplateWorkbook`/`downloadDutyTemplate` in `src/lib/excel.ts`: check callers before removing.
  - `canViewStats` (`src/domain/access.ts`): still used by `Layout` on master; unused once `feat/hide-stats-menu` merges.
- 5 high audit findings remain from `@grpc/grpc-js` under firebase (even firebase 13.2.0 pins `~1.9.0`); `--force` would downgrade firebase, not applied.

## Verification

- Type check (`npx tsc -b`): RUN, passed
- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 154 passed / 17 skipped (15 duty-parser tests removed with the code)
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- Manual UI check in a browser: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- Manual UI check of the homeroom statistics toggle still pending.
- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Review and open PRs for `feat/hide-stats-menu` and `chore/remove-dead-code` → `master`; resolve the handoff/AGENTS conflict on the second merge.

## Additional next actions

- Decide whether to remove the further dead-code candidates listed above.
- Manual check on Emulator/demo data: toggle in `/admin`, then log in as a homeroom teacher with the policy on and off.
- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `chore/remove-dead-code` from `master` (`80325b8`). No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branches not merged.
- Manual UI check not run.
