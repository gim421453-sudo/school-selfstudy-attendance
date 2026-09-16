# Dependency security baseline v0.3

## SheetJS Community Edition

- Version: 0.20.3
- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- Vendored file: vendor/xlsx-0.20.3.tgz
- SHA-256: 8DC73FC3B00203E72D176E85B50938627C7B086E607C682E8D3C22C02BB99FE8

The application imports school-supplied spreadsheets. The official tarball is stored in the
repository so future installs use a reviewed, reproducible artifact instead of the vulnerable
npm registry xlsx package.

The registry package was removed because it remains affected by GHSA-4r6h-8v6p-xvw6
(prototype pollution) and GHSA-5pgg-2g8v-p4x9 (ReDoS). SheetJS Community Edition 0.20.3
is the official replacement selected for this project.

## Vitest

- Previous version: 3.2.4
- Current version: 4.1.11

Vitest 4.1.11 remediates GHSA-82fw-gwwq-j7x9 without an unnecessary Vitest 5 major upgrade.
