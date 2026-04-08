import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MENU_WIDTH = SCREEN_W * 0.78;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface MenuItem {
  id: string;
  label: string;
  icon: IoniconsName;
  subtitle?: string;
  badge?: string;
  section?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { id: "Home",        label: "Home",              icon: "home-outline",               subtitle: "Live bullion dashboard",     section: "main" },
  { id: "LiveRates",   label: "Live Rates",        icon: "pulse-outline",              subtitle: "Gold, Silver & INR",         section: "main" },
  { id: "Coins",       label: "MMTC Coins",        icon: "cash-outline",               subtitle: "Gold & silver coins",        section: "main" },
  { id: "Analytics",   label: "Analytics",         icon: "bar-chart-outline",          subtitle: "Charts & trends",            section: "main" },
  { id: "BankDetails", label: "Bank Details",      icon: "card-outline",               subtitle: "Payment information",        section: "tools" },
  { id: "Zakat",       label: "Zakaat Calculator", icon: "calculator-outline",         subtitle: "Calculate your zakaat",      section: "tools" },
  { id: "AboutUs",     label: "About Us",          icon: "information-circle-outline",  subtitle: "Our story",                  section: "tools" },
  { id: "B2B",         label: "B2B Portal",        icon: "storefront-outline",         subtitle: "Retailer wholesale",         section: "account", badge: "PRO" },
];

const SECTION_LABELS: Record<string, string> = {
  main: "NAVIGATION",
  tools: "TOOLS & INFO",
  account: "ACCOUNT",
};

const ICON_COLORS: Record<string, { bg: string; icon: string }> = {
  Home:        { bg: "#fef3cd", icon: "#8a6400" },
  LiveRates:   { bg: "#e8f5e9", icon: "#2e7d32" },
  Coins:       { bg: "#fff3e0", icon: "#e65100" },
  Analytics:   { bg: "#e3f2fd", icon: "#1565c0" },
  BankDetails: { bg: "#f3e5f5", icon: "#7b1fa2" },
  Zakat:       { bg: "#e0f2f1", icon: "#00695c" },
  AboutUs:     { bg: "#fce4ec", icon: "#c62828" },
  B2B:         { bg: "#fff8e1", icon: "#8a6400" },
};

interface SlideMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  activeRoute?: string;
}

export default function SlideMenu({ visible, onClose, onNavigate, activeRoute }: SlideMenuProps) {
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(MENU_ITEMS.map(() => new Animated.Value(0))).current;
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();

      itemAnims.forEach((a) => a.setValue(0));
      Animated.stagger(
        35,
        itemAnims.map((a) =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 })
        )
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -MENU_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
      });
    }
  }, [visible]);

  if (!visible && !rendered) {
    return null;
  }

  // Group items by section
  const sections: { key: string; items: MenuItem[] }[] = [];
  let currentSection = "";
  MENU_ITEMS.forEach((item) => {
    const sec = item.section || "main";
    if (sec !== currentSection) {
      sections.push({ key: sec, items: [] });
      currentSection = sec;
    }
    sections[sections.length - 1].items.push(item);
  });

  let globalIndex = 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "box-none"}>
      {/* Dark overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Menu panel */}
      <Animated.View style={[styles.menuPanel, { transform: [{ translateX: slideAnim }] }]}>
        {/* ── Header ── */}
        <View style={styles.menuHeader}>
          <View style={styles.headerRow}>
            <View style={styles.headerLogoCircle}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={styles.headerLogo}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>N. Khajawaal</Text>
              <Text style={styles.headerSubtitle}>Jewellers</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={20} color="#8a6400" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scrollable Items ── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {sections.map((section) => (
            <View key={section.key} style={styles.sectionWrap}>
              {/* Section label */}
              <View style={styles.sectionLabelRow}>
                <View style={styles.sectionLabelLine} />
                <Text style={styles.sectionLabelText}>
                  {SECTION_LABELS[section.key] || section.key.toUpperCase()}
                </Text>
                <View style={styles.sectionLabelLine} />
              </View>

              {/* Section items */}
              {section.items.map((item) => {
                const idx = globalIndex++;
                const isActive = activeRoute === item.id;
                const colors = ICON_COLORS[item.id] || { bg: "#f5f5f5", icon: "#666" };
                const translateX = itemAnims[idx].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0],
                });
                const opacity = itemAnims[idx];

                return (
                  <Animated.View
                    key={item.id}
                    style={{ opacity, transform: [{ translateX }] }}
                  >
                    <TouchableOpacity
                      style={[styles.menuItem, isActive && styles.menuItemActive]}
                      onPress={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: isActive ? colors.bg : colors.bg }]}>
                        <Ionicons
                          name={isActive ? (item.icon.replace("-outline", "") as IoniconsName) : item.icon}
                          size={18}
                          color={isActive ? colors.icon : colors.icon}
                        />
                      </View>
                      <View style={styles.menuItemTextWrap}>
                        <Text style={[styles.menuItemLabel, isActive && styles.menuItemLabelActive]}>
                          {item.label}
                        </Text>
                        {item.subtitle && (
                          <Text style={[styles.menuItemSub, isActive && styles.menuItemSubActive]}>
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                      {item.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={14} color={isActive ? "#8a6400" : "#ccc"} />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.menuFooter}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>
            N. Khajawaal Jewellers © {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerVersion}>v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  menuPanel: {
    position: "absolute",
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: SCREEN_H,
    backgroundColor: "#fefdfb",
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 25,
  },

  /* Header */
  menuHeader: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#d4a836",
  },
  headerLogo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#242424",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
    fontWeight: "500",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fef6e4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e4c4",
  },

  /* Scrollable area */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
  },

  /* Section */
  sectionWrap: {
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    marginTop: 8,
    marginBottom: 6,
    gap: 8,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ece4d4",
  },
  sectionLabelText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b8a070",
    letterSpacing: 1.8,
  },

  /* Items */
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 1,
  },
  menuItemActive: {
    backgroundColor: "#fdf5e3",
    borderWidth: 1,
    borderColor: "#eedcac",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  menuItemTextWrap: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 0.1,
  },
  menuItemLabelActive: {
    color: "#7a5800",
    fontWeight: "800",
  },
  menuItemSub: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 1,
    fontWeight: "400",
  },
  menuItemSubActive: {
    color: "#b8a070",
  },

  badge: {
    backgroundColor: "#8a6400",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },

  /* Footer */
  menuFooter: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 8,
    alignItems: "center",
  },
  footerDivider: {
    width: "80%",
    height: 1,
    backgroundColor: "#ece4d4",
    marginBottom: 10,
  },
  footerText: {
    fontSize: 10,
    color: "#b8a070",
    fontWeight: "600",
  },
  footerVersion: {
    fontSize: 9,
    color: "#ccc",
    marginTop: 2,
  },
});
