# 학교 자습 출결관리 v0.1 아키텍처

## 권한 모델

- `system_owner`
  - 전체 권한
  - 교직원 활성/비활성 및 역할 관리
  - 통계 열람 정책 변경
  - 출결 담당교사 배정
- `grade_admin`
  - 학년부 선생님 2명
  - 학생 명부/교시/담당교사 배정 관리
  - 전체 통계 열람
  - 출결 긴급 수정 가능
- `homeroom_teacher`
  - 일반 교사 + 담임 표시
  - 출결 조회
  - 통계 정책이 허용될 경우 통계 열람
- `teacher`
  - 로그인 및 출결 조회
  - `dutyAssignments/{date}.teacherUid`가 본인 UID인 날짜에만 출결 수정

핵심 원칙: "오늘 담당교사"는 고정 역할이 아니다. 날짜별 배정 문서로 계산한다.

## Firestore 구조

```text
users/{uid}
students/{studentId}
periods/{periodId}
dutyAssignments/{yyyy-MM-dd}
settings/access
attendance/{yyyy-MM-dd}/records/{classId__periodId__studentId}
statistics/{statId}  # 후속 집계 캐시
```

## 출결 상태

- present: 출석
- late: 지각
- absent: 결석
- excused: 인정
- early_leave: 조퇴

## 통계 정책

`settings/access`

```json
{
  "statsVisibility": "grade_admin_only",
  "homeroomStatsScope": "own_class"
}
```

`statsVisibility`는 `grade_admin_and_homeroom`으로 변경 가능하다.

## 보안

UI의 버튼 숨김은 편의 기능일 뿐 보안 경계가 아니다.
실제 쓰기 권한은 `firestore.rules`에서 다시 검증한다.

일반 선생님:
- 출결 읽기: 가능
- 담당 날짜 출결 쓰기: 가능
- 담당이 아닌 날짜 쓰기: 불가
- 학생/교시/담당자 배정 수정: 불가

## 다음 단계

1. 실제 학교 반/학생 명부 import
2. 담당교사 달력형 배정 UI
3. 반별/학생별/교시별 주간·월간 통계 집계
4. 수정 이력(audit log) 및 누가/언제/무엇을 변경했는지 기록
5. 교직원 계정 생성 워크플로(관리자 SDK/Cloud Function 또는 관리용 별도 백엔드)
6. 결석 사유/비고 정책
7. CSV/Excel/PDF 내보내기
8. 운영 호스팅과 백업 정책
