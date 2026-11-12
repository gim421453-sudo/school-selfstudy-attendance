# Current Project Handoff

Last updated: 2026-11-12 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: `origin/master` = `848b6fb` (PR #11 statistics dropdown fix merged)
- Branch: `docs/mark-tests-verified` (created from `848b6fb`)
- HEAD: this session's commits on that branch

## Latest: statistics class dropdown (`fix/homeroom-stats-class-select-v2`, 2026-11-12)

- Cause: the class `<select>` on `SelfStudyStatisticsPage` was bound to the raw choice `classId` (default `""` = "전체") and listed every class, while the data used `statisticsClassScope`, which pins a homeroom teacher to the own class. So a homeroom teacher saw "전체" over own-class data.
- Fix: new pure helper `statisticsClassSelect` (`src/domain/scope.ts`) derives the dropdown from the `statisticsClassScope` result. Homeroom teacher: value = own class, only that option, disabled. Owner/grade admin: unchanged ("전체" + all classes, value = their choice).
- Tests: `src/tests/statistics-class-select.test.ts` (3 tests; written as a new file in the v2 branch so the large `scope.test.ts` did not have to be re-uploaded).
- Verification on the original branch (before rebuilding on master): `npx tsc -b`, `npm run build`, `npm test` 154 passed / 17 skipped, `npm run test:rules` 17/17 passed, and an emulator-only manual check (grade admin dropdown "전체|2-1|2-2" enabled; homeroom dropdown "2-1" only, disabled).
- Verification of v2 (PR branch `12da1d2`, 2026-11-12): `npx tsc -b` passed; `npm run build` passed; `npm test` 155 passed / 17 skipped (run on the PC and again in the cloud with dummy demo env values); `npm run test:rules` 17/17 passed (PC, Emulator). Master after the merge (`848b6fb`) was not re-run.
- Merged as PR #11 (`848b6fb`); PR #10 closed. The branches `fix/homeroom-stats-class-select` and `fix/homeroom-stats-class-select-v2` are intentionally kept (user decision).

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

Decide whether to merge the `docs/user-guide` branch (user guide, pushed from the PC, no PR yet). Optionally re-run the three checks on master.

## Additional next actions

- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.
- The old statistics-dropdown branches are kept on purpose; delete only if the user asks.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- `master` = `848b6fb` (PR #11 merged). Working branch for this docs update: `docs/mark-tests-verified`.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Master not re-run after the PR #11 merge (the PR branch was verified).
- 5 high audit findings remain (firebase/grpc-js).
