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
import {
  AdminSettings,
  getB2bCoinPremium,
  isCoinDisabled,
  loadSettings,
} from "../utils/adminSettings";
import { fetchLiveRates, RateItem } from "../utils/asawirScraper";
import { getGoldCoinList, getSilverCoinList } from "../utils/coinDefinitions";
import { B2BRetailer, checkB2BAuth, logoutRetailer } from "../utils/b2bStore";
import { buildGoldDistributorRates, buildSilverDistributorRates } from "../utils/mmtcDistributorRates";
import B2BLoginScreen from "./B2BLoginScreen";
import B2BRegisterScreen from "./B2BRegisterScreen";

type ViewMode = "landing" | "login" | "register" | "portal";

function getWeight(label: string): number | null {
  const halfMatch = label.match(/\.500/);
  if (halfMatch) return 0.5;
  const match = label.match(/([\d.]+)\s*(?:g|gm|gms|gram)/i);
  return match ? parseFloat(match[1]) : null;
}

/* ──── Price Flash ──── */
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

function CoinPrice({ value }: { value: string }) {
  const { dir, flash } = usePriceFlash(value);
  const color = dir === "up" ? "#22c55e" : dir === "down" ? "#ef4444" : "#1f1f1f";
  const bgColor = flash.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,255,255,0)", dir === "up" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"] });
  const display = value && value !== "-" ? `₹${Number(value).toLocaleString("en-IN")}` : "—";
  return (
    <Animated.View style={{ backgroundColor: bgColor, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color, fontWeight: "800", fontSize: 22 }}>{display}</Text>
    </Animated.View>
  );
}

/* ──── B2B Coin Card ──── */
function B2BCoinCard({ coin, type, b2bPrice }: {
  coin: RateItem; type: "gold" | "silver"; b2bPrice: number | null;
}) {
  const weight = getWeight(coin.label);
  const cleanLabel = coin.label.replace(/Excl(uding)?\s*gst/i, "").replace(/\s+/g, " ").trim();
  const isGold = type === "gold";
  const accentColor = isGold ? "#d4a836" : "#8a8a8a";

  return (
    <View style={[styles.card, isGold ? styles.cardGold : styles.cardSilver]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: isGold ? "#fef6e4" : "#f0f0f0" }]}>
          <Ionicons name="ellipse" size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.coinName}>{cleanLabel}</Text>
          <View style={styles.metaRow}>
            {weight && <Text style={[styles.metaBadge, !isGold && styles.silverBadge]}>{weight}g</Text>}
            <Text style={[styles.metaBadge, !isGold && styles.silverBadge]}>999.9 Purity</Text>
            <View style={styles.b2bTag}><Text style={styles.b2bTagText}>B2B</Text></View>
          </View>
        </View>
      </View>
      <View style={styles.priceSection}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>B2B PRICE</Text>
          <CoinPrice value={b2bPrice ? b2bPrice.toString() : "-"} />
        </View>
      </View>
    </View>
  );
}

/* ──── Landing View ──── */
function LandingView({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <View style={styles.landingWrap}>
      <View style={styles.landingIcon}>
        <Ionicons name="storefront" size={52} color="#8a6400" />
      </View>
      <Text style={styles.landingTitle}>B2B Retailer Portal</Text>
      <Text style={styles.landingSub}>
        Exclusive wholesale coin prices for approved jewellery retailers.{"\n"}
        Login or register to get access.
      </Text>
      <TouchableOpacity style={styles.loginBtn} onPress={onLogin}>
        <Ionicons name="log-in-outline" size={18} color="#fff" />
        <Text style={styles.loginBtnText}>Login as Retailer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.registerBtn} onPress={onRegister}>
        <Ionicons name="person-add-outline" size={18} color="#8a6400" />
        <Text style={styles.registerBtnText}>Register New Retailer</Text>
      </TouchableOpacity>
      <View style={styles.infoBadge}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#8a6400" />
        <Text style={styles.infoText}>Prices visible only after admin approval</Text>
      </View>
    </View>
  );
}

