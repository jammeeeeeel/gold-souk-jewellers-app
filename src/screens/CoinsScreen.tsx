import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AdminSettings, getCoinPremium, isCoinDisabled, loadSettings } from "../utils/adminSettings";
import { fetchCoinRates, fetchLiveRates, fetchSilverCoinRates, RateItem } from "../utils/asawirScraper";
import { buildGoldDistributorRates, buildSilverDistributorRates } from "../utils/mmtcDistributorRates";
import { fetchMmtcAllPrices, MmtcWeightPriceMap } from "../utils/mmtcPampScraper";

/* ──── Extract weight from coin label ──── */
function getWeight(label: string): number | null {
  // Match patterns like ".500" (0.5g), "1g", "10 g", "1000 GM"
  const halfMatch = label.match(/\.500/);
  if (halfMatch) return 0.5;
  const match = label.match(/([\d.]+)\s*(?:g|gm|gms|gram)/i);
  return match ? parseFloat(match[1]) : null;
}

/* ──── Price flash hook ──── */
function usePriceFlash(value: string) {
  const prev = useRef(value);
  const flash = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState<"up" | "down" | "none">("none");

  useEffect(() => {
    const cur = parseFloat(value);
    const old = parseFloat(prev.current);
    if (!isNaN(cur) && !isNaN(old) && cur !== old) {
      setDir(cur > old ? "up" : "down");
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 800, useNativeDriver: false }).start();
    }
    prev.current = value;
  }, [value]);

  return { dir, flash };
}

/* ──── Animated Price ──── */
function CoinPrice({ value, large }: { value: string; large?: boolean }) {
  const { dir, flash } = usePriceFlash(value);
  const color = dir === "up" ? "#22c55e" : dir === "down" ? "#ef4444" : "#1f1f1f";
  const bgColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0)", dir === "up" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"],
  });
  const displayValue = value && value !== "-" ? `₹${Number(value).toLocaleString("en-IN")}` : "—";

  return (
    <Animated.View style={{ backgroundColor: bgColor, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={[{ color, fontWeight: "800", fontSize: large ? 22 : 17 }]}>{displayValue}</Text>
    </Animated.View>
  );
}

/* ──── Coin Card (clean user-facing — no MC, no premium, no GST details) ──── */
function CoinCard({ coin, index, type, price }: {
  coin: RateItem; index: number; type: "gold" | "silver"; price: number | null;
}) {
  const weight = getWeight(coin.label);
  const cleanLabel = coin.label
    .replace(/Excl(uding)?\s*gst/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const isGold = type === "gold";
  const accentColor = isGold ? "#d4a836" : "#8a8a8a";
  const priceStr = price ? price.toString() : "-";

  return (
    <View style={[styles.card, index % 2 === 0 ? styles.cardEven : (isGold ? styles.cardOddGold : styles.cardOddSilver)]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: isGold ? "#fef6e4" : "#f0f0f0" }]}>
          <Ionicons name="ellipse" size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.coinName}>{cleanLabel}</Text>
          <View style={styles.metaRow}>
            {weight && <Text style={[styles.metaBadge, !isGold && styles.silverBadge]}>{weight}g</Text>}
            <Text style={[styles.metaBadge, !isGold && styles.silverBadge]}>{isGold ? "999.9" : "999.9"} Purity</Text>
          </View>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>PRICE</Text>
          <CoinPrice value={priceStr} large />
        </View>
      </View>
    </View>
  );
}

