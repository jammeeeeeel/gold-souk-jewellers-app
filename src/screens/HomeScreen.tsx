import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import TickerBar from "../components/TickerBar";
import { AdminSettings, getCoinDisplayName, getCoinPremium, getCoinPriceOffset, isCoinDisabled, loadSettings } from "../utils/adminSettings";
import { fetchCoinRates, fetchLiveRates, fetchSilverCoinRates, RateItem, RatesData } from "../utils/asawirScraper";
import { buildGoldDistributorRates, buildSilverDistributorRates } from "../utils/mmtcDistributorRates";
import { fetchMmtcAllPrices, MmtcWeightPriceMap } from "../utils/mmtcPampScraper";

/* ──────── RESPONSIVE HOOK ──────── */
function useScreenDimensions() {
  const [dims, setDims] = useState(Dimensions.get("window"));
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);
  return dims;
}

const DESKTOP_BREAKPOINT = 900;

/* ──────── PRICE DIRECTION TRACKER ──────── */
type Direction = "up" | "down" | "none";

function useFlashColor(value: string): { color: string | null; flash: Animated.Value } {
  const prev = useRef(value);
  const flash = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState<Direction>("none");

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

  const color = dir === "up" ? "#22c55e" : dir === "down" ? "#ef4444" : null;
  return { color, flash };
}

/* ──────── ANIMATED PRICE TEXT ──────── */
function PriceText({ value, style }: { value: string; style?: any }) {
  const { color, flash } = useFlashColor(value);

  const bgColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0)", color === "#22c55e" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"],
  });

  // Only override color when flashing (up/down); otherwise let the style prop's color apply
  const colorOverride = color ? { color } : {};

  return (
    <Animated.View style={{ backgroundColor: bgColor, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 }}>
      <Text style={[style, colorOverride]}>{value}</Text>
    </Animated.View>
  );
}

/* ──────── SKELETON SHIMMER ──────── */
function SkeletonBlock({ width, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const bg = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["#e0e0e0", "#f5f5f5"],
  });
  const bgDark = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["#2a2d38", "#363a48"],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: style?.__dark ? bgDark : bg },
        style,
      ]}
    />
  );
}

/* ──────── SKELETON: Top Banner ──────── */
function SkeletonTopBanner({ isDesktop }: { isDesktop: boolean }) {
  return (
    <View style={[
      styles.topBannerRow,
      isDesktop && dStyles.topBannerRow,
      { borderColor: isDesktop ? '#d4a83630' : '#e0e0e0' },
    ]}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.topBannerCell, isDesktop && dStyles.topBannerCell, { borderRightColor: isDesktop ? '#ffffff08' : '#f0f0f0' }]}>
          <SkeletonBlock width={isDesktop ? 100 : 60} height={isDesktop ? 14 : 10} style={isDesktop ? { __dark: true } : undefined} />
          <View style={{ height: isDesktop ? 12 : 6 }} />
          <SkeletonBlock width={isDesktop ? 140 : 80} height={isDesktop ? 36 : 20} style={isDesktop ? { __dark: true } : undefined} />
          <View style={{ height: isDesktop ? 10 : 4 }} />
          <SkeletonBlock width={isDesktop ? 110 : 70} height={isDesktop ? 12 : 8} style={isDesktop ? { __dark: true } : undefined} />
        </View>
      ))}
    </View>
  );
}

