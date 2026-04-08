import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { B2BRetailer, loginRetailer } from "../utils/b2bStore";

type Props = {
  onLoginSuccess: (retailer: B2BRetailer) => void;
  onRegister: () => void;
  onBack: () => void;
};

export default function B2BLoginScreen({ onLoginSuccess, onRegister, onBack }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      return setError("Please enter phone and password.");
    }
    setLoading(true);
    setError("");
    const result = await loginRetailer(phone, password);
    setLoading(false);
    if (result.success && result.retailer) {
      onLoginSuccess(result.retailer);
    } else {
      setError(result.error || "Login failed.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity onPress={onBack} style={styles.headerBack}>
        <Ionicons name="arrow-back" size={22} color="#8a6400" />
        <Text style={styles.headerBackText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.box}>
        <View style={styles.iconWrap}>
          <Ionicons name="storefront" size={40} color="#8a6400" />
        </View>
        <Text style={styles.title}>B2B Login</Text>
        <Text style={styles.subtitle}>Approved retailers only</Text>

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#bbb"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(t) => { setPhone(t); setError(""); }}
          maxLength={10}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#bbb"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(""); }}
          onSubmitEditing={handleLogin}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#c62828" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginBtnText}>{loading ? "Logging in…" : "Login"}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.registerPrompt}>Not registered yet?</Text>
        <TouchableOpacity style={styles.registerBtn} onPress={onRegister}>
          <Ionicons name="person-add-outline" size={16} color="#8a6400" />
          <Text style={styles.registerBtnText}>Register as Retailer</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f8f9fb", padding: 20 },

  headerBack: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerBackText: { color: "#8a6400", fontWeight: "700", fontSize: 14, marginLeft: 4 },

  box: { alignItems: "center" },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#fef6e4", alignItems: "center",
    justifyContent: "center", marginBottom: 12,
    borderWidth: 1.5, borderColor: "#d4a836",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#222" },
  subtitle: { fontSize: 13, color: "#888", marginTop: 4, marginBottom: 24 },

  input: {
    width: "100%", borderWidth: 1, borderColor: "#ddd", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: "#222", backgroundColor: "#fff", marginBottom: 10,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff0f0", borderRadius: 8, padding: 10,
    marginBottom: 8, width: "100%",
  },
  errorText: { color: "#c62828", fontSize: 13, flex: 1 },

  loginBtn: {
    width: "100%", backgroundColor: "#8a6400", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 4,
  },
  loginBtnDisabled: { backgroundColor: "#c9a84c" },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  divider: { height: 1, backgroundColor: "#eee", width: "100%", marginVertical: 20 },

  registerPrompt: { fontSize: 13, color: "#888", marginBottom: 10 },
  registerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#8a6400", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  registerBtnText: { color: "#8a6400", fontWeight: "700", fontSize: 14 },
});
