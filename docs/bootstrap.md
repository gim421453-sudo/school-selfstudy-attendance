# 최초 부트스트랩 순서

1. Firebase Authentication에서 최고관리자 계정을 먼저 생성한다.
2. 그 계정의 UID를 확인한다.
3. Firestore `users/{UID}` 문서를 아래 형태로 수동 생성한다.

```json
{
  "email": "본인 계정 이메일",
  "displayName": "최고관리자",
  "roles": ["system_owner", "teacher"],
  "active": true
}
```

4. `settings/access`는 없어도 앱 기본값이 `grade_admin_only`로 동작한다. 최고관리자 화면에서 정책을 처음 저장하면 문서가 생성된다.
5. 학년부 선생님 2명의 Firebase Auth 계정을 만든 뒤 각 UID에 `grade_admin` 역할을 넣는다.
6. 일반 선생님은 `teacher`, 담임은 `teacher` + `homeroom_teacher` 역할로 등록한다.
7. 학생 명부와 교시를 입력한 뒤 날짜별 담당교사를 배정한다.

## 운영 전 필수

개발 중에는 공개 회원가입 화면을 만들지 않는다. Auth 계정 생성은 Firebase Console 또는 향후 관리자 전용 서버 기능으로만 수행한다.
