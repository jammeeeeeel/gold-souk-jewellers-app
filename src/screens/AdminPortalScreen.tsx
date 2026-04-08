import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  AdminSettings,
  checkAdminAuth,
  getCoinDisplayName,
  isCoinDisabled,
  loadSettings,
  loginAdmin,
  logoutAdmin,
  saveSettings,
} from "../utils/adminSettings";
import { fetchLiveRates, RateItem } from "../utils/asawirScraper";
import { getGoldCoinList, getSilverCoinList } from "../utils/coinDefinitions";
import { buildGoldDistributorRates, buildSilverDistributorRates } from "../utils/mmtcDistributorRates";

const DESKTOP_BREAKPOINT = 900;

/* ──────── TOP-LEVEL TABS ──────── */
type AdminTab = "premiums" | "adjustments";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PREMIUM HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PremiumRow({
  coin, premium, disabled, displayLabel, onUpdate, onToggle, onRename,
}: {
  coin: RateItem; premium: number; disabled: boolean; displayLabel: string;
  onUpdate: (val: number) => void; onToggle: () => void; onRename: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(premium.toString());
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(displayLabel);
  const save = () => { onUpdate(parseInt(text) || 0); setEditing(false); };
  const saveName = () => {
    const trimmed = nameText.trim();
    if (trimmed && trimmed !== displayLabel) onRename(trimmed);
    setEditingName(false);
  };
  return (
    <View style={[styles.premRow, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        {editingName ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TextInput
              style={[styles.premInput, { flex: 1, fontSize: 13, paddingVertical: 4, minWidth: 100 }]}
              value={nameText}
              onChangeText={setNameText}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={saveName}
              onBlur={saveName}
            />
            <TouchableOpacity onPress={saveName} style={[styles.saveBtn, { paddingHorizontal: 6, paddingVertical: 4 }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setNameText(displayLabel); setEditingName(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.premCoinName} numberOfLines={1}>{displayLabel}</Text>
            <Ionicons name="create-outline" size={14} color="#bbb" />
          </TouchableOpacity>
        )}
        {disabled ? (
          <Text style={[styles.premCoinSell, { color: '#c62828', fontWeight: '700' }]}>OUT OF STOCK</Text>
        ) : (
          <Text style={styles.premCoinSell}>{"Base: \u20B9"}{coin.sell !== '-' ? Number(coin.sell).toLocaleString('en-IN') : '--'}</Text>
        )}
      </View>
      {/* Availability toggle */}
      <TouchableOpacity
        onPress={onToggle}
        style={[
          styles.togglePill,
          { backgroundColor: disabled ? '#fee2e2' : '#dcfce7', borderColor: disabled ? '#fca5a5' : '#86efac' },
        ]}
      >
        <View style={[styles.toggleDot, { backgroundColor: disabled ? '#ef4444' : '#22c55e' }]} />
        <Text style={[styles.toggleText, { color: disabled ? '#c62828' : '#166534' }]}>
          {disabled ? 'Off' : 'On'}
        </Text>
      </TouchableOpacity>
      {/* Premium edit */}
      {!disabled && (
        editing ? (
          <View style={styles.premEditRow}>
            <Text style={styles.rupeeSign}>{"\u20B9"}</Text>
            <TextInput style={styles.premInput} value={text} onChangeText={setText} keyboardType="number-pad" autoFocus selectTextOnFocus onSubmitEditing={save} />
            <TouchableOpacity onPress={save} style={styles.saveBtn}><Ionicons name="checkmark" size={18} color="#fff" /></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setText(premium.toString()); setEditing(true); }} style={styles.premDisplay}>
            <Text style={[styles.premValue, premium > 0 && styles.premValueActive]}>{premium > 0 ? `+\u20B9${premium}` : '\u20B90'}</Text>
            <Ionicons name="pencil" size={14} color="#999" />
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

function GlobalPremiumCard({
  label, icon, value, onSave, accentColor,
}: {
  label: string; icon: string; value: number; onSave: (v: number) => void; accentColor: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value.toString());
  useEffect(() => { setText(value.toString()); }, [value]);
  const save = () => { onSave(parseInt(text) || 0); setEditing(false); };
  return (
    <View style={[styles.globalCard, { borderColor: accentColor }]}>
      <View style={styles.globalCardHeader}>
        <Ionicons name={icon as any} size={20} color={accentColor} />
        <Text style={styles.globalCardLabel}>{label}</Text>
      </View>
      <Text style={styles.globalCardDesc}>Applied to ALL {label.toLowerCase().includes("gold") ? "gold" : "silver"} coins</Text>
      {editing ? (
        <View style={styles.premEditRow}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput style={[styles.premInput, { flex: 1 }]} value={text} onChangeText={setText} keyboardType="number-pad" autoFocus selectTextOnFocus onSubmitEditing={save} />
          <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: accentColor }]}><Ionicons name="checkmark" size={18} color="#fff" /></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setText(value.toString()); setEditing(true); }} style={styles.globalValueRow}>
          <Text style={[styles.globalValue, { color: accentColor }]}>{value > 0 ? `+₹${value}` : "₹0"}</Text>
          <Ionicons name="pencil" size={16} color="#bbb" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* -- Custom Price Row for Adjustments tab -- */
function CustomPriceRow({
  label, basePrice, offset, accentColor, onUpdate,
}: {
  label: string; basePrice: number; offset: number;
  accentColor: string; onUpdate: (newOffset: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const customPrice = basePrice > 0 ? Math.round(basePrice + offset) : 0;
  const [text, setText] = useState(customPrice > 0 ? customPrice.toString() : "");

  const save = () => {
    const trimmed = text.trim();
    // Empty field or 0 → reset to base price (offset = 0)
    if (trimmed === "" || trimmed === "0") {
      onUpdate(0);
      setEditing(false);
      return;
    }
    const enteredPrice = parseInt(trimmed) || 0;
    const newOffset = basePrice > 0 ? enteredPrice - basePrice : enteredPrice;
    onUpdate(newOffset);
    setEditing(false);
  };

  return (
    <View style={styles.premRow}>
      <View style={{ flex: 1.2 }}>
        <Text style={styles.premCoinName} numberOfLines={1}>{label}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={[styles.premCoinSell, { fontSize: 13, fontWeight: "600" }]}>
          {basePrice > 0 ? `₹${basePrice.toLocaleString("en-IN")}` : "--"}
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {editing ? (
          <View style={[styles.premEditRow, { marginLeft: 0 }]}>
            <Text style={styles.rupeeSign}>{"\u20B9"}</Text>
            <TextInput
              style={[styles.premInput, { width: 80 }]}
              value={text}
              onChangeText={setText}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={save}
            />
            <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: accentColor }]}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setText(customPrice > 0 ? customPrice.toString() : (basePrice > 0 ? basePrice.toString() : "")); setEditing(true); }} style={[styles.premDisplay, { marginLeft: 0 }]}>
            <Text style={[styles.premValue, offset !== 0 && styles.premValueActive, { fontWeight: "800" }]}>
              {customPrice > 0 ? `₹${customPrice.toLocaleString("en-IN")}` : "--"}
            </Text>
            <Ionicons name="pencil" size={14} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flex: 0.7, alignItems: "center" }}>
        <Text style={[styles.premCoinSell, {
          fontSize: 12,
          fontWeight: "700",
          color: offset > 0 ? "#22c55e" : offset < 0 ? "#ef4444" : "#999",
        }]}>
          {offset === 0 ? "₹0" : offset > 0 ? `+₹${offset.toLocaleString("en-IN")}` : `-₹${Math.abs(offset).toLocaleString("en-IN")}`}
        </Text>
      </View>
    </View>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN ADMIN PORTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AdminPortalScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && screenWidth >= DESKTOP_BREAKPOINT;
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [goldCoins, setGoldCoins] = useState<RateItem[]>([]);
  const [silverCoins, setSilverCoins] = useState<RateItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<"gold" | "silver">("gold");
  const [adjSection, setAdjSection] = useState<"gold" | "silver">("gold");
  const [adminTab, setAdminTab] = useState<AdminTab>("premiums");
  const [goldBasePerGram, setGoldBasePerGram] = useState(0);
  const [silverBasePerGram, setSilverBasePerGram] = useState(0);

  const pollLiveRate = async () => {
    try {
      const mainRates = await fetchLiveRates();
      const gf = mainRates.products.find(
        (p) => p.label.toUpperCase().includes("GOLD") && p.label.toUpperCase().includes("FUTURE")
      );
      if (gf) {
        const v = parseFloat(gf.sell) || parseFloat(gf.buy);
        if (v > 0) setGoldBasePerGram(v / 10);
      }
      const sf = mainRates.products.find(
        (p) => p.label.toUpperCase().includes("SILVER") && p.label.toUpperCase().includes("FUTURE")
      );
      if (sf) {
        const v = parseFloat(sf.sell) || parseFloat(sf.buy);
        if (v > 0) setSilverBasePerGram(v / 1000);
      }
    } catch {}
  };

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      const authed = await checkAdminAuth();
      if (authed) {
        setIsLoggedIn(true);
        // Load data in parallel
        const [s] = await Promise.all([
          loadSettings(),
          loadCoinData(),
          pollLiveRate(),
        ]);
        setSettings(s);
      }
      setChecking(false);
    })();
  }, []);

  // Poll live rate only when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(pollLiveRate, 3000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLogin = async () => {
    setLoginError("");
    if (!username.trim() || !password.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }
    setLoginLoading(true);
    const ok = await loginAdmin(username.trim(), password);
    if (ok) {
      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
      // Load dashboard data
      const [s] = await Promise.all([loadSettings(), loadCoinData(), pollLiveRate()]);
      setSettings(s);
    } else {
      setLoginError("Invalid username or password.");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setIsLoggedIn(false);
    setSettings(null);
  };

  // Force no horizontal overflow on web
  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.textContent = "html, body, #root { overflow-x: hidden !important; max-width: 100vw !important; }";
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
  }, []);



  const loadCoinData = () => {
    // Coin lists are local — no API calls needed
    setGoldCoins(getGoldCoinList());
    setSilverCoins(getSilverCoinList());
  };

  const updateAndSave = useCallback(async (updated: AdminSettings) => {
    setSettings(updated);
    await saveSettings(updated);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCoinData();
    const s = await loadSettings();
    setSettings(s);
    setRefreshing(false);
  };

  // ── Loading ──
  if (checking) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="small" color="#8a6400" />
      </SafeAreaView>
    );
  }

  // ── Login Screen ──
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color="#8a6400" />
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#8a6400" }}>Back</Text>
        </TouchableOpacity>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center" }}>
          <View style={[styles.loginBox, isDesktop && { maxWidth: 400, alignSelf: "center" as any, width: "100%" as any }]}>
            <Ionicons name="shield-checkmark" size={isDesktop ? 56 : 44} color="#8a6400" />
            <Text style={[styles.loginTitle, isDesktop && { fontSize: 34 }]}>Admin Portal</Text>
            <Text style={[styles.loginSubtitle, isDesktop && { fontSize: 16 }]}>Sign in to manage rates & premiums</Text>
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
            <TextInput
              style={[styles.input, isDesktop && { fontSize: 18, paddingVertical: 16 }]}
              placeholder="Username"
              placeholderTextColor="#bbb"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, isDesktop && { fontSize: 18, paddingVertical: 16 }]}
              placeholder="Password"
              placeholderTextColor="#bbb"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={[styles.loginButton, isDesktop && { paddingVertical: 18 }, loginLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.loginButtonText, isDesktop && { fontSize: 18 }]}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Dashboard ──
  if (!settings) return null;
  const coins = activeSection === "gold" ? goldCoins : silverCoins;

  return (
    <SafeAreaView style={[styles.dashContainer, isDesktop && dStyles.dashContainer]}>
      {/* Top Header */}
      <View style={[styles.dashHeaderRow, isDesktop && dStyles.dashHeaderRow]}>
        <View>
          <Text style={[styles.dashTitle, isDesktop && dStyles.dashTitle]}>Admin Dashboard</Text>
          <Text style={[styles.dashSub, isDesktop && dStyles.dashSub]}>Manage premiums & rate adjustments</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, isDesktop && dStyles.logoutBtn]}>
          <Ionicons name="log-out-outline" size={isDesktop ? 22 : 18} color="#c62828" />
          <Text style={[styles.logoutText, isDesktop && dStyles.logoutText]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Admin Tabs — only Premiums & Adjustments */}
      <View style={[styles.adminTabRow, isDesktop && dStyles.adminTabRow]}>
        <TouchableOpacity
          style={[styles.adminTabBtn, isDesktop && dStyles.adminTabBtn, adminTab === "premiums" && styles.adminTabBtnActive, adminTab === "premiums" && isDesktop && dStyles.adminTabBtnActive]}
          onPress={() => setAdminTab("premiums")}
        >
          <Ionicons name="pricetag-outline" size={isDesktop ? 22 : 15} color={adminTab === "premiums" ? "#8a6400" : "#999"} />
          <Text style={[styles.adminTabText, isDesktop && dStyles.adminTabText, adminTab === "premiums" && styles.adminTabTextActive]}>Premiums</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.adminTabBtn, isDesktop && dStyles.adminTabBtn, adminTab === "adjustments" && styles.adminTabBtnActive, adminTab === "adjustments" && isDesktop && dStyles.adminTabBtnActive]}
          onPress={() => setAdminTab("adjustments")}
        >
          <Ionicons name="options-outline" size={isDesktop ? 22 : 15} color={adminTab === "adjustments" ? "#8a6400" : "#999"} />
          <Text style={[styles.adminTabText, isDesktop && dStyles.adminTabText, adminTab === "adjustments" && styles.adminTabTextActive]}>Adjustments</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={isDesktop ? { flex: 1 } : undefined}
        contentContainerStyle={[styles.dashContent, isDesktop && dStyles.dashContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8a6400" />}
      >
        {/* ── PREMIUMS TAB ── */}
        {adminTab === "premiums" && (
          <>
            <Text style={[styles.sectionTitle, isDesktop && dStyles.sectionTitle]}>Global Premiums</Text>
            <View style={[styles.globalRow, isDesktop && dStyles.globalRow]}>
              <GlobalPremiumCard label="Gold Premium" icon="ellipse" value={settings.globalGoldPremium} accentColor="#b8860b" onSave={(v) => updateAndSave({ ...settings, globalGoldPremium: v })} />
              <GlobalPremiumCard label="Silver Premium" icon="ellipse" value={settings.globalSilverPremium} accentColor="#888" onSave={(v) => updateAndSave({ ...settings, globalSilverPremium: v })} />
            </View>

            <Text style={[styles.sectionTitle, isDesktop && dStyles.sectionTitle]}>Per-Coin Premiums</Text>
            <View style={[styles.tabWrapper, isDesktop && dStyles.tabWrapper]}>
              <TouchableOpacity onPress={() => setActiveSection("gold")} style={[styles.tabBtn, isDesktop && dStyles.tabBtn, activeSection === "gold" && styles.activeGoldTab]}>
                <Text style={[styles.tabText, isDesktop && dStyles.tabText, activeSection === "gold" && { color: "#8a6400" }]}>GOLD ({goldCoins.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveSection("silver")} style={[styles.tabBtn, isDesktop && dStyles.tabBtn, activeSection === "silver" && styles.activeSilverTab]}>
                <Text style={[styles.tabText, isDesktop && dStyles.tabText, activeSection === "silver" && { color: "#444" }]}>SILVER ({silverCoins.length})</Text>
              </TouchableOpacity>
            </View>

            {coins.map((coin) => {
              const premiums = activeSection === "gold" ? settings.goldPremiums : settings.silverPremiums;
              const premium = premiums[coin.id] || 0;
              const isDisabled = isCoinDisabled(settings, coin.id, activeSection);
              const displayLabel = getCoinDisplayName(settings, coin.id, coin.label);
              const toggleDisabled = () => {
                const listKey = activeSection === "gold" ? "disabledGoldCoins" : "disabledSilverCoins";
                const current: string[] = (settings[listKey] as string[]) || [];
                const next = isDisabled ? current.filter((id) => id !== coin.id) : [...current, coin.id];
                updateAndSave({ ...settings, [listKey]: next });
              };
              return (
                <PremiumRow key={coin.id} coin={coin} premium={premium}
                  disabled={isDisabled} displayLabel={displayLabel} onToggle={toggleDisabled}
                  onUpdate={(val) => {
                    const key = activeSection === "gold" ? "goldPremiums" : "silverPremiums";
                    updateAndSave({ ...settings, [key]: { ...settings[key], [coin.id]: val } });
                  }}
                  onRename={(newName: string) => {
                    const overrides = { ...(settings.coinNameOverrides || {}), [coin.id]: newName };
                    updateAndSave({ ...settings, coinNameOverrides: overrides });
                  }}
                />
              );
            })}

            {coins.length === 0 && (
              <Text style={[styles.emptyText, isDesktop && dStyles.emptyText]}>No {activeSection} coins loaded yet. Pull to refresh.</Text>
            )}

            <TouchableOpacity
              style={[styles.resetBtn, isDesktop && dStyles.resetBtn]}
              onPress={() => Alert.alert("Reset All Premiums", "Set all public premiums to ₹0?", [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: () => updateAndSave({ ...settings, goldPremiums: {}, silverPremiums: {}, globalGoldPremium: 0, globalSilverPremium: 0 }) },
              ])}
            >
              <Ionicons name="trash-outline" size={isDesktop ? 20 : 16} color="#c62828" />
              <Text style={[styles.resetText, isDesktop && dStyles.resetText]}>Reset Public Premiums</Text>
            </TouchableOpacity>
          </>
        )}

        {/* -- ADJUSTMENTS TAB (Custom Prices) -- */}
        {adminTab === "adjustments" && (
          <>
            <Text style={[styles.sectionTitle, isDesktop && dStyles.sectionTitle]}>Custom Rate Pricing</Text>
            <Text style={[{ fontSize: 12, color: '#888', marginBottom: 10, paddingHorizontal: 2 }, isDesktop && { fontSize: 16, marginBottom: 16 }]}>
              Set custom rates per denomination. Difference stays constant as market moves. Selling = Custom Price + Premium.
            </Text>

            <View style={[styles.tabWrapper, isDesktop && dStyles.tabWrapper]}>
              <TouchableOpacity onPress={() => setAdjSection("gold")} style={[styles.tabBtn, isDesktop && dStyles.tabBtn, adjSection === "gold" && styles.activeGoldTab]}>
                <Text style={[styles.tabText, isDesktop && dStyles.tabText, adjSection === "gold" && { color: "#8a6400" }]}>GOLD ({goldCoins.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAdjSection("silver")} style={[styles.tabBtn, isDesktop && dStyles.tabBtn, adjSection === "silver" && styles.activeSilverTab]}>
                <Text style={[styles.tabText, isDesktop && dStyles.tabText, adjSection === "silver" && { color: "#444" }]}>SILVER ({silverCoins.length})</Text>
              </TouchableOpacity>
            </View>

            {/* Column Headers */}
            <View style={{ flexDirection: "row", paddingHorizontal: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" }}>
              <Text style={[{ flex: 1.2, fontSize: 11, fontWeight: "700", color: "#888" }, isDesktop && { fontSize: 14 }]}>DENOMINATION</Text>
              <Text style={[{ flex: 1, fontSize: 11, fontWeight: "700", color: "#888", textAlign: "center" }, isDesktop && { fontSize: 14 }]}>BASE PRICE</Text>
              <Text style={[{ flex: 1, fontSize: 11, fontWeight: "700", color: "#888", textAlign: "center" }, isDesktop && { fontSize: 14 }]}>CUSTOM PRICE</Text>
              <Text style={[{ flex: 0.7, fontSize: 11, fontWeight: "700", color: "#888", textAlign: "center" }, isDesktop && { fontSize: 14 }]}>DIFF</Text>
            </View>

            {(() => {
              const adjCoins = adjSection === "gold" ? goldCoins : silverCoins;
              const base = adjSection === "gold" ? goldBasePerGram : silverBasePerGram;
              const distMap = base > 0
                ? (adjSection === "gold" ? buildGoldDistributorRates(base) : buildSilverDistributorRates(base))
                : {};
              const offsetKey = adjSection === "gold" ? "goldPriceOffsets" : "silverPriceOffsets";
              const offsetMap = (settings[offsetKey] || {}) as Record<string, number>;

              if (adjCoins.length === 0) {
                return <Text style={[styles.emptyText, isDesktop && dStyles.emptyText]}>No {adjSection} coins loaded. Pull to refresh.</Text>;
              }

              return adjCoins.map((coin) => {
                const cleanLabel = getCoinDisplayName(settings, coin.id, coin.label);
                const weightMatch = coin.label.match(/\.500/) ? 0.5 : (coin.label.match(/([\.\d]+)\s*(?:g|gm|gms|gram)/i)?.[1] ? parseFloat(coin.label.match(/([\.\d]+)\s*(?:g|gm|gms|gram)/i)![1]) : null);
                const weightKey = weightMatch ? weightMatch.toString() : null;
                const basePrice = weightKey ? (distMap[weightKey] || 0) : 0;
                const offset = offsetMap[coin.id] || 0;

                return (
                  <CustomPriceRow
                    key={coin.id}
                    label={cleanLabel}
                    basePrice={Math.round(basePrice)}
                    offset={offset}
                    accentColor={adjSection === "gold" ? "#b8860b" : "#888"}
                    onUpdate={(newOffset: number) => {
                      updateAndSave({ ...settings, [offsetKey]: { ...offsetMap, [coin.id]: newOffset } });
                    }}
                  />
                );
              });
            })()}

            <TouchableOpacity
              style={[styles.resetBtn, isDesktop && dStyles.resetBtn, { marginTop: 16 }]}
              onPress={() => Alert.alert("Reset Custom Prices", `Reset all ${adjSection} custom prices to base?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: () => {
                  const offsetKey = adjSection === "gold" ? "goldPriceOffsets" : "silverPriceOffsets";
                  updateAndSave({ ...settings, [offsetKey]: {} });
                }},
              ])}
            >
              <Ionicons name="trash-outline" size={isDesktop ? 20 : 16} color="#c62828" />
              <Text style={[styles.resetText, isDesktop && dStyles.resetText]}>Reset {adjSection === "gold" ? "Gold" : "Silver"} Custom Prices</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9fb" },

  /* Login */
  loginContainer: { flex: 1, backgroundColor: "#f8f9fb", justifyContent: "center" },
  loginBox: { alignItems: "center", paddingHorizontal: 24 },
  loginTitle: { fontSize: 26, fontWeight: "800", color: "#222", marginTop: 12 },
  loginSubtitle: { fontSize: 13, color: "#888", marginTop: 4, marginBottom: 24 },
  input: {
    width: "100%", borderWidth: 1, borderColor: "#ddd", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: "#222", backgroundColor: "#fff", marginBottom: 12,
  },
  errorText: { color: "#c62828", fontSize: 13, marginBottom: 8 },
  loginButton: { width: "100%", backgroundColor: "#8a6400", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  loginButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  /* Dashboard */
  dashContainer: {
    flex: 1, backgroundColor: "#f8f9fb",
  },
  dashContent: {
    padding: 14, paddingBottom: 30,
  },
  dashHeaderRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e5e5",
  },
  dashTitle: { fontSize: 24, fontWeight: "800", color: "#222" },
  dashSub: { fontSize: 15, color: "#888", marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee" },
  logoutText: { color: "#c62828", fontWeight: "700", fontSize: 16 },

  /* Admin Main Tabs */
  adminTabRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e5e5e5",
  },
  adminTabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11,
  },
  adminTabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#8a6400" },
  adminTabText: { fontSize: 16, fontWeight: "700", color: "#999" },
  adminTabTextActive: { color: "#8a6400" },
  notifBadge: {
    backgroundColor: "#c62828", borderRadius: 10, minWidth: 18,
    height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  /* Section Title */
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#333", marginTop: 16, marginBottom: 8 },

  /* Global Premium Cards */
  globalRow: { flexDirection: "row", gap: 10 },
  globalCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1.5 },
  globalCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  globalCardLabel: { fontSize: 16, fontWeight: "700", color: "#333" },
  globalCardDesc: { fontSize: 13, color: "#999", marginTop: 2, marginBottom: 8 },
  globalValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  globalValue: { fontSize: 26, fontWeight: "800" },

  /* Tabs */
  tabWrapper: { flexDirection: "row", backgroundColor: "#f1f1f1", borderRadius: 10, padding: 3, marginBottom: 6 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  activeGoldTab: { backgroundColor: "#fef6e4" },
  activeSilverTab: { backgroundColor: "#f0f0f0" },
  tabText: { fontSize: 15, fontWeight: "700", color: "#999" },

  /* Premium Rows */
  premRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: "#f0f0f0",
  },
  premCoinName: { fontSize: 16, fontWeight: "700", color: "#333" },
  premCoinSell: { fontSize: 14, color: "#999", marginTop: 2 },
  premDisplay: { flexDirection: "row", alignItems: "center", gap: 6 },
  premValue: { fontSize: 20, fontWeight: "700", color: "#ccc" },
  premValueActive: { color: "#22c55e" },
  premEditRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rupeeSign: { fontSize: 20, fontWeight: "700", color: "#666" },
  premInput: {
    width: 90, borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 20, fontWeight: "700", color: "#222", backgroundColor: "#fff",
  },
  saveBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },

  /* Stock toggle */
  togglePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, marginHorizontal: 6,
  },
  toggleDot: { width: 8, height: 8, borderRadius: 4 },
  toggleText: { fontSize: 14, fontWeight: "800" },

  emptyText: { color: "#aaa", textAlign: "center", marginTop: 20, fontSize: 16 },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },

  resetBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 20, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#f0d0d0",
  },
  resetText: { color: "#c62828", fontWeight: "700", fontSize: 16 },

  /* B2B Sub-tabs */
  b2bSubTabWrap: { flexDirection: "row", backgroundColor: "#f1f1f1", borderRadius: 10, padding: 3, marginTop: 10, marginBottom: 4 },
  b2bSubTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  b2bSubTabActive: { backgroundColor: "#fff" },
  b2bSubTabText: { fontSize: 12, fontWeight: "700", color: "#999" },
  b2bSubTabTextActive: { color: "#8a6400" },
  b2bBadge: { backgroundColor: "#c62828", borderRadius: 9, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  b2bBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  /* Retailer Cards */
  retailerCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff",
    borderRadius: 12, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  approvedCard: { borderColor: "#d4edda" },
  retailerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fef6e4", alignItems: "center", justifyContent: "center",
    marginRight: 10,
  },
  retailerName: { fontSize: 14, fontWeight: "800", color: "#222" },
  retailerBiz: { fontSize: 12, color: "#666", marginTop: 1 },
  retailerPhone: { fontSize: 12, color: "#888", marginTop: 2 },
  retailerDate: { fontSize: 11, color: "#bbb", marginTop: 2 },
  retailerActions: { gap: 6, alignItems: "flex-end", marginLeft: 8 },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  rejectBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ef4444", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  rejectBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  editActionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#fef6e4", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d4a836" },
  deleteActionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#fff5f5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fdd" },

  /* Edit Modal */
  editModal: { padding: 16, backgroundColor: "#f8f9fb", flex: 1 },
  editModalLabel: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 4, marginTop: 10 },
  editModalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelEditBtn: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  cancelEditText: { fontWeight: "700", color: "#666" },
  saveEditBtn: { flex: 1, backgroundColor: "#8a6400", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  saveEditText: { fontWeight: "700", color: "#fff" },

  /* Bank Details Admin */
  bankFieldLabel: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 4, marginTop: 10 },
  bankFieldCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#f0f0f0", marginBottom: 4,
  },
  bankSectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 8, marginBottom: 2,
  },
  bankAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#8a6400", borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  bankAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  bankListItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 10, padding: 12, marginTop: 6,
    borderWidth: 1, borderColor: "#f0f0f0",
  },
  bankListName: { fontSize: 14, fontWeight: "700", color: "#333" },
  bankListSub: { fontSize: 11, color: "#999", marginTop: 2 },
  bankTypeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  bankTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#eee",
  },
  bankTypeBtnActive: { backgroundColor: "#fef6e4", borderColor: "#d4a836" },
  bankTypeBtnText: { fontSize: 13, fontWeight: "700", color: "#999" },
  bankTypeBtnTextActive: { color: "#8a6400" },
  bankUpiLabelBadge: {
    backgroundColor: "#f3e8ff", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  bankUpiLabelText: { fontSize: 11, fontWeight: "800", color: "#6d28d9" },

  /* About Us Admin */
  aboutMemberAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#fef6e4", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e8d9b0",
  },
  aboutMemberAvatarText: { fontSize: 14, fontWeight: "800", color: "#8a6400" },
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DESKTOP-RESPONSIVE OVERRIDES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const dStyles = StyleSheet.create({
  dashContainer: {
    maxWidth: 960,
    width: "100%" as any,
    alignSelf: "center" as any,
    backgroundColor: "#f8f9fb",
  },
  dashContent: {
    padding: 32,
    paddingBottom: 60,
  },
  dashHeaderRow: {
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 18,
  },
  dashTitle: {
    fontSize: 38,
    fontWeight: "900" as any,
  },
  dashSub: {
    fontSize: 20,
    marginTop: 6,
  },
  logoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: "800" as any,
  },

  /* Admin Tabs */
  adminTabRow: {
    paddingHorizontal: 32,
    gap: 8,
  },
  adminTabBtn: {
    paddingVertical: 16,
    gap: 10,
  },
  adminTabBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#8a6400",
  },
  adminTabText: {
    fontSize: 22,
    fontWeight: "800" as any,
  },

  /* Section Title */
  sectionTitle: {
    fontSize: 28,
    fontWeight: "900" as any,
    marginTop: 32,
    marginBottom: 16,
  },

  /* Global Premiums */
  globalRow: {
    gap: 20,
  },

  /* Tabs */
  tabWrapper: {
    padding: 5,
    borderRadius: 14,
    marginBottom: 12,
  },
  tabBtn: {
    paddingVertical: 14,
    borderRadius: 12,
  },
  tabText: {
    fontSize: 18,
    fontWeight: "800" as any,
  },

  /* Empty & Reset */
  emptyText: {
    fontSize: 18,
    marginTop: 28,
  },
  resetBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  resetText: {
    fontSize: 18,
    fontWeight: "800" as any,
  },
});
