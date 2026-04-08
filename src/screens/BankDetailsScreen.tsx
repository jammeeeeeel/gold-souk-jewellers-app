import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BankAccount,
  BankDetailsData,
  loadBankDetails,
  UpiDetail,
} from "../utils/bankDetailsStore";

/* ──── Clipboard helper ──── */
async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/* ──── Copy Button with feedback ──── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={16} color={copied ? "#22c55e" : "#8a6400"} />
      {copied && <Text style={styles.copiedText}>Copied!</Text>}
    </TouchableOpacity>
  );
}

/* ──── Detail Row ──── */
function DetailRow({ icon, label, value, copyable }: { icon: string; label: string; value: string; copyable?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon as any} size={15} color="#8a6400" />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} selectable>{value}</Text>
      </View>
      {copyable && value.trim() && <CopyButton text={value} />}
    </View>
  );
}

/* ──── Bank Account Card ──── */
function BankAccountCard({ account, index }: { account: BankAccount; index: number }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10, delay: index * 100 }),
    ]).start();
  }, []);

  if (!account.accountNumber && !account.ifscCode) return null;

  return (
    <Animated.View style={[styles.accountCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
      {/* Bank Header */}
      <View style={styles.accountHeader}>
        <View style={styles.bankIconCircle}>
          <Ionicons name="business" size={18} color="#8a6400" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bankName}>{account.bankName || "Bank Account"}</Text>
          <View style={styles.accountTypeBadge}>
            <Text style={styles.accountTypeText}>
              {account.accountType === "savings" ? "SAVINGS" : "CURRENT"}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.cardDivider} />

      {/* Details */}
      <DetailRow icon="person-outline" label="Account Holder" value={account.accountHolder} copyable />
      <DetailRow icon="card-outline" label="Account Number" value={account.accountNumber} copyable />
      <DetailRow icon="git-branch-outline" label="IFSC Code" value={account.ifscCode} copyable />
      <DetailRow icon="location-outline" label="Branch" value={account.branchName} />
    </Animated.View>
  );
}

/* ──── UPI Card ──── */
function UpiCard({ details }: { details: UpiDetail[] }) {
  const validDetails = details.filter((d) => d.upiId?.trim());
  if (validDetails.length === 0) return null;

  return (
    <View style={styles.upiCard}>
      <View style={styles.upiHeader}>
        <View style={styles.upiIconCircle}>
          <Ionicons name="phone-portrait-outline" size={18} color="#6d28d9" />
        </View>
        <Text style={styles.upiTitle}>UPI Payment</Text>
      </View>
      <View style={styles.cardDivider} />
      {validDetails.map((upi) => (
        <View key={upi.id} style={styles.upiRow}>
          <View style={styles.upiLabelBadge}>
            <Text style={styles.upiLabelText}>{upi.label || "UPI"}</Text>
          </View>
          <Text style={styles.upiIdText} selectable>{upi.upiId}</Text>
          <CopyButton text={upi.upiId} />
        </View>
      ))}
    </View>
  );
}

