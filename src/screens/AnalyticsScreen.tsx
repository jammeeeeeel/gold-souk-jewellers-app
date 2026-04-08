import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { fetchLiveRates } from '../utils/asawirScraper';
import { ChartDataPoint, getHistoricalPrices, saveDailyPrice } from '../utils/priceHistoryStore';
import { calculateSMA, getTrendForecast } from '../utils/trendAnalyzer';

const { width } = Dimensions.get('window');
const SCREEN_WIDTH = width;

type MetalType = 'Gold' | 'Silver';
type Timeframe = '1W' | '1M' | '6M' | '1Y';

/* ──── Derived analytics ──── */
function computeStats(data: ChartDataPoint[]) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const first = values[0];
  const last = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pctChange = (((last - first) / first) * 100);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // Volatility = std dev as % of mean
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const volatilityPct = (stdDev / avg) * 100;

  // Simple RSI-like momentum: count up days vs down days in last 14 data points
  const recent = values.slice(-14);
  let gains = 0; let losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i] - recent[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const rs = losses === 0 ? 100 : gains / losses;
  const rsi = Math.round(100 - (100 / (1 + rs)));

  // SMA 7 and SMA 14
  const sma7 = calculateSMA(data, 7);
  const sma14 = calculateSMA(data, 14);

  return { first, last, high, low, pctChange, avg, volatilityPct, rsi, sma7, sma14 };
}

/* ──── RSI Label ──── */
function rsiLabel(rsi: number): { text: string; color: string } {
  if (rsi >= 70) return { text: 'Overbought', color: '#ef4444' };
  if (rsi <= 30) return { text: 'Oversold', color: '#22c55e' };
  return { text: 'Normal', color: '#f59e0b' };
}

/* ──── Forecast: next 7-day price range ──── */
function forecastRange(last: number, volatilityPct: number, trend: string): { low: number; high: number } {
  const dailyVol = (volatilityPct / 100) * last * 0.5;
  const bias = trend === 'Bullish' ? 0.003 : trend === 'Bearish' ? -0.003 : 0;
  const weekBias = last * bias * 7;
  return {
    low: Math.round(last - dailyVol * 2 + weekBias),
    high: Math.round(last + dailyVol * 2 + weekBias),
  };
}

