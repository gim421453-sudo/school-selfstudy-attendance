# 학교 자습 출결관리 시스템

학교의 자율학습 운영을 체계적으로 관리하기 위한 웹 기반 출결·감독·운영 관리 시스템입니다.

Firebase Authentication, Cloud Firestore, React, Vite, TypeScript를 기반으로 하며 교직원 인증, 학년도·학년별 권한, 자습 출결, 감독교사 배정, 학생·학급·자습그룹 관리, 시간표, 운영 제외일, 통계, 감사 기록, 비상 운영모드 등을 하나의 시스템에서 관리합니다.

현재 개발 및 기능 확장이 진행 중입니다.

---

## 주요 기술

- React
- Vite
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firebase Emulator Suite
- Excel 직접 파싱
- Google 로그인

---

# 주요 기능

## 자습 출결 관리

날짜, 자습 교시, 자습그룹을 기준으로 학생 출결을 관리합니다.

지원 상태:

- 출석
- 인정 결석
- 무단 결석
- 미입력

`미입력(MISSING)`은 저장되는 출결 상태가 아니라 해당 학생의 출결 기록이 아직 존재하지 않는 데이터 상태입니다.

주요 기능:

- 날짜별 출결 입력
- 자습 교시별 출결 입력
- 자습그룹별 출결 입력
- 학생별 상태 변경
- 전체 출석 처리
- 출결 저장
- 과거 출결 조회
- 권한에 따른 과거 출결 수정
- 기간별 검색
- Excel 다운로드

출결 권한은 단순히 UI에서만 제한하지 않고 Firestore Security Rules에서도 강제합니다.

---

## 자습 출결 통계

다양한 기준으로 자습 출결 통계를 조회할 수 있습니다.

기간:

- 일별
- 주별
- 월별
- 직접 기간 지정

분류:

- 학생별
- 학급별
- 자습그룹별
- 교시별

주요 통계:

- 예상 출결 수
- 출석
- 인정 결석
- 무단 결석
- 미입력
- 출석률

통계 계산 시 다음 데이터를 함께 고려합니다.

- 실제 운영 교시
- 자습그룹
- 학생 membership
- 운영 제외일
- 자습 허락
- 실제 저장된 출결 기록

통계 계산 로직은 화면마다 별도로 구현하지 않고 공통 도메인 로직을 사용합니다.

---

# 감독교사 관리

감독교사는 고정 역할이 아니라 날짜별 `SupervisionAssignment`로 관리합니다.

주요 기능:

- 날짜별 감독교사 배정
- 자습 교시별 배정
- 자습그룹별 배정
- 내 감독 일정 조회
- 주간 / 월간 감독 일정 확인
- 감독교사 직접 추가
- 감독교사 변경
- 감독교사 해제
- Excel 담당표 업로드
- Excel 업로드 미리보기
- 교직원 계정 매칭 검증

다음 상태는 서로 다르게 취급합니다.

### 미배정

자습그룹과 자습교시는 연결되어 있지만 감독교사가 아직 지정되지 않은 상태입니다.

### 교시 미연결

해당 자습그룹이 해당 자습교시와 연결되어 있지 않은 상태입니다.

두 상태를 동일하게 표시하거나 계산하지 않습니다.

---

# 감독교사 Excel

구조화된 `.xlsx` 파일은 OCR을 사용하지 않고 셀 데이터를 직접 읽습니다.

기본 처리 흐름:

1. Excel 파일 업로드
2. 셀 데이터 직접 파싱
3. 교사 정보 매칭
4. 오류 검증
5. 동명이인 검증
6. 미리보기
7. 사용자 확인
8. 일괄 적용

교직원 식별 시 이메일 등 고유성이 높은 값을 우선 사용합니다.

등록되지 않은 계정이나 모호한 매칭은 자동 적용하지 않습니다.

이미지나 PDF 형식 담당표를 추후 지원할 경우에만 OCR을 fallback 방식으로 사용합니다.

---

# 학생 관리

학생은 학년도와 학년 범위에서 관리합니다.

주요 기능:

- 학생 조회
- 학생 추가
- 학생 정보 수정
- 학생 비활성화
- Excel 명부 업로드
- 학년도별 학생 관리
- 학년별 학생 관리

