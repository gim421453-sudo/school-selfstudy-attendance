# Current Project Handoff

Last updated: 2026-10-18 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `a7c3c83` (PR #2 rules scenarios merged)
- Branch: `test/ui-scenarios-11-12-14` (created from `a7c3c83`)
- HEAD: this session's commit on that branch; committed and pushed by Claude (user delegated commit/push)

## Session objective

Cover the UI-side scenarios 11, 12 and 14 from `CODEX_HANDOFF.md` with unit tests and make the statistics class scope fail-closed.

## Completed this session

- Scenario 11: moved the supervision Excel preview logic out of `SupervisionPage.upload()` into `buildSupervisionImportPreview` and added `canCommitSupervisionImport` (`src/domain/supervisionUi.ts`). New: rows dated outside the selected month are errors ("선택한 월 밖의 날짜"). The page's save button and `commitImport()` use `canCommitSupervisionImport`. Replaced the vacuous test "requires a clean preview before commit" with 5 real tests (red first: function missing).
- Scenario 12: added a test chaining `buildBulkPresentDraft` → `resolveSelfStudyAttendanceDisplayStatus` → `summarizeSelfStudyAttendance` (3 students, 1 absent → present 2, unexcused 1). Characterization test; no app code change; passed on first run.
- Scenario 14: added `statisticsClassScope` (`src/domain/scope.ts`): owner/grade admin → selected class or whole grade, homeroom → own class, otherwise `null`. `SelfStudyStatisticsPage` shows "통계를 조회할 권한이 없습니다." when `null` (after classes load) instead of an empty table. 3 tests (red first). Correction to the earlier investigation report: the old page already skipped the query when the teacher had no class, so this was not a data exposure, only an unexplained empty page.

## Files changed

### Created

None

### Modified

- `src/domain/supervisionUi.ts`
- `src/pages/SupervisionPage.tsx`
- `src/domain/scope.ts`
- `src/pages/SelfStudyStatisticsPage.tsx`
- `src/tests/supervision-ui.test.ts`
- `src/tests/self-study-reporting.test.ts`
- `src/tests/scope.test.ts`
- `CODEX_HANDOFF.md` (rows 11, 12 and next steps only)
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

None

## Decisions / architecture

- Out-of-range date = outside the month selected on `/supervision` (chosen in the plan; change if the academic-year range is wanted).
- Dead code (`DutySchedulePage`, `StatsPage`, `parseDutyWorkbook`, `parseDutyWorkbookByPeriod`) left as is; separate cleanup task.
- Homeroom statistics policy toggle (`settings/access`, AdminPage): waiting for the user's decision (remove the toggle vs wire it into `SelfStudyStatisticsPage`). The toggle, AdminPage and CODEX_HANDOFF rows 13·14 were not touched.

## Verification

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 29 files passed / 1 skipped; 167 tests passed / 17 skipped (was 159)
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- Manual UI check in a browser: NOT RUN
- `npm audit`: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- Pending user decision on the homeroom statistics policy toggle (scenarios 13·14).
- `supervisionUi.ts` new strings are literal Korean, while most of the file uses unicode escape sequences; both are UTF-8 and work.

## Do not repeat

- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not install dependencies or deploy Firebase resources without a new explicit request.

## Exact next action

Open a PR `test/ui-scenarios-11-12-14` → `master` after review, then apply the user's decision on the statistics policy toggle and update CODEX_HANDOFF rows 13·14.

## Additional next actions

- Manual check of `/supervision` Excel upload and `/self-study-statistics` as a teacher without a homeroom class (Emulator or demo project only).
- Separate task: remove dead duty/statistics code.
- Review `artifacts/ui-audit/ui-inventory.md` when starting the broader UI redesign.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: OpenJDK 21) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically. Firestore 8080 and Auth 9099 are free.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `test/ui-scenarios-11-12-14` from `master` (`a7c3c83`), committed and pushed to origin by Claude. No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch pushed but not merged.
- Pending decision on the statistics policy toggle.
- Manual UI check and `npm audit` not run.
