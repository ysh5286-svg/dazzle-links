// 페이지 디자인 값의 허용 집합.
// 렌더러(src/app/[slug]/page.tsx)와 API 검증(src/app/api/pages/[slug]/route.ts)이
// 같은 집합을 공유해서, DB 에 저장된 값이 <style> 로 그대로 흘러들어가지 않게 한다.

export const FONT_MAP: Record<string, string> = {
  pretendard: "'Pretendard', -apple-system, sans-serif",
  "noto-sans": "'Noto Sans KR', sans-serif",
  gothic: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  "nanum-gothic": "'Nanum Gothic', sans-serif",
  "nanum-square": "'NanumSquare', sans-serif",
  gmarket: "'GmarketSans', sans-serif",
};

export const SHAPE_MAP: Record<string, string> = {
  rounded: "16px",
  pill: "9999px",
  square: "4px",
};

export const BTN_ACTIONS = ["fill", "wave", "shadow", "none"] as const;

export const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_COLOR_RE.test(v);
}

export function isFontKey(v: unknown): v is string {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FONT_MAP, v);
}

export function isShapeKey(v: unknown): v is string {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SHAPE_MAP, v);
}

export function isBtnAction(v: unknown): v is string {
  return typeof v === "string" && (BTN_ACTIONS as readonly string[]).includes(v);
}