/* ──── MAIN SCREEN ──── */
export default function BankDetailsScreen() {
  const [data, setData] = useState<BankDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const d = await loadBankDetails();
    setData(d);
    setLoading(false);
    if (isRefresh) setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const handleCallPress = () => {
    if (data?.shopPhone) {
      Linking.openURL(`tel:${data.shopPhone}`);
    }
  };

  const handleEmailPress = () => {
    if (data?.shopEmail) {
      Linking.openURL(`mailto:${data.shopEmail}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#8a6400" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const hasAccounts = data.accounts.some((a) => a.accountNumber?.trim());
  const hasUpi = data.upiDetails.some((u) => u.upiId?.trim());
  const isEmpty = !hasAccounts && !hasUpi;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#8a6400" />
        }
      >
        {/* Shop Info Header */}
        <View style={styles.shopHeader}>
          <View style={styles.shopIconCircle}>
            <Ionicons name="wallet-outline" size={28} color="#8a6400" />
          </View>
          <Text style={styles.shopName}>{data.shopName || "Payment Details"}</Text>
          <Text style={styles.shopSubtitle}>Use the details below to make a payment</Text>
        </View>

        {/* Empty State */}
        {isEmpty && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color="#ddd" />
            <Text style={styles.emptyTitle}>No Payment Details</Text>
            <Text style={styles.emptyDesc}>
              Bank details have not been added yet.{"\n"}Please contact the jeweller directly.
            </Text>
          </View>
        )}

        {/* Bank Accounts */}
        {hasAccounts && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>BANK ACCOUNTS</Text>
              <View style={styles.sectionLine} />
            </View>
            {data.accounts.map((account, i) => (
              <BankAccountCard key={account.id} account={account} index={i} />
            ))}
          </>
        )}

        {/* UPI Details */}
        {hasUpi && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>UPI PAYMENT</Text>
              <View style={styles.sectionLine} />
            </View>
            <UpiCard details={data.upiDetails} />
          </>
        )}

        {/* Important Note */}
        {data.note?.trim() && (
          <View style={styles.noteCard}>
            <Ionicons name="information-circle" size={18} color="#b8860b" />
            <Text style={styles.noteText}>{data.note}</Text>
          </View>
        )}

        {/* Contact Row */}
        {(data.shopPhone?.trim() || data.shopEmail?.trim()) && (
          <View style={styles.contactRow}>
            {data.shopPhone?.trim() && (
              <TouchableOpacity style={styles.contactBtn} onPress={handleCallPress}>
                <Ionicons name="call-outline" size={18} color="#fff" />
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>
            )}
            {data.shopEmail?.trim() && (
              <TouchableOpacity style={[styles.contactBtn, styles.emailBtn]} onPress={handleEmailPress}>
                <Ionicons name="mail-outline" size={18} color="#fff" />
                <Text style={styles.contactBtnText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Address */}
        {data.shopAddress?.trim() && (
          <View style={styles.addressCard}>
            <Ionicons name="location-outline" size={16} color="#8a6400" />
            <Text style={styles.addressText}>{data.shopAddress}</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ──── STYLES ──── */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f9fb",
  },
  scrollContent: {
    paddingBottom: 30,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Shop Header */
  shopHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0e6c8",
  },
  shopIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fef6e4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#e8d9b0",
  },
  shopName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#242424",
    textAlign: "center",
  },
  shopSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e8e0cc",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#b8a070",
    letterSpacing: 1.8,
  },

  /* Account Card */
  accountCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0e6c8",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bankIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fef6e4",
    justifyContent: "center",
    alignItems: "center",
  },
  bankName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
  },
  accountTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f5e9",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  accountTypeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2e7d32",
    letterSpacing: 0.5,
  },

  /* Card Divider */
  cardDivider: {
    height: 1,
    backgroundColor: "#f0e6c8",
    marginVertical: 12,
  },

  /* Detail Row */
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 10,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#fef6e4",
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginTop: 1,
  },

  /* Copy */
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fef6e4",
  },
  copiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#22c55e",
  },

  /* UPI Card */
  upiCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ede5f5",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  upiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  upiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
  },
  upiTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
  },
  upiRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  upiLabelBadge: {
    backgroundColor: "#f3e8ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  upiLabelText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6d28d9",
  },
  upiIdText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  /* Note Card */
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 16,
    backgroundColor: "#fef6e4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: "#6b5300",
    lineHeight: 19,
    fontWeight: "500",
  },

  /* Contact */
  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 16,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#8a6400",
    borderRadius: 12,
    paddingVertical: 13,
  },
  emailBtn: {
    backgroundColor: "#555",
  },
  contactBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Address */
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 19,
  },

  /* Empty State */
  emptyState: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#999",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#bbb",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
});
