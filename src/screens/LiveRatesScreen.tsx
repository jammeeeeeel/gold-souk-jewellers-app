import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ArihantRateItem,
  ArihantRates,
  fetchAllArihantRates,
} from "../utils/arihantScraper";

/* ──── HELPERS ──── */
function fmt(val: string): string {
  if (!val || val === "-" || val === "0") return "-";
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  if (num >= 1000) return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function isTopBarItem(label: string): boolean {
  const l = label.toUpperCase();
  return l === "GOLD" || l === "USD INR" || l === "GOLD COST" || l === "SILVER" || l === "SILVER COSTING";
}

/* ──── MAIN SCREEN ──── */
type ActiveTab = "gold" | "silver" | "coins";

export default function LiveRatesScreen() {
  const [rates, setRates] = useState<ArihantRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("gold");
  const [error, setError] = useState<string | null>(null);
  const ratesRef = useRef<ArihantRates | null>(null);

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
      const data = await fetchAllArihantRates();
      if (data.gold.length > 0 || data.silver.length > 0 || data.coins.length > 0) {
        ratesRef.current = data;
        setRates(data);
        setError(null);
      } else if (!ratesRef.current) {
        setError("Market may be closed. Pull down to retry.");
      }
    } catch {
      if (!ratesRef.current) setError("Connection error. Pull down to retry.");
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
    const loadingTimer = setTimeout(() => setLoading(false), 4000);
    const interval = setInterval(() => loadRates(), 5000);
    return () => {
      clearTimeout(loadingTimer);
      clearInterval(interval);
    };
  }, []);

  // Active data
  const getActiveItems = (): ArihantRateItem[] => {
    if (!rates) return [];
    if (activeTab === "gold") return rates.gold;
    if (activeTab === "silver") return rates.silver;
    return rates.coins;
  };

  const allItems = getActiveItems();
  const summaryItems = allItems.filter((i) => isTopBarItem(i.label));
  const tableItems = allItems.filter((i) => !isTopBarItem(i.label));

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#8a6400" />
          <Text style={s.loadText}>Fetching live rates…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRates(true)} tintColor="#8a6400" />}
      >
        {/* Compact top bar */}
        <View style={s.topBar}>
          <View style={s.liveBadge}>
            <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
            <Text style={s.liveLabel}>LIVE</Text>
          </View>
          <View style={s.sourceTag}>
            <Ionicons name="globe-outline" size={10} color="#aaa" />
            <Text style={s.sourceText}>Arihant Spot • IBJA</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {(["gold", "silver", "coins"] as ActiveTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "coins" ? "cash-outline" : "ellipse"}
                size={tab === "coins" ? 14 : 8}
                color={activeTab === tab ? (tab === "gold" ? "#b8860b" : tab === "silver" ? "#666" : "#8a6400") : "#ccc"}
              />
              <Text style={[s.tabLabel, activeTab === tab && { color: tab === "gold" ? "#b8860b" : tab === "silver" ? "#555" : "#8a6400" }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {error && !rates && (
          <View style={s.errorBox}>
            <Ionicons name="cloud-offline-outline" size={40} color="#ccc" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Summary Cards */}
        {summaryItems.length > 0 && (
          <View style={s.cardsRow}>
            {summaryItems.map((item) => {
              const isUSD = item.label.toUpperCase().includes("USD");
              const isGold = item.label.toUpperCase().includes("GOLD");
              return (
                <View key={item.id} style={s.card}>
                  <View style={s.cardHead}>
                    <Ionicons
                      name={isUSD ? "swap-horizontal" : "ellipse"}
                      size={10}
                      color={isUSD ? "#1565c0" : isGold ? "#b8860b" : "#888"}
                    />
                    <Text style={s.cardLabel}>{item.label}</Text>
                  </View>
                  <Text style={s.cardPrice}>
                    {item.sell !== "-" ? fmt(item.sell) : fmt(item.buy)}
                  </Text>
                  <View style={s.cardHL}>
                    <Text style={s.hlText}>L: {fmt(item.low)}</Text>
                    <Text style={s.hlText}>H: {fmt(item.high)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Rate Table */}
        {tableItems.length > 0 && (
          <View style={s.tableContainer}>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 1.6 }]}>PRODUCT</Text>
              <Text style={[s.th, { flex: 1, textAlign: "center" }]}>BUY</Text>
              <Text style={[s.th, { flex: 1, textAlign: "center" }]}>SELL</Text>
            </View>
            {tableItems.map((item, idx) => (
              <View key={item.id} style={[s.row, idx % 2 === 0 ? s.rowEven : s.rowOdd]}>
                <View style={{ flex: 1.6 }}>
                  <Text style={s.prodName}>{item.label}</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={s.price}>{fmt(item.buy)}</Text>
                  <Text style={s.sub}>L: {fmt(item.low)}</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={[s.price, { color: "#8a6400" }]}>{fmt(item.sell)}</Text>
                  <Text style={s.sub}>H: {fmt(item.high)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No Data */}
        {rates && allItems.length === 0 && (
          <View style={s.errorBox}>
            <Ionicons name="information-circle-outline" size={36} color="#ccc" />
            <Text style={s.errorText}>No rates available for this category right now.</Text>
          </View>
        )}

        {/* Timestamp */}
        {rates && (
          <View style={s.tsRow}>
            <Ionicons name="time-outline" size={12} color="#bbb" />
            <Text style={s.tsText}>Updated: {new Date(rates.fetchedAt).toLocaleTimeString("en-IN")}</Text>
            <Text style={s.tsHint}>• Auto-refreshes every 5s</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f9fb" },
  scroll: { paddingBottom: 30 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadText: { fontSize: 13, color: "#888" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0e6c8",
  },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#e8f5e9", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveLabel: { fontSize: 10, fontWeight: "800", color: "#2e7d32", letterSpacing: 1 },
  sourceTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  sourceText: { fontSize: 10, color: "#aaa" },

  tabRow: {
    flexDirection: "row", marginHorizontal: 14, marginTop: 10,
    backgroundColor: "#f1f1f1", borderRadius: 12, padding: 3,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: "700", color: "#999" },

  /* Summary Cards */
  cardsRow: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 14, paddingTop: 14, gap: 10,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    minWidth: 140, flex: 1, borderWidth: 1, borderColor: "#f0e6c8",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  cardLabel: { fontSize: 11, fontWeight: "700", color: "#888", textTransform: "uppercase" },
  cardPrice: { fontSize: 20, fontWeight: "800", color: "#333" },
  cardHL: { flexDirection: "row", gap: 10, marginTop: 4 },
  hlText: { fontSize: 10, color: "#aaa" },

  /* Table */
  tableContainer: {
    marginHorizontal: 14, marginTop: 14, borderRadius: 14,
    borderWidth: 1, borderColor: "#f0f0f0", overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableHead: {
    flexDirection: "row", paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: "#8a6400",
  },
  th: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.8 },
  row: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  rowEven: { backgroundColor: "#fff" },
  rowOdd: { backgroundColor: "#fafaf7" },
  prodName: { fontSize: 13, fontWeight: "700", color: "#333" },
  price: { fontSize: 14, fontWeight: "800", color: "#333" },
  sub: { fontSize: 10, color: "#bbb", marginTop: 2 },

  errorBox: {
    alignItems: "center", gap: 12, paddingVertical: 40,
    marginHorizontal: 14, marginTop: 20,
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#f0f0f0",
  },
  errorText: { fontSize: 14, color: "#888", textAlign: "center" },

  tsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 16,
  },
  tsText: { fontSize: 11, color: "#bbb" },
  tsHint: { fontSize: 11, color: "#ccc" },
});
