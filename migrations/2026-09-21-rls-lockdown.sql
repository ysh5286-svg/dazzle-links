-- =============================================================================
-- dazzle-links: RLS lockdown
-- Date: 2026-09-21
--
-- 적용 전 필수 조건
--   1. dazzle-links 배포(Vercel 등)에 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되어 있고,
--      src/lib/supabase-server.ts 를 사용하는 코드가 배포되어 있어야 한다.
--      -> 그 전에 적용하면 anon 키로 동작하는 서버 쓰기(페이지/링크/그룹링크/소셜 저장,
--         analytics 기록)가 전부 실패한다.
--   2. 가정(확인 필요): dazzle-links 는 다른 앱(dazzle-sales, dazzle-schedule 등)과
--      "별도의" Supabase 프로젝트를 사용한다 (NEXT_PUBLIC_SUPABASE_URL 이 다름).
--      같은 프로젝트를 공유한다면, 아래 테이블을 다른 앱이 anon 키로 쓰고 있지 않은지
--      먼저 확인할 것.
--   3. 아래 "적용 전 백업" 블록을 먼저 실행해 결과를 저장해 둘 것 (롤백의 유일한 근거).
--
-- 효과
--   - pages / links / group_links / socials : anon, authenticated 는 SELECT 만 가능
--   - analytics                             : anon, authenticated 는 접근 불가 (정책 없음 + REVOKE)
--   - service_role 은 RLS 를 우회하므로 서버(supabase-server.ts)의 읽기/쓰기는 그대로 동작
-- =============================================================================

-- =============================================================================
-- 적용 전 백업 — 반드시 아래 3개 SELECT 결과를 저장한 뒤 본문을 실행한다.
--   롤백은 "이 백업이 보여준 상태로 되돌리는 것"이지, RLS 를 끄고 anon 에 쓰기를 여는 것이 아니다.
-- =============================================================================
-- (1) 현재 정책 목록
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('pages', 'links', 'group_links', 'socials', 'analytics')
--  ORDER BY tablename, policyname;
--
-- (2) anon / authenticated 의 현재 테이블 권한
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('pages', 'links', 'group_links', 'socials', 'analytics')
--    AND grantee IN ('anon', 'authenticated')
--  ORDER BY table_name, grantee, privilege_type;
--
-- (3) 현재 RLS 활성 여부
-- SELECT relname, relrowsecurity
--   FROM pg_class
--  WHERE relname IN ('pages', 'links', 'group_links', 'socials', 'analytics')
--    AND relnamespace = 'public'::regnamespace
--  ORDER BY relname;

begin;

-- 1) RLS 활성화
alter table public.pages        enable row level security;
alter table public.links        enable row level security;
alter table public.group_links  enable row level security;
alter table public.socials      enable row level security;
alter table public.analytics    enable row level security;

-- 2) 공개 읽기 정책 (렌더링용 테이블)
drop policy if exists "public read pages"       on public.pages;
drop policy if exists "public read links"       on public.links;
drop policy if exists "public read group_links" on public.group_links;
drop policy if exists "public read socials"     on public.socials;

create policy "public read pages"       on public.pages       for select to anon, authenticated using (true);
create policy "public read links"       on public.links       for select to anon, authenticated using (true);
create policy "public read group_links" on public.group_links for select to anon, authenticated using (true);
create policy "public read socials"     on public.socials     for select to anon, authenticated using (true);

-- analytics: anon / authenticated 용 정책을 만들지 않는다 (모든 읽기/쓰기는 서버의 service_role 경유).

-- 3) 명시적 권한 회수 (RLS 와 별개의 2중 방어)
revoke insert, update, delete
  on public.pages, public.links, public.group_links, public.socials, public.analytics
  from anon, authenticated;
revoke select on public.analytics from anon, authenticated;

commit;

-- =============================================================================
-- ROLLBACK
--
-- 원칙
--   * 애플리케이션 레벨의 안전한 롤백 = "anon 키로 동작하던 이전 코드를 재배포" 하는 것이 아니라,
--     service_role 키를 쓰는 현재 코드를 유지한 채 이 마이그레이션이 바꾼 DB 상태만 백업대로 되돌리는 것이다.
--     이전 코드(anon 키 서버 쓰기)를 재배포하는 것은 "DB 를 백업 상태로 되돌린 뒤"에만 의미가 있으며,
--     그 경우에도 anon 쓰기를 여는 것은 백업이 그 상태였음을 증명할 때에 한한다.
--   * 아래 템플릿은 "적용 전 백업" 결과를 그대로 재현하기 위한 자리표시자다.
--     백업에 없던 정책·권한을 임의로 추가하지 말 것.
-- =============================================================================
--
-- (A) 이 마이그레이션이 만든 정책 제거
-- begin;
-- drop policy if exists "public read pages"       on public.pages;
-- drop policy if exists "public read links"       on public.links;
-- drop policy if exists "public read group_links" on public.group_links;
-- drop policy if exists "public read socials"     on public.socials;
--
-- (B) 백업 (1) 에 있던 정책을 그대로 복원 — 백업 행마다 1개씩 작성
-- create policy "<policyname>" on public.<tablename>
--   as <permissive|restrictive>
--   for <cmd>                      -- select | insert | update | delete | all
--   to <roles>                     -- 예: anon, authenticated
--   using (<qual>)                 -- 백업의 qual 이 NULL 이면 이 줄 생략
--   with check (<with_check>);     -- 백업의 with_check 이 NULL 이면 이 줄 생략
--
-- (C) 백업 (2) 에 있던 권한만 다시 부여 — 백업 행마다 1개씩 작성 (백업에 없던 권한은 부여하지 않는다)
-- grant <privilege_type> on public.<table_name> to <grantee>;
--
-- (D) 백업 (3) 에서 relrowsecurity = false 였던 테이블만 RLS 해제
-- alter table public.<relname> disable row level security;
-- commit;
--
-- -----------------------------------------------------------------------------
-- (E) 비상용 — "이전 상태가 RLS 비활성 · anon/authenticated 전체 쓰기였음이 백업으로 확인된 경우에만"
--     (백업 (3) 의 5개 테이블 relrowsecurity 가 전부 false 이고, 백업 (2) 에 5개 테이블 × anon/authenticated 의
--      SELECT/INSERT/UPDATE/DELETE 가 전부 있었을 때). 그 외에는 절대 실행하지 말 것 — 공개 쓰기가 열린다.
-- -----------------------------------------------------------------------------
-- begin;
-- drop policy if exists "public read pages"       on public.pages;
-- drop policy if exists "public read links"       on public.links;
-- drop policy if exists "public read group_links" on public.group_links;
-- drop policy if exists "public read socials"     on public.socials;
-- alter table public.pages        disable row level security;
-- alter table public.links        disable row level security;
-- alter table public.group_links  disable row level security;
-- alter table public.socials      disable row level security;
-- alter table public.analytics    disable row level security;
-- grant select, insert, update, delete
--   on public.pages, public.links, public.group_links, public.socials, public.analytics
--   to anon, authenticated;
-- commit;
