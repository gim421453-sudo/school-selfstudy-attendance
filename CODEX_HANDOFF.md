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

1. 일반 교사 A가 비담당 날짜에 attendance write → DENY
2. 일반 교사 A가 본인 담당 날짜에 attendance write → ALLOW
3. 일반 교사가 dutyAssignments 변경 → DENY
4. grade_admin이 dutyAssignments Excel 일괄 적용 → ALLOW
5. grade_admin이 학생/교시/반/담임 변경 → ALLOW
6. 일반 교사가 학생/교시/반 변경 → DENY
7. grade_admin이 users의 homeroomClassId/displayName만 변경 → ALLOW
8. grade_admin이 roles/active/system_owner를 변경 → DENY
9. system_owner는 users roles/active 변경 → ALLOW
10. auditLogs update/delete → DENY
11. Excel 동명이인/중복날짜/기간밖 날짜가 실제 적용 버튼을 막는지 확인
12. 한 반 전체 출석 후 예외 학생 1명을 결석으로 바꿔 통계가 1건만 결석으로 집계되는지 확인
13. 담임 통계 정책 OFF → 담임 통계 차단
14. 담임 통계 정책 ON → 본인 반 데이터만 UI 집계

## 다음 단계

Firebase Emulator Suite를 추가하고 Firestore Rules 테스트를 자동화한다. 실제 운영 배포는 Emulator PASS 전까지 진행하지 않는다.
