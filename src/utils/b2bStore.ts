import AsyncStorage from "@react-native-async-storage/async-storage";

/* ──── Keys ──── */
const RETAILERS_KEY = "b2b_retailers";
const B2B_AUTH_KEY = "b2b_logged_in_id";

/* ──── Types ──── */
export type RetailerStatus = "pending" | "approved" | "rejected";

export type B2BRetailer = {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  password: string;
  status: RetailerStatus;
  createdAt: string;
};

/* ──── Storage Helpers ──── */
export async function loadRetailers(): Promise<B2BRetailer[]> {
  try {
    const raw = await AsyncStorage.getItem(RETAILERS_KEY);
    if (raw) return JSON.parse(raw) as B2BRetailer[];
  } catch (e) {
    console.log("B2B load error:", e);
  }
  return [];
}

async function saveRetailers(retailers: B2BRetailer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RETAILERS_KEY, JSON.stringify(retailers));
  } catch (e) {
    console.log("B2B save error:", e);
  }
}

/* ──── Registration ──── */
export async function registerRetailer(
  name: string,
  businessName: string,
  phone: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const retailers = await loadRetailers();
  const exists = retailers.find((r) => r.phone === phone.trim());
  if (exists) {
    return { success: false, error: "Phone number already registered." };
  }
  const newRetailer: B2BRetailer = {
    id: `b2b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    businessName: businessName.trim(),
    phone: phone.trim(),
    password,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await saveRetailers([...retailers, newRetailer]);
  return { success: true };
}

/* ──── Admin Actions ──── */
export async function approveRetailer(id: string): Promise<void> {
  const retailers = await loadRetailers();
  await saveRetailers(
    retailers.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
  );
}

export async function rejectRetailer(id: string): Promise<void> {
  const retailers = await loadRetailers();
  await saveRetailers(
    retailers.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
  );
}

export async function deleteRetailer(id: string): Promise<void> {
  const retailers = await loadRetailers();
  await saveRetailers(retailers.filter((r) => r.id !== id));
  // also log out if this retailer was logged in
  const current = await AsyncStorage.getItem(B2B_AUTH_KEY);
  if (current === id) await AsyncStorage.removeItem(B2B_AUTH_KEY);
}

export async function updateRetailer(
  id: string,
  fields: Partial<Pick<B2BRetailer, "name" | "businessName" | "phone">>
): Promise<void> {
  const retailers = await loadRetailers();
  await saveRetailers(
    retailers.map((r) => (r.id === id ? { ...r, ...fields } : r))
  );
}

/* ──── Auth (Retailer Login / Logout) ──── */
export async function loginRetailer(
  phone: string,
  password: string
): Promise<{ success: boolean; retailer?: B2BRetailer; error?: string }> {
  const retailers = await loadRetailers();
  const found = retailers.find((r) => r.phone === phone.trim());
  if (!found) return { success: false, error: "Phone number not registered." };
  if (found.password !== password)
    return { success: false, error: "Incorrect password." };
  if (found.status === "pending")
    return {
      success: false,
      error: "Your account is pending admin approval.",
    };
  if (found.status === "rejected")
    return {
      success: false,
      error: "Your registration was not approved. Please contact admin.",
    };
  await AsyncStorage.setItem(B2B_AUTH_KEY, found.id);
  return { success: true, retailer: found };
}

export async function checkB2BAuth(): Promise<B2BRetailer | null> {
  try {
    const id = await AsyncStorage.getItem(B2B_AUTH_KEY);
    if (!id) return null;
    const retailers = await loadRetailers();
    const found = retailers.find((r) => r.id === id);
    if (!found || found.status !== "approved") {
      await AsyncStorage.removeItem(B2B_AUTH_KEY);
      return null;
    }
    return found;
  } catch {
    return null;
  }
}

export async function logoutRetailer(): Promise<void> {
  await AsyncStorage.removeItem(B2B_AUTH_KEY);
}

/* ──── Utility ──── */
export async function getPendingCount(): Promise<number> {
  const retailers = await loadRetailers();
  return retailers.filter((r) => r.status === "pending").length;
}
