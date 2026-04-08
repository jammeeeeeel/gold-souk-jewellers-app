/**
 * supabase.ts
 *
 * Singleton Supabase client for the Gold Souk app.
 * Used to persist admin settings to the cloud so they
 * sync across all devices instantly.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://svheoxdadadjgtorxejx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aGVveGRhZGFkamd0b3J4ZWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDM1ODAsImV4cCI6MjA5MTIxOTU4MH0.Xc1qbkGrYKEHu5chPxSF1rztBHzvAEKqYOAgQz9_KD8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
