import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient);

// Types
export type PageRow = {
  id: string;
  slug: string;
  title: string;
  desc: string;
  profile: string;
  created_at: string;
  bg_color: string;
  hover_color: string;
  btn_color: string;
  btn_shape: string;
  btn_action: string;
  font: string;
  category: string;
  sort_order: number;
  badge_color: string | null;
};

export type LinkRow = {
  id: string;
  page_id: string;
  label: string;
  url: string;
  thumbnail: string | null;
  sort_order: number;
  layout: string;
  enabled: boolean;
};

export type SocialRow = {
  id: string;
  page_id: string;
  platform: string;
  url: string;
  sort_order: number;
};
