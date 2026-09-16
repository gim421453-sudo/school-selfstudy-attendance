# 학교 자습 출결관리 v0.2

Firebase Authentication + Cloud Firestore + React/Vite 기반 학교 자습 출결관리 웹앱입니다.

## v0.2 핵심 기능

- Firebase Email/Password 로그인
- 역할: `system_owner`, `grade_admin`, `teacher`
- 담임 여부: 사용자 문서의 `homeroomClassId`와 `classes` 연결로 관리
- 날짜별 담당교사 배정
- 일반교사: 출결/담당표/과거기록 확인 전용, 본인 담당일에만 출결 수정
- 학년부: 학생/교시/반/담임/담당교사 관리
- 최고관리자: 교직원 권한, 활성상태, 통계 공개정책 관리
- Excel 담당표 양식 생성
- Excel 담당표 업로드 → 셀 직접 파싱 → 교사 계정 매칭 → 오류/동명이인 검증 → 미리보기 → 일괄 적용
- 학년부의 담당교사 수동 변경
- 주별/월별 담당 일정 보기
- 출결 미입력 상태 구분 및 `현재 반 전체 출석 처리`
- 과거 출결 기간/반/학생/교시/상태 검색
- 학년부 과거 출결 Excel 다운로드
- 원하는 주/월/직접 기간 통계
- 반별/학생별/교시별 통계
- 통계 Excel 다운로드
- 담당표/담임 변경 감사 로그
- Firestore Security Rules로 UI와 별개로 실제 쓰기 권한 강제

## 담당표 Excel 형식

프로그램에서 선택한 주/월 기준으로 양식을 직접 다운로드할 수 있습니다.

| 날짜 | 요일 | 담당교사명 | 담당교사이메일 | 비고 |
|---|---|---|---|---|
| 2026-10-01 | 목 | 홍길동 | teacher@example.com | |

매칭 우선순위:

1. `담당교사이메일` 정확히 일치
2. 이메일이 없거나 매칭되지 않으면 `담당교사명` 정확히 일치
3. 같은 이름의 활성 교사가 2명 이상이면 오류 처리하여 이메일 입력 요구
4. 등록되지 않은 계정은 적용 차단

`.xlsx` 파일은 OCR을 사용하지 않고 셀 데이터를 직접 읽습니다. OCR은 향후 사진/PDF 담당표 지원 시에만 fallback으로 추가합니다.

## Firestore 구조

```text
users/{uid}
classes/{classId}
students/{studentId}
periods/{periodId}
dutyAssignments/{yyyy-MM-dd}
settings/access
attendance/{yyyy-MM-dd}/records/{classId__periodId__studentId}
auditLogs/{logId}
statistics/{statId}  # 향후 서버 집계 캐시용
```

출결 record에는 `date`를 중복 저장하여 collection-group 기간 조회와 통계가 가능하게 했습니다.

## 권한 요약

### system_owner

- 전체 기능
- 교직원 일반/학년부 권한 변경
- 계정 활성/비활성
- 통계: 학년부 전용 / 학년부+담임 정책 변경

### grade_admin

- 전체 출결 수정 가능
- 담당교사 일정 Excel 업로드/수동 변경
- 학생 명부/교시/반/담임 관리
- 전체 통계와 Excel 다운로드
- 감사 로그 생성

### teacher

- 담당교사 일정 확인
- 출결 및 과거 출결 조회
- `dutyAssignments/{date}.teacherUid == 본인 UID`인 날짜에만 출결 수정
- 담당이 아닌 날짜는 뷰어 모드

### 담임

담임은 별도 고정 권한을 중복 저장하기보다 `homeroomClassId`로 판별합니다.
통계 정책이 `grade_admin_and_homeroom`일 때 자기 반 통계를 볼 수 있습니다.

## Firebase 준비

