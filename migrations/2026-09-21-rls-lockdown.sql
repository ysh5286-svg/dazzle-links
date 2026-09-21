-- =============================================================================
-- dazzle-links: RLS lockdown (v2 — 2026-09-21 운영 메타데이터 확인 후 보완)
-- Date: 2026-09-21
--
-- 목표(선언): pages / links / group_links / socials 는 anon·authenticated 가 SELECT 만,
--            analytics 는 anon·authenticated 접근 불가. 서버(service_role) 는 그대로.
--
-- 적용 전 필수 조건
--   1. dazzle-links 배포(Vercel)에 SUPABASE_SERVICE_ROLE_KEY 가 설정되어 있고, src/lib/supabase-server.ts 를
--      쓰는 코드가 배포·동작(관리자 편집 저장 성공)하고 있어야 한다.
--      -> 그 전에 적용하면 anon 키로 동작하는 서버 쓰기(페이지/링크/그룹링크/소셜 저장, analytics 기록)가 전부 실패한다.
--   2. dazzle-links 는 별도 Supabase 프로젝트(oaax…)를 쓴다 — 다른 앱 테이블(users/deals 등)이 없음을 확인(2026-09-21).
--   3. 아래 "적용 전 백업" 의 3개 SELECT 를 실행해 결과를 저장한다. 롤백은 그 결과로 되돌리는 것이다.
--
-- 2026-09-21 운영 상태 (Codex, SELECT 만으로 확인 — 이 파일의 사전 점검이 이 상태를 전제로 검사한다)
--   - 5개 테이블 모두 RLS = true (relforcerowsecurity 는 미확인)
--   - relacl: postgres / anon / authenticated / service_role 각각 arwdDxtm (SELECT·INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER·MAINTAIN). PUBLIC grant 없음.
--   - 정책 10개:
--       pages, links, group_links, socials : "Anon write"  PERMISSIVE  TO public  FOR ALL     USING (true)   (with_check NULL)
--                                            "Public read" PERMISSIVE  TO public  FOR SELECT  USING (true)
--       analytics                          : "Anon read"   PERMISSIVE  TO public  FOR SELECT  USING (true)
--                                            "Public write" PERMISSIVE TO public  FOR INSERT  WITH CHECK (true)
--   - auth_throttle 없음. 추정 행수: analytics 8,870 / socials 45 / links 36 / pages 12 / group_links 미집계.
--
-- v1 과의 차이 (왜 보완했나)
--   - v1 은 INSERT/UPDATE/DELETE 만 회수해 TRUNCATE·REFERENCES·TRIGGER·MAINTAIN 이 anon 에 남고,
--     기존 "Anon write"/"Public write"/"Anon read" 정책도 그대로 남아 선언(SELECT-only / analytics 차단)과 달랐다.
--   - v2 는 (1) 정책 집합이 위 10개(또는 이미 적용된 결과)와 정확히 같을 때만 진행(다른 정책이 있으면 예외로 중단 — 임의 삭제 금지)
--            (2) anon·authenticated·PUBLIC 의 테이블 권한 전부 회수 → 렌더링 4개에 SELECT 만 재부여
--            (3) 기존 공개 쓰기·analytics 읽기/쓰기 정책 제거, 렌더링 4개에 읽기 정책 1개씩("public read <table>", TO anon, authenticated)
--            (4) service_role 권한은 건드리지 않음(RLS 우회 + 기존 grant 유지)
--            (5) 사후 점검: RLS 5개 true, anon/authenticated 에 SELECT 외 권한 0, analytics SELECT 0, 정책 정확히 4개
--   - 한 트랜잭션. lock_timeout 2s / statement_timeout 30s. 두 번 실행해도 결과 동일.
-- =============================================================================

