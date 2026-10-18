# Codex handoff — 학교 자습 출결관리 v0.2

## 목표

현재 v0.2 구현을 실제 Windows 개발 환경에서 fresh install/build/test하고 Firebase Emulator까지 붙여 권한 규칙을 검증한다.

## 가장 먼저 실행

```powershell
cd <project-folder>
npm install
npm run build
npm test
```

빌드 오류가 있으면 임시 우회 없이 원인을 수정한다.

## v0.2에서 이미 구현된 기능

- Firebase Auth 로그인
- 날짜별 담당교사 권한
- 일반교사 비담당일 read-only
- 학년부/최고관리자 override
- Excel 담당표 양식 생성
- XLSX 직접 셀 파싱
- 이메일 우선 / 이름 fallback 교사 매칭
- 동명이인/미등록/중복날짜/선택기간 밖 날짜 검증
- 적용 전 미리보기
- 담당표 일괄 적용 및 학년부 수동 변경
- 반/담임 계정 연결
- 과거 출결 검색
- 학년부 원본 출결 Excel 다운로드
- 주/월/직접기간 통계
- 반별/학생별/교시별 집계
- 통계 Excel 다운로드
- 미입력 출결 표시 + 전체 출석 처리
- auditLogs 기본 기록

## 검증해야 할 핵심 시나리오

2026-10-18 에 현재 `firestore.rules` 모델(학년도·학년 범위 `staffAssignments`, Duty V2 `dutyAssignments/{gradeId}_{date}/periods/{periodId}`, `users` 쓰기는 system_owner 만, 담임은 `classes.homeroomTeacherUid` + `homeroomAssignments`)에 맞춰 다시 썼다. 원래 v0.2 목록은 전역 역할(`users.roles`) 기준이었다.

"테스트" 열은 `src/tests/firestore.rules.test.ts` 의 `it(...)` 이름이다. `npm run test:rules` 기준 17/17 통과(2026-10-18, Emulator).

| # | 시나리오 (현재 모델) | 기대 | 근거 테스트 |
|---|---|---|---|
| 1 | 같은 학년 교사가 담당이 아닌 날짜·교시, 또는 편집 시간창 밖에 attendance write | DENY | enforces scoped attendance, history, and audit rules (teacherWrong, 2026-09-17 창 밖) / validates StaffAssignment projections and D3 self-study attendance boundaries (d3-other) |
| 2 | Duty V2 담당 교사가 편집 시간창 안에서 본인 담당 attendance write | ALLOW | enforces scoped attendance, history, and audit rules (teacherA) / D3 테스트 (d3-supervisor) |
| 3 | 일반 교사, 다른 학년 grade_admin 이 dutyAssignments 부모·교시 문서 변경 | DENY | enforces Duty V2 parent, child, batch, query, and exception scope rules |
| 4 | 해당 학년 grade_admin 이 담당표 일괄 적용(부모+교시+감사로그 batch) | ALLOW (잘못된 교시가 섞이면 batch 전체 DENY) | enforces Duty V2 parent, child, batch, query, and exception scope rules |
| 5 | 해당 학년 grade_admin 이 학생·반·교시·담임 생성/수정 | ALLOW | lets only the scoped grade admin write students and classes, and only the owner write users and staff assignments / enforces scoped class, student, period, and assignment access (교시) / enforces self-study operation scope, supervision, and homeroom permissions (담임 배정 batch) |
| 6 | 일반 교사, 다른 학년 grade_admin 이 학생·반·교시 변경 | DENY | lets only the scoped grade admin write students and classes, … / enforces scoped class, student, period, and assignment access (교시) / enforces self-study operation scope, … (반 수정) |
| 7 | grade_admin 이 `users` 문서(displayName 등) 수정 | DENY (v0.2 의 ALLOW 에서 바뀜: `users` 쓰기는 owner 만, 담임 연결은 `classes`/`homeroomAssignments` 로 함) | lets only the scoped grade admin write students and classes, … |
| 8 | grade_admin 이 `users.globalRoles`/`roles`/`active` 또는 `staffAssignments`(역할 승격 포함) 변경 | DENY | lets only the scoped grade admin write students and classes, … / reserves grade-admin role changes for the system owner (레거시 `roles`) |
| 9 | system_owner 가 `users` roles/active, `staffAssignments` 변경 | ALLOW | allows system owner user administration while protecting audit immutability / reserves grade-admin role changes for the system owner / validates StaffAssignment projections and D3 … / lets only the scoped grade admin write … (owner 승격) |
| 10 | auditLogs update/delete (owner 포함) | DENY | allows system owner user administration while protecting audit immutability / enforces scoped attendance, history, and audit rules |
| 11 | 감독 Excel 업로드(`/supervision`)에서 동명이인·파일 내 중복 행·선택한 월 밖 날짜가 있으면 '확인 후 저장'을 막는지 | 저장 차단 (단위 테스트) | `src/tests/supervision-ui.test.ts` "supervision import preview" (blocks commit when the file repeats a row / a teacher name is ambiguous / a date is outside the selected month). 미리보기 생성은 `buildSupervisionImportPreview`, 버튼과 `commitImport` 는 `canCommitSupervisionImport` 를 쓴다(`src/domain/supervisionUi.ts`). 실제 화면 클릭은 NOT VERIFIED |
| 12 | 반 전체 일괄 출석 후 1명만 결석으로 바꾸면 결석 1건만 집계 | 결석 1건 (단위 테스트) | `src/tests/self-study-reporting.test.ts` "counts exactly one absence after bulk present and one student switched to absent" (`buildBulkPresentDraft` → `resolveSelfStudyAttendanceDisplayStatus` → `summarizeSelfStudyAttendance`) |
| 13 | 담임 통계 정책 OFF → 담임은 통계 못 봄 | DENY | honors the homeroom statistics policy. 규칙상 `statistics` 는 정책과 무관하게 owner/레거시 grade_admin 만 읽는다 |
| 14 | 담임 통계 정책 ON → 본인 반 데이터만 | 규칙: 담임은 본인 반 attendance 만 읽음, 다른 반·학년 전체 쿼리 DENY. `settings/access` 정책은 Rules 가 참조하지 않으므로 UI 집계 범위는 Rules 테스트 불가 | enforces scoped attendance, history, and audit rules (homeA) / honors the homeroom statistics policy (정책 ON 이어도 `statistics` DENY) |

## 다음 단계

- Emulator Rules 테스트는 자동화됐다(`npm run test:rules`). 새 컬렉션이나 권한을 추가하면 위 표에 행과 테스트를 같이 추가한다.
- 11·12 는 2026-10-18 에 단위 테스트로 덮었다. 14 의 UI 범위와 13·14 의 담임 통계 정책 토글은 사용자 결정(토글 제거 또는 통계 화면 연결)을 기다린다.
- 실제 운영 배포는 Emulator PASS 와 사용자 승인 전까지 진행하지 않는다.
