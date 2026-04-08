import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AboutUsData, loadAboutUs } from "../utils/aboutUsStore";

/* ──── SECTION CARD ──── */
function SectionCard({ icon, iconColor, iconBg, title, children }: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={16} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/* ──── CONTACT ROW ──── */
function ContactRow({ icon, label, value, onPress }: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  if (!value) return null;
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.contactRow} onPress={onPress}>
      <View style={styles.contactIconBox}>
        <Ionicons name={icon as any} size={16} color="#8a6400" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, onPress && { color: "#1565c0" }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color="#ccc" />}
    </Wrapper>
  );
}

/* ──── SPECIALTY CHIP ──── */
function SpecialtyChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name="checkmark-circle" size={13} color="#8a6400" />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/* ──── MAIN SCREEN ──── */
export default function AboutUsScreen() {
  const [data, setData] = useState<AboutUsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await loadAboutUs();
      setData(d);
    } catch (e) {
      console.log("AboutUs load error:", e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#8a6400" />
        </View>
      </SafeAreaView>
    );
  }

  const openLink = (url: string) => { Linking.openURL(url).catch(() => {}); };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#8a6400" />}
      >
        {/* ── HERO HEADER ── */}
        <View style={styles.hero}>
          <View style={styles.heroIconOuter}>
            <View style={styles.heroIconInner}>
              <Ionicons name="diamond" size={32} color="#8a6400" />
            </View>
          </View>
          <Text style={styles.heroName}>{data.shopName}</Text>
          {data.tagline ? <Text style={styles.heroTagline}>{data.tagline}</Text> : null}
          {data.foundedYear ? (
            <View style={styles.heroBadge}>
              <Ionicons name="time-outline" size={12} color="#8a6400" />
              <Text style={styles.heroBadgeText}>Est. {data.foundedYear}</Text>
            </View>
          ) : null}
        </View>

        {/* ── OUR STORY ── */}
        {data.story ? (
          <SectionCard icon="book-outline" iconColor="#6d28d9" iconBg="#f3e8ff" title="Our Story">
            <Text style={styles.bodyText}>{data.story}</Text>
          </SectionCard>
        ) : null}

        {/* ── MISSION & VISION ── */}
        {(data.mission || data.vision) ? (
          <View style={styles.mvRow}>
            {data.mission ? (
              <View style={styles.mvCard}>
                <View style={[styles.mvIconCircle, { backgroundColor: "#e8f5e9" }]}>
                  <Ionicons name="flag-outline" size={18} color="#2e7d32" />
                </View>
                <Text style={styles.mvTitle}>Our Mission</Text>
                <Text style={styles.mvText}>{data.mission}</Text>
              </View>
            ) : null}
            {data.vision ? (
              <View style={styles.mvCard}>
                <View style={[styles.mvIconCircle, { backgroundColor: "#e3f2fd" }]}>
                  <Ionicons name="eye-outline" size={18} color="#1565c0" />
                </View>
                <Text style={styles.mvTitle}>Our Vision</Text>
                <Text style={styles.mvText}>{data.vision}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── SPECIALTIES ── */}
        {data.specialties.length > 0 ? (
          <SectionCard icon="sparkles-outline" iconColor="#b8860b" iconBg="#fef6e4" title="What We Offer">
            <View style={styles.chipsWrap}>
              {data.specialties.map((s, i) => <SpecialtyChip key={i} text={s} />)}
            </View>
          </SectionCard>
        ) : null}

        {/* ── TEAM ── */}
        {data.team.length > 0 ? (
          <SectionCard icon="people-outline" iconColor="#0d47a1" iconBg="#e3f2fd" title="Our Team">
            {data.team.map((m) => (
              <View key={m.id} style={styles.teamRow}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{m.name}</Text>
                  <Text style={styles.teamRole}>{m.role}</Text>
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ── CONTACT US ── */}
        <SectionCard icon="call-outline" iconColor="#c62828" iconBg="#fce4ec" title="Contact Us">
          <ContactRow
            icon="call-outline" label="Phone"
            value={data.phone}
            onPress={data.phone ? () => openLink(`tel:${data.phone}`) : undefined}
          />
          <ContactRow
            icon="logo-whatsapp" label="WhatsApp"
            value={data.whatsapp}
            onPress={data.whatsapp ? () => openLink(`https://wa.me/${data.whatsapp.replace(/[^0-9]/g, "")}`) : undefined}
          />
          <ContactRow
            icon="mail-outline" label="Email"
            value={data.email}
            onPress={data.email ? () => openLink(`mailto:${data.email}`) : undefined}
          />
          <ContactRow
            icon="logo-instagram" label="Instagram"
            value={data.instagram}
            onPress={data.instagram ? () => openLink(`https://instagram.com/${data.instagram.replace("@", "")}`) : undefined}
          />
          <ContactRow
            icon="globe-outline" label="Website"
            value={data.website}
            onPress={data.website ? () => openLink(data.website.startsWith("http") ? data.website : `https://${data.website}`) : undefined}
          />
          <ContactRow
            icon="location-outline" label="Address"
            value={data.address}
          />
          <ContactRow
            icon="time-outline" label="Timings"
            value={data.timings}
          />
        </SectionCard>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Ionicons name="diamond-outline" size={18} color="#d4a836" />
          <Text style={styles.footerText}>{data.shopName}</Text>
          <Text style={styles.footerSub}>Purity · Tradition · Trust</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8f9fb" },
  scrollContent: { paddingBottom: 30 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Hero */
  hero: {
    alignItems: "center", paddingTop: 28, paddingBottom: 22,
    paddingHorizontal: 20, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0e6c8",
  },
  heroIconOuter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fef6e4", justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#e8d9b0", marginBottom: 14,
  },
  heroIconInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
  },
  heroName: { fontSize: 22, fontWeight: "800", color: "#242424", textAlign: "center" },
  heroTagline: { fontSize: 13, color: "#888", marginTop: 6, textAlign: "center", fontStyle: "italic", lineHeight: 19 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 10, backgroundColor: "#fef6e4", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "#e8d9b0",
  },
  heroBadgeText: { fontSize: 11, fontWeight: "700", color: "#8a6400" },

  /* Section Card */
  sectionCard: {
    marginHorizontal: 14, marginTop: 14, backgroundColor: "#fff",
    borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#f0f0f0",
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIconCircle: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#333" },

  /* Body Text */
  bodyText: { fontSize: 14, color: "#555", lineHeight: 22 },

  /* Mission / Vision */
  mvRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 14 },
  mvCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#f0f0f0", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  mvIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  mvTitle: { fontSize: 14, fontWeight: "800", color: "#333", marginBottom: 8, textAlign: "center" },
  mvText: { fontSize: 12, color: "#666", lineHeight: 18, textAlign: "center" },

  /* Chips */
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fef6e4", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#f0e6c8",
  },
  chipText: { fontSize: 12, fontWeight: "700", color: "#6b5200" },

  /* Team */
  teamRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  teamAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fef6e4", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#e8d9b0",
  },
  teamAvatarText: { fontSize: 16, fontWeight: "800", color: "#8a6400" },
  teamName: { fontSize: 14, fontWeight: "700", color: "#333" },
  teamRole: { fontSize: 12, color: "#888", marginTop: 2 },

  /* Contact */
  contactRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  contactIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#fef6e4", justifyContent: "center", alignItems: "center",
  },
  contactLabel: { fontSize: 11, color: "#aaa", fontWeight: "600" },
  contactValue: { fontSize: 13, fontWeight: "700", color: "#333", marginTop: 1 },

  /* Footer */
  footer: { alignItems: "center", marginTop: 24, gap: 6 },
  footerDivider: { width: 40, height: 2, backgroundColor: "#e8d9b0", borderRadius: 1, marginBottom: 8 },
  footerText: { fontSize: 14, fontWeight: "800", color: "#8a6400" },
  footerSub: { fontSize: 11, color: "#bbb", letterSpacing: 1.5 },
});
