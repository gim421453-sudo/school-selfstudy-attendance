# Current Project Handoff

Last updated: 2026-10-14 (Asia/Seoul)
Status: READY_WITH_WARNINGS

## Project

- Project: school-selfstudy-attendance
- Repository: VERIFIED locally
- Branch: docs/cleanup-conflict-markers
- HEAD: 5d5d078 (baseline before this cleanup; cleanup changes are uncommitted)

## Session objective

Documentation-only cleanup: resolve leftover merge-conflict markers, add the `OWNER` file, and bring `CLAUDE.md` / `AGENTS.md` up to date with the real stack and verification commands.

## Completed this session

- Resolved conflict markers in `AGENTS.md`, `CHATGPT_PROJECT_INSTRUCTIONS.md`, `docs/handoff/CURRENT_HANDOFF.md`, `.agents/skills/project-handoff/SKILL.md`, `.agents/skills/project-handoff/references/HANDOFF_TEMPLATE.md`.
  - `AGENTS.md`: kept both PROJECT_HANDOFF_POLICY and PROJECT_DOCUMENTATION_POLICY blocks; first line has no BOM.
  - `CURRENT_HANDOFF.md`: kept the 2026-10-02 (READY_WITH_WARNINGS) content; dropped the NOT_INITIALIZED template.
  - `CHATGPT_PROJECT_INSTRUCTIONS.md`: HEAD side plus the `PROJECT_DOCS.config` / `project-docs-manager` / `DEVLOG_AUTO_UPDATE` rules from dcdb850.
  - `SKILL.md`, `HANDOFF_TEMPLATE.md`: HEAD side only (dcdb850 side had no unique rules).
- Added `OWNER` (`Claude`).
- `CLAUDE.md`: stack set to Vite + React 19 + TypeScript + Firebase, removed the NOT_INITIALIZED note, filled verification commands, added the OWNER rule.
- `AGENTS.md`: added the same verification commands and the "OWNER=Claude, Codex reads only" rule.
- Earlier state still true: `AGENTS.md` and `.agents/` are already tracked (no longer untracked workspace files). `/settings/appearance` is a disabled UI-only scaffold (`src/domain/uiThemes.ts`, `src/pages/AppearanceSettingsPage.tsx`, `src/App.tsx`, `src/navigation.ts`); no persistence or theme engine.

## Files changed

### Created

- `OWNER`
- `CLAUDE.md` (was untracked; updated)

### Modified

- `AGENTS.md`
- `CHATGPT_PROJECT_INSTRUCTIONS.md`
- `docs/handoff/CURRENT_HANDOFF.md`
- `.agents/skills/project-handoff/SKILL.md`
- `.agents/skills/project-handoff/references/HANDOFF_TEMPLATE.md`

### Deleted

None

## Decisions / architecture

- Markdown/docs only. No change to `src/`, `firestore.rules`, `package.json`, or any config.
- Conflict resolution default = HEAD side (e5a3fa8); dcdb850-only rules merged only where they were genuinely new.
- `OWNER=Claude`: Codex reads only.

## Verification

- Conflict-marker grep (incl. CRLF-aware `\r?` variant): see session output; expected no matches after cleanup.
- Build: NOT RUN (docs-only task)
- Unit tests: NOT RUN
- Integration tests: NOT RUN
- Rules/security tests: NOT RUN (`npm run test:rules`, Emulator)
- Deploy: NOT RUN

## Known issues / blockers

- `AGENTS.md.backup-20260927-024606` is still tracked; the user will remove it with `git rm`. Claude must not delete it.
- Note: a plain `^=======( |$)` grep misses these CRLF files; use `^(<<<<<<<|=======|>>>>>>>)( |\r?$)`.
- Appearance controls are intentionally disabled.

## Do not repeat

- Do not add a theme engine, persistence, or Firestore preference model without a new explicit request.
- Do not install dependencies or deploy Firebase resources without a new explicit request.
- Do not delete the AGENTS.md backup file.

## Exact next action

Verify the 14 Firestore Rules scenarios listed in `CODEX_HANDOFF.md` (section "검증해야 할 핵심 시나리오") on the Firebase Emulator with `npm run test:rules`; do not deploy to production before the Emulator passes.

## Additional next actions

- User: `git rm AGENTS.md.backup-20260927-024606`, then stage and commit the docs cleanup.
- Review `artifacts/ui-audit/ui-inventory.md` when starting the broader UI redesign.

## Environment / configuration

- Workspace: `C:\dev\school-selfstudy-attendance`
- Timezone: Asia/Seoul
- `npm run test:rules` needs Java and the Firebase Emulator; Firebase config lives in the local environment, secrets intentionally excluded.

## Git / workspace state

- Branch `docs/cleanup-conflict-markers`; changes uncommitted. No add/commit/push/pull/reset/stash performed.
- Remote: NOT VERIFIED.
- Last verified commit: `5d5d078`.

## Cross-device readiness

READY_WITH_WARNINGS

Warnings:
- Build, unit tests, and Rules tests were not run in this session (docs-only).
- Cleanup is uncommitted until the user stages and commits it.
