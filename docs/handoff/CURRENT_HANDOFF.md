# Current Project Handoff

Last updated: 2026-11-12 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `00a2bfa` (PR #7 statistics menu merged; PR #6 dead-code removal merged before it)
- Branch: `chore/remove-dead-code-2` (created from `00a2bfa`)
- HEAD: this session's commit on that branch

## Session objective

Second dead-code pass (candidates left by PR #6/#7), plus an `npm audit` recheck and a manual UI check plan for the statistics toggle/menu.

## Completed this session

- `npm audit` recheck (read only): still 5 high, all `@grpc/grpc-js <=1.13.5`. Latest firebase 13.2.0 → `@firebase/firestore` 4.19.1 still pins `@grpc/grpc-js ~1.9.0` (fixed grpc-js is 1.13.6+, latest 1.14.7). No non-breaking fix exists yet; nothing changed.
- Deleted `src/pages/HistoryPage.tsx` and `src/pages/AttendancePage.tsx` and their `lazy(...)` declarations in `src/App.tsx`; no `<Route>` rendered them (`/history`, `/attendance` redirect to the self-study pages).
- `src/services/duty.ts`: removed `listDutyAssignmentsByRange`, `saveDutyAssignment`, `saveDutyAssignmentsBulk` (no callers), `getDutyAssignment` (only caller was `AttendancePage`), and `DutyAssignmentInput`/`dutyEditWindow` used only by those. `validateDutyAssignmentDate` stays (tested in `schedule-policy.test.ts`).
- `src/lib/excel.ts`: removed `dutyRowsToAssignments`, `DutyImportRow`, `createDutyTemplateWorkbook`, `downloadDutyTemplate` (no callers outside tests) and the helper/import left unused (`localDateString`, schedule import).
- `src/domain/access.ts`: removed `canViewStats` (only `access.test.ts` used it; the live check is `statisticsClassScope`).
- Tests removed with their code (not weakened: the code they covered no longer exists): `canViewStats` test in `access.test.ts`, duty-template round trip in `excel-workbook-roundtrip.test.ts`.
- Evidence: `grep` before deleting, then `npx tsc -b` passed and none of the removed names remain in `src/`.

## Files changed

### Created

None

### Modified

- `src/App.tsx`
- `src/services/duty.ts`
- `src/lib/excel.ts`
- `src/domain/access.ts`
- `src/tests/access.test.ts`
- `src/tests/excel-workbook-roundtrip.test.ts`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

- `src/pages/HistoryPage.tsx`
- `src/pages/AttendancePage.tsx`

## Decisions / architecture

- Further candidates exposed by this pass, NOT deleted (not in the agreed list):
  - `src/services/attendance.ts`: `listAttendanceByRange`, `markStudentsPresent` (no callers left); check the rest of the file.
  - `exportAttendanceExcel` in `src/lib/excel.ts` (no callers; `createAttendanceWorkbook` is still tested).
  - `canManageAttendance` in `src/domain/access.ts` (only `access.test.ts` uses it).
- `firestore.rules` unchanged.

## Verification

- Type check (`npx tsc -b`): RUN, passed
- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 153 passed / 17 skipped (2 tests removed with their code)
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- `npm audit`: RUN, 5 high (grpc-js via firebase), unchanged
- Manual UI check in a browser: NOT RUN (next step in this session)
- Deploy: NOT RUN

## Known issues / blockers

- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.
- Manual UI check of the homeroom statistics toggle and menu still pending.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Review and open a PR `chore/remove-dead-code-2` → `master`.

## Additional next actions

- Decide on the further candidates listed above.
- Manual check on Emulator/demo data only: toggle in `/admin`, then a homeroom teacher with the policy on and off, and a teacher without a homeroom class; check the statistics menu, `/self-study-statistics` and the history menu.
- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `chore/remove-dead-code-2` from `master` (`00a2bfa`). No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch not merged.
- Manual UI check not run.
