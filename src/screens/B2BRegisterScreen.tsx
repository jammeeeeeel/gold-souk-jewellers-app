import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { registerRetailer } from "../utils/b2bStore";

export default function B2BRegisterScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !businessName.trim() || !phone.trim() || !password) {
      return Alert.alert("All fields are required.");
    }
    if (phone.trim().length < 10) {
      return Alert.alert("Enter a valid 10-digit phone number.");
    }
    if (password.length < 6) {
      return Alert.alert("Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      return Alert.alert("Passwords do not match.");
    }
    setLoading(true);
    const result = await registerRetailer(name, businessName, phone, password);
    setLoading(false);
    if (result.success) {
      setDone(true);
    } else {
      Alert.alert(result.error || "Registration failed.");
    }
  };

  if (done) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successIcon}>
          <Ionicons name="time-outline" size={52} color="#8a6400" />
        </View>
        <Text style={styles.successTitle}>Registration Submitted!</Text>
        <Text style={styles.successSub}>
          Your request has been sent to the admin.{"\n"}
          You'll be able to login once approved.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back to B2B Portal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* Header */}
        <TouchableOpacity onPress={onBack} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#8a6400" />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>

        <Ionicons name="storefront" size={44} color="#8a6400" style={styles.topIcon} />
        <Text style={styles.title}>Retailer Registration</Text>
        <Text style={styles.subtitle}>Register to access exclusive B2B rates</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your full name"
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your jewellery shop / business name"
          placeholderTextColor="#bbb"
          value={businessName}
          onChangeText={setBusinessName}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="10-digit mobile number"
          placeholderTextColor="#bbb"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a password (min 6 chars)"
          placeholderTextColor="#bbb"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Re-enter password"
          placeholderTextColor="#bbb"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleRegister}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? "Submitting..." : "Submit Registration"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, backgroundColor: "#f8f9fb", flexGrow: 1 },

  headerBack: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  headerBackText: { color: "#8a6400", fontWeight: "700", fontSize: 14, marginLeft: 4 },

  topIcon: { alignSelf: "center", marginTop: 8, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "800", color: "#222", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 4, marginBottom: 20 },

  label: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: "#222", backgroundColor: "#fff",
  },

  submitBtn: {
    backgroundColor: "#8a6400", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: "#c9a84c" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  successWrap: {
    flex: 1, backgroundColor: "#f8f9fb",
    alignItems: "center", justifyContent: "center", padding: 28,
  },
  successIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#fef6e4", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
    borderWidth: 2, borderColor: "#d4a836",
  },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#222", marginBottom: 8 },
  successSub: {
    fontSize: 14, color: "#666", textAlign: "center",
    lineHeight: 22, marginBottom: 28,
  },
  backBtn: {
    backgroundColor: "#8a6400", borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 32,
  },
  backBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
