import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트.
// - 라우트 핸들러 / 서버 컴포넌트에서만 사용한다 ("server-only" 로 클라이언트 번들 유입 차단).
// - SUPABASE_SERVICE_ROLE_KEY 가 있으면 service role 로 동작 (RLS 우회).
// - 없으면 anon 키로 폴백 — RLS 를 켜기 전(migrations/2026-09-21-rls-lockdown.sql)에는
//   기존과 동일하게 동작하지만, RLS 를 켠 뒤에는 서버 쓰기가 실패하므로 반드시 설정할 것.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!serviceRoleKey) {
  // 모듈 로드 시 1회만 출력
  console.warn(
    "[supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. " +
      "Set it before applying the RLS lockdown migration or server-side writes will fail."
  );
}

export const supabaseServer: SupabaseClient = supabaseUrl
  ? createClient(supabaseUrl, serviceRoleKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : (null as unknown as SupabaseClient);
