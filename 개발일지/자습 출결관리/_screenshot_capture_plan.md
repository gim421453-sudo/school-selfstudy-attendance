# 자동 스크린샷 캡처 환경 조사 계획

작성 단계: Phase 2 조사만 완료

## 현재 인증·테스트 구조

- 앱은 `src/lib/firebase.ts`에서 Vite 환경 변수로 Firebase Web App을 초기화한다. 현재 Firebase 설정에는 Emulator 연결 코드가 없다.
- `AuthProvider`는 Firebase Auth의 `onAuthStateChanged`를 구독하고, 로그인은 Google `signInWithPopup`만 제공한다.
- 로그인한 Auth UID에 대응하는 `users/{uid}` 문서가 있어야 승인된 `appUser`가 된다. 그렇지 않으면 pending 사용자 흐름으로 간다.
- `ProtectedRoute`가 로그인·승인되지 않은 사용자를 `/login`으로 보낸다. 대시보드와 운영 화면은 이 보호 라우트 안에 있다.
- `GradeAdminRoute`, `AuditRoute`, `OwnerRoute`가 학년 관리자·감사·시스템 관리자 권한을 추가로 검사한다.
- `ScopeProvider`는 학년도, 교직원 배정, 학년을 Firestore에서 읽어 현재 범위를 결정한다. 테스트 세션은 인증뿐 아니라 이 범위 데이터도 필요하다.

## Emulator 사용 여부

### Firestore Emulator

- `firebase.json`에 Firestore Emulator가 포트 8080으로 등록되어 있다.
- `npm run test:rules`가 Firebase CLI의 `emulators:exec --only firestore`로 Firestore Emulator를 실행한다.
- `src/tests/firestore.rules.test.ts`는 `@firebase/rules-unit-testing`의 `initializeTestEnvironment`와 `authenticatedContext`를 사용한다.
- 규칙 테스트의 인증 컨텍스트는 브라우저 로그인 세션이 아니다. 테스트 코드가 UID와 인증 정보를 직접 주입해 Firestore 규칙만 검증한다.

### Auth Emulator

- `firebase.json`에 Auth Emulator 설정이 없다.
- 코드에서 `connectAuthEmulator`를 호출하지 않는다.
- Google 팝업 로그인을 Auth Emulator와 연결하는 기존 구조나 테스트 로그인 계정은 없다.
- 따라서 현재 상태에서 브라우저가 실제 로그인된 앱 화면으로 이동할 수 없다.

## 기존 테스트 사용자·mock·fixture·seed

- Firestore 규칙 테스트에는 `teacher`, `dutyTeacher`, `admin`, `homeroom`, `owner` 같은 UID가 inline seed로 등장한다.
- 테스트 데이터도 테스트 파일의 `beforeEach` 안에서 직접 생성한다. 별도 공용 fixture/seed 디렉터리나 브라우저용 계정 생성기는 확인되지 않았다.
- `authenticatedContext`는 규칙 테스트용 가상 인증을 제공하지만 Firebase Auth Emulator 계정이나 로그인 가능한 이메일·비밀번호를 만들지는 않는다.
- 기존 테스트 데이터는 규칙 테스트에 맞춘 최소 문서 모음이며, 브라우저 화면을 안정적으로 채우는 통합 seed로 바로 재사용할 수 없다.

## 가장 안전한 권장 방식

Phase 3에서는 운영 Firebase를 전혀 사용하지 않고 별도 로컬 Firebase Emulator 세션을 구성한다.

1. Auth Emulator와 Firestore Emulator를 모두 명시적으로 활성화한다.
2. `DEVLOG_SCREENSHOT_TEST_MODE=1`인 개발 전용 실행에서만 두 Emulator 연결을 활성화한다.
3. Google 팝업이나 실제 계정 로그인을 사용하지 않고 Auth Emulator의 이메일/비밀번호 테스트 계정을 별도 seed로 생성한다.
4. 테스트 계정은 `devlog-owner@example.invalid` 같은 예약 도메인과 `devlog-owner` UID를 사용한다. 실제 사람의 이름·이메일·비밀번호는 사용하지 않는다.
5. Firestore seed는 `users`, 학년도·학년·교직원 배정, 학급, 자습그룹, 교시, 감독 배정, 출결 기록을 최소한으로 생성한다.
6. Playwright는 로컬 HTTP 주소만 사용하고 현재 수집기의 로컬 URL·테스트 모드 가드를 그대로 유지한다. 캡처 종료 후 Emulator와 테스트 데이터를 폐기한다.

Auth Emulator를 추가하는 것이 현재 구조에서 가장 작은 안전한 인증 변경이다. 규칙 테스트의 `authenticatedContext`를 브라우저 세션으로 억지로 재사용하거나 운영 Firebase의 Google 로그인을 자동화하는 방식은 사용하지 않는다.

## 테스트 사용자와 데이터 seed 방식

테스트 데이터는 사람이 아닌 명확한 가상 값만 사용한다.