-- =============================================================================
-- 적용 전 백업 — 반드시 아래 3개 SELECT 결과를 저장한 뒤 본문을 실행한다.
-- =============================================================================
-- (1) 현재 정책 목록
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('pages','links','group_links','socials','analytics') ORDER BY tablename, policyname;
-- (2) anon / authenticated 의 현재 테이블 권한
-- SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name IN ('pages','links','group_links','socials','analytics')
--    AND grantee IN ('anon','authenticated') ORDER BY table_name, grantee, privilege_type;
-- (3) 현재 RLS 활성 여부
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('pages','links','group_links','socials','analytics') AND relnamespace = 'public'::regnamespace ORDER BY relname;

begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

-- 0) 사전 점검 — 테이블·역할 존재, 정책 집합이 "확인된 운영 상태" 또는 "이미 적용된 상태" 와 정확히 같을 것
do $$
declare
  t text;
  v_actual text;
  v_before text := 'analytics:Anon read|analytics:Public write|group_links:Anon write|group_links:Public read|links:Anon write|links:Public read|pages:Anon write|pages:Public read|socials:Anon write|socials:Public read';
  v_after  text := 'group_links:public read group_links|links:public read links|pages:public read pages|socials:public read socials';
begin
  foreach t in array array['pages','links','group_links','socials','analytics'] loop
    if to_regclass('public.' || t) is null then raise exception 'precheck: public.% 테이블이 없습니다', t; end if;
  end loop;
  if not exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls) then
    raise exception 'precheck: service_role(BYPASSRLS) 역할이 없습니다';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'precheck: anon/authenticated 역할이 없습니다';
  end if;
  select coalesce(string_agg(tablename || ':' || policyname, '|' order by tablename, policyname), '') into v_actual
    from pg_policies where schemaname = 'public' and tablename in ('pages','links','group_links','socials','analytics');
  if v_actual <> v_before and v_actual <> v_after then
    raise exception 'precheck: 정책 집합이 확인된 상태와 다릅니다. 임의로 삭제하지 않고 중단합니다. 현재=[%]', v_actual;
  end if;
  raise notice 'precheck OK (state=%)', case when v_actual = v_before then 'before' else 'already-applied' end;
end $$;

-- 1) RLS 활성화 (이미 켜져 있어도 무해)
alter table public.pages        enable row level security;
alter table public.links        enable row level security;
alter table public.group_links  enable row level security;
alter table public.socials      enable row level security;
alter table public.analytics    enable row level security;

-- 2) 확인된 기존 공개 쓰기 정책 + analytics 읽기/쓰기 정책 제거 (0) 에서 집합을 검증했으므로 여기서 지우는 것은 확인된 것뿐)
drop policy if exists "Anon write"   on public.pages;
drop policy if exists "Anon write"   on public.links;
drop policy if exists "Anon write"   on public.group_links;
drop policy if exists "Anon write"   on public.socials;
drop policy if exists "Public read"  on public.pages;
drop policy if exists "Public read"  on public.links;
drop policy if exists "Public read"  on public.group_links;
drop policy if exists "Public read"  on public.socials;
drop policy if exists "Anon read"    on public.analytics;
drop policy if exists "Public write" on public.analytics;

-- 3) 공개 읽기 정책 (렌더링용 4개, 역할 명시)
drop policy if exists "public read pages"       on public.pages;
drop policy if exists "public read links"       on public.links;
drop policy if exists "public read group_links" on public.group_links;
drop policy if exists "public read socials"     on public.socials;
create policy "public read pages"       on public.pages       for select to anon, authenticated using (true);
create policy "public read links"       on public.links       for select to anon, authenticated using (true);
create policy "public read group_links" on public.group_links for select to anon, authenticated using (true);
create policy "public read socials"     on public.socials     for select to anon, authenticated using (true);
-- analytics: anon / authenticated 용 정책 없음 (모든 읽기/쓰기는 서버의 service_role 경유)