/* ──── MetalPage: self-contained page for one metal ──── */
function MetalPage({ metal, timeframe }: { metal: MetalType; timeframe: Timeframe }) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState(0);
  const aliveRef = useRef(true);
  const chartColor = metal === 'Gold' ? '#e7b860' : '#888888';
  const gradColors = metal === 'Gold'
    ? (['#fef6e4', '#fff9ec'] as const)
    : (['#f5f5f5', '#fafafa'] as const);

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const rates = await fetchLiveRates();
        const future = rates.products.find(
          (p) => p.label.toUpperCase().includes(metal.toUpperCase()) && p.label.toUpperCase().includes('FUTURE')
        );
        if (future) {
          const price = parseFloat(future.sell) || parseFloat(future.buy);
          if (price > 0) { setLivePrice(price); await saveDailyPrice(metal, price); }
        }
      } catch {}
      const historicalData = await getHistoricalPrices(metal, timeframe);
      if (aliveRef.current) { setData(historicalData); setLoading(false); }
    })();
    return () => { aliveRef.current = false; };
  }, [metal, timeframe]);

  const stats = computeStats(data);
  const trendResult = stats && data.length > 0 ? getTrendForecast(data[data.length - 1].value, data) : null;
  const trend = trendResult?.status ?? 'Neutral';
  const forecast = stats ? forecastRange(stats.last, stats.volatilityPct, trend) : null;
  const trendColor = trend === 'Bullish' ? '#22c55e' : trend === 'Bearish' ? '#ef4444' : '#f59e0b';
  const trendIcon = trend === 'Bullish' ? 'trending-up' : trend === 'Bearish' ? 'trending-down' : 'remove';
  const isPositive = stats ? stats.pctChange >= 0 : true;

  return (
    <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Price Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.currentPriceLabel}>
          {metal === 'Gold' ? 'Gold Futures (per 10g)' : 'Silver Futures (per kg)'}
        </Text>
        <Text style={styles.currentPriceValue}>
          ₹{stats ? stats.last.toLocaleString('en-IN') : (livePrice > 0 ? livePrice.toLocaleString('en-IN') : '—')}
        </Text>
        {stats && (
          <View style={styles.changeRow}>
            <View style={[styles.changePill, { backgroundColor: isPositive ? '#f0fdf4' : '#fff0f0' }]}>
              <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={12} color={isPositive ? '#22c55e' : '#ef4444'} />
              <Text style={[styles.changePct, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
                {isPositive ? '+' : ''}{Number(stats.pctChange).toFixed(2)}%
              </Text>
              <Text style={styles.changePeriodText}>this period</Text>
            </View>
            <View style={[styles.trendPill, { backgroundColor: trendColor + '18', borderColor: trendColor + '44' }]}>
              <Ionicons name={trendIcon as any} size={13} color={trendColor} />
              <Text style={[styles.trendText, { color: trendColor }]}>{trend}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Price History</Text>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={chartColor} /><Text style={styles.loadingText}>Loading chart data…</Text></View>
        ) : data.length < 2 ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="bar-chart-outline" size={32} color="#ccc" />
            <Text style={styles.loadingText}>Not enough data yet.{'\n'}Data accumulates as the app runs daily.</Text>
          </View>
        ) : (
          <LineChart
            areaChart data={data}
            width={width - 64} height={200}
            hideDataPoints={data.length > 30}
            initialSpacing={0}
            spacing={(width - 64) / Math.max(data.length - 1, 1)}
            color={chartColor} startFillColor={chartColor} endFillColor="#ffffff"
            startOpacity={0.35} endOpacity={0.0}
            yAxisThickness={0} xAxisThickness={1} xAxisColor="#e0e0e0"
            yAxisTextStyle={{ color: '#aaa', fontSize: 9 }}
            rulesType="solid" rulesColor="#f3f3f3"
            pointerConfig={{
              pointerStripHeight: 160, pointerStripColor: '#ccc', pointerStripWidth: 1.5,
              pointerColor: chartColor, radius: 5, pointerLabelWidth: 110, pointerLabelHeight: 52,
              activatePointersOnLongPress: false, autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: any) => {
                const item = items[0];
                return (
                  <View style={styles.tooltipContainer}>
                    <Text style={styles.tooltipDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                    <Text style={styles.tooltipValue}>₹{item.value.toLocaleString('en-IN')}</Text>
                  </View>
                );
              },
            }}
          />
        )}
      </View>

      {/* Stats */}
      {stats && (
        <>
          <Text style={styles.sectionLabel}>PERIOD STATISTICS</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'Period High', value: `₹${stats.high.toLocaleString('en-IN')}`, icon: 'arrow-up-circle', color: '#22c55e' },
              { label: 'Period Low', value: `₹${stats.low.toLocaleString('en-IN')}`, icon: 'arrow-down-circle', color: '#ef4444' },
              { label: '7-Day SMA', value: stats.sma7 ? `₹${Math.round(stats.sma7).toLocaleString('en-IN')}` : '—', icon: 'analytics-outline', color: '#8a6400' },
              { label: '14-Day SMA', value: stats.sma14 ? `₹${Math.round(stats.sma14).toLocaleString('en-IN')}` : '—', icon: 'analytics-outline', color: '#8a6400' },
            ].map((s) => (
              <LinearGradient key={s.label} colors={gradColors} style={styles.statCard}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
                <Ionicons name={s.icon as any} size={16} color={s.color} />
              </LinearGradient>
            ))}
          </View>

          <Text style={styles.sectionLabel}>MOMENTUM INDICATORS</Text>
          <View style={styles.momentumCard}>
            <View style={styles.momentumRow}>
              <Text style={styles.momentumLabel}>RSI (14-period)</Text>
              <View style={[styles.rsiPill, { backgroundColor: rsiLabel(stats.rsi).color + '22' }]}>
                <Text style={[styles.rsiValue, { color: rsiLabel(stats.rsi).color }]}>{stats.rsi}</Text>
                <Text style={[styles.rsiTag, { color: rsiLabel(stats.rsi).color }]}>{rsiLabel(stats.rsi).text}</Text>
              </View>
            </View>
            <View style={styles.rsiBarWrap}>
              <View style={styles.rsiBarTrack}>
                <View style={[styles.rsiBarFill, { width: `${stats.rsi}%` as any, backgroundColor: rsiLabel(stats.rsi).color }]} />
              </View>
              <View style={styles.rsiZones}>
                <Text style={styles.rsiZoneText}>Oversold 0–30</Text>
                <Text style={styles.rsiZoneText}>Normal 30–70</Text>
                <Text style={styles.rsiZoneText}>70–100 Overbought</Text>
              </View>
            </View>
            {[
              { label: 'Volatility', value: `${stats.volatilityPct.toFixed(2)}%` },
              { label: 'Period Average', value: `₹${Math.round(stats.avg).toLocaleString('en-IN')}` },
              { label: 'Price vs SMA7', value: stats.sma7 ? (stats.last > stats.sma7 ? `+₹${(stats.last - Math.round(stats.sma7)).toLocaleString('en-IN')} above` : `-₹${(Math.round(stats.sma7) - stats.last).toLocaleString('en-IN')} below`) : '—', color: stats.sma7 && stats.last > stats.sma7 ? '#22c55e' : '#ef4444' },
            ].map((row) => (
              <View key={row.label} style={[styles.momentumRow, { marginTop: 10 }]}>
                <Text style={styles.momentumLabel}>{row.label}</Text>
                <Text style={[styles.momentumVal, row.color ? { color: row.color } : {}]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {forecast && (
            <>
              <Text style={styles.sectionLabel}>NEXT 7-DAY OUTLOOK</Text>
              <View style={styles.forecastCard}>
                <View style={styles.forecastBadge}>
                  <Ionicons name="warning-outline" size={14} color="#f59e0b" />
                  <Text style={styles.forecastDisclaimer}>PREDICTION ONLY — Not financial advice. Past performance does not guarantee future results.</Text>
                </View>
                <View style={styles.forecastBody}>
                  <View style={styles.forecastBlock}>
                    <Text style={styles.forecastLabel}>Expected Low</Text>
                    <Text style={[styles.forecastValue, { color: '#ef4444' }]}>₹{forecast.low.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.forecastDivider} />
                  <View style={styles.forecastBlock}>
                    <Text style={styles.forecastLabel}>Trend</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name={trendIcon as any} size={18} color={trendColor} />
                      <Text style={[styles.forecastValue, { color: trendColor }]}>{trend}</Text>
                    </View>
                  </View>
                  <View style={styles.forecastDivider} />
                  <View style={styles.forecastBlock}>
                    <Text style={styles.forecastLabel}>Expected High</Text>
                    <Text style={[styles.forecastValue, { color: '#22c55e' }]}>₹{forecast.high.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
                <Text style={styles.forecastNote}>
                  Based on SMA trend + historical volatility of {stats.volatilityPct.toFixed(2)}%. Statistical estimate only.
                </Text>
              </View>
            </>
          )}

          <Text style={styles.bottomDisclaimer}>
            Data from live MCX/COMEX futures. Predictions are statistical estimates only — not investment advice.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

export default function AnalyticsScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0); // 0=Gold 1=Silver
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1M');
  const pagerRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

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

  const indicatorLeft = indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Market Analytics</Text>
        <Text style={styles.pageSubtitle}>Based on live MCX/COMEX futures data</Text>
      </View>

      {/* Animated Tab Bar */}
      <View style={styles.tabContainer}>
        <Animated.View style={[styles.tabIndicatorAnalytics, {
          left: indicatorLeft,
          backgroundColor: indicatorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#fef6e4', '#ebebeb'] }),
        }]} />
        <TouchableOpacity style={styles.tabButton} onPress={() => switchTab(0)}>
          <Ionicons name="ellipse" size={13} color={activeTab === 0 ? '#b8860b' : '#999'} />
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>GOLD 24K</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => switchTab(1)}>
          <Ionicons name="ellipse" size={13} color={activeTab === 1 ? '#555' : '#999'} />
          <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>SILVER 999</Text>
        </TouchableOpacity>
      </View>

      {/* Timeframe bar */}
      <View style={styles.timeframeContainer}>
        {(['1W', '1M', '6M', '1Y'] as Timeframe[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.tfBtn, selectedTimeframe === tf && styles.tfBtnActive]}
            onPress={() => setSelectedTimeframe(tf)}
          >
            <Text style={[styles.tfText, selectedTimeframe === tf && styles.tfTextActive]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Horizontal Pager */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSwipe}
        decelerationRate="fast"
        style={{ flex: 1 }}
      >
        <MetalPage metal="Gold" timeframe={selectedTimeframe} />
        <MetalPage metal="Silver" timeframe={selectedTimeframe} />
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fb' },
  container: { flex: 1, backgroundColor: '#f8f9fb' },

  pageHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  pageSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },

  tabContainer: {
    flexDirection: 'row', marginHorizontal: 12, marginTop: 12,
    backgroundColor: '#f1f1f1', borderRadius: 12, padding: 4,
    position: 'relative',
  },
  tabIndicatorAnalytics: {
    position: 'absolute', top: 4, bottom: 4,
    width: '50%', borderRadius: 10,
  },
  tabButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8, gap: 6, zIndex: 1,
  },
  tabText: { fontWeight: '700', color: '#888', fontSize: 12 },
  activeTabText: { color: '#333' },
  timeframeContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
  },

  summaryContainer: { paddingHorizontal: 16, marginTop: 18 },
  currentPriceLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  currentPriceValue: { fontSize: 34, fontWeight: '800', color: '#2f2416', marginTop: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  changePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  changePct: { fontSize: 13, fontWeight: '800' },
  changePeriodText: { fontSize: 12, color: '#888' },
  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  trendText: { fontSize: 13, fontWeight: '700' },

  chartCard: {
    marginTop: 14, marginHorizontal: 12, backgroundColor: '#fff',
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, marginBottom: 10,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  timeframeRow: { flexDirection: 'row', gap: 4 },
  tfBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#f3f3f3' },
  tfBtnActive: { backgroundColor: '#333' },
  tfText: { fontSize: 12, fontWeight: '600', color: '#666' },
  tfTextActive: { color: '#fff' },
  loadingContainer: { height: 200, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  tooltipContainer: {
    backgroundColor: '#222', padding: 8, borderRadius: 8, alignItems: 'center',
  },
  tooltipDate: { color: '#aaa', fontSize: 10, marginBottom: 2 },
  tooltipValue: { color: '#fff', fontSize: 13, fontWeight: '800' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#999', textTransform: 'uppercase',
    marginHorizontal: 16, marginTop: 18, marginBottom: 8, letterSpacing: 0.8,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 8 },
  statCard: {
    width: (width - 24 - 24) / 2, padding: 14, borderRadius: 12,
    gap: 4, borderWidth: 1, borderColor: '#ece8df',
  },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#222', marginVertical: 4 },

  momentumCard: {
    marginHorizontal: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#f0f0f0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  momentumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  momentumLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  momentumVal: { fontSize: 14, fontWeight: '800', color: '#222' },

  rsiPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  rsiValue: { fontSize: 16, fontWeight: '800' },
  rsiTag: { fontSize: 11, fontWeight: '700' },

  rsiBarWrap: { marginTop: 8, marginBottom: 4 },
  rsiBarTrack: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  rsiBarFill: { height: '100%', borderRadius: 4 },
  rsiZones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  rsiZoneText: { fontSize: 9, color: '#bbb' },

  forecastCard: {
    marginHorizontal: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#f59e0b33',
    shadowColor: '#f59e0b', shadowOpacity: 0.1, shadowRadius: 8, elevation: 1,
  },
  forecastBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#fffbeb',
    borderRadius: 8, padding: 8, marginBottom: 12,
  },
  forecastDisclaimer: { fontSize: 11, color: '#92400e', fontWeight: '600', flex: 1, lineHeight: 16 },
  forecastBody: { flexDirection: 'row', alignItems: 'center' },
  forecastBlock: { flex: 1, alignItems: 'center' },
  forecastDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  forecastLabel: { fontSize: 11, color: '#999', fontWeight: '600', marginBottom: 4 },
  forecastValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  forecastNote: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 12, lineHeight: 17 },

  bottomDisclaimer: {
    fontSize: 11, color: '#bbb', textAlign: 'center',
    marginHorizontal: 20, marginTop: 20, lineHeight: 18, fontStyle: 'italic',
  },
});
