import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchLiveRates, RateItem } from "../utils/asawirScraper";

/* ──── ZAKAT CONSTANTS ──── */
const ZAKAT_RATE = 0.025; // 2.5%
const GOLD_NISAB_GRAMS = 87.48; // Minimum gold threshold (grams)
const SILVER_NISAB_GRAMS = 612.36; // Minimum silver threshold (grams)
const KARATS = [24, 22, 21, 18, 14] as const;
const { width: SCREEN_W } = Dimensions.get("window");

/* ──── HELPERS ──── */
function formatINR(amount: number): string {
  if (isNaN(amount) || amount === 0) return "₹0";
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function extractGoldPricePerGram(products: RateItem[]): number {
  // Look for "GOLD 999" or similar fine gold rate per gram
  for (const item of products) {
    const label = item.label.toUpperCase();
    if ((label.includes("GOLD") && label.includes("999")) || label.includes("GOLD FINE")) {
      const sell = parseFloat(item.sell);
      if (!isNaN(sell) && sell > 0) {
        // If price > 50000, it's per 10g — divide by 10
        return sell > 50000 ? sell / 10 : sell;
      }
    }
  }
  // Fallback: first gold product
  for (const item of products) {
    if (item.label.toUpperCase().includes("GOLD")) {
      const sell = parseFloat(item.sell);
      if (!isNaN(sell) && sell > 0) {
        return sell > 50000 ? sell / 10 : sell;
      }
    }
  }
  return 0;
}

function extractSilverPricePerGram(products: RateItem[]): number {
  for (const item of products) {
    const label = item.label.toUpperCase();
    if ((label.includes("SILVER") && label.includes("999")) || label.includes("SILVER FINE")) {
      const sell = parseFloat(item.sell);
      if (!isNaN(sell) && sell > 0) {
        // Silver per KG → per gram
        return sell > 5000 ? sell / 1000 : sell;
      }
    }
  }
  for (const item of products) {
    if (item.label.toUpperCase().includes("SILVER")) {
      const sell = parseFloat(item.sell);
      if (!isNaN(sell) && sell > 0) {
        return sell > 5000 ? sell / 1000 : sell;
      }
    }
  }
  return 0;
}

/* ──── ASSET INPUT ROW ──── */
function AssetInput({
  icon,
  iconColor,
  iconBg,
  label,
  subLabel,
  value,
  onChangeText,
  placeholder,
  keyboardType = "numeric",
  suffix,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  subLabel?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "numeric" | "decimal-pad";
  suffix?: string;
}) {
  return (
    <View style={styles.assetRow}>
      <View style={[styles.assetIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.assetContent}>
        <Text style={styles.assetLabel}>{label}</Text>
        {subLabel && <Text style={styles.assetSubLabel}>{subLabel}</Text>}
      </View>
      <View style={styles.assetInputWrap}>
        <TextInput
          style={styles.assetInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#ccc"
          keyboardType={keyboardType}
          selectTextOnFocus
        />
        {suffix && <Text style={styles.assetSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

/* ──── RESULT CARD ──── */
function ResultCard({
  label,
  value,
  icon,
  accent,
  subText,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
  subText?: string;
}) {
  return (
    <View style={[styles.resultCard, { borderColor: accent }]}>
      <View style={[styles.resultIconCircle, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon as any} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultLabel}>{label}</Text>
        {subText && <Text style={styles.resultSubText}>{subText}</Text>}
      </View>
      <Text style={[styles.resultValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

/* ──── MAIN SCREEN ──── */
export default function ZakatCalculatorScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goldPricePerGram, setGoldPricePerGram] = useState(0);
  const [silverPricePerGram, setSilverPricePerGram] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Gold inputs (in grams)
  const [gold24k, setGold24k] = useState("");
  const [gold22k, setGold22k] = useState("");
  const [gold21k, setGold21k] = useState("");
  const [gold18k, setGold18k] = useState("");

  // Silver input (in grams)
  const [silverGrams, setSilverGrams] = useState("");

  // Cash & savings
  const [cash, setCash] = useState("");
  const [savings, setSavings] = useState("");
  const [investments, setInvestments] = useState("");

  // Liabilities
  const [debts, setDebts] = useState("");

  // Active tab
  const [activeTab, setActiveTab] = useState<"calculator" | "info">("calculator");

  // Pulse animation for live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadRates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const rates = await fetchLiveRates();
      if (rates.products.length > 0) {
        const gp = extractGoldPricePerGram(rates.products);
        const sp = extractSilverPricePerGram(rates.products);
        if (gp > 0) setGoldPricePerGram(gp);
        if (sp > 0) setSilverPricePerGram(sp);
        setLastUpdated(rates.updated_at);
      }
    } catch (e) {
      console.log("Zakat rate fetch error:", e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
    const interval = setInterval(() => loadRates(), 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadRates]);

  /* ── Calculations ── */
  const toNum = (s: string) => parseFloat(s) || 0;

  // Convert karat gold to pure gold equivalent (grams)
  const pureGold24k = toNum(gold24k);
  const pureGold22k = toNum(gold22k) * (22 / 24);
  const pureGold21k = toNum(gold21k) * (21 / 24);
  const pureGold18k = toNum(gold18k) * (18 / 24);
  const totalPureGold = pureGold24k + pureGold22k + pureGold21k + pureGold18k;

  const totalSilver = toNum(silverGrams);

  // Total value of gold & silver at live rates
  const goldValue = totalPureGold * goldPricePerGram;
  const silverValue = totalSilver * silverPricePerGram;

  // Cash & investments
  const totalCash = toNum(cash) + toNum(savings) + toNum(investments);

  // Total liabilities
  const totalDebts = toNum(debts);

  // Net zakatable wealth
  const totalWealth = goldValue + silverValue + totalCash;
  const netWealth = Math.max(0, totalWealth - totalDebts);

  // Nisab thresholds (in ₹)
  const goldNisabValue = GOLD_NISAB_GRAMS * goldPricePerGram;
  const silverNisabValue = SILVER_NISAB_GRAMS * silverPricePerGram;
  // Use the lower (silver) nisab as recommended by scholars
  const nisabValue = silverPricePerGram > 0 ? silverNisabValue : goldNisabValue;
  const nisabType = silverPricePerGram > 0 ? "silver" : "gold";

  // Is Zakat due?
  const isZakatDue = netWealth >= nisabValue && nisabValue > 0;

  // Zakat amount
  const zakatAmount = isZakatDue ? netWealth * ZAKAT_RATE : 0;

  const hasAnyInput = totalPureGold > 0 || totalSilver > 0 || totalCash > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#8a6400" />
          <Text style={styles.loadingText}>Fetching live rates…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRates(true)} tintColor="#8a6400" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="calculator" size={28} color="#8a6400" />
          </View>
          <Text style={styles.headerTitle}>Zakaat Calculator</Text>
          <Text style={styles.headerSub}>Calculate your Zakat based on live market rates</Text>

          {/* Live rate indicator */}
          <View style={styles.liveRateRow}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveText}>LIVE RATES</Text>
          </View>
        </View>

        {/* Live Rate Cards */}
        <View style={styles.rateCardsRow}>
          <View style={styles.rateCard}>
            <View style={styles.rateCardHeader}>
              <Ionicons name="ellipse" size={10} color="#b8860b" />
              <Text style={styles.rateCardTitle}>Gold 24K</Text>
            </View>
            <Text style={styles.rateCardPrice}>{formatINR(goldPricePerGram)}</Text>
            <Text style={styles.rateCardUnit}>per gram</Text>
          </View>
          <View style={styles.rateCard}>
            <View style={styles.rateCardHeader}>
              <Ionicons name="ellipse" size={10} color="#888" />
              <Text style={styles.rateCardTitle}>Silver 999</Text>
            </View>
            <Text style={styles.rateCardPrice}>{formatINR(silverPricePerGram)}</Text>
            <Text style={styles.rateCardUnit}>per gram</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "calculator" && styles.tabBtnActive]}
            onPress={() => setActiveTab("calculator")}
          >
            <Ionicons name="calculator-outline" size={15} color={activeTab === "calculator" ? "#8a6400" : "#999"} />
            <Text style={[styles.tabText, activeTab === "calculator" && styles.tabTextActive]}>Calculator</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "info" && styles.tabBtnActive]}
            onPress={() => setActiveTab("info")}
          >
            <Ionicons name="book-outline" size={15} color={activeTab === "info" ? "#8a6400" : "#999"} />
            <Text style={[styles.tabText, activeTab === "info" && styles.tabTextActive]}>About Zakat</Text>
          </TouchableOpacity>
        </View>

        {activeTab === "calculator" ? (
          <>
            {/* ── GOLD SECTION ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#b8860b" }]} />
              <Text style={styles.sectionTitle}>Gold Holdings</Text>
              <Text style={styles.sectionHint}>Enter weight in grams</Text>
            </View>

            <View style={styles.assetCard}>
              <AssetInput
                icon="ellipse" iconColor="#b8860b" iconBg="#fef6e4"
                label="24K Gold" subLabel="Pure gold (99.9%)"
                value={gold24k} onChangeText={setGold24k}
                placeholder="0" suffix="g"
              />
              <View style={styles.assetDivider} />
              <AssetInput
                icon="ellipse" iconColor="#c49b2c" iconBg="#fef6e4"
                label="22K Gold" subLabel="Standard jewelry (91.6%)"
                value={gold22k} onChangeText={setGold22k}
                placeholder="0" suffix="g"
              />
              <View style={styles.assetDivider} />
              <AssetInput
                icon="ellipse" iconColor="#d4a836" iconBg="#fef6e4"
                label="21K Gold" subLabel="Gulf standard (87.5%)"
                value={gold21k} onChangeText={setGold21k}
                placeholder="0" suffix="g"
              />
              <View style={styles.assetDivider} />
              <AssetInput
                icon="ellipse" iconColor="#e8c876" iconBg="#fef6e4"
                label="18K Gold" subLabel="Mixed alloy (75%)"
                value={gold18k} onChangeText={setGold18k}
                placeholder="0" suffix="g"
              />
              {totalPureGold > 0 && (
                <View style={styles.pureGoldBanner}>
                  <Ionicons name="sparkles" size={14} color="#8a6400" />
                  <Text style={styles.pureGoldText}>
                    Pure gold equivalent: {totalPureGold.toFixed(2)}g = {formatINR(goldValue)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── SILVER SECTION ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#888" }]} />
              <Text style={styles.sectionTitle}>Silver Holdings</Text>
              <Text style={styles.sectionHint}>Enter weight in grams</Text>
            </View>

            <View style={styles.assetCard}>
              <AssetInput
                icon="ellipse" iconColor="#888" iconBg="#f5f5f5"
                label="Silver (999)" subLabel="Pure silver"
                value={silverGrams} onChangeText={setSilverGrams}
                placeholder="0" suffix="g"
              />
              {totalSilver > 0 && (
                <View style={[styles.pureGoldBanner, { backgroundColor: "#f5f5f5", borderColor: "#e0e0e0" }]}>
                  <Ionicons name="sparkles" size={14} color="#666" />
                  <Text style={[styles.pureGoldText, { color: "#555" }]}>
                    Silver value: {formatINR(silverValue)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── CASH & SAVINGS ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#2e7d32" }]} />
              <Text style={styles.sectionTitle}>Cash & Savings</Text>
              <Text style={styles.sectionHint}>Enter in ₹</Text>
            </View>

            <View style={styles.assetCard}>
              <AssetInput
                icon="wallet-outline" iconColor="#2e7d32" iconBg="#e8f5e9"
                label="Cash in Hand" subLabel="Physical cash"
                value={cash} onChangeText={setCash}
                placeholder="0" suffix="₹"
              />
              <View style={styles.assetDivider} />
              <AssetInput
                icon="card-outline" iconColor="#1565c0" iconBg="#e3f2fd"
                label="Bank Savings" subLabel="Savings & current accounts"
                value={savings} onChangeText={setSavings}
                placeholder="0" suffix="₹"
              />
              <View style={styles.assetDivider} />
              <AssetInput
                icon="trending-up-outline" iconColor="#6d28d9" iconBg="#f3e8ff"
                label="Investments" subLabel="Stocks, funds, FDs, etc."
                value={investments} onChangeText={setInvestments}
                placeholder="0" suffix="₹"
              />
            </View>

            {/* ── LIABILITIES ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#c62828" }]} />
              <Text style={styles.sectionTitle}>Liabilities</Text>
              <Text style={styles.sectionHint}>Deduct from total</Text>
            </View>

            <View style={styles.assetCard}>
              <AssetInput
                icon="remove-circle-outline" iconColor="#c62828" iconBg="#fce4ec"
                label="Outstanding Debts" subLabel="Immediate loans & dues"
                value={debts} onChangeText={setDebts}
                placeholder="0" suffix="₹"
              />
            </View>

            {/* ── RESULTS ── */}
            {hasAnyInput && (
              <View style={styles.resultSection}>
                <View style={styles.resultDividerRow}>
                  <View style={styles.resultDividerLine} />
                  <Text style={styles.resultDividerText}>ZAKAT SUMMARY</Text>
                  <View style={styles.resultDividerLine} />
                </View>

                <ResultCard
                  label="Total Wealth" icon="layers-outline" accent="#333"
                  value={formatINR(totalWealth)}
                  subText={`Gold ${formatINR(goldValue)} + Silver ${formatINR(silverValue)} + Cash ${formatINR(totalCash)}`}
                />

                {totalDebts > 0 && (
                  <ResultCard
                    label="Less: Liabilities" icon="remove-circle-outline" accent="#c62828"
                    value={`- ${formatINR(totalDebts)}`}
                  />
                )}

                <ResultCard
                  label="Net Zakatable Wealth" icon="wallet-outline" accent="#1565c0"
                  value={formatINR(netWealth)}
                />

                <ResultCard
                  label={`Nisab Threshold (${nisabType})`}
                  icon="shield-checkmark-outline" accent="#6d28d9"
                  value={formatINR(nisabValue)}
                  subText={nisabType === "silver"
                    ? `${SILVER_NISAB_GRAMS}g silver × ${formatINR(silverPricePerGram)}/g`
                    : `${GOLD_NISAB_GRAMS}g gold × ${formatINR(goldPricePerGram)}/g`
                  }
                />

                {/* STATUS BANNER */}
                <View style={[
                  styles.zakatBanner,
                  isZakatDue ? styles.zakatDueBanner : styles.zakatNotDueBanner,
                ]}>
                  <Ionicons
                    name={isZakatDue ? "checkmark-circle" : "information-circle"}
                    size={24}
                    color={isZakatDue ? "#2e7d32" : "#666"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.zakatBannerTitle,
                      { color: isZakatDue ? "#1b5e20" : "#444" },
                    ]}>
                      {isZakatDue ? "Zakat is Due" : "Zakat is Not Due"}
                    </Text>
                    <Text style={styles.zakatBannerSub}>
                      {isZakatDue
                        ? `Your net wealth exceeds the nisab threshold`
                        : `Your net wealth is below the nisab threshold (${formatINR(nisabValue)})`
                      }
                    </Text>
                  </View>
                </View>

                {isZakatDue && (
                  <View style={styles.zakatAmountCard}>
                    <Text style={styles.zakatAmountLabel}>YOUR ZAKAT PAYABLE</Text>
                    <Text style={styles.zakatAmountValue}>{formatINR(zakatAmount)}</Text>
                    <Text style={styles.zakatAmountCalc}>
                      {formatINR(netWealth)} × 2.5% = {formatINR(zakatAmount)}
                    </Text>
                    <View style={styles.zakatDivider} />
                    <Text style={styles.zakatDisclaimer}>
                      This calculation uses the silver nisab standard as recommended by most scholars.
                      Please consult your local Islamic scholar for specific guidance.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Updated timestamp */}
            {lastUpdated && (
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={12} color="#bbb" />
                <Text style={styles.timestampText}>
                  Rates updated: {new Date(lastUpdated).toLocaleTimeString("en-IN")}
                </Text>
              </View>
            )}
          </>
        ) : (
          /* ── INFO TAB ── */
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What is Zakat?</Text>
              <Text style={styles.infoText}>
                Zakat is one of the Five Pillars of Islam. It is a mandatory charitable contribution,
                typically 2.5% of a Muslim's total savings and wealth above a minimum threshold (Nisab),
                due every lunar year.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Nisab Threshold</Text>
              <Text style={styles.infoText}>
                The Nisab is the minimum amount of wealth that makes a Muslim liable to pay Zakat.
                It is calculated based on either:
              </Text>
              <View style={styles.infoBullet}>
                <View style={[styles.bulletDot, { backgroundColor: "#b8860b" }]} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Gold:</Text> {GOLD_NISAB_GRAMS}g of pure gold ({formatINR(goldNisabValue)} at current rates)
                </Text>
              </View>
              <View style={styles.infoBullet}>
                <View style={[styles.bulletDot, { backgroundColor: "#888" }]} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Silver:</Text> {SILVER_NISAB_GRAMS}g of pure silver ({formatINR(silverNisabValue)} at current rates)
                </Text>
              </View>
              <Text style={[styles.infoText, { marginTop: 8 }]}>
                Most scholars recommend using the silver standard as it has a lower threshold,
                enabling more people to contribute to those in need.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How to Calculate</Text>
              <View style={styles.infoSteps}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
                  <Text style={styles.infoText}>Add up all your gold, silver, cash, savings, and investments.</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
                  <Text style={styles.infoText}>Subtract any immediate debts or liabilities.</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
                  <Text style={styles.infoText}>If the net amount exceeds the Nisab, Zakat is due.</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
                  <Text style={styles.infoText}>Pay 2.5% of your total net wealth as Zakat.</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Gold Purity Conversion</Text>
              <Text style={styles.infoText}>
                Zakat is calculated on the pure gold content only:
              </Text>
              <View style={styles.purityTable}>
                {KARATS.map((k) => (
                  <View key={k} style={styles.purityRow}>
                    <Text style={styles.purityKarat}>{k}K</Text>
                    <View style={styles.purityBar}>
                      <View style={[styles.purityFill, { width: `${(k / 24) * 100}%` }]} />
                    </View>
                    <Text style={styles.purityPercent}>{((k / 24) * 100).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.infoText, { marginTop: 6, fontStyle: "italic" }]}>
                Example: 100g of 22K gold = {(100 * 22 / 24).toFixed(1)}g pure gold
              </Text>
            </View>

            <View style={[styles.infoCard, { borderColor: "#f0e6c8" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="warning-outline" size={18} color="#b8860b" />
                <Text style={[styles.infoTitle, { marginBottom: 0 }]}>Disclaimer</Text>
              </View>
              <Text style={[styles.infoText, { marginTop: 8 }]}>
                This calculator provides an estimate based on commonly accepted Islamic principles.
                For personal-use jewelry and specific financial situations, there are varying scholarly
                opinions. Please consult a qualified Islamic scholar or financial advisor for precise guidance.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f9fb" },
  scrollContent: { paddingBottom: 30 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#888" },

  /* Header */
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0e6c8",
  },
  headerIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#fef6e4", justifyContent: "center", alignItems: "center",
    marginBottom: 10, borderWidth: 2, borderColor: "#e8d9b0",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#242424" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 4, textAlign: "center" },
  liveRateRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 10, backgroundColor: "#e8f5e9", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveText: { fontSize: 10, fontWeight: "800", color: "#2e7d32", letterSpacing: 1 },

  /* Rate Cards */
  rateCardsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 14 },
  rateCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#f0e6c8",
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  rateCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  rateCardTitle: { fontSize: 12, fontWeight: "700", color: "#666" },
  rateCardPrice: { fontSize: 20, fontWeight: "800", color: "#333", marginTop: 4 },
  rateCardUnit: { fontSize: 10, color: "#aaa", marginTop: 1 },

  /* Tabs */
  tabRow: {
    flexDirection: "row", marginHorizontal: 14, marginTop: 14,
    backgroundColor: "#f1f1f1", borderRadius: 10, padding: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#999" },
  tabTextActive: { color: "#8a6400" },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, marginTop: 18, marginBottom: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#333", flex: 1 },
  sectionHint: { fontSize: 11, color: "#bbb" },

  /* Asset Card */
  assetCard: {
    marginHorizontal: 14, backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
  },
  assetRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  assetIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  assetContent: { flex: 1 },
  assetLabel: { fontSize: 14, fontWeight: "700", color: "#333" },
  assetSubLabel: { fontSize: 11, color: "#aaa", marginTop: 1 },
  assetInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8f8f8", borderRadius: 10,
    borderWidth: 1, borderColor: "#eee",
    paddingHorizontal: 10, minWidth: 100,
  },
  assetInput: {
    flex: 1, fontSize: 16, fontWeight: "700", color: "#333",
    paddingVertical: 8, textAlign: "right",
  },
  assetSuffix: { fontSize: 13, fontWeight: "600", color: "#aaa", marginLeft: 4 },
  assetDivider: { height: 1, backgroundColor: "#f5f5f5", marginLeft: 60 },

  /* Pure gold banner */
  pureGoldBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "#fef6e4", borderTopWidth: 1, borderColor: "#f0e6c8",
  },
  pureGoldText: { fontSize: 12, fontWeight: "700", color: "#8a6400" },

  /* Result Section */
  resultSection: { marginTop: 10, paddingHorizontal: 14 },
  resultDividerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginBottom: 12, marginTop: 8,
  },
  resultDividerLine: { flex: 1, height: 1, backgroundColor: "#e8d9b0" },
  resultDividerText: { fontSize: 10, fontWeight: "800", color: "#b8a070", letterSpacing: 1.8 },

  /* Result Card */
  resultCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: "#f0f0f0",
  },
  resultIconCircle: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  resultLabel: { fontSize: 13, fontWeight: "700", color: "#555" },
  resultSubText: { fontSize: 10, color: "#aaa", marginTop: 2 },
  resultValue: { fontSize: 16, fontWeight: "800" },

  /* Zakat Banner */
  zakatBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 8,
    borderWidth: 1,
  },
  zakatDueBanner: { backgroundColor: "#e8f5e9", borderColor: "#a5d6a7" },
  zakatNotDueBanner: { backgroundColor: "#f5f5f5", borderColor: "#e0e0e0" },
  zakatBannerTitle: { fontSize: 16, fontWeight: "800" },
  zakatBannerSub: { fontSize: 12, color: "#666", marginTop: 2 },

  /* Zakat Amount Card */
  zakatAmountCard: {
    backgroundColor: "#fef6e4", borderRadius: 16, padding: 20,
    alignItems: "center", borderWidth: 2, borderColor: "#e8d9b0",
    marginTop: 4,
  },
  zakatAmountLabel: {
    fontSize: 10, fontWeight: "800", color: "#b8a070",
    letterSpacing: 2, marginBottom: 4,
  },
  zakatAmountValue: { fontSize: 32, fontWeight: "800", color: "#8a6400" },
  zakatAmountCalc: { fontSize: 12, color: "#a08a50", marginTop: 4 },
  zakatDivider: { width: 40, height: 2, backgroundColor: "#e8d9b0", borderRadius: 1, marginVertical: 12 },
  zakatDisclaimer: {
    fontSize: 11, color: "#a08a50", textAlign: "center", lineHeight: 16, fontStyle: "italic",
  },

  /* Timestamp */
  timestampRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 16,
  },
  timestampText: { fontSize: 11, color: "#bbb" },

  /* Info Section */
  infoSection: { paddingHorizontal: 14, marginTop: 10 },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: "#f0f0f0",
  },
  infoTitle: { fontSize: 16, fontWeight: "800", color: "#333", marginBottom: 8 },
  infoText: { fontSize: 13, color: "#666", lineHeight: 20, flex: 1 },
  infoBold: { fontWeight: "800", color: "#444" },
  infoBullet: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },

  /* Steps */
  infoSteps: { gap: 10, marginTop: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fef6e4", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#e8d9b0",
  },
  stepNumText: { fontSize: 12, fontWeight: "800", color: "#8a6400" },

  /* Purity Table */
  purityTable: { marginTop: 10, gap: 6 },
  purityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  purityKarat: { fontSize: 12, fontWeight: "800", color: "#666", width: 30 },
  purityBar: {
    flex: 1, height: 8, backgroundColor: "#f5f5f5", borderRadius: 4, overflow: "hidden",
  },
  purityFill: { height: "100%", backgroundColor: "#d4a836", borderRadius: 4 },
  purityPercent: { fontSize: 11, fontWeight: "700", color: "#888", width: 40, textAlign: "right" },
});
