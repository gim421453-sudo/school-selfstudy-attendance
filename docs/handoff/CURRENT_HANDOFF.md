# Current Project Handoff

Last updated: 2026-11-12 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `3194acd` (PR #8 second dead-code pass merged)
- Branch: `fix/homeroom-stats-class-select` (created from `3194acd`)
- HEAD: this session's commit on that branch

## Latest: statistics class dropdown (`fix/homeroom-stats-class-select`, 2026-11-12)

- Cause: the class `<select>` on `SelfStudyStatisticsPage` was bound to the raw choice `classId` (default `""` = "전체") and listed every class, while the data used `statisticsClassScope`, which pins a homeroom teacher to the own class. So a homeroom teacher saw "전체" over own-class data.
- Fix: new pure helper `statisticsClassSelect` (`src/domain/scope.ts`) derives the dropdown from the `statisticsClassScope` result. Homeroom teacher: value = own class, only that option, disabled. Owner/grade admin: unchanged ("전체" + all classes, value = their choice).
- Test first: `src/tests/scope.test.ts` "locks the class filter to the pinned own class for a homeroom teacher" failed (helper missing), then passed.
- Verification: `npx tsc -b` passed; `npm run build` passed; `npm test` 154 passed / 17 skipped; `npm run test:rules` 17/17 passed.
- Manual check (emulator only, `VITE_DEVLOG_SCREENSHOT_TEST_MODE=1`, policy "grade admin + homeroom", classes 2-1 and 2-2): grade admin dropdown "전체|2-1|2-2", enabled, shows "전체"; homeroom dropdown "2-1" only, disabled, shows "2-1". No request left localhost. Owner's default scope is all grades, so the page asks to pick a grade (unchanged).
- Exact next action: review and open a PR `fix/homeroom-stats-class-select` → `master`. Sibling branch `chore/remove-dead-code-3` also edits this file and `AGENTS.md`; the second merge needs a small conflict fix there.

## Previous session objective (PR #8, merged)

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
- Manual UI check (on `master` `00a2bfa`): RUN, all 10 scenarios as expected; see below
- Deploy: NOT RUN

### Manual UI check (2026-11-12, emulator only)

- Setup: `firebase emulators:start --only auth,firestore --project school-selfstudy-attendance-devlog` + `vite` with `VITE_DEVLOG_SCREENSHOT_TEST_MODE=1` (forces Auth/Firestore emulators and the email/password test login). Test users and data were seeded by a throwaway script outside the repo (users `menu-owner|menu-admin|menu-homeroom|menu-teacher@example.test`, one class 2-1 with the homeroom user). Driven by Playwright with the system Edge (`channel: "msedge"`; Playwright's own browser is not downloaded). No request left localhost.
- Results (statistics menu / history menu / `/self-study-statistics`):
  - Policy "grade admin only": owner Y/Y/shown, grade admin Y/Y/shown, homeroom N/Y/no-access, teacher without class N/N/no-access.
  - Owner pressed "정책 변경" in `/admin` → "grade admin + homeroom": homeroom Y/Y/shown (pinned to own class 2-1), teacher without class N/N/no-access, grade admin Y/Y/shown.
  - Toggled back → homeroom N/Y/no-access again.
- Minor observation (not changed): for a homeroom teacher the class filter dropdown on the statistics page shows "전체" while the data and heading are pinned to the own class.
- Plain `npm run dev` without the test-mode flag uses `.env.local`, whose project ID is the real project (`school-selfstudy-attendance`, not `demo-*`). Use the test-mode flag for local UI checks.

## Known issues / blockers

- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Review and open a PR `chore/remove-dead-code-2` → `master`.

## Additional next actions

- Decide on the further candidates listed above.
- Optional: make the statistics class filter show the pinned own class for homeroom teachers.
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
- 5 high audit findings remain (firebase/grpc-js).
