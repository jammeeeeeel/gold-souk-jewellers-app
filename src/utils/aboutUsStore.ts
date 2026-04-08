import AsyncStorage from "@react-native-async-storage/async-storage";

/* ──── Storage Key ──── */
const ABOUT_US_KEY = "about_us_v1";

/* ──── Types ──── */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface AboutUsData {
  shopName: string;
  tagline: string;
  story: string;               // long description / about text
  mission: string;
  vision: string;
  foundedYear: string;
  specialties: string[];       // e.g. ["Gold Jewellery", "Silver Articles", "MMTC Coins"]
  team: TeamMember[];
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  instagram: string;
  website: string;
  timings: string;             // e.g. "10:00 AM – 9:00 PM (Mon–Sat)"
}

/* ──── Defaults ──── */
const DEFAULT_ABOUT_US: AboutUsData = {
  shopName: "N. Khajawaal Jewellers",
  tagline: "Trusted in Gold & Silver Since Generations",
  story:
    "Established with a vision to bring the finest quality gold and silver jewellery to our customers, N. Khajawaal Jewellers has been a trusted name in the jewellery industry for decades. Our commitment to purity, craftsmanship, and fair pricing has earned us the trust of thousands of families across generations.\n\nFrom traditional designs rooted in heritage to contemporary styles that match modern trends, we offer an exquisite collection that caters to every taste and occasion. Each piece is crafted with meticulous attention to detail, ensuring the highest standards of quality.",
  mission:
    "To provide our customers with the purest gold and silver jewellery at the most transparent and competitive prices, backed by exceptional service and trust.",
  vision:
    "To be the most trusted and preferred jewellery destination, known for uncompromising quality, innovative designs, and a customer-first approach.",
  foundedYear: "",
  specialties: [
    "Hallmarked Gold Jewellery",
    "Pure Silver Articles",
    "MMTC-PAMP Gold & Silver Coins",
    "Bridal & Wedding Collections",
    "Custom Jewellery Design",
    "Old Gold Exchange",
  ],
  team: [
    { id: "tm_1", name: "N. Khajawaal", role: "Founder & Proprietor" },
  ],
  phone: "",
  email: "",
  address: "",
  whatsapp: "",
  instagram: "",
  website: "",
  timings: "10:00 AM – 9:00 PM (Mon–Sat)",
};

/* ──── Load ──── */
export async function loadAboutUs(): Promise<AboutUsData> {
  try {
    const raw = await AsyncStorage.getItem(ABOUT_US_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ABOUT_US,
        ...parsed,
        specialties: parsed.specialties?.length > 0 ? parsed.specialties : DEFAULT_ABOUT_US.specialties,
        team: parsed.team?.length > 0 ? parsed.team : DEFAULT_ABOUT_US.team,
      };
    }
  } catch (e) {
    console.log("AboutUs load error:", e);
  }
  return DEFAULT_ABOUT_US;
}

/* ──── Save ──── */
export async function saveAboutUs(data: AboutUsData): Promise<void> {
  try {
    await AsyncStorage.setItem(ABOUT_US_KEY, JSON.stringify(data));
  } catch (e) {
    console.log("AboutUs save error:", e);
  }
}

/* ──── Helper: generate a unique ID ──── */
export function generateAboutId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
