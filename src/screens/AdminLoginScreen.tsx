import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { loginAdmin } from "../utils/adminSettings";
export default function AdminLoginScreen({ navigation }: any) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      shake();
      return Alert.alert("Missing Credentials", "Enter username and password");
    }

    try {
      setLoading(true);
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
      ]).start();

      // Authenticate against Supabase
      const ok = await loginAdmin(username.trim(), password);
      if (ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
        navigation.replace("AdminPortal");
      } else {
        shake();
        Alert.alert("Access Denied", "Invalid credentials");
      }
    } catch (err) {
      shake();
      Alert.alert("Error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#0a0a0a", "#1a1a1a", "#0f0f0f"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="#666" />
        </TouchableOpacity>

        {/* Lock icon */}
        <View style={styles.lockCircle}>
          <Ionicons name="shield-checkmark" size={32} color="#d4a836" />
        </View>

        <Text style={styles.title}>Admin Access</Text>
        <Text style={styles.subtitle}>Restricted area — authorized only</Text>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }], width: "100%" }}>
          {/* Username */}
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#555" style={styles.inputIcon} />
            <TextInput
              placeholder="Username"
              placeholderTextColor="#555"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#555" style={styles.inputIcon} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#555"
              style={styles.input}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#555"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Login button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }], width: "100%" }}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#d4a836", "#b8860b"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <Text style={styles.buttonText}>Authenticating...</Text>
              ) : (
                <>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                  <Text style={styles.buttonText}>Authenticate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footerNote}>
          This area is protected. Unauthorized access is logged.
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28,
  },
  closeBtn: {
    position: "absolute", top: Platform.OS === "ios" ? 56 : 40, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
  },
  lockCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(212,168,54,0.1)",
    borderWidth: 1.5, borderColor: "rgba(212,168,54,0.25)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26, fontWeight: "800", color: "#d4a836",
    letterSpacing: 0.5, marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: "#666", marginBottom: 36,
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12, marginBottom: 14,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: "#eee", fontSize: 15, fontWeight: "500",
  },
  button: { marginTop: 10, borderRadius: 12, overflow: "hidden" },
  buttonDisabled: { opacity: 0.7 },
  buttonGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 15, gap: 8,
  },
  buttonText: {
    fontSize: 15, fontWeight: "800", color: "#000",
    letterSpacing: 0.5,
  },
  footerNote: {
    fontSize: 10, color: "#444", marginTop: 28,
    textAlign: "center", letterSpacing: 0.3,
  },
});
