export type UiThemeId = "V2" | "V3" | "V4" | "V5";

export type UiTheme = {
  id: UiThemeId;
  name: string;
  description: string;
};

export const UI_THEMES: UiTheme[] = [
  { id: "V2", name: "라이트 관리형", description: "밝고 단정한 학교 행정 스타일" },
  { id: "V3", name: "다크 운영센터형", description: "진한 네이비 기반의 운영 중심 스타일" },
  { id: "V4", name: "라이트 프리미엄", description: "밝고 여백이 넓은 프리미엄 스타일" },
  { id: "V5", name: "다크 시네마틱", description: "학교 배경과 글래스 효과를 활용한 스타일" },
];