1. Firebase Authentication > Email/Password 활성화
2. Firestore Database 생성
3. 교직원 Auth 계정 생성
4. Auth UID와 같은 ID로 `users/{uid}` 생성
5. 최고관리자 계정에 `roles: ["system_owner", "teacher"]`
6. 학년부 2명은 `roles: ["grade_admin", "teacher"]`

예시:

```json
{
  "email": "owner@example.com",
  "displayName": "최고관리자",
  "roles": ["system_owner", "teacher"],
  "active": true
}
```

## 로컬 실행

`.env.example`을 `.env.local`로 복사한 뒤 Firebase Web App 값을 입력합니다.

```bash
npm install
npm run dev
```

기본 주소:

```text
http://127.0.0.1:5173
```

## Tailscale 개발 접속

Vite는 localhost에만 bind하도록 두고 Tailscale Serve로 같은 tailnet에 공유하는 구성을 권장합니다.

```bash
tailscale serve --bg 5173
tailscale serve status
```

중지:

```bash
tailscale serve 5173 off
```

개발 중에는 Funnel로 공개 인터넷 노출하지 않는 것을 권장합니다.

## 검증 상태

현재 실행 환경은 npm registry DNS 접근이 차단되어 `npm install`이 `EAI_AGAIN`으로 실패했습니다.
따라서 이 환경에서는 실제 `npm run build` / `npm test`까지 완료 선언하지 않습니다.

확인한 항목:

- 프로젝트 파일 생성/구조 확인
- TypeScript 소스 정적 구문 검사 수행
- 의존성 미설치로 발생한 module-resolution 오류 외에 코드 검토 진행
- Firestore 권한 구조와 화면 권한을 동일 모델로 정렬

Codex/로컬 개발 PC에서는 아래 순서로 검증하세요.

```bash
npm install
npm run build
npm test
```

이후 Firebase Emulator를 추가해 Security Rules 권한 테스트를 자동화하는 것이 다음 우선순위입니다.

## v0.3 권장 범위

- Firebase Emulator 기반 Firestore Rules 통합 테스트
- 학생 명부 Excel 일괄 업로드
- 출결 수정 전/후 값까지 포함한 감사로그
- 출결 비고/사유 편집 UI
- 학년부용 감사로그 조회 화면
- 담임 Excel 다운로드를 허용할 경우 `본인 반만` 서버 규칙으로 제한
- 통계 계산식(인정 상태를 출석률에 포함할지) 학교 정책 설정화
- Firebase Auth 교직원 계정 생성용 관리자 전용 Cloud Function 또는 별도 관리 API
- 운영 Hosting/백업/복구 정책

## Development environment and verification

Install Node.js (LTS) and npm, then install the project dependencies with `npm install`.

Firestore Rules tests require a local Java runtime. Confirm it is available with `java -version`. Java is a machine prerequisite only; do not add a JRE or JDK binary to this repository.

Install the Firebase CLI globally with `npm install -g firebase-tools`, then confirm it with `firebase --version`. The project intentionally does not include `firebase-tools` as a local dependency because the global CLI keeps the production dependency audit surface small. On Windows, ensure the global npm bin directory is available through the PowerShell Firebase shim before running Rules tests.

Run `npm run test:rules` to execute the Firestore Emulator Rules suite. It uses the emulator only and does not connect to or deploy to the production Firebase project.

Run `npm run verify` before handoff. It runs the production build, unit tests, Firestore Emulator Rules tests, and `npm audit` in sequence.

Recommended local verification order:

1. `npm install`
2. `npm run build`
3. `npm test`
4. `npm run test:rules`
5. `npm audit`
6. `npm run verify`

## Google sign-in setup

Enable Google as a Firebase Authentication sign-in provider in the Firebase Console before using this application. Add every local, Tailscale, and hosted URL used to open the app to Firebase Authentication Authorized domains.

Google authentication proves identity only. Application access still requires a manually created `users/{uid}` Firestore document with `active: true`; that document remains the source of display name, roles, and homeroom assignment. The first `system_owner` must be created manually in the Firebase Console after obtaining the Google Auth UID.