- 계정: `devlog-owner@example.invalid`, `devlog-teacher@example.invalid`
- 표시 이름: `테스트 관리자`, `테스트 교사 01`
- 학년도: `2026 테스트 학년도`
- 학년·학급: `테스트 2학년`, `2학년 1반`
- 학생: `테스트 학생 01`, `테스트 학생 02`
- 자습그룹: `테스트 자습그룹 A`
- 교시: `테스트 1교시`

Seed 순서는 Auth Emulator 계정 생성 → Emulator 전용 Firestore seed → `users/{uid}`와 역할·활성 상태 생성 → 학년도·학년·교직원 배정 생성 → 화면용 자습·출결 데이터 생성 순서로 한다. 운영 프로젝트 ID·호스트·문서에 연결되지 않는지 실행 전에 검사한다.

## 캡처 가능한 첫 화면

첫 캡처는 인증 후 데이터 의존성이 가장 낮은 `대시보드(/)`를 권장한다. 테스트 계정이 승인되고 최소 범위가 seed된 뒤 대시보드가 렌더링되는지 확인한다.

그 다음은 자습 출결(`/self-study-attendance`) → 감독교사 배정(`/supervision`) → 자습 출결 통계(`/self-study-statistics`) 순서가 적절하다. 시스템 관리자 화면(`/admin/staff`)은 마지막에 확인한다. 모바일 캡처는 데스크톱 대시보드 성공 뒤 진행한다.

## 현재 스크린샷 도구 연결 상태

- `scripts/devlog-screenshots.mjs`는 `changed`와 `full` 모드를 제공하고 `DEVLOG_SCREENSHOT_TEST_MODE=1` 및 로컬 HTTP URL을 요구한다.
- 현재 도구는 서버를 시작하거나 로그인하지 않는다. 페이지가 `/login`으로 이동하면 `AUTH_CAPTURE_NOT_CONFIGURED`로 기록한다.
- 현재 프로젝트에는 Auth Emulator·테스트 로그인·통합 seed가 없어 보호된 화면은 실제 캡처할 수 없다.
- 변경 화면이 없으면 `NO_RELATED_CHANGED_SCREENS`를 기록하고 임의 화면을 만들지 않는다.

## Phase 3에서 수정할 예상 파일

- `firebase.json`: Auth Emulator 포트와 로컬 전용 설정
- `src/lib/firebase.ts`: 테스트 모드에서만 Auth·Firestore Emulator 연결
- `src/auth/AuthProvider.tsx`, `src/pages/LoginPage.tsx`: 테스트 모드 Emulator 이메일/비밀번호 로그인 경로
- 신규 `scripts/devlog-test-seed.mjs`: 가상 Auth 사용자와 Firestore 문서 seed·정리
- `package.json`, `package-lock.json`: Emulator seed·로컬 캡처 실행 명령
- 필요 시 `.env.example`: 테스트 모드와 로컬 Emulator 호스트 이름 문서화
- 필요 시 Playwright 수집기: 테스트 준비 완료 신호만 최소 추가

이번 Phase에서는 위 파일을 수정하지 않았다.

## 보안 위험과 방지책

- 운영 Firebase 연결: 테스트 모드가 아니면 Emulator 연결을 하지 않고 캡처 URL도 localhost/127.0.0.1 HTTP로 제한한다.
- 실제 계정 로그인: Google 팝업, 실제 이메일, 실제 비밀번호, 인증 쿠키·토큰·storageState를 사용하지 않는다.
- 개인정보 노출: seed 값은 `테스트 학생 01` 같은 가상 데이터만 사용하고 캡처 전 민감정보 검사를 유지한다.
- 권한 우회: Firestore 보안 규칙을 완화하지 않고 Emulator에서도 실제 역할·범위 문서를 통해 보호 라우트를 통과시킨다.
- 잔여 데이터: 캡처 종료 후 Emulator와 테스트 데이터를 폐기한다.

## 실제 PNG 1장까지 필요한 작업 순서

1. Firebase CLI와 Java를 확인하고 Auth·Firestore Emulator 설정을 추가한다.
2. 테스트 모드에서만 Firebase SDK가 두 Emulator에 연결되도록 구현한다.
3. Auth Emulator 테스트 계정과 Firestore 최소 seed 스크립트를 작성한다.
4. 개발 서버를 로컬 테스트 환경 변수로 실행한다.
5. Playwright 수집기를 `DEVLOG_SCREENSHOT_TEST_MODE=1`과 localhost URL로 실행한다.
6. 대시보드가 `/login`으로 이동하지 않고 가상 데이터만 표시되는지 확인한다.
7. 민감정보 검사 통과 시에만 PNG를 저장한다.
8. `manifest.json`과 `README.md`에서 실제 파일·게시 후보·가림 필요 상태를 확인한다.
9. 캡처 파일을 사람이 검토하고 Emulator와 테스트 데이터를 정리한다.

현재 Phase 2에서는 인증·seed·프로젝트 코드를 변경하지 않으며 실제 PNG도 생성하지 않는다.