/* ──────── SKELETON: Live Rates ──────── */
function SkeletonLiveRates({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <View style={dStyles.liveRatesContainer}>
        <View style={dStyles.liveRatesHeader}>
          <SkeletonBlock width={12} height={12} borderRadius={6} style={{ __dark: true, marginRight: 10 }} />
          <SkeletonBlock width={160} height={22} style={{ __dark: true }} />
        </View>
        {[1, 2].map((i) => (
          <View key={i} style={[dStyles.liveRateCard, { borderLeftColor: i === 1 ? '#d4a83640' : '#8a8a8a40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <SkeletonBlock width={40} height={40} borderRadius={12} style={{ __dark: true }} />
              <SkeletonBlock width={200} height={22} style={{ __dark: true }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBlock width={50} height={12} style={{ __dark: true }} />
                <View style={{ height: 10 }} />
                <SkeletonBlock width={140} height={38} style={{ __dark: true }} />
                <View style={{ height: 8 }} />
                <SkeletonBlock width={80} height={12} style={{ __dark: true }} />
              </View>
              <View style={{ width: 1, height: 60, backgroundColor: '#ffffff10' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBlock width={50} height={12} style={{ __dark: true }} />
                <View style={{ height: 10 }} />
                <SkeletonBlock width={140} height={38} style={{ __dark: true }} />
                <View style={{ height: 8 }} />
                <SkeletonBlock width={80} height={12} style={{ __dark: true }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Mobile skeleton
  return (
    <View style={styles.tableWrap}>
      <View style={[styles.sectionTitleBar, { borderBottomColor: '#e0e0e0' }]}>
        <SkeletonBlock width={8} height={8} borderRadius={4} />
        <SkeletonBlock width={100} height={12} style={{ marginLeft: 8 }} />
      </View>
      <View style={[styles.tableHeader, { backgroundColor: '#f0f0f0' }]}>
        <SkeletonBlock width={80} height={12} style={{ flex: 1.5 } as any} />
        <SkeletonBlock width={50} height={12} style={{ flex: 1 } as any} />
        <SkeletonBlock width={50} height={12} style={{ flex: 1 } as any} />
      </View>
      {[1, 2].map((i) => (
        <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
          <View style={{ flex: 1.5 }}>
            <SkeletonBlock width={100} height={14} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={70} height={18} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width={50} height={8} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={70} height={18} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width={50} height={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ──────── SKELETON: MMTC Coins Table ──────── */
function SkeletonCoinsTable({ isGold, isDesktop }: { isGold: boolean; isDesktop: boolean }) {
  const accentColor = isGold ? '#d4a836' : '#8a8a8a';
  const rowCount = isGold ? 5 : 4;

  if (isDesktop) {
    return (
      <View style={[dStyles.mmtcTableWrap, { borderColor: accentColor + '40' }]}>
        <View style={[dStyles.mmtcTableTitle, { backgroundColor: isGold ? '#d4a83610' : '#8a8a8a10' }]}>
          <SkeletonBlock width={16} height={16} borderRadius={8} style={{ __dark: true }} />
          <SkeletonBlock width={200} height={22} style={{ __dark: true, marginLeft: 12 }} />
        </View>
        <View style={[dStyles.mmtcHeader, { backgroundColor: isGold ? '#d4a83608' : '#8a8a8a08' }]}>
          <SkeletonBlock width={120} height={12} style={{ __dark: true, flex: 1.4 } as any} />
          <SkeletonBlock width={70} height={12} style={{ __dark: true, flex: 1 } as any} />
          <SkeletonBlock width={70} height={12} style={{ __dark: true, flex: 1 } as any} />
        </View>
        {Array.from({ length: rowCount }).map((_, i) => (
          <View key={i} style={[dStyles.mmtcRow, i % 2 === 0 ? dStyles.mmtcRowEven : dStyles.mmtcRowOdd]}>
            <View style={{ flex: 1.4 }}>
              <SkeletonBlock width={160} height={18} style={{ __dark: true }} />
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <SkeletonBlock width={100} height={24} style={{ __dark: true }} />
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <SkeletonBlock width={100} height={24} style={{ __dark: true }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Mobile skeleton
  return (
    <View style={[styles.mmtcTableWrap, { borderColor: accentColor }]}>
      <View style={[styles.mmtcTableTitle, { backgroundColor: isGold ? '#fef6e4' : '#f0f0f0' }]}>
        <SkeletonBlock width={10} height={10} borderRadius={5} />
        <SkeletonBlock width={150} height={14} style={{ marginLeft: 8 }} />
      </View>
      <View style={[styles.mmtcHeader, { backgroundColor: isGold ? '#f5edd4' : '#e8e8e8' }]}>
        <SkeletonBlock width={80} height={10} style={{ flex: 1.4 } as any} />
        <SkeletonBlock width={50} height={10} style={{ flex: 1 } as any} />
        <SkeletonBlock width={50} height={10} style={{ flex: 1 } as any} />
      </View>
      {Array.from({ length: rowCount }).map((_, i) => (
        <View key={i} style={[styles.mmtcRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
          <View style={{ flex: 1.4 }}>
            <SkeletonBlock width={100} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={60} height={14} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={60} height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ──────── FULL SKELETON LAYOUT ──────── */
function SkeletonLayout({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <>
        <SkeletonTopBanner isDesktop />
        <View style={dStyles.columnsContainer}>
          <View style={dStyles.leftColumn}>
            <SkeletonLiveRates isDesktop />
          </View>
          <View style={dStyles.rightColumn}>
            <SkeletonCoinsTable isGold isDesktop />
            <SkeletonCoinsTable isGold={false} isDesktop />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <SkeletonTopBanner isDesktop={false} />
      <SkeletonLiveRates isDesktop={false} />
      <SkeletonCoinsTable isGold isDesktop={false} />
      <SkeletonCoinsTable isGold={false} isDesktop={false} />
    </>
  );
}

/* ──────── PULSING LIVE DOT ──────── */
function LiveDot({ size = 10 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#22c55e",
        opacity: pulse,
        marginRight: 6,
      }}
    />
  );
}

/* ──────── TOP BANNER — Wide Glass Cards ──────── */
function TopBanner({ items, isDesktop }: { items: RateItem[]; isDesktop: boolean }) {
  if (items.length === 0) return null;
  return (
    <View style={[styles.topBannerRow, isDesktop && dStyles.topBannerRow]}>
      {items.map((item, i) => (
        <View key={item.id || i} style={[styles.topBannerCell, isDesktop && dStyles.topBannerCell]}>
          <Text style={[styles.topBannerLabel, isDesktop && dStyles.topBannerLabel]}>{item.label}</Text>
          <PriceText
            value={item.buy && item.buy !== "-" ? item.buy : item.sell}
            style={[styles.topBannerValue, isDesktop && dStyles.topBannerValue]}
          />
          <Text style={[styles.topBannerHL, isDesktop && dStyles.topBannerHL]}>
            L {item.low} | H {item.high}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ──────── LIVE RATES — Desktop: Vertical Bold Cards / Mobile: Table ──────── */
function LiveRatesSection({ items, updatedAt, isDesktop }: { items: RateItem[]; updatedAt: string | null; isDesktop: boolean }) {
  const futuresOnly = items.filter((item) => {
    const label = item.label.toUpperCase();
    return (label.includes("GOLD") && label.includes("FUTURE")) ||
      (label.includes("SILVER") && label.includes("FUTURE"));
  });
  if (futuresOnly.length === 0) return null;

  if (isDesktop) {
    // Desktop: Large bold vertical cards that fill the left column
    return (
      <View style={dStyles.liveRatesContainer}>
        {/* Section Header */}
        <View style={dStyles.liveRatesHeader}>
          <LiveDot size={12} />
          <Text style={dStyles.liveRatesTitle}>LIVE RATES</Text>
        </View>

        {/* Rate Cards - Vertical Stack */}
        {futuresOnly.map((item, i) => {
          const isGold = item.label.toUpperCase().includes("GOLD");
          return (
            <View
              key={item.id || i}
              style={[
                dStyles.liveRateCard,
                { borderLeftColor: isGold ? "#d4a836" : "#8a8a8a" },
              ]}
            >
              <View style={dStyles.liveRateCardHeader}>
                <View style={[dStyles.liveRateIconBadge, { backgroundColor: isGold ? "#fef6e4" : "#f0f0f0" }]}>
                  <Ionicons name="ellipse" size={16} color={isGold ? "#d4a836" : "#8a8a8a"} />
                </View>
                <Text style={dStyles.liveRateProductName}>{item.label}</Text>
              </View>
              <View style={dStyles.liveRatePrices}>
                <View style={dStyles.liveRatePriceBlock}>
                  <Text style={dStyles.liveRatePriceLabel}>BUY</Text>
                  <PriceText value={item.buy} style={dStyles.liveRatePriceValue} />
                  <Text style={dStyles.liveRateHL}>Low: {item.low}</Text>
                </View>
                <View style={dStyles.liveRateDivider} />
                <View style={dStyles.liveRatePriceBlock}>
                  <Text style={dStyles.liveRatePriceLabel}>SELL</Text>
                  <PriceText value={item.sell} style={dStyles.liveRateSellValue} />
                  <Text style={dStyles.liveRateHL}>High: {item.high}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Updated timestamp */}
        <View style={dStyles.liveRatesTimestamp}>
          <Ionicons name="time-outline" size={14} color="#bbb" />
          <Text style={dStyles.liveRatesTimestampText}>
            Updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--:--:--"}
          </Text>
          <Text style={dStyles.liveRatesAutoRefresh}>• Auto-refreshes every 3s</Text>
        </View>
      </View>
    );
  }

  // Mobile: compact table
  return (
    <View style={styles.tableWrap}>
      <View style={styles.sectionTitleBar}>
        <LiveDot size={8} />
        <Text style={styles.sectionTitleText}>LIVE RATES</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, { flex: 1.5 }]}>PRODUCT</Text>
        <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>BUY</Text>
        <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>SELL</Text>
      </View>
      {futuresOnly.map((item, i) => (
        <View
          key={item.id || i}
          style={[styles.tableRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}
        >
          <View style={{ flex: 1.5 }}>
            <Text style={styles.productName}>{item.label}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <PriceText value={item.buy} style={styles.priceText} />
            <Text style={styles.hlSmall}>L : {item.low}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <PriceText value={item.sell} style={styles.priceText} />
            <Text style={styles.hlSmall}>H : {item.high}</Text>
          </View>
        </View>
      ))}
      <View style={styles.updatedRow}>
        <Text style={styles.updatedText}>
          Updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--:--:--"}
        </Text>
      </View>
    </View>
  );
}

/* ──────── Extract weight from coin label ──────── */
function getWeight(label: string): number | null {
  const halfMatch = label.match(/\.500/);
  if (halfMatch) return 0.5;
  const match = label.match(/([\d.]+)\s*(?:g|gm|gms|gram)/i);
  return match ? parseFloat(match[1]) : null;
}

/* ──────── MMTC COINS TABLE ──────── */
function MmtcCoinsTable({
  title,
  coins,
  type,
  settings,
  basePerGram,
  mmtcPrices,
  isDesktop,
}: {
  title: string;
  coins: RateItem[];
  type: "gold" | "silver";
  settings: AdminSettings | null;
  basePerGram: number;
  mmtcPrices: MmtcWeightPriceMap;
  isDesktop: boolean;
}) {
  if (coins.length === 0) return null;
  const isGold = type === "gold";
  const accentColor = isGold ? "#d4a836" : "#8a8a8a";

  const cleanLabel = (coin: RateItem) => settings
    ? getCoinDisplayName(settings, coin.id, coin.label)
    : coin.label.replace(/Excl(uding)?\s*gst/i, "").replace(/\s+/g, " ").trim();

  const rows: { label: string; price: number | null }[] = coins.map((coin) => {
    if (!settings || isCoinDisabled(settings, coin.id, type)) {
      return { label: cleanLabel(coin), price: null };
    }
    const weight = getWeight(coin.label);
    if (!weight) return { label: cleanLabel(coin), price: null };

    const weightKey = weight.toString();
    const premium = getCoinPremium(settings, coin.id, type);
    const offset = getCoinPriceOffset(settings, coin.id, type);

    // Get base price from live market (distributor rate or MMTC scraper)
    let basePrice: number | null = null;
    if (basePerGram > 0) {
      const distMap = type === "gold"
        ? buildGoldDistributorRates(basePerGram)
        : buildSilverDistributorRates(basePerGram);
      const distPrice = distMap[weightKey];
      if (distPrice && distPrice > 0) basePrice = Math.round(distPrice);
    }
    if (!basePrice) {
      const mmtcBase = mmtcPrices[weightKey];
      if (mmtcBase && mmtcBase > 0) basePrice = Math.round(mmtcBase);
    }

    // Custom price = base + offset (offset is constant, base moves with market)
    // Selling price = custom price + premium
    const sellingPrice = basePrice ? Math.round(basePrice + offset + premium) : null;

    return {
      label: cleanLabel(coin),
      price: sellingPrice,
    };
  });

  // Desktop-aware colors
  const titleBg = isDesktop
    ? (isGold ? "#d4a83615" : "#8a8a8a15")
    : (isGold ? "#fef6e4" : "#f0f0f0");
  const headerBg = isDesktop
    ? (isGold ? "#d4a83610" : "#8a8a8a10")
    : (isGold ? "#f5edd4" : "#e8e8e8");
  const titleColor = isDesktop
    ? (isGold ? "#d4a836" : "#aaa")
    : (isGold ? "#8a6400" : "#555");

  return (
    <View style={[styles.mmtcTableWrap, { borderColor: accentColor }, isDesktop && dStyles.mmtcTableWrap]}>
      {/* Title */}
      <View style={[styles.mmtcTableTitle, { backgroundColor: titleBg }, isDesktop && dStyles.mmtcTableTitle]}>
        <Ionicons name="ellipse" size={isDesktop ? 16 : 10} color={accentColor} />
        <Text style={[styles.mmtcTableTitleText, { color: titleColor }, isDesktop && dStyles.mmtcTableTitleText]}>{title}</Text>
      </View>

      {/* Header */}
      <View style={[styles.mmtcHeader, { backgroundColor: headerBg }, isDesktop && dStyles.mmtcHeader]}>
        <Text style={[styles.mmtcTh, { flex: 1.4 }, isDesktop && dStyles.mmtcTh]}>DENOMINATION</Text>
        <Text style={[styles.mmtcTh, { flex: 1, textAlign: "center" }, isDesktop && dStyles.mmtcTh]}>RATE</Text>
      </View>

      {/* Rows */}
      {rows.map((row, i) => (
        <View key={i} style={[styles.mmtcRow, i % 2 === 0 ? (isDesktop ? dStyles.mmtcRowEven : styles.rowEven) : (isDesktop ? dStyles.mmtcRowOdd : styles.rowOdd), isDesktop && dStyles.mmtcRow]}>
          <View style={{ flex: 1.4 }}>
            <Text style={[styles.mmtcDenomName, isDesktop && dStyles.mmtcDenomName]}>{row.label}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            {row.price ? (
              <PriceText value={`\u20B9${row.price.toLocaleString("en-IN")}`} style={[styles.mmtcSellPrice, isDesktop && dStyles.mmtcSellPrice]} />
            ) : (
              <Text style={[styles.mmtcDash, isDesktop && dStyles.mmtcDash]}>—</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ──────── MAIN SCREEN ──────── */
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth, height: screenHeight } = useScreenDimensions();
  const isDesktop = Platform.OS === "web" && screenWidth >= DESKTOP_BREAKPOINT;

  // Force no horizontal overflow on web
  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = "html, body, #root { overflow-x: hidden !important; max-width: 100vw !important; }";
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
  }, []);

  const [data, setData] = useState<RatesData>({
    topBar: [],
    products: [],
    updated_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // MMTC coin data
  const [goldCoins, setGoldCoins] = useState<RateItem[]>([]);
  const [silverCoins, setSilverCoins] = useState<RateItem[]>([]);
  const [goldBasePerGram, setGoldBasePerGram] = useState(0);
  const [silverBasePerGram, setSilverBasePerGram] = useState(0);
  const [mmtcGoldPrices, setMmtcGoldPrices] = useState<MmtcWeightPriceMap>({});
  const [mmtcSilverPrices, setMmtcSilverPrices] = useState<MmtcWeightPriceMap>({});
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [mmtcLoading, setMmtcLoading] = useState(true);

  const dataRef = useRef(data);
  dataRef.current = data;

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
      console.log("Static data error:", e);
    } finally {
      setMmtcLoading(false);
    }
  };

  const loadRates = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetchLiveRates();
      if (res.topBar.length > 0 || res.products.length > 0) {
        setData(res);

        const goldFuture = res.products.find(
          (p) => p.label.toUpperCase().includes("GOLD") && p.label.toUpperCase().includes("FUTURE")
        );
        if (goldFuture) {
          const gfSell = parseFloat(goldFuture.sell) || parseFloat(goldFuture.buy);
          if (gfSell > 0) setGoldBasePerGram(gfSell / 10);
        }
        const silverFuture = res.products.find(
          (p) => p.label.toUpperCase().includes("SILVER") && p.label.toUpperCase().includes("FUTURE")
        );
        if (silverFuture) {
          const sfSell = parseFloat(silverFuture.sell) || parseFloat(silverFuture.buy);
          if (sfSell > 0) setSilverBasePerGram(sfSell / 1000);
        }
      }
    } catch (e) {
      console.log("Fetch error:", e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const reloadSettings = async () => {
    try {
      const s = await loadSettings();
      setSettings(s);
    } catch { }
  };

  useEffect(() => {
    loadStaticData();
    loadRates();
    const rateInterval = setInterval(() => loadRates(), 3000);
    const settingsInterval = setInterval(() => reloadSettings(), 5000);
    return () => {
      clearInterval(rateInterval);
      clearInterval(settingsInterval);
    };
  }, []);

  const hasData = data.topBar.length > 0 || data.products.length > 0;

  return (
    <SafeAreaView style={[styles.screen, isDesktop && dStyles.screen]}>
      <ScrollView
        style={[styles.scroll, isDesktop && dStyles.scroll]}
        contentContainerStyle={[styles.scrollContent, isDesktop && dStyles.scrollContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadStaticData();
              loadRates(true);
            }}
            tintColor="#8a6400"
          />
        }
      >
        {/* ── HEADER ── */}
        <View style={[styles.header, isDesktop && dStyles.header]}>
          <Pressable style={{ marginRight: 0 }}>
            <View style={[styles.logoCircle, isDesktop && dStyles.logoCircle]}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={[styles.logo, isDesktop && dStyles.logo]}
              />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shopName, isDesktop && dStyles.shopName]}>JEWEL SOUK</Text>
            <Text style={[styles.shopTag, isDesktop && dStyles.shopTag]}>Live Bullion Rates</Text>
          </View>
          <TouchableOpacity
            style={[styles.adminBtn, isDesktop && dStyles.adminBtn]}
            onPress={() => navigation.navigate("AdminPortal")}
          >
            <Ionicons name="shield-checkmark" size={isDesktop ? 20 : 16} color="#8a6400" />
            <Text style={[styles.adminBtnText, isDesktop && dStyles.adminBtnText]}>Admin</Text>
          </TouchableOpacity>
        </View>

        {/* ── TICKER ── */}
        <TickerBar />

        {/* ── CONTENT ── */}
        {loading ? (
          <SkeletonLayout isDesktop={isDesktop} />
        ) : !hasData ? (
          <View style={[styles.centerBox, isDesktop && { minHeight: screenHeight - 200 }]}>
            <Text style={styles.errorTitle}>⚠ Rates unavailable</Text>
            <Text style={styles.errorSub}>Pull down to refresh</Text>
          </View>
        ) : isDesktop ? (
          /* ══════ DESKTOP FULL-WIDTH LAYOUT ══════ */
          <>
            {/* Top Banner spans full width */}
            <TopBanner items={data.topBar} isDesktop={isDesktop} />

            {/* Two-column body: Live Rates LEFT | Coin Tables RIGHT */}
            <View style={dStyles.columnsContainer}>
              {/* ── LEFT COLUMN: Live Rates ── */}
              <View style={dStyles.leftColumn}>
                <LiveRatesSection items={data.products} updatedAt={data.updated_at} isDesktop={isDesktop} />
              </View>

              {/* ── RIGHT COLUMN: Coin Tables ── */}
              <View style={dStyles.rightColumn}>
                {mmtcLoading ? (
                  <>
                    <SkeletonCoinsTable isGold isDesktop />
                    <SkeletonCoinsTable isGold={false} isDesktop />
                  </>
                ) : (
                  <>
                    <MmtcCoinsTable
                      title="MMTC GOLD COINS"
                      coins={goldCoins}
                      type="gold"
                      settings={settings}
                      basePerGram={goldBasePerGram}
                      mmtcPrices={mmtcGoldPrices}
                      isDesktop={isDesktop}
                    />
                    <MmtcCoinsTable
                      title="MMTC SILVER COINS"
                      coins={silverCoins}
                      type="silver"
                      settings={settings}
                      basePerGram={silverBasePerGram}
                      mmtcPrices={mmtcSilverPrices}
                      isDesktop={isDesktop}
                    />
                  </>
                )}
              </View>
            </View>

            <Text style={[styles.footnote, dStyles.footnote]}>
              Prices inclusive of all taxes. Rates subject to market fluctuation.
            </Text>
          </>
        ) : (
          /* ══════ MOBILE STACKED LAYOUT ══════ */
          <>
            <TopBanner items={data.topBar} isDesktop={false} />
            <LiveRatesSection items={data.products} updatedAt={data.updated_at} isDesktop={false} />

            {mmtcLoading ? (
              <>
                <SkeletonCoinsTable isGold isDesktop={false} />
                <SkeletonCoinsTable isGold={false} isDesktop={false} />
              </>
            ) : (
              <>
                <MmtcCoinsTable
                  title="MMTC GOLD COINS"
                  coins={goldCoins}
                  type="gold"
                  settings={settings}
                  basePerGram={goldBasePerGram}
                  mmtcPrices={mmtcGoldPrices}
                  isDesktop={false}
                />
                <MmtcCoinsTable
                  title="MMTC SILVER COINS"
                  coins={silverCoins}
                  type="silver"
                  settings={settings}
                  basePerGram={silverBasePerGram}
                  mmtcPrices={mmtcSilverPrices}
                  isDesktop={false}
                />
              </>
            )}

            <Text style={styles.footnote}>
              Prices inclusive of all taxes. Rates subject to market fluctuation.
            </Text>
          </>
        )}
        {/* <Text style={[styles.poweredBy, isDesktop && dStyles.poweredBy]}>
          Powered By{" "}
          <Text
            style={[styles.poweredByLink, isDesktop && dStyles.poweredByLink]}
            onPress={() => Linking.openURL("https://thescaleroom.in")}
          >
            The Scale Room
          </Text>
        </Text> */}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──────── STYLES — MOBILE / BASE ──────── */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    ...(Platform.OS === "web" ? { alignItems: "center" as const } : {}),
  },
  scroll: {
    flex: 1,
    ...(Platform.OS === "web" ? { width: "100%" as any } : {}),
  },
  scrollContent: {
    paddingBottom: 30,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#d4a836",
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  shopName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#242424",
  },
  shopTag: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#fef6e4",
    borderWidth: 1,
    borderColor: "#e8d9b0",
  },
  adminBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a6400",
  },

  /* ── Section Title ── */
  sectionTitleBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d4a836",
    backgroundColor: "#fffbf0",
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8a6400",
    letterSpacing: 1,
  },

  /* ── Top Banner ── */
  topBannerRow: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d4a836",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topBannerCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e5e5e5",
  },
  topBannerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a6400",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  topBannerValue: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1f1f1f",
  },
  topBannerHL: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },

  /* ── Live Rates Table (Mobile) ── */
  tableWrap: {
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d4a836",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5edd4",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d4a836",
  },
  thText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6b5300",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowEven: {
    backgroundColor: "#ffffff",
  },
  rowOdd: {
    backgroundColor: "#fafafa",
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b3d2a",
    lineHeight: 18,
  },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  hlSmall: {
    fontSize: 10,
    color: "#aaa",
    marginTop: 2,
  },
  updatedRow: {
    backgroundColor: "#fafafa",
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  updatedText: {
    fontSize: 11,
    color: "#999",
  },

  /* ── MMTC Coins Table ── */
  mmtcTableWrap: {
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mmtcTableTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  mmtcTableTitleText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mmtcHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  mmtcTh: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b5300",
    letterSpacing: 0.5,
  },
  mmtcRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  mmtcDenomName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3d3020",
    lineHeight: 16,
  },
  mmtcBuyPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  mmtcSellPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22c55e",
  },
  mmtcDash: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ccc",
  },

  /* ── Footnote ── */
  footnote: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    fontStyle: "italic",
  },
  poweredBy: {
    marginTop: 14,
    marginBottom: 8,
    textAlign: "center",
    fontSize: 12,
    color: "#8a8a8a",
  },
  poweredByLink: {
    color: "#8a6400",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* ── States ── */
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: "#888",
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: "#8a6400",
    fontSize: 18,
    fontWeight: "700",
  },
  errorSub: {
    color: "#999",
    fontSize: 13,
    marginTop: 6,
  },
});

/* ──────── DESKTOP OVERRIDES — Full Viewport ──────── */
const dStyles = StyleSheet.create({
  screen: {
    backgroundColor: "#0f1117",
    alignItems: "stretch" as any,
    overflow: "hidden" as any,
    ...(Platform.OS === "web" ? { maxWidth: "100vw" } : {}),
  },
  scroll: {
    maxWidth: undefined as any,
    width: "100%" as any,
    ...(Platform.OS === "web" ? { maxWidth: "100vw" } : {}),
  },
  scrollContent: {
    paddingBottom: 40,
    overflow: "hidden" as any,
    ...(Platform.OS === "web" ? { maxWidth: "100vw" } : {}),
  },

  /* ── Header (Desktop) ── */
  header: {
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#181b22",
    borderBottomWidth: 2,
    borderBottomColor: "#d4a83640",
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    marginRight: 16,
    borderWidth: 3,
    borderColor: "#d4a836",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  shopName: {
    fontSize: 28,
    fontWeight: "900" as any,
    letterSpacing: 3,
    color: "#f5f0e8",
  },
  shopTag: {
    fontSize: 14,
    marginTop: 2,
    color: "#d4a836",
    fontWeight: "600" as any,
    letterSpacing: 1,
  },
  adminBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#d4a83615",
    borderColor: "#d4a83650",
  },
  adminBtnText: {
    fontSize: 14,
    color: "#d4a836",
  },

  /* ── Top Banner (Desktop) ── */
  topBannerRow: {
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#d4a83660",
    backgroundColor: "#1a1d26",
    shadowColor: "#d4a836",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    overflow: "hidden" as any,
    ...(Platform.OS === "web" ? { boxSizing: "border-box" } : {}),
  },
  topBannerCell: {
    paddingVertical: 24,
    borderRightColor: "#ffffff10",
  },
  topBannerLabel: {
    fontSize: 15,
    marginBottom: 8,
    letterSpacing: 2,
    color: "#d4a836",
  },
  topBannerValue: {
    fontSize: 36,
    fontWeight: "900" as any,
    color: "#f5f0e8",
  },
  topBannerHL: {
    fontSize: 13,
    marginTop: 8,
    color: "#888",
  },

  /* ── Two-column layout ── */
  columnsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginTop: 28,
    gap: 24,
    alignItems: "flex-start",
    overflow: "hidden" as any,
    ...(Platform.OS === "web" ? { boxSizing: "border-box", maxWidth: "100vw" } : {}),
  },
  leftColumn: {
    flex: 4,
    minWidth: 0,
    overflow: "hidden" as any,
  },
  rightColumn: {
    flex: 6,
    minWidth: 0,
    overflow: "hidden" as any,
  },

  /* ── Live Rates: Large Vertical Cards (Desktop) ── */
  liveRatesContainer: {
    backgroundColor: "#1a1d26",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#d4a83640",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  liveRatesHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff10",
    backgroundColor: "#d4a83608",
  },
  liveRatesTitle: {
    fontSize: 22,
    fontWeight: "900" as any,
    color: "#d4a836",
    letterSpacing: 3,
  },

  liveRateCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: "#22252e",
    borderLeftWidth: 5,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  liveRateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  liveRateIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  liveRateProductName: {
    fontSize: 22,
    fontWeight: "900" as any,
    color: "#f5f0e8",
    letterSpacing: 1.5,
  },
  liveRatePrices: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveRatePriceBlock: {
    flex: 1,
    alignItems: "center",
  },
  liveRatePriceLabel: {
    fontSize: 13,
    fontWeight: "800" as any,
    color: "#888",
    letterSpacing: 2,
    marginBottom: 8,
  },
  liveRatePriceValue: {
    fontSize: 38,
    fontWeight: "900" as any,
    color: "#f5f0e8",
  },
  liveRateSellValue: {
    fontSize: 38,
    fontWeight: "900" as any,
    color: "#22c55e",
  },
  liveRateHL: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  liveRateDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#ffffff15",
    marginHorizontal: 8,
  },
  liveRatesTimestamp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ffffff08",
  },
  liveRatesTimestampText: {
    fontSize: 13,
    color: "#666",
  },
  liveRatesAutoRefresh: {
    fontSize: 13,
    color: "#555",
  },

  /* ── MMTC Coins Table (Desktop) ── */
  mmtcTableWrap: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 24,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: "#1a1d26",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  mmtcTableTitle: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    gap: 12,
    borderBottomColor: "#ffffff10",
  },
  mmtcTableTitleText: {
    fontSize: 22,
    fontWeight: "900" as any,
    letterSpacing: 2,
  },
  mmtcHeader: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderBottomColor: "#ffffff10",
  },
  mmtcTh: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#888",
  },
  mmtcRow: {
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderBottomColor: "#ffffff08",
  },
  mmtcRowEven: {
    backgroundColor: "#1a1d26",
  },
  mmtcRowOdd: {
    backgroundColor: "#1e2130",
  },
  mmtcDenomName: {
    fontSize: 18,
    fontWeight: "800" as any,
    lineHeight: 26,
    color: "#e0d8c8",
  },
  mmtcBuyPrice: {
    fontSize: 24,
    fontWeight: "900" as any,
    color: "#f5f0e8",
  },
  mmtcSellPrice: {
    fontSize: 24,
    fontWeight: "900" as any,
    color: "#22c55e",
  },
  mmtcDash: {
    fontSize: 24,
    fontWeight: "800" as any,
    color: "#444",
  },

  /* ── Footnote ── */
  footnote: {
    fontSize: 14,
    marginTop: 32,
    color: "#555",
  },
  poweredBy: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 13,
    color: "#6c7280",
  },
  poweredByLink: {
    color: "#d4a836",
  },
});