const SCREEN_W = Dimensions.get("window").width;

/* ──── B2B Coins Dashboard ──── */
function B2BDashboard({ retailer, onLogout }: { retailer: B2BRetailer; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0); // 0=gold 1=silver
  const pagerRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [goldCoins, setGoldCoins] = useState<RateItem[]>([]);
  const [silverCoins, setSilverCoins] = useState<RateItem[]>([]);
  const [goldBase, setGoldBase] = useState(0);   // per gram
  const [silverBase, setSilverBase] = useState(0); // per gram
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── One-time: coin lists (local) + settings ──
  const loadStaticData = async () => {
    try {
      // Coin lists are local — no API calls needed
      setGoldCoins(getGoldCoinList());
      setSilverCoins(getSilverCoinList());
      const s = await loadSettings();
      setSettings(s);
    } catch (e) { console.log("B2B static data error:", e); }
  };

  // ── Per-second: only MCX futures base rate ──
  const pollLiveRate = async () => {
    try {
      const mainRates = await fetchLiveRates();
      const goldFuture = mainRates.products.find((p) => p.label.toUpperCase().includes("GOLD") && p.label.toUpperCase().includes("FUTURE"));
      if (goldFuture) {
        const gf = parseFloat(goldFuture.sell) || parseFloat(goldFuture.buy);
        if (gf > 0) setGoldBase(gf / 10);
      }
      const silverFuture = mainRates.products.find((p) => p.label.toUpperCase().includes("SILVER") && p.label.toUpperCase().includes("FUTURE"));
      if (silverFuture) {
        const sf = parseFloat(silverFuture.sell) || parseFloat(silverFuture.buy);
        if (sf > 0) setSilverBase(sf / 1000);
      }
    } catch (e) { console.log("B2B live rate error:", e); }
    finally { setLoading(false); }
  };

  // ── Pull-to-refresh: reload everything ──
  const loadAll = async () => {
    await Promise.all([loadStaticData(), pollLiveRate()]);
  };

  useEffect(() => {
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const switchTab = (index: 0 | 1) => {
    setActiveTab(index);
    pagerRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
    Animated.spring(indicatorAnim, { toValue: index, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };

  const onSwipe = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W) as 0 | 1;
    if (p !== activeTab) {
      setActiveTab(p);
      Animated.spring(indicatorAnim, { toValue: p, useNativeDriver: false, tension: 60, friction: 10 }).start();
    }
  };

  const indLeft = indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "50%"] });

  const getPriceFor = (coin: RateItem, type: "gold" | "silver"): number | null => {
    if (!settings || isCoinDisabled(settings, coin.id, type)) return null;
    const weight = getWeight(coin.label);
    const base = type === "gold" ? goldBase : silverBase;
    if (!weight || base <= 0) return null;
    const distMap = type === "gold"
      ? buildGoldDistributorRates(base)
      : buildSilverDistributorRates(base);
    const distPrice = distMap[weight.toString()];
    if (!distPrice) return null;
    return Math.round(distPrice + getB2bCoinPremium(settings, coin.id, type));
  };

  return (
    <SafeAreaView style={styles.dashSafe}>
      {/* Header */}
      <View style={styles.dashHeader}>
        <View style={styles.dashHeaderLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="storefront" size={20} color="#8a6400" />
          </View>
          <View>
            <Text style={styles.dashRetailerName}>{retailer.name}</Text>
            <Text style={styles.dashBizName}>{retailer.businessName}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={16} color="#c62828" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* B2B Badge */}
      <View style={styles.b2bBadgeBar}>
        <Ionicons name="shield-checkmark" size={13} color="#8a6400" />
        <Text style={styles.b2bBadgeText}>B2B WHOLESALE COIN PRICES  •  LIVE</Text>
        <View style={styles.liveDot} />
      </View>

      {/* Gold / Silver Tabs */}
      <View style={styles.tabWrapper}>
        <Animated.View style={[
          styles.tabIndicatorB2b,
          { left: indLeft, backgroundColor: indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#fef6e4", "#f0f0f0"] }) },
        ]} />
        <TouchableOpacity onPress={() => switchTab(0)} style={[styles.tabBtn]}>
          <Ionicons name="ellipse" size={14} color={activeTab === 0 ? "#b8860b" : "#999"} />
          <Text style={[styles.tabText, activeTab === 0 && styles.activeGoldText]}>GOLD COINS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => switchTab(1)} style={[styles.tabBtn]}>
          <Ionicons name="ellipse" size={14} color={activeTab === 1 ? "#666" : "#999"} />
          <Text style={[styles.tabText, activeTab === 1 && styles.activeSilverText]}>SILVER COINS</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Pager */}
      <ScrollView
        ref={pagerRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16} onMomentumScrollEnd={onSwipe}
        decelerationRate="fast" style={{ flex: 1 }}
      >
        {/* Gold page */}
        <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing && activeTab === 0} onRefresh={onRefresh} tintColor="#8a6400" />}
        >
          {loading ? (
            <View style={styles.centerBox}><ActivityIndicator size="large" color="#8a6400" /><Text style={styles.loadingText}>Loading B2B coin prices…</Text></View>
          ) : goldCoins.length === 0 ? (
            <View style={styles.centerBox}><Text style={styles.errorTitle}>⚠ Rates unavailable</Text><Text style={styles.errorSub}>Pull down to refresh</Text></View>
          ) : (
            <>
              <View style={styles.summaryBanner}><Text style={styles.summaryText}>{goldCoins.length} gold coin variants • Exclusive B2B pricing</Text></View>
              {goldCoins.map((coin, i) => <B2BCoinCard key={coin.id || i} coin={coin} type="gold" b2bPrice={getPriceFor(coin, "gold")} />)}
              <Text style={styles.footnote}>B2B prices exclusive to approved retailers. Inclusive of all taxes & making charges.{"\n"}Rates subject to live market fluctuations.</Text>
            </>
          )}
        </ScrollView>

        {/* Silver page */}
        <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing && activeTab === 1} onRefresh={onRefresh} tintColor="#8a6400" />}
        >
          {loading ? (
            <View style={styles.centerBox}><ActivityIndicator size="large" color="#8a6400" /><Text style={styles.loadingText}>Loading B2B coin prices…</Text></View>
          ) : silverCoins.length === 0 ? (
            <View style={styles.centerBox}><Text style={styles.errorTitle}>⚠ Rates unavailable</Text><Text style={styles.errorSub}>Pull down to refresh</Text></View>
          ) : (
            <>
              <View style={styles.summaryBanner}><Text style={styles.summaryText}>{silverCoins.length} silver coin variants • Exclusive B2B pricing</Text></View>
              {silverCoins.map((coin, i) => <B2BCoinCard key={coin.id || i} coin={coin} type="silver" b2bPrice={getPriceFor(coin, "silver")} />)}
              <Text style={styles.footnote}>B2B prices exclusive to approved retailers. Inclusive of all taxes & making charges.{"\n"}Rates subject to live market fluctuations.</Text>
            </>
          )}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── Main B2B Portal Screen ──── */
