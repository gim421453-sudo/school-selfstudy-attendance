export const SCREEN_CANDIDATES = [
  { file: "01-dashboard.png", title: "자습 출결 대시보드", route: "/", category: "주요 UI", reason: "대시보드 변경 또는 공통 탐색 변경을 보여 줍니다.", relatedChanges: ["src/pages/DashboardPage.tsx", "src/components/Layout.tsx", "src/App.tsx", "src/navigation.ts"], viewport: "1440x900" },
  { file: "02-attendance-list.png", title: "자습 출결 화면", route: "/self-study-attendance", category: "출결 관리", reason: "자습 출결 입력 화면의 변경을 보여 줍니다.", relatedChanges: ["src/pages/SelfStudyAttendancePage.tsx", "src/services/selfStudyAttendance.ts"], viewport: "1440x900" },
  { file: "03-supervisor-calendar.png", title: "감독교사 배정 캘린더", route: "/supervision", category: "감독교사 배정", reason: "감독교사 배정과 월간 캘린더 변경을 보여 줍니다.", relatedChanges: ["src/pages/SupervisionPage.tsx", "src/domain/supervisionCalendar.ts", "src/domain/supervisionUi.ts", "src/services/selfStudyOperations.ts"], viewport: "1440x900" },
  { file: "04-my-supervision.png", title: "내 감독교사 일정", route: "/my-supervision", category: "감독교사 일정", reason: "교사별 감독 일정 조회 변경을 보여 줍니다.", relatedChanges: ["src/pages/MySupervisionPage.tsx"], viewport: "1440x900" },
  { file: "05-statistics-filter.png", title: "자습 출결 통계 필터", route: "/self-study-statistics", category: "출결 통계", reason: "기간·범위 필터와 통계 집계 변경을 보여 줍니다.", relatedChanges: ["src/pages/SelfStudyStatisticsPage.tsx", "src/domain/selfStudyStatistics.ts", "src/domain/statisticsPresentation.ts", "src/services/selfStudyReporting.ts"], viewport: "1440x900" },
  { file: "06-staff-assignment.png", title: "교직원 학년 배정 관리", route: "/admin/staff", category: "권한 및 배정", reason: "교직원과 학년 배정 관리 변경을 보여 줍니다.", relatedChanges: ["src/pages/StaffAssignmentAdminPage.tsx", "src/services/staffAssignments.ts", "src/scope/ScopeProvider.tsx"], viewport: "1440x900" },
  { file: "07-mobile-sidebar.png", title: "모바일 사이드바", route: "/", category: "반응형 UI", reason: "작은 화면의 탐색 메뉴 변경을 보여 줍니다.", relatedChanges: ["src/components/Layout.tsx", "src/styles.css", "src/navigation.ts"], viewport: "390x844", prepare: "open-mobile-menu" },
];

export function parseCaptureMode(args) {
  const modeIndex = args.indexOf("--mode");
  const mode = modeIndex === -1 ? "changed" : args[modeIndex + 1];
  if (mode !== "changed" && mode !== "full") throw new Error("--mode must be changed or full");
  return mode;
}

export function isSafeLocalCaptureUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function selectScreens(mode, changedFiles) {
  if (mode === "full") return SCREEN_CANDIDATES;
  const changed = new Set(changedFiles);
  return SCREEN_CANDIDATES.filter((candidate) => candidate.relatedChanges.some((file) => changed.has(file)));
}

export function detectSensitiveContent(text) {
  const sanitized = text.replace(/[A-Z0-9._%+-]+@example\.test/gi, "synthetic-test-account");
  const patterns = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+82[- ]?)?0?1[0-9][ -]?\d{3,4}[ -]?\d{4}/,
    /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|cookie|session)\b/i,
    /(?:https?:\/\/)?(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/,
  ];
  return patterns.some((pattern) => pattern.test(sanitized));
}

export function koreanDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function manifestEntry(candidate, createdAt, extra = {}) {
  return {
    file: candidate.file,
    title: candidate.title,
    route: candidate.route,
    category: candidate.category,
    reason: candidate.reason,
    viewport: candidate.viewport,
    createdAt,
    relatedChanges: candidate.relatedChanges,
    publishCandidate: true,
    requiresRedaction: false,
    notes: "테스트 전용 로컬 환경에서 캡처해야 합니다.",
    ...extra,
  };
}
