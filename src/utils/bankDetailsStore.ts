import AsyncStorage from "@react-native-async-storage/async-storage";

/* ──── Storage Key ──── */
const BANK_DETAILS_KEY = "bank_details_v1";

/* ──── Types ──── */
export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: "savings" | "current";
}

export interface UpiDetail {
  id: string;
  upiId: string;
  label: string;         // e.g. "GPay", "PhonePe", "Paytm"
}

export interface BankDetailsData {
  accounts: BankAccount[];
  upiDetails: UpiDetail[];
  note: string;            // custom note displayed to users (e.g. "Send screenshot after payment")
  shopName: string;        // display name shown on the bank details page
  shopPhone: string;       // contact phone number
  shopEmail: string;       // contact email
  shopAddress: string;     // shop address
}

/* ──── Defaults ──── */
const DEFAULT_BANK_DETAILS: BankDetailsData = {
  accounts: [
    {
      id: "acct_1",
      bankName: "State Bank of India",
      accountHolder: "N. Khajawaal Jewellers",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      accountType: "current",
    },
  ],
  upiDetails: [
    {
      id: "upi_1",
      upiId: "",
      label: "GPay",
    },
  ],
  note: "Please share payment screenshot on WhatsApp after transfer.",
  shopName: "N. Khajawaal Jewellers",
  shopPhone: "",
  shopEmail: "",
  shopAddress: "",
};

/* ──── Load ──── */
export async function loadBankDetails(): Promise<BankDetailsData> {
  try {
    const raw = await AsyncStorage.getItem(BANK_DETAILS_KEY);
    if (raw) {
      return { ...DEFAULT_BANK_DETAILS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.log("BankDetails load error:", e);
  }
  return DEFAULT_BANK_DETAILS;
}

/* ──── Save ──── */
export async function saveBankDetails(data: BankDetailsData): Promise<void> {
  try {
    await AsyncStorage.setItem(BANK_DETAILS_KEY, JSON.stringify(data));
  } catch (e) {
    console.log("BankDetails save error:", e);
  }
}

/* ──── Helper: generate a unique ID ──── */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
