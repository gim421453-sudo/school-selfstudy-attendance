# Current Project Handoff

Last updated: 2026-11-11 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally on a new PC; `origin/master` = `12d8a0b` (PR #4 homeroom statistics toggle merged)
- Branch: `chore/audit-fix` (created from `12d8a0b`)
- HEAD: this session's commit on that branch; committed and pushed by Claude (user delegated commit/push)

## Session objective

Set up the new PC (Java), run the full verification on `master` and PR #4, then apply the non-breaking `npm audit fix` on a separate branch.

## Completed this session

- New PC check: Java = Temurin OpenJDK 21.0.13 on PATH; Node v24.22.1; `node_modules` present.
- Before the fix, on `master` (`e042d7d`) and on PR #4 (`3f160b6`): build passed, unit tests 167/169 passed (17 skipped), rules 17/17 passed. PR #4 was then merged on GitHub (by the project thread, not this session).
- `npm audit fix` (no `--force`) on `chore/audit-fix`: only `package-lock.json` changed; `package.json` unchanged.
  - vite 7.3.6 → 7.3.8 (launch-editor / dev-server advisories)
  - vitest and `@vitest/*` (incl. mocker) 4.1.11 → 4.1.12
  - re2js 2.8.6 → 2.10.0, source-map-js 1.2.1 → 1.2.2
  - chai 6.2.2 → 6.3.0, tinyrainbow 3.1.1 → 3.2.0 (pulled in by vitest)
- Audit went from 10 (2 moderate, 8 high) to 5 high.

## Files changed

### Created

None

### Modified

- `package-lock.json`
- `AGENTS.md`
- `docs/handoff/CURRENT_HANDOFF.md`

### Deleted

None

## Decisions / architecture

- The remaining 5 high findings are all one chain: `@grpc/grpc-js <=1.13.5` ← `@firebase/firestore` ← `firebase` ← `@firebase/rules-unit-testing`. npm only offers `--force`, which would downgrade firebase to 9.14.0. Not applied; wait for a firebase release with a fixed grpc-js.
- npm warned that install scripts for `@firebase/util`, `esbuild` and `protobufjs` were not run (not covered by `allowScripts`). Build and all tests still passed; no scripts were approved.

## Verification

- Build (`npm run build`): RUN, passed (chunk-size warning only)
- Unit tests (`npm test`): RUN, 169 passed / 17 skipped
- Rules tests (`npm run test:rules`, Firestore Emulator): RUN, 17/17 passed
- `npm audit`: RUN, 5 high remaining (grpc-js chain above)
- Manual UI check in a browser: NOT RUN
- Deploy: NOT RUN

## Known issues / blockers

- 5 high audit findings via firebase → grpc-js; no non-breaking fix yet.
- Manual UI check of the homeroom statistics toggle (PR #4) still pending.

## Do not repeat

- Do not run `npm audit fix --force` or downgrade firebase.
- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not deploy Firebase resources without a new explicit request.

## Exact next action

Review and open a PR `chore/audit-fix` → `master`.

## Additional next actions

- Manual check on Emulator/demo data: toggle in `/admin`, then open `/self-study-statistics` as a homeroom teacher with the policy on and off.
- Recheck `npm audit` when firebase ships a grpc-js >= 1.13.6.
- Optional: hide the statistics menu for users without access.
- Separate task: remove dead duty/statistics code.

## Environment / configuration

- Workspace: the repository root (folder name differs per computer)
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java (verified: Temurin OpenJDK 21.0.13) and the Firebase Emulator; no production access.
- Windows excluded TCP ranges cover emulator hub 4400 and logging 4500; the CLI moves them automatically.
- Firebase config lives in the local environment; secrets intentionally excluded.

## Git / workspace state

- Branch `chore/audit-fix` from `master` (`12d8a0b`), committed and pushed to origin by Claude. No PR, no merge to master.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Branch pushed but not merged.
- 5 high audit findings remain (firebase/grpc-js).
- Manual UI check not run.