학생을 완전히 삭제하는 것보다 기존 출결 및 운영 이력을 보존할 수 있도록 비활성화를 우선합니다.

---

# 학급 및 담임 관리

학급은 학년도와 학년 범위로 관리합니다.

주요 기능:

- 학급 생성
- 학급 수정
- 학급 비활성화
- 담임교사 지정
- 담임교사 변경
- 담임교사 해제

담임은 별도 전역 역할이 아닙니다.

담임 여부는 다음 속성을 기준으로 판단합니다.

```text
classes/{classId}.homeroomTeacherUid
```

따라서 담임 지정과 `StaffAssignment` 역할 변경은 서로 다른 작업입니다.

---

# 자습그룹

실제 학급과 자율학습 운영 그룹은 별개의 개념입니다.

`Class`

- 실제 학교 학급

`SelfStudyGroup`

- 자율학습 운영을 위한 별도 그룹

주요 기능:

- 자습그룹 생성
- 자습그룹 수정
- 자습그룹 비활성화
- 학생 배정
- 학생 배정 해제
- 교시 연결
- 교시 연결 해제

학생의 자습그룹을 변경하더라도 실제 학급 정보는 변경되지 않습니다.

---

# 자습 시간표

요일별로 서로 독립적인 자습 시간표를 운영할 수 있습니다.

각 요일별로 다음 값을 설정합니다.

- 교시 이름
- 순서
- 시작 시간
- 종료 시간
- 활성 여부
- 교시 유형

교시 유형:

```text
SELF_STUDY
BREAK
```

`BREAK`는 다음 기능에서 자습 운영 교시로 계산하지 않습니다.

- 감독교사 배정
- 출결 입력
- 출결 통계
- 예상 출결 계산

요일별 시간표는 자동으로 서로 동기화하지 않습니다.

다른 요일에 동일한 값을 적용하고 싶은 경우 사용자가 명시적으로 `월~금에 반영` 기능을 실행합니다.

---

# 자습 운영 제외일

학교 또는 특정 학년의 자습 운영 제외일을 관리합니다.

예:

- 공휴일
- 시험일
- 학교 행사
- 학년 행사
- 기타 자습 미운영일

지원 범위:

- 학교 전체
- 특정 학년
- 특정 교시
- 하루 전체

`periodIds`가 지정되지 않은 경우 해당 날짜 전체를 제외하는 방식으로 처리합니다.

일요일은 기본 자습 운영일에서 제외됩니다.

---

# 자습 허락

학생의 특정 날짜 또는 교시에 대한 자습 허락 정보를 관리합니다.

허락 정보는 인정 결석 처리와 연계할 수 있도록 설계되어 있습니다.

주요 항목:

- 날짜
- 학생
- 적용 교시
- 사유
- 비고

자습 허락과 실제 출결 기록은 동일한 데이터가 아니며 서로 연계되는 별도 도메인으로 관리합니다.

---

# 사용자 인증

Firebase Authentication을 사용합니다.

현재 로그인 방식:

- Google Popup 로그인

Google 인증 성공은 사용자의 신원 확인만 의미합니다.

프로그램 사용을 위해서는 애플리케이션 내부 사용자 승인도 필요합니다.

승인되지 않은 사용자가 로그인하면 승인 대기 정보가 생성되며, 승인된 사용자만 실제 시스템에 접근할 수 있습니다.

---

# 권한 구조

## system_owner

시스템 최고 관리자입니다.

주요 권한:

- 전체 학년도 / 학년 관리
- 사용자 승인
- 사용자 활성 / 비활성 관리
- StaffAssignment 관리
- 전체 시스템 관리
- 시스템 운영모드 관리
- 감사 기록 확인
- 비상 상황 관리

`system_owner`는 전체 시스템 범위를 관리합니다.

---

## teacher

교직원의 기본 전역 역할입니다.

실제 접근 가능한 범위는 다음 정보와 함께 결정됩니다.

- 현재 AcademicYear
- StaffAssignment
- 학년
- 담임 학급
- SupervisionAssignment
- 기능별 권한

---

## grade_admin

`grade_admin`은 전체 시스템에 적용되는 단순 전역 역할로 사용하지 않습니다.

다음 범위가 포함된 `StaffAssignment`를 기준으로 판단합니다.

```text
academicYearId
gradeId
uid
role
active
```

