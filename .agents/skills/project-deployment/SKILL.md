---
name: project-deployment
description: Maintain deployment and operations documentation when build, hosting, environment, migration, domain, rollback, or production verification changes.
---
# Deployment Documentation
Primary target: `docs/deployment/DEPLOYMENT.md`

Document only verified or clearly marked unverified procedures. Typical sections: targets, prerequisites, required config names, build, deployment order, database/rules/migrations, domains/routing, post-deploy verification, rollback/recovery, production caveats. Never include secret values. Never claim a production deployment succeeded unless verified.
