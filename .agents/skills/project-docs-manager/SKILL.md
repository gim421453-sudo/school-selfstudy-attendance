---
name: project-docs-manager
description: Decide which project documents became stale and coordinate README, CHANGELOG, deployment docs, devlog, and handoff updates.
---
# Project Documentation Manager

Read `PROJECT_DOCS.config` before the final response of meaningful project-changing work.

## Decision rules
- README: update only when project purpose, setup, run/use instructions, configuration, major features, architecture, supported platforms, or useful repository structure changed.
- CHANGELOG: update only for meaningful user/operator/release/security/migration/bug-fix changes. Use `Unreleased` unless a version is verified.
- Deployment docs: update only when build/deploy/hosting/env/domain/migration/rollback/production-check behavior changed.
- Development log: update only when `DEVLOG_AUTO_UPDATE=true` OR the user explicitly requests a devlog.
- Handoff: always update after meaningful project-changing work.

Preserve existing project-specific content. Do not replace existing docs with templates. Do not invent versions, dates, commands, tests, deployments, or history. Never write secrets.
