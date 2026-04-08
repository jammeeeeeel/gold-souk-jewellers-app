import { createClient } from "@supabase/supabase-js";

/* ──────────────────────────────────────────────────────────────────
   Supabase project: jewel-souk-backend
   ────────────────────────────────────────────────────────────────── */
const SUPABASE_URL = "https://rugkqzhdpugjhmoauneh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-mIGhluB5Ic8hLrFm77N6w_M1HEOSUA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
