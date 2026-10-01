---
name: project-devlog
description: Maintain development logs only when DEVLOG_AUTO_UPDATE=true or the user explicitly requests a development log.
---
# Development Log
Read `PROJECT_DOCS.config` first.

If `DEVLOG_AUTO_UPDATE=false`, stop without creating or updating devlogs unless the user explicitly requested one. This disabled state is intentional and is not an error.

When enabled, use `DEVLOG_ROOT`, follow any project-specific devlog policy, use verified files/Git/tests as evidence, never fabricate historical dates, never claim unverified completion, and never include secrets.

To re-enable later, change only:
`DEVLOG_AUTO_UPDATE=true`
No skill rewrite is required.
