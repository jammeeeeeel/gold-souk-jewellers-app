-- ============================================================
-- Jewel Souk Backend — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 0. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────
-- Admin Credentials Table (server-side auth)
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_credentials (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert admin user (username: jewelsouk, password: jewelsouk@tsr)
INSERT INTO admin_credentials (username, password_hash)
VALUES ('jewelsouk', crypt('jewelsouk@tsr', gen_salt('bf')))
ON CONFLICT (username) DO UPDATE SET password_hash = crypt('jewelsouk@tsr', gen_salt('bf'));

-- RLS: No direct read/write from client (only via RPC)
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
-- Deny all direct access — force use of RPC
CREATE POLICY "No direct access" ON admin_credentials
    FOR ALL USING (false) WITH CHECK (false);

-- RPC function: verify_admin_login(username, password) → boolean
-- Runs with SECURITY DEFINER so it can read admin_credentials despite RLS
CREATE OR REPLACE FUNCTION verify_admin_login(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_credentials
        WHERE username = p_username
        AND password_hash = crypt(p_password, password_hash)
    );
END;
$$;

-- 1. Create the admin_settings table (single-row config pattern)
CREATE TABLE IF NOT EXISTS admin_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the default row
INSERT INTO admin_settings (id, settings, updated_at)
VALUES (
    'main',
    '{
        "goldPremiums": {},
        "silverPremiums": {},
        "globalGoldPremium": 0,
        "globalSilverPremium": 0,
        "goldBuyingAdjustments": {},
        "silverBuyingAdjustments": {},
        "b2bGoldPremiums": {},
        "b2bSilverPremiums": {},
        "b2bGlobalGoldPremium": 0,
        "b2bGlobalSilverPremium": 0,
        "disabledGoldCoins": [],
        "disabledSilverCoins": []
    }'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Anyone can READ settings (public rates display)
CREATE POLICY "Public read access"
ON admin_settings
FOR SELECT
USING (true);

-- 5. RLS Policy: Anyone can UPDATE/INSERT settings
--    (In production you'd restrict to authenticated admins,
--     but since auth is handled in-app, we allow all for now)
CREATE POLICY "Allow all writes"
ON admin_settings
FOR ALL
USING (true)
WITH CHECK (true);