/* ──── Main Screen ──── */
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function CoinsScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0); // 0=gold 1=silver
  const [goldCoins, setGoldCoins] = useState<RateItem[]>([]);
  const [silverCoins, setSilverCoins] = useState<RateItem[]>([]);
  const [goldBasePerGram, setGoldBasePerGram] = useState(0);
  const [silverBasePerGram, setSilverBasePerGram] = useState(0);
  const [mmtcGoldPrices, setMmtcGoldPrices] = useState<MmtcWeightPriceMap>({});
  const [mmtcSilverPrices, setMmtcSilverPrices] = useState<MmtcWeightPriceMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // ── One-time load: coin lists, settings, MMTC prices (don't change per-tick) ──
  const loadStaticData = async () => {
    try {
      const [gold, silver, s, mmtcPrices] = await Promise.all([
        fetchCoinRates(),
        fetchSilverCoinRates(),
        loadSettings(),
        fetchMmtcAllPrices(),
      ]);
      if (gold.length > 0) setGoldCoins(gold);
      if (silver.length > 0) setSilverCoins(silver);
      setSettings(s);
      if (Object.keys(mmtcPrices.gold).length > 0) setMmtcGoldPrices(mmtcPrices.gold);
      if (Object.keys(mmtcPrices.silver).length > 0) setMmtcSilverPrices(mmtcPrices.silver);
    } catch (e) {
      console.log("Static coin data error:", e);
    }
  };

  // ── Per-second live rate fetch (only MCX futures base rate) ──
  const pollLiveRate = async () => {
    try {
      const mainRates = await fetchLiveRates();
      const goldFuture = mainRates.products.find(
        (p) => p.label.toUpperCase().includes("GOLD") && p.label.toUpperCase().includes("FUTURE")
      );
      if (goldFuture) {
        const gfSell = parseFloat(goldFuture.sell) || parseFloat(goldFuture.buy);
        if (gfSell > 0) setGoldBasePerGram(gfSell / 10);
      }
      const silverFuture = mainRates.products.find(
        (p) => p.label.toUpperCase().includes("SILVER") && p.label.toUpperCase().includes("FUTURE")
      );
      if (silverFuture) {
        const sfSell = parseFloat(silverFuture.sell) || parseFloat(silverFuture.buy);
        if (sfSell > 0) setSilverBasePerGram(sfSell / 1000);
      }
    } catch (e) {
      console.log("Live rate poll error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Pull-to-refresh: reload everything ──
  const loadCoins = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    await Promise.all([loadStaticData(), pollLiveRate()]);
    if (isRefresh) setRefreshing(false);
  };

  useEffect(() => {
    // Load static data once, then start 1s live rate loop
    loadStaticData();
    let alive = true;
    const loop = async () => {
      while (alive) {
        await pollLiveRate();
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    loop();
    return () => { alive = false; };
  }, []);

  const tabType = activeTab === 0 ? "gold" : "silver";
  const goldBasePerGramRef = goldBasePerGram;
  const silverBasePerGramRef = silverBasePerGram;

  const switchTab = (index: 0 | 1) => {
    setActiveTab(index);
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    Animated.spring(indicatorAnim, { toValue: index, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };

  const onSwipe = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH) as 0 | 1;
    if (pageIndex !== activeTab) {
      setActiveTab(pageIndex);
      Animated.spring(indicatorAnim, { toValue: pageIndex, useNativeDriver: false, tension: 60, friction: 10 }).start();
    }
  };

  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  // Price calculator per type
  // Priority 1: Distributor rate (MCX Futures formula — removes Asawir dealer margin)
  // Priority 2: MMTC portal retail MRP as cross-check fallback
  const getPriceFor = (coin: RateItem, type: "gold" | "silver"): number | null => {
    if (!settings || isCoinDisabled(settings, coin.id, type)) return null;
    const weight = getWeight(coin.label);
    if (!weight) return null;
    const premium = getCoinPremium(settings, coin.id, type);
    const weightKey = weight.toString();

    // ── Priority 1: Calculate from MCX Futures using MMTC distributor formula ──
    const base = type === "gold" ? goldBasePerGramRef : silverBasePerGramRef;
    if (base > 0) {
      const distMap = type === "gold"
        ? buildGoldDistributorRates(base)
        : buildSilverDistributorRates(base);
      const distPrice = distMap[weightKey];
      if (distPrice && distPrice > 0) {
        return Math.round(distPrice + premium);
      }
    }

    // ── Priority 2: MMTC portal retail MRP (consumer-facing, fallback only) ──
    const mmtcMap = type === "gold" ? mmtcGoldPrices : mmtcSilverPrices;
    const mmtcBase = mmtcMap[weightKey];
    if (mmtcBase && mmtcBase > 0) {
      return Math.round(mmtcBase + premium);
    }

    return null;
  };

  const indicatorBg = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#fef6e4", "#f0f0f0"],
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="cash" size={24} color="#8a6400" />
        <Text style={styles.headerTitle}>MMTC-PAMP Coins</Text>
      </View>

      {/* Animated Tab Bar */}
      <View style={styles.tabWrapper}>
        <Animated.View style={[
          styles.tabIndicator,
          { left: indicatorLeft, backgroundColor: indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#fef6e4", "#f0f0f0"] }) },
        ]} />
        <TouchableOpacity onPress={() => switchTab(0)} style={styles.tabButton}>
          <Ionicons name="ellipse" size={14} color={activeTab === 0 ? "#b8860b" : "#999"} />
          <Text style={[styles.tabText, activeTab === 0 && styles.activeGoldTabText]}>GOLD COINS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => switchTab(1)} style={styles.tabButton}>
          <Ionicons name="ellipse" size={14} color={activeTab === 1 ? "#666" : "#999"} />
          <Text style={[styles.tabText, activeTab === 1 && styles.activeSilverTabText]}>SILVER COINS</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Pager */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSwipe}
        style={{ flex: 1 }}
        decelerationRate="fast"
      >
        {/* ── Gold Page ── */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing && activeTab === 0} onRefresh={() => loadCoins(true)} tintColor="#8a6400" />
          }
        >
          {loading ? (
            <View style={styles.centerBox}><ActivityIndicator size="large" color="#8a6400" /><Text style={styles.loadingText}>Loading coin rates...</Text></View>
          ) : goldCoins.length === 0 ? (
            <View style={styles.centerBox}><Text style={styles.errorTitle}>⚠ Gold coin rates unavailable</Text><Text style={styles.errorSub}>Pull down to refresh</Text></View>
          ) : (
            <>
              <View style={styles.summaryBanner}><Text style={styles.summaryText}>{goldCoins.length} gold coin variants • Live rates</Text></View>
              {goldCoins.map((coin, i) => <CoinCard key={coin.id || i} coin={coin} index={i} type="gold" price={getPriceFor(coin, "gold")} />)}
              <Text style={styles.footnote}>Prices inclusive of all taxes. Rates subject to market fluctuation.</Text>
            </>
          )}
        </ScrollView>

        {/* ── Silver Page ── */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing && activeTab === 1} onRefresh={() => loadCoins(true)} tintColor="#8a6400" />
          }
        >
          {loading ? (
            <View style={styles.centerBox}><ActivityIndicator size="large" color="#8a6400" /><Text style={styles.loadingText}>Loading coin rates...</Text></View>
          ) : silverCoins.length === 0 ? (
            <View style={styles.centerBox}><Text style={styles.errorTitle}>⚠ Silver coin rates unavailable</Text><Text style={styles.errorSub}>Pull down to refresh</Text></View>
          ) : (
            <>
              <View style={styles.summaryBanner}><Text style={styles.summaryText}>{silverCoins.length} silver coin variants • Live rates</Text></View>
              {silverCoins.map((coin, i) => <CoinCard key={coin.id || i} coin={coin} index={i} type="silver" price={getPriceFor(coin, "silver")} />)}
              <Text style={styles.footnote}>Prices inclusive of all taxes. Rates subject to market fluctuation.</Text>
            </>
          )}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f9fb" },
  scrollContent: { paddingBottom: 30 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e5e5",
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#242424" },

  tabWrapper: {
    flexDirection: "row", backgroundColor: "#f1f1f1",
    marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 4,
    position: "relative",
  },
  tabIndicator: {
    position: "absolute", top: 4, bottom: 4,
    width: "50%", borderRadius: 10,
  },
  tabButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 10, gap: 6, zIndex: 1,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: "#888" },
  activeGoldTabText: { color: "#8a6400" },
  activeSilverTabText: { color: "#444" },

  summaryBanner: {
    marginHorizontal: 12, marginTop: 10, backgroundColor: "#f5edd4",
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#d4a836",
  },
  summaryText: { fontSize: 12, fontWeight: "600", color: "#6b5300" },

  card: {
    marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 14,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e8e0cc",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardEven: { backgroundColor: "#fff" },
  cardOddGold: { backgroundColor: "#fdfaf4" },
  cardOddSilver: { backgroundColor: "#f9f9f9" },

  cardTop: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  coinName: { fontSize: 14, fontWeight: "700", color: "#3d3020", lineHeight: 18 },

  metaRow: { flexDirection: "row", marginTop: 4, gap: 6 },
  metaBadge: {
    fontSize: 10, fontWeight: "700", color: "#8a6400",
    backgroundColor: "#fef6e4",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden",
  },
  silverBadge: { color: "#555", backgroundColor: "#ececec" },

  priceRow: {
    flexDirection: "row", marginTop: 12,
    justifyContent: "flex-start", alignItems: "flex-start",
  },
  priceBlock: { alignItems: "flex-start" },
  priceLabel: {
    fontSize: 10, fontWeight: "700", color: "#999",
    marginBottom: 4, textTransform: "uppercase",
  },

  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { color: "#888", marginTop: 12, fontSize: 14 },
  errorTitle: { color: "#8a6400", fontSize: 18, fontWeight: "700" },
  errorSub: { color: "#999", fontSize: 13, marginTop: 6 },

  footnote: {
    fontSize: 11, color: "#aaa", textAlign: "center",
    marginTop: 16, paddingHorizontal: 20, fontStyle: "italic",
  },
});
