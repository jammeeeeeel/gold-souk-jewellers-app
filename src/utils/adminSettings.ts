import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/* ──── Keys ──── */
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

/* ──── Secure session helpers (works on both native & web) ──── */
async function getSessionFlag(): Promise<boolean> {
    try {
        if (Platform.OS === "web") {
            return localStorage.getItem(AUTH_KEY) === "true";
        }
        const val = await SecureStore.getItemAsync(AUTH_KEY);
        return val === "true";
    } catch { return false; }
}

async function setSessionFlag(v: boolean): Promise<void> {
    try {
        if (Platform.OS === "web") {
            if (v) localStorage.setItem(AUTH_KEY, "true");
            else localStorage.removeItem(AUTH_KEY);
            return;
        }
        if (v) await SecureStore.setItemAsync(AUTH_KEY, "true");
        else await SecureStore.deleteItemAsync(AUTH_KEY);
    } catch {}
}

/* ──── Auth — credentials stored in Supabase ──── */
export async function checkAdminAuth(): Promise<boolean> {
    return getSessionFlag();
}

export async function loginAdmin(username: string, password: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from("app_settings")
            .select("data")
            .eq("id", 1)
            .single();

        if (error || !data?.data) return false;

        const stored = data.data as Record<string, any>;
        if (
            username === stored.admin_username &&
            password === stored.admin_password
        ) {
            await setSessionFlag(true);
            return true;
        }
        return false;
    } catch (e) {
        console.log("Login error:", e);
        return false;
    }
}

export async function logoutAdmin(): Promise<void> {
    await setSessionFlag(false);
}

/* ──── Settings — Supabase only ──── */

/**
 * Load settings from Supabase.
 * Extracts the admin settings fields from the data JSONB column,
 * ignoring auth-related fields (admin_username, admin_password).
 */
export async function loadSettings(): Promise<AdminSettings> {
    try {
        const { data, error } = await supabase
            .from("app_settings")
            .select("data")
            .eq("id", 1)
            .single();

        if (!error && data?.data) {
            const { admin_username, admin_password, ...settingsData } = data.data as any;
            return { ...DEFAULT_SETTINGS, ...settingsData };
        }
    } catch (e) {
        console.log("Supabase settings load error:", e);
    }

    return DEFAULT_SETTINGS;
}

/**
 * Save settings to Supabase.
 * Preserves auth fields (admin_username, admin_password) already in the row.
 */
export async function saveSettings(settings: AdminSettings): Promise<void> {
    try {
        // First read existing data to preserve auth fields
        const { data: existing } = await supabase
            .from("app_settings")
            .select("data")
            .eq("id", 1)
            .single();

        const preserved = existing?.data
            ? { admin_username: (existing.data as any).admin_username, admin_password: (existing.data as any).admin_password }
            : {};

        const merged = { ...preserved, ...settings };

        const { error } = await supabase
            .from("app_settings")
            .update({ data: merged, updated_at: new Date().toISOString() })
            .eq("id", 1);

        if (error) {
            console.log("Supabase settings save error:", error.message);
        }
    } catch (e) {
        console.log("Supabase settings save network error:", e);
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
