import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";

/* ──── Keys ──── */
const SETTINGS_TABLE = "admin_settings";   // Supabase table name
const SETTINGS_ROW_ID = "main";            // Single-row config pattern
const LOCAL_CACHE_KEY = "admin_premiums";   // local fallback cache
const AUTH_KEY = "admin_logged_in";

/* ──── Types ──── */
export type CoinPremiums = Record<string, number>; // coinId → premium amount (₹)

export type AdminSettings = {
    goldPremiums: CoinPremiums;
    silverPremiums: CoinPremiums;
    globalGoldPremium: number;
    globalSilverPremium: number;
    goldPriceOffsets: CoinPremiums;
    silverPriceOffsets: CoinPremiums;
    b2bGoldPremiums: CoinPremiums;
    b2bSilverPremiums: CoinPremiums;
    b2bGlobalGoldPremium: number;
    b2bGlobalSilverPremium: number;
    disabledGoldCoins: string[];
    disabledSilverCoins: string[];
    coinNameOverrides: Record<string, string>;
};

const DEFAULT_SETTINGS: AdminSettings = {
    goldPremiums: {},
    silverPremiums: {},
    globalGoldPremium: 0,
    globalSilverPremium: 0,
    goldPriceOffsets: {},
    silverPriceOffsets: {},
    b2bGoldPremiums: {},
    b2bSilverPremiums: {},
    b2bGlobalGoldPremium: 0,
    b2bGlobalSilverPremium: 0,
    disabledGoldCoins: [],
    disabledSilverCoins: [],
    coinNameOverrides: {},
};

/* ──── Auth (server-side verification via Supabase RPC) ──── */
export async function checkAdminAuth(): Promise<boolean> {
    const val = await AsyncStorage.getItem(AUTH_KEY);
    return val === "true";
}

export async function loginAdmin(username: string, password: string): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc("verify_admin_login", {
            p_username: username,
            p_password: password,
        });
        console.log("Login RPC response:", { data, error, dataType: typeof data });
        if (error) {
            console.log("Login RPC error:", error.message, error.details, error.hint);
            // Fallback: if RPC doesn't exist yet, check locally
            if (error.message?.includes("could not find") || error.code === "PGRST202") {
                console.log("RPC not found — using local fallback");
                if (username === "jewelsouk" && password === "jewelsouk@tsr") {
                    await AsyncStorage.setItem(AUTH_KEY, "true");
                    return true;
                }
            }
            return false;
        }
        if (data === true) {
            await AsyncStorage.setItem(AUTH_KEY, "true");
            return true;
        }
        return false;
    } catch (e) {
        console.log("Login error:", e);
        return false;
    }
}

export async function logoutAdmin(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_KEY);
}

/* ──── Settings — Supabase-first, AsyncStorage fallback ──── */

/**
 * Load settings from Supabase. Falls back to local cache if offline.
 * Public-facing screens call this every few seconds to pick up
 * admin changes in real-time.
 */
export async function loadSettings(): Promise<AdminSettings> {
    try {
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select("settings")
            .eq("id", SETTINGS_ROW_ID)
            .single();

        if (!error && data?.settings) {
            const merged = { ...DEFAULT_SETTINGS, ...data.settings };
            // Cache locally for offline fallback
            AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(merged)).catch(() => { });
            return merged;
        }
    } catch (e) {
        console.log("Supabase load error (falling back to local):", e);
    }

    // Fallback: try local cache
    try {
        const raw = await AsyncStorage.getItem(LOCAL_CACHE_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        console.log("Local cache load error:", e);
    }

    return DEFAULT_SETTINGS;
}

/**
 * Save settings to Supabase (upsert) and local cache.
 * Only the admin portal calls this.
 */
export async function saveSettings(settings: AdminSettings): Promise<void> {
    try {
        // Upsert to Supabase
        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert(
                { id: SETTINGS_ROW_ID, settings, updated_at: new Date().toISOString() },
                { onConflict: "id" }
            );

        if (error) {
            console.log("Supabase save error:", error.message);
        }
    } catch (e) {
        console.log("Supabase save error:", e);
    }

    // Always save locally too
    try {
        await AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.log("Local cache save error:", e);
    }
}

/* ──── Helper: get premium for a specific coin ──── */
export function getCoinPremium(
    settings: AdminSettings,
    coinId: string,
    type: "gold" | "silver"
): number {
    const perCoin = type === "gold"
        ? settings.goldPremiums[coinId] || 0
        : settings.silverPremiums[coinId] || 0;
    const global = type === "gold"
        ? settings.globalGoldPremium
        : settings.globalSilverPremium;
    return perCoin + global;
}

/* ──── Helper: get B2B premium for a specific coin ──── */
export function getB2bCoinPremium(
    settings: AdminSettings,
    coinId: string,
    type: "gold" | "silver"
): number {
    const perCoin = type === "gold"
        ? (settings.b2bGoldPremiums?.[coinId] || 0)
        : (settings.b2bSilverPremiums?.[coinId] || 0);
    const global = type === "gold"
        ? (settings.b2bGlobalGoldPremium || 0)
        : (settings.b2bGlobalSilverPremium || 0);
    return perCoin + global;
}

/* ──── Helper: get price offset for a specific coin (0 = no offset) ──── */
export function getCoinPriceOffset(
    settings: AdminSettings,
    coinId: string,
    type: "gold" | "silver"
): number {
    const map = type === "gold"
        ? (settings.goldPriceOffsets || {})
        : (settings.silverPriceOffsets || {});
    return map[coinId] || 0;
}

/* ──── Helper: check if a coin is disabled (out of stock) ──── */
export function isCoinDisabled(
    settings: AdminSettings,
    coinId: string,
    type: "gold" | "silver"
): boolean {
    const list = type === "gold"
        ? (settings.disabledGoldCoins || [])
        : (settings.disabledSilverCoins || []);
    return list.includes(coinId);
}

/* ──── Helper: get display name for a coin (override or cleaned original) ──── */
export function getCoinDisplayName(
    settings: AdminSettings,
    coinId: string,
    originalLabel: string
): string {
    const overrides = settings.coinNameOverrides || {};
    if (overrides[coinId]) return overrides[coinId];
    return originalLabel.replace(/Excl(uding)?\s*gst/i, "").replace(/\s+/g, " ").trim();
}