즉 같은 교사라도 학년도 또는 학년에 따라 권한이 달라질 수 있습니다.

---

## 담임교사

담임은 별도 global role이 아닙니다.

```text
classes.homeroomTeacherUid
```

를 기준으로 판단합니다.

---

## 감독교사

감독교사도 별도 전역 role이 아닙니다.

특정 날짜·교시·자습그룹에 대한:

```text
SupervisionAssignment
```

으로 결정됩니다.

---

# 주요 도메인 구조

현재 시스템의 주요 도메인은 다음과 같습니다.

```text
users
pendingUsers

academicYears
grades
staffAssignments

classes
students

periods

selfStudyGroups
groupPeriods
memberships

supervisionAssignments

selfStudyPermissions
selfStudyExceptions

selfStudyAttendanceRecords

auditLogs

operations
```

실제 collection 이름과 세부 필드는 코드의 domain/service 정의를 최종 기준으로 합니다.

과거 버전의 `dutyAssignments` 또는 날짜별 중첩 attendance 구조는 현재 도메인 모델과 다를 수 있습니다.

---

# 시스템 운영모드

시스템 전체 운영 상태를 제어할 수 있습니다.

지원 모드:

```text
NORMAL
READ_ONLY
ESSENTIAL_ONLY
MAINTENANCE
LOCKDOWN
```

## NORMAL

정상 운영 상태입니다.

## READ_ONLY

대부분의 수정 작업을 제한하고 조회 중심으로 동작합니다.

## ESSENTIAL_ONLY

필수 기능 중심으로 제한 운영합니다.

## MAINTENANCE

점검 상태를 사용자에게 안내하고 일반 기능 접근을 제한합니다.

## LOCKDOWN

비상 상황에서 일반 사용자의 시스템 접근을 강하게 제한합니다.

`system_owner`는 비상 상황에서도 시스템 운영 페이지에 접근할 수 있도록 설계합니다.

---

# 운영 공지

운영모드와 함께 다음 정보를 관리할 수 있습니다.

- 공지 제목
- 공지 내용
- 사전공지 시작 시각
- 점검 시작 시각
- 점검 종료 시각
- 상단 공지 배너
- 상단 알림

시간 입력은 한국 표준시 사용을 전제로 합니다.

---

# 감사 기록

중요한 변경 작업은 감사 기록을 남기는 구조를 사용합니다.

예:

- 감독교사 변경
- 담임교사 변경
- 출결 변경
- 교시 수정
- 권한 변경
- 운영 설정 변경

감사 기록은 현재 데이터와 별개의 변경 이력입니다.

향후에는 내부 action/source 값을 사용자 친화적인 한국어 표현으로 변환하여 표시할 예정입니다.

---

# 화면 디자인 시스템

이 시스템은 하나의 디자인만 사용하는 것이 아니라 사용자별로 원하는 화면 스타일을 선택할 수 있도록 확장하고 있습니다.

현재 디자인 카탈로그:

## V2 — 라이트 관리형

밝고 단정한 학교 행정 SaaS 스타일입니다.

특징:

- 흰색 / 쿨그레이
- 네이비 포인트
- 높은 가독성
- 파스텔 상태 표현
- 관리 업무 중심

---

## V3 — 다크 운영센터형

딥 네이비 기반의 고밀도 운영 UI입니다.

특징:

- 딥 네이비
- 블루 / 시안 강조색
- 운영 상태 중심
- 높은 정보 밀도
- 시스템 관제 느낌

---

## V4 — 라이트 프리미엄

넓은 여백과 둥근 카드 중심의 밝은 프리미엄 스타일입니다.

특징:

- 밝은 배경
- 넓은 여백
- 부드러운 카드
- 모바일 친화적 레이아웃

---

## V5 — 다크 시네마틱 캠퍼스

학교 야간 이미지와 글래스 효과를 사용하는 다크 브랜딩 스타일입니다.

특징:

- 야간 학교 분위기
- 글래스모피즘
- 큰 타이포그래피
- 브랜딩 중심 UI

---

# 화면 스타일 설정

다음 페이지가 추가되어 있습니다.

```text
/settings/appearance
```

현재 구현된 UI:

- V2 선택 UI
- V3 선택 UI
- V4 선택 UI
- V5 선택 UI
- 모든 탭 동일 적용 토글
- 주요 메뉴별 디자인 선택
- 전체 초기화 버튼
- 미리보기 버튼
- 설정 적용 버튼

현재 단계에서는 UI Scaffold만 구현되어 있습니다.

아직 구현되지 않은 기능:

- Firestore 저장
- localStorage 캐시
- ThemeProvider
- 실제 테마 전환
- 탭별 테마 전환
- 미리보기
- 초기화
- 실시간 preference 동기화

향후 사용자 설정은 다음과 같은 별도 영역으로 관리할 예정입니다.

```text
userPreferences/{uid}
```

각 사용자는 자신의 UI 설정만 변경할 수 있도록 제한합니다.

UI preference는 출결, 권한, StaffAssignment 등 업무 데이터와 분리합니다.

---

# 테마 구현 원칙

V2 / V3 / V4 / V5는 서로 다른 프로그램이 아닙니다.

모든 테마는 동일한:

- Firebase 데이터
- Firestore Rules
- 권한
- 서비스 계층
- 통계 계산
- 업무 기능

을 사용합니다.

구조:

```text
같은 기능
+
같은 데이터
+
같은 권한
+
다른 UI
```

테마마다 페이지 전체를 복제하지 않습니다.

공통 컴포넌트와 디자인 토큰을 사용해 외형만 변경하는 구조를 목표로 합니다.

---

# 화면 숫자와 통계

디자인 시안에 포함된 숫자는 디자인 예시입니다.

실제 앱에서는 숫자를 하드코딩하지 않습니다.

예:

- 현재 학생 수
- 자습그룹 수
- 감독 미배정 수
- 출결 미입력 수
- 오늘 운영 교시 수
- 출석률
- 인정 결석 수
- 무단 결석 수
- 최근 감사 기록
- 신학년도 준비 상태

위 값들은 실제 Firestore 데이터와 도메인 계산 결과를 기반으로 표시합니다.

---

# 추가 구현 예정 기능

디자인 시안을 실제 기능과 연결하기 위해 다음 기능을 추가할 예정입니다.

- 사용자별 V2 / V3 / V4 / V5 저장
- 전체 테마 선택
- 탭별 테마 선택
- ThemeProvider
- userPreferences Security Rules
- localStorage 초기 테마 캐시
- 운영모드 실시간 동기화
- StaffAssignment 실시간 동기화
- Scope 실시간 갱신
- 점검 사전공지 모달
- 대시보드 파생 알림
- 출결 통계 차트
- 기간별 통계 추이
- 감사 기록 한국어 표시 계층
- 모바일 전용 레이아웃
- 접근성 개선
- 운영 제외일 사유 선택화

선택 기능:

- 학교 위치 기준 날씨

날씨 기능을 구현하는 경우 사용자 위치를 수집하지 않고 학교의 고정 위치를 기준으로 조회합니다.

---

# Firebase 준비

Firebase 프로젝트에서 다음 항목을 준비합니다.

1. Firebase Authentication 활성화
2. Google 로그인 Provider 활성화
3. Cloud Firestore 생성
4. Firebase Web App 생성
5. 필요한 Authorized Domain 등록
6. 최초 `system_owner` 사용자 승인 및 설정
7. Firestore Security Rules 적용

Google 인증만으로 애플리케이션 권한이 자동 부여되지는 않습니다.

---

# 환경 변수

`.env.example`을 참고하여 로컬 환경 파일을 구성합니다.

```text
.env.local
```

Firebase Web App 설정 값을 입력합니다.

환경 변수와 API Key 관련 로컬 설정 파일을 Git에 커밋하지 않습니다.

---

# 로컬 실행

Node.js LTS와 npm을 준비합니다.

```bash
npm install
npm run dev
```

기본 개발 주소는 환경에 따라 다음과 같은 localhost 주소를 사용합니다.

```text
http://127.0.0.1:5173
```

실제 포트는 실행 환경 또는 개발 설정에 따라 달라질 수 있습니다.

---

# Tailscale 개발 접속

개발 환경을 같은 tailnet 내 다른 장치에서 확인할 경우 Tailscale Serve를 사용할 수 있습니다.

예:

```bash
tailscale serve --bg 5173
tailscale serve status
```

중지:

```bash
tailscale serve 5173 off
```

