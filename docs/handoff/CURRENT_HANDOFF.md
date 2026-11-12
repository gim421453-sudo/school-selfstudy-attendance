# Current Project Handoff

Last updated: 2026-11-12 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: `origin/master` = `8fdb0d5` (PR #9 third dead-code pass merged)
- Branch: `fix/homeroom-stats-class-select-v2` (created from `8fdb0d5`; replaces the conflicting `fix/homeroom-stats-class-select` / PR #10)
- HEAD: this session's commits on that branch

## Latest: statistics class dropdown (`fix/homeroom-stats-class-select-v2`, 2026-11-12)

- Cause: the class `<select>` on `SelfStudyStatisticsPage` was bound to the raw choice `classId` (default `""` = "전체") and listed every class, while the data used `statisticsClassScope`, which pins a homeroom teacher to the own class. So a homeroom teacher saw "전체" over own-class data.
- Fix: new pure helper `statisticsClassSelect` (`src/domain/scope.ts`) derives the dropdown from the `statisticsClassScope` result. Homeroom teacher: value = own class, only that option, disabled. Owner/grade admin: unchanged ("전체" + all classes, value = their choice).
- Tests: `src/tests/statistics-class-select.test.ts` (3 tests; written as a new file in the v2 branch so the large `scope.test.ts` did not have to be re-uploaded).
- Verification on the original branch (before rebuilding on master): `npx tsc -b`, `npm run build`, `npm test` 154 passed / 17 skipped, `npm run test:rules` 17/17 passed, and an emulator-only manual check (grade admin dropdown "전체|2-1|2-2" enabled; homeroom dropdown "2-1" only, disabled).
- Verification of v2: NOT RUN locally. The v2 branch was assembled through the GitHub API from the verified source files, so run `npm run build`, `npm test` (expected 155 passed / 17 skipped) and `npm run test:rules` once on the merged tree. CI result must be checked on the PR.
- Exact next action: check the PR for `fix/homeroom-stats-class-select-v2` → `master`, run the three commands above on the PC, then merge.

## Previous work (merged)

- PR #8: second dead-code pass (HistoryPage, AttendancePage, duty service functions, excel duty template, `canViewStats`).
- PR #9: third dead-code pass (`listAttendanceByRange`, `markStudentsPresent`, `exportAttendanceExcel`, `canManageAttendance`; `access.test.ts` removed with its only test).
- Manual UI check of the statistics toggle/menu (emulator only, 2026-11-12): 10 scenarios as expected. Plain `npm run dev` without `VITE_DEVLOG_SCREENSHOT_TEST_MODE=1` uses `.env.local`, whose project is the real one; use the test-mode flag plus the emulator for UI checks.

## Files changed (this branch)

### Created

- `src/tests/statistics-class-select.test.ts`

### Modified

- `src/domain/scope.ts`
- `src/pages/SelfStudyStatisticsPage.tsx`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

## Decisions / architecture

- `firestore.rules` unchanged.
- `homeroomStatsScope=grade` is still unsupported (the homeroom teacher is pinned to the own class).
- Remaining dead-code candidates were cleared by PR #9; none are known now.

## Verification

- See the verification lines in the Latest section.
- `npm audit`: 5 high (grpc-js via firebase), unchanged.
- Deploy: NOT RUN

## Known issues / blockers

- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet (latest firebase 13.2.0 still pins `@grpc/grpc-js ~1.9.0`).

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Check the PR `fix/homeroom-stats-class-select-v2` → `master`, run build / `npm test` / `npm run test:rules` on the PC, then merge.

## Additional next actions

- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.
- Delete the obsolete branch `fix/homeroom-stats-class-select` and close PR #10 after v2 is merged.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `fix/homeroom-stats-class-select-v2` from `master` (`8fdb0d5`). PR open, not merged.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch not merged; v2 not yet tested on the merged tree.
- 5 high audit findings remain (firebase/grpc-js).
