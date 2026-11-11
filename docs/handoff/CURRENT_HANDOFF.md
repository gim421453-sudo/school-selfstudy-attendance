# Current Project Handoff

Last updated: 2026-10-19 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally; `origin/master` = `e042d7d` (PR #3 UI scenarios merged)
- Branch: `feat/homeroom-stats-toggle` (created from `e042d7d`)
- HEAD: this session's commit on that branch; committed and pushed by Claude (user delegated commit/push)

## Session objective

Connect the homeroom statistics policy toggle (`settings/access`) to the self-study statistics screen, as the user decided.

## Completed this session

- `statisticsClassScope` (`src/domain/scope.ts`) now takes the access settings: owner/grade admin are unaffected; a homeroom teacher gets the own class only when `statsVisibility = "grade_admin_and_homeroom"`; `grade_admin_only`, a missing document (service default) or a read failure deny (fail-closed). `homeroomStatsScope = "grade"` still pins the own class because the rules only let a homeroom teacher read that class.
- `SelfStudyStatisticsPage` loads the settings with `getAccessSettings()` and shows the no-access message only after classes and settings have loaded.
- `AdminPage` toggle label shows "학년부만" / "학년부 + 담임(본인 반)" with a one-line explanation instead of the raw value.
- Tests: scope tests rewritten with the settings input (5 tests; the "policy off/unreadable denies homeroom" test failed first).
- `firestore.rules` unchanged. Reason: the toggle is a statistics-screen policy; homeroom teachers must keep reading their own class records for the history page, and the rules already never allow whole-grade reads for them.
- Correction carried over: the earlier report that a teacher without a homeroom class queried the whole grade was wrong (the page already skipped the query); fixed in the PR #3 handoff.

## Files changed

### Created

None

### Modified

- `src/domain/scope.ts`
- `src/pages/SelfStudyStatisticsPage.tsx`
- `src/pages/AdminPage.tsx`
- `src/tests/scope.test.ts`
- `CODEX_HANDOFF.md` (rows 13, 14 and next steps)
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

None

## Decisions / architecture

- Default and failure = homeroom statistics closed.
- No UI sets `homeroomStatsScope`; the value `grade` is treated as own class. Supporting whole-grade homeroom statistics would need a rules change and Emulator tests first.
- The statistics menu item is still visible to every assigned teacher; a teacher without access sees the no-access message. Hiding the menu is a possible follow-up.
- Dead code (`DutySchedulePage`, `StatsPage`, `parseDutyWorkbook*`) still left for a separate cleanup.

## Verification

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 169 passed / 17 skipped
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- Manual UI check in a browser: NOT RUN
- `npm audit`: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- None blocking. Manual UI check pending.

## Do not repeat

- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not install dependencies or deploy Firebase resources without a new explicit request.

## Exact next action

Open a PR `feat/homeroom-stats-toggle` → `master` after review.

## Additional next actions

- Manual check on Emulator/demo data: toggle in `/admin`, then open `/self-study-statistics` as a homeroom teacher with the policy on and off.
- Optional: hide the statistics menu for users without access.
- Separate task: remove dead duty/statistics code.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: OpenJDK 21) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `feat/homeroom-stats-toggle` from `master` (`e042d7d`), committed and pushed to origin by Claude. No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch pushed but not merged.
- Manual UI check and `npm audit` not run.