개발 중에는 특별한 이유가 없다면 Funnel을 이용한 공개 인터넷 노출을 피합니다.

---

# Google 로그인 설정

Firebase Console에서 Google Authentication Provider를 활성화해야 합니다.

사용하는 환경에 따라 Firebase Authentication의 Authorized Domains에 다음 환경을 등록해야 할 수 있습니다.

- localhost
- 로컬 개발 주소
- Tailscale 접속 주소
- Firebase Hosting 도메인

Google 로그인은 사용자 신원만 확인합니다.

실제 애플리케이션 접근 여부는 Firestore의 사용자 승인 상태와 StaffAssignment 등을 기준으로 판단합니다.

---

# 개발 환경 및 검증

Node.js LTS와 npm을 설치합니다.

Firestore Rules 테스트를 위해 로컬 Java Runtime이 필요합니다.

확인:

```bash
java -version
```

Java는 개발 PC의 실행 환경 요구사항이며 JRE/JDK 바이너리를 저장소에 포함하지 않습니다.

Firebase CLI 설치:

```bash
npm install -g firebase-tools
```

확인:

```bash
firebase --version
```

Firebase CLI는 production dependency로 프로젝트에 포함하지 않고 전역 CLI를 사용하는 구성을 기본으로 합니다.

---

# 테스트

일반 테스트:

```bash
npm test
```

Firestore Rules 테스트:

```bash
npm run test:rules
```

Rules 테스트는 Firebase Emulator를 사용하며 실제 Production Firestore를 대상으로 실행하지 않습니다.

TypeScript 검사:

```bash
npx tsc --noEmit
```

전체 검증:

```bash
npm run verify
```

현재 `npm run verify`는 프로젝트 설정에 따라 다음 검증을 묶어서 수행합니다.

- Production build
- Unit test
- Firestore Rules test
- npm audit

---

# 권장 검증 순서

```text
1. npm install
2. npx tsc --noEmit
3. npm run build
4. npm test
5. npm run test:rules
6. npm audit
7. npm run verify
```

작은 UI 수정에서는 필요에 따라 `npx tsc --noEmit`을 먼저 사용하고, 최종 handoff 또는 배포 전에는 전체 검증을 수행합니다.

---

# Production Build

배포 전 반드시 새 Production Build를 생성합니다.

```bash
npm run build
```

다음과 같이 build 성공을 확인한 뒤에만 배포합니다.

```text
✓ built
```

Build가 실패한 상태에서 Hosting을 배포하지 않습니다.

이전 `dist`가 남아 있을 경우 이전 빌드 결과가 다시 배포될 수 있습니다.

---

# Firebase Hosting 배포

Firebase 프로젝트 선택:

```bash
firebase use dev
```

Hosting 배포:

```bash
firebase deploy --only hosting
```

현재 Hosting 주소:

```text
https://school-selfstudy-attendance.web.app
```

Firestore Rules를 변경하지 않은 UI-only 작업에서는 Hosting만 배포합니다.

Rules가 변경된 경우에는 변경 범위를 검증한 뒤 필요한 Rules만 별도로 배포합니다.

---

# 개발일지 스크린샷

개발일지 및 블로그용 스크린샷 자동화 기능을 사용할 수 있습니다.

```bash
npm run devlog:screenshots
```

전체 주요 화면을 대상으로 할 경우:

```bash
npm run devlog:screenshots -- --mode full
```

스크린샷 자동화는 Production 인증을 우회하지 않습니다.

로그인이 필요한 화면을 캡처할 수 없는 경우 해당 화면을 강제로 우회하지 않고 캡처 불가 상태로 기록합니다.

각 실행은 manifest와 README 정보를 생성하여 게시 가능한 이미지를 구분할 수 있도록 합니다.

---

# 생성 산출물

자동 생성되는 UI 감사 결과, 스크린샷, 임시 개발 산출물은 다음 폴더를 사용합니다.

```text
artifacts/
```

이 폴더는 Git에서 추적하지 않습니다.

`.gitignore`:

```text
artifacts/
```

---

# 현재 알려진 주요 개선사항

현재 우선 확인 또는 해결이 필요한 항목입니다.

## P1

