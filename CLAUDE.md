# CLAUDE.md — school-selfstudy-attendance (출결)

이 파일은 Claude Code 가 세션마다 읽는 프로젝트 지침이다. 사용자는 한국어로 대화한다. 답변과 문서는 한국어로 쓴다.

@AGENTS.md

## 프로젝트

- **목적**: 학교 프로젝트용으로 **재작성**하는 출결(자습 감독) 시스템. 학년부와 감독이 모두 사용한다. 학년부는 학생·교사를 관리하고, 감독은 지정된 날짜에 감독 권한을 갖고, 감독이 아닌 교사는 출석 체크만 할 수 있다.
- **스택**: Vite 7 + React 19 + TypeScript 5.9 + Firebase 12 (Auth/Firestore). 기준은 `package.json`.

## 작업 시작 전 (매 세션)

1. `AGENTS.md` 가 있으면 먼저 읽고 따른다 (위 import 로 이미 불러와진다). 없으면 만들지 않는다.
2. `docs/handoff/CURRENT_HANDOFF.md` 는 **맨 위(최신) 섹션만** 읽는다. 파일이 길고 아래는 과거 기록일 수 있다.
3. `git status -sb` 와 `git log -5 --oneline` 으로 **실제 상태**를 확인한다. 핸드오프와 다르면 실제 상태를 기준으로 하고 사용자에게 알린다.
4. 다른 프로젝트와의 관계나 전체 맥락이 필요하면 `../PROJECTS.md` 에서 이 프로젝트 섹션만 읽는다. 전체를 읽지 않는다.

## 검증 명령 (`package.json` scripts 기준)

- `npm run build` — `tsc -b && vite build`
- `npm test` — `vitest run`
- `npm run test:rules` — Firestore Rules 테스트. **Firebase Emulator** 로 돈다 (Java 필요, 운영 프로젝트에 닿지 않음)
- `npm run verify` — build → test → test:rules → `npm audit` 순서로 전부 실행 (`npm audit` 은 네트워크 필요)

실제로 실행해서 결과를 확인하기 전에는 통과라고 보고하지 않는다. 명령이 바뀌었으면 위 목록과 `AGENTS.md` 를 함께 고친다.

## 이 프로젝트 주의사항

- 재작성이므로 기존 코드의 재사용 범위를 정하기 전에 현황 조사 결과를 사용자에게 보고한다.
- 역할/권한 모델을 먼저 설계한다: 학년부(학생·교사 관리) / 감독(지정일에만) / 일반 교사(체크만). 학생 개인정보를 다루므로 권한은 기본 거부(fail-closed)로 설계한다.
- 요금제/권한 구조는 chat-service, My Web 과 공통 모델이 될 수 있다.

## 공통 규칙

- 루트 `OWNER` 파일 = `Claude`. 파일 수정은 Claude 가 하고, Codex 는 읽기만 한다.
- 작업은 **이 저장소 폴더 안에서만** 한다. 다른 프로젝트 폴더는 읽지도 수정하지도 않는다.
- `git add` / `commit` / `push` / `pull` / `reset` / `clean` / `stash` 는 **사용자가 명시적으로 요청할 때만** 한다.
- `docs/recovery/` 는 사용자 자료이므로 건드리지 않는다.
- Windows 보안 설정(Smart App Control, Defender, WDAC)은 변경하거나 우회하지 않는다.
- 운영(production) 서비스·데이터에 쓰기·배포하지 않는다. 검증은 `demo-*` 프로젝트와 Emulator로 한다.
- 비밀값(키, 토큰, `.env`)은 읽어도 문서·로그·채팅에 출력하지 않는다.
- 검증하지 않은 것은 통과라고 쓰지 않고 `NOT VERIFIED` / `NOT RUN` 으로 남긴다. 테스트를 약화시켜서 통과시키지 않는다.
- 의존성 설치·삭제, `npm audit fix --force` 같은 큰 변경은 먼저 사용자에게 묻는다.
- 큰 수정은 먼저 계획을 보여주고 승인받은 뒤 진행한다.

## 문서 갱신 규칙

- 의미 있는 작업을 끝내면 `docs/handoff/CURRENT_HANDOFF.md` 를 **기존 형식 그대로** 갱신한다. 새 내용은 맨 위 최신 섹션에 쓰고, 해결된 과거 내용은 정리한다.
- **AGENTS.md 동기화 (사용자가 중단 지시하기 전까지 유지)**: 명령어, 폴더 구조, 규칙, 주의사항 같은 프로젝트 사실이 바뀌면 같은 변경을 `AGENTS.md` 에도 반영한다. 기존 내용과 형식은 보존하고 필요한 부분만 최소 수정한다. Codex 전용 문구는 임의로 지우지 않는다. `AGENTS.md` 가 없으면 만들지 말고 사용자에게 묻는다.
- `CHANGELOG.md` 가 있으면 사용자에게 보이는 변경만 기록한다. `DEVLOG_AUTO_UPDATE=false` 이면 개발일지를 만들지 않는다.
