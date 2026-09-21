-- =============================================================================
-- dazzle-links: 로그인 시도 제한 테이블 (auth_throttle) + 원자적 실패 기록 RPC (auth_throttle_fail)
-- Date: 2026-09-21
--
-- 용도
--   /api/auth 의 DB 기반 무차별 대입 방어 (src/lib/auth-throttle.ts).
--   key = 'links-login:ip:<ip>' | 'links-login:id:<login_id>'
--   10회 실패 / 15분 → 15분 잠금.
--
-- 접근 제어
--   - RLS 활성화, anon / authenticated 용 정책 없음 → service_role(서버) 만 읽기/쓰기 가능.
--   - 명시적 REVOKE 로 2중 방어.
--   - auth_throttle_fail 함수도 service_role 만 EXECUTE 가능.
--
-- 적용 순서
--   2026-09-21-rls-lockdown.sql 과 독립적 (순서 무관). 단, 서버가 SUPABASE_SERVICE_ROLE_KEY 로
--   동작하고 있어야 한다 — anon 키로는 이 테이블/함수에 접근할 수 없고, 그 경우 throttle 은
--   fail-closed 로 동작해 /api/auth 가 503 을 반환한다 (로그인 불가).
--   ⚠ 이 마이그레이션(테이블 + 함수) 을 적용하기 전에 새 코드를 배포해도 같은 이유로 503 이 난다.
--      순서: 서비스 키 설정 → 이 마이그레이션 적용 → 코드 배포.
-- =============================================================================

begin;

create table if not exists public.auth_throttle (
  key          text primary key,
  fail_count   int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.auth_throttle enable row level security;

-- anon / authenticated 정책 없음 (service_role 전용)
revoke all on public.auth_throttle from anon, authenticated;

-- -----------------------------------------------------------------------------
-- auth_throttle_fail — 실패 1회를 단일 원자 UPSERT 로 기록.
--   select → 계산 → upsert 3단계는 동시 실패 요청이 서로의 증가분을 덮어쓴다.
--   INSERT ... ON CONFLICT DO UPDATE 는 충돌 행에 행 잠금이 걸려 동시 호출이 직렬화된다.
--   p_key       : throttle 키
--   p_threshold : 창(window) 안 누적 실패가 이 값 이상이면 잠금
--   p_window_sec: 마지막 실패(updated_at) 로부터 이 시간이 지나면 카운터를 1 로 리셋
--   p_lock_sec  : 잠금 지속 시간
--   반환        : 갱신 후 (fail_count, locked_until). 이미 잠긴 키는 그대로 유지한 채 반환.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_throttle_fail(p_key text, p_threshold int, p_window_sec int, p_lock_sec int)
RETURNS TABLE(fail_count int, locked_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz := now();
BEGIN
  RETURN QUERY
  INSERT INTO public.auth_throttle AS t (key, fail_count, locked_until, updated_at)
  VALUES (p_key, 1, CASE WHEN p_threshold <= 1 THEN v_now + make_interval(secs => p_lock_sec) END, v_now)
  ON CONFLICT (key) DO UPDATE SET
    fail_count = CASE
      WHEN t.locked_until IS NOT NULL AND t.locked_until > v_now THEN t.fail_count            -- already locked: keep
      WHEN v_now - t.updated_at > make_interval(secs => p_window_sec) THEN 1                   -- window expired: reset
      ELSE t.fail_count + 1 END,
    locked_until = CASE
      WHEN t.locked_until IS NOT NULL AND t.locked_until > v_now THEN t.locked_until
      WHEN (CASE WHEN v_now - t.updated_at > make_interval(secs => p_window_sec) THEN 1 ELSE t.fail_count + 1 END) >= p_threshold
        THEN v_now + make_interval(secs => p_lock_sec)
      ELSE NULL END,
    updated_at = v_now
  RETURNING t.fail_count, t.locked_until;
END $$;

REVOKE ALL ON FUNCTION public.auth_throttle_fail(text, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_throttle_fail(text, int, int, int) TO service_role;

commit;

-- =============================================================================
-- ROLLBACK (문제 발생 시 아래 블록을 실행)
--   함수/테이블을 지우면 새 코드의 /api/auth 는 503 을 반환하므로, 코드도 이전 버전으로 함께 되돌릴 것.
-- =============================================================================
-- begin;
-- drop function if exists public.auth_throttle_fail(text, int, int, int);
-- drop table if exists public.auth_throttle;
-- commit;
