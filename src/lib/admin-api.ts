/**
 * 관리자 화면 공용 API 호출 — 실패를 "조용히" 넘기지 않기 위한 얇은 래퍼 (감사 12번).
 *
 *  - HTTP 오류(4xx/5xx)와 통신 오류(fetch 예외)를 모두 { ok: false, error } 로 돌려준다. 절대 throw 하지 않는다.
 *  - 서버가 { error } JSON 을 주면 그 문구를, 아니면 상태 코드 기반 기본 문구를 쓴다.
 *  - 호출부는 ok 를 확인한 뒤에만 화면 상태를 확정/이동하고, 실패면 이전 값으로 되돌리거나 서버 상태로 다시 맞춘다.
 */
export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export const NETWORK_ERROR = '서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.';

export function describeHttpError(status: number, body: unknown): string {
  const msg = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
    ? (body as { error: string }).error
    : '';
  if (msg) return msg;
  if (status === 401) return '로그인이 만료됐습니다. 다시 로그인해주세요.';
  if (status === 403) return '권한이 없습니다.';
  if (status === 404) return '대상을 찾을 수 없습니다.';
  if (status >= 500) return `서버 오류(${status})로 저장하지 못했습니다.`;
  return `요청이 거부됐습니다 (${status}).`;
}

export async function apiRequest<T = unknown>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) return { ok: false, status: res.status, error: describeHttpError(res.status, body) };
  return { ok: true, status: res.status, data: body as T };
}

export function apiJson<T = unknown>(input: string, method: 'POST' | 'PUT' | 'DELETE' | 'PATCH', payload?: unknown): Promise<ApiResult<T>> {
  return apiRequest<T>(input, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