-- 4) 테이블 권한: anon·authenticated·PUBLIC 의 권한 전부 회수(TRUNCATE·REFERENCES·TRIGGER·MAINTAIN 포함) → 렌더링 4개 SELECT 만 재부여
--    service_role / postgres 권한은 건드리지 않는다.
revoke all privileges on public.pages, public.links, public.group_links, public.socials, public.analytics from public, anon, authenticated;
grant select on public.pages, public.links, public.group_links, public.socials to anon, authenticated;

-- 5) 사후 점검 — 선언한 상태가 정확히 만들어졌는지. 아니면 예외 → 전체 롤백
do $$
declare t text; r text; p text;
begin
  foreach t in array array['pages','links','group_links','socials','analytics'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'postcheck: % RLS 꺼짐', t; end if;
    foreach r in array array['anon','authenticated'] loop
      foreach p in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        if has_table_privilege(r, 'public.' || t, p) then raise exception 'postcheck: % 에 % % 권한 잔존', r, t, p; end if;
      end loop;
      if t = 'analytics' and has_table_privilege(r, 'public.analytics', 'SELECT') then raise exception 'postcheck: % 이 analytics 를 읽을 수 있음', r; end if;
      if t <> 'analytics' and not has_table_privilege(r, 'public.' || t, 'SELECT') then raise exception 'postcheck: % 에 % SELECT 없음', r, t; end if;
    end loop;
  end loop;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('pages','links','group_links','socials','analytics')) <> 4
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'analytics') <> 0 then
    raise exception 'postcheck: 정책이 렌더링 4개 읽기 정책만이어야 합니다';
  end if;
  if not has_table_privilege('service_role', 'public.analytics', 'INSERT') then raise exception 'postcheck: service_role INSERT 권한이 사라짐'; end if;
  raise notice 'postcheck OK';
end $$;

commit;

-- =============================================================================
-- ROLLBACK — 2026-09-21 백업(위 "운영 상태")으로 정확히 되돌린다. 이전 코드(anon 쓰기)를 재배포하는 것과는 별개다.
-- 백업이 위와 다르면 이 블록을 쓰지 말고 저장한 백업 결과로 정책/권한을 한 줄씩 복원할 것.
-- 실행 전 확인: 현재 정책이 "public read <table>" 4개뿐이어야 한다(아니면 예외로 중단).
-- =============================================================================
-- begin;
-- set local lock_timeout = '2s';
-- set local statement_timeout = '30s';
-- do $$ declare v text; begin
--   select coalesce(string_agg(tablename || ':' || policyname, '|' order by tablename, policyname), '') into v
--     from pg_policies where schemaname = 'public' and tablename in ('pages','links','group_links','socials','analytics');
--   if v <> 'group_links:public read group_links|links:public read links|pages:public read pages|socials:public read socials' then
--     raise exception 'rollback: 현재 정책이 v2 적용 결과와 다릅니다. 중단. 현재=[%]', v;
--   end if;
-- end $$;
-- drop policy if exists "public read pages"       on public.pages;
-- drop policy if exists "public read links"       on public.links;
-- drop policy if exists "public read group_links" on public.group_links;
-- drop policy if exists "public read socials"     on public.socials;
-- create policy "Anon write"   on public.pages       as permissive for all    to public using (true);
-- create policy "Public read"  on public.pages       as permissive for select to public using (true);
-- create policy "Anon write"   on public.links       as permissive for all    to public using (true);
-- create policy "Public read"  on public.links       as permissive for select to public using (true);
-- create policy "Anon write"   on public.group_links as permissive for all    to public using (true);
-- create policy "Public read"  on public.group_links as permissive for select to public using (true);
-- create policy "Anon write"   on public.socials     as permissive for all    to public using (true);
-- create policy "Public read"  on public.socials     as permissive for select to public using (true);
-- create policy "Anon read"    on public.analytics   as permissive for select to public using (true);
-- create policy "Public write" on public.analytics   as permissive for insert to public with check (true);
-- grant all privileges on public.pages, public.links, public.group_links, public.socials, public.analytics to anon, authenticated;
-- -- RLS 는 백업에서도 true 였으므로 그대로 둔다.
-- commit;