1. `grade_admin` 전환 시 일부 환경에서 Scope `MISSING`이 발생하는 문제
2. 일반교사의 자습 출결 접근 과정에서 일부 Firestore `permission-denied`가 발생하는 문제
3. 일부 필터 적용 시 페이지 상태가 초기화되거나 이동하는 문제
4. StaffAssignment 또는 권한 변경 후 재로그인이 필요한 문제
5. `grade_admin` 감사 기록 범위 확인
6. 일부 수정 오류 후보 재검증
7. 운영모드 실시간 반영

위 문제는 권한을 넓게 완화하는 방식으로 해결하지 않습니다.

실제 원인을 확인한 뒤 최소 권한 원칙을 유지합니다.

---

# UI 리디자인

현재 V2 / V3 / V4 / V5 디자인 시안이 준비되어 있으며 전체 화면 리디자인을 진행할 예정입니다.

대상 주요 화면:

1. 로그인
2. 대시보드
3. 자습 출결
4. 내 감독 일정
5. 출결 이력
6. 출결 통계
7. 자습 허락
8. 학생 명부
9. 학급 / 담임 관리
10. 자습 시간표
11. 자습그룹 / 자습실
12. 감독교사 배정
13. 자습 운영 제외일
14. 감사 기록
15. 교직원 / 권한 관리
16. 시스템 운영 / 비상 모드
17. 시스템 관리자
18. 신학년도 준비

각 테마에서 기능과 데이터는 동일하게 유지합니다.

---

# 다음 개발 작업

다음 예정 작업:

```text
UI_THEME_ROUTE_CATALOG_PASS
```

목표:

- 테마 적용 대상 화면 목록 중앙화
- `UiThemeRouteKey` 추가
- `UI_THEME_ROUTES` 추가
- route key 관리
- path 관리
- label 관리
- group 관리
- `AppearanceSettingsPage`의 하드코딩 제거
- `UI_THEME_ROUTES.map()` 기반 UI 생성

이 단계에서는 다음 기능을 구현하지 않습니다.

- Firestore 저장
- localStorage
- 실제 ThemeProvider
- 실제 테마 전환
- CSS 전면 변경

---

# 이후 구현 순서

권장 순서:

```text
1. 현재 코드 기준점 및 검증
2. P1 권한 / Scope 문제 해결
3. 운영모드 실시간 동기화
4. StaffAssignment / 사용자 Scope 실시간 동기화
5. userPreferences 구현
6. V2~V5 Theme Provider 구현
7. 공통 디자인 시스템 구현
8. 핵심 업무 화면 리디자인
9. 나머지 업무 화면 리디자인
10. 관리자 화면 리디자인
11. 신규 대시보드 기능 및 통계 차트
12. 모바일 최적화
13. 접근성 검증
14. 역할별 E2E
15. Production 검증 및 배포
```

---

# 개발 원칙

이 프로젝트는 다음 원칙을 따릅니다.

- 검증되지 않은 기능을 완료로 표시하지 않습니다.
- Production 화면에 임의 숫자를 하드코딩하지 않습니다.
- UI 때문에 권한 정책을 약화하지 않습니다.
- Firestore Security Rules를 실제 보안 경계로 사용합니다.
- Rules는 query filter가 아니라 접근 제어 정책으로 취급합니다.
- 담임, 학년관리자, 감독교사를 서로 다른 개념으로 관리합니다.
- 학급과 자습그룹을 서로 다른 도메인으로 관리합니다.
- 미입력과 무단 결석을 구분합니다.
- 미배정과 교시 미연결을 구분합니다.
- 기존 도메인 계산 로직을 가능한 한 재사용합니다.
- 테마별 페이지 복제를 피합니다.
- Build 성공을 확인하지 않은 Hosting 배포를 하지 않습니다.
- 민감정보와 환경 변수는 Git 저장소에 포함하지 않습니다.
- 자동화는 Production 인증이나 권한을 우회하지 않습니다.

---

# 프로젝트 상태

이 프로젝트는 현재 기능 확장 및 UI 리디자인 단계입니다.

기존 기능을 유지하면서:

- 권한 모델 안정화
- 실시간 동기화
- 사용자별 디자인 선택
- V2 / V3 / V4 / V5 테마
- 대시보드 강화
- 통계 시각화
- 모바일 최적화
- 운영 안정성 향상

을 순차적으로 진행합니다.