export default function B2BPortalScreen() {
  const [view, setView] = useState<ViewMode>("landing");
  const [retailer, setRetailer] = useState<B2BRetailer | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await checkB2BAuth();
      if (r) { setRetailer(r); setView("portal"); }
      setChecking(false);
    })();
  }, []);

  const handleLogout = async () => {
    await logoutRetailer();
    setRetailer(null);
    setView("landing");
  };

  if (checking) {
    return <SafeAreaView style={styles.centered}><ActivityIndicator size="small" color="#8a6400" /></SafeAreaView>;
  }
  if (view === "login") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <B2BLoginScreen onLoginSuccess={(r) => { setRetailer(r); setView("portal"); }} onRegister={() => setView("register")} onBack={() => setView("landing")} />
      </SafeAreaView>
    );
  }
  if (view === "register") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <B2BRegisterScreen onBack={() => setView("landing")} />
      </SafeAreaView>
    );
  }
  if (view === "portal" && retailer) {
    return <B2BDashboard retailer={retailer} onLogout={handleLogout} />;
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
      <LandingView onLogin={() => setView("login")} onRegister={() => setView("register")} />
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9fb" },

  /* Landing */
  landingWrap: { flex: 1, backgroundColor: "#f8f9fb", alignItems: "center", justifyContent: "center", padding: 28 },
  landingIcon: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: "#fef6e4",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    borderWidth: 2, borderColor: "#d4a836",
  },
  landingTitle: { fontSize: 22, fontWeight: "800", color: "#222", marginBottom: 8 },
  landingSub: { fontSize: 13, color: "#777", textAlign: "center", lineHeight: 21, marginBottom: 28 },
  loginBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#8a6400",
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, marginBottom: 12, width: "100%", justifyContent: "center",
  },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  registerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#8a6400",
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28, marginBottom: 20, width: "100%", justifyContent: "center",
  },
  registerBtnText: { color: "#8a6400", fontWeight: "700", fontSize: 15 },
  infoBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef6e4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  infoText: { color: "#8a6400", fontSize: 12, fontWeight: "600" },

  /* Dashboard */
  dashSafe: { flex: 1, backgroundColor: "#f8f9fb" },
  dashHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e5e5e5",
  },
  dashHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#fef6e4",
    alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#d4a836",
  },
  dashRetailerName: { fontSize: 15, fontWeight: "800", color: "#222" },
  dashBizName: { fontSize: 12, color: "#888", marginTop: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "#fdd",
  },
  logoutText: { color: "#c62828", fontWeight: "700", fontSize: 12 },

  b2bBadgeBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef6e4", paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: "#e5d5a5",
  },
  b2bBadgeText: { fontSize: 11, fontWeight: "800", color: "#8a6400", flex: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },

  /* Tabs */
  tabWrapper: { flexDirection: "row", backgroundColor: "#f1f1f1", marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 4, position: "relative" },
  tabIndicatorB2b: { position: "absolute", top: 4, bottom: 4, width: "50%", borderRadius: 10 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6, zIndex: 1 },
  tabText: { fontSize: 13, fontWeight: "700", color: "#888" },
  activeGoldText: { color: "#8a6400" },
  activeSilverText: { color: "#444" },

  /* Coins */
  summaryBanner: {
    marginHorizontal: 12, marginTop: 10, backgroundColor: "#fef6e4",
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#d4a836",
  },
  summaryText: { fontSize: 11, fontWeight: "600", color: "#6b5300" },

  card: {
    marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 14,
    borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardGold: { backgroundColor: "#fdfaf4", borderColor: "#e8d9b0" },
  cardSilver: { backgroundColor: "#f9f9f9", borderColor: "#e0e0e0" },

  cardTop: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  coinName: { fontSize: 14, fontWeight: "700", color: "#3d3020", lineHeight: 18 },
  metaRow: { flexDirection: "row", marginTop: 4, gap: 6, flexWrap: "wrap" },
  metaBadge: {
    fontSize: 10, fontWeight: "700", color: "#8a6400", backgroundColor: "#fef6e4",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden",
  },
  silverBadge: { color: "#555", backgroundColor: "#ececec" },
  b2bTag: { backgroundColor: "#8a6400", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  b2bTagText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  priceSection: { marginTop: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-start" },
  priceBlock: {},
  priceLabel: { fontSize: 10, fontWeight: "700", color: "#999", marginBottom: 4, textTransform: "uppercase" },

  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { color: "#888", marginTop: 12, fontSize: 14 },
  errorTitle: { color: "#8a6400", fontSize: 18, fontWeight: "700" },
  errorSub: { color: "#999", fontSize: 13, marginTop: 6 },
  footnote: { fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 16, paddingHorizontal: 20, fontStyle: "italic", lineHeight: 17 },
});
