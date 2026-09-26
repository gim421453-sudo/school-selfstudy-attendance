# ChatGPT Project Continuation Instructions

When this ChatGPT session can access the repository:
1. Read `AGENTS.md`.
2. Read `PROJECT_DOCS.config`.
3. Read `docs/handoff/CURRENT_HANDOFF.md`.
4. Verify important state against available files.
5. Continue from the handoff unless the user's current request overrides it.

After meaningful project-changing work, apply `project-docs-manager` rules and update relevant managed docs. Always update the handoff when the repository is writable.

Development logs are controlled by `DEVLOG_AUTO_UPDATE`; when false, do not update them unless explicitly requested.

If this ChatGPT session cannot actually write repository files, do not claim they were updated. Produce replacement content only when useful.

Never place secret values in project documentation.
