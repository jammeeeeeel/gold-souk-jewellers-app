import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface RouteParams {
  title?: string;
  icon?: IoniconsName;
  description?: string;
}

export default function ComingSoonScreen() {
  const route = useRoute();
  const params = (route.params as RouteParams) || {};
  const { title = "Coming Soon", icon = "time-outline", description = "This feature is under development." } = params;

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();

    // Gentle pulse on the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View style={[styles.container, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Icon circle */}
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulse }] }]}>
          <View style={styles.iconInner}>
            <Ionicons name={icon} size={44} color="#8a6400" />
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Coming Soon badge */}
        <View style={styles.badge}>
          <Ionicons name="time-outline" size={13} color="#8a6400" />
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* Decorative dots */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { backgroundColor: "#d4a836" }]} />
          <View style={[styles.dot, { backgroundColor: "#e8d9b0" }]} />
          <View style={[styles.dot, { backgroundColor: "#d4a836" }]} />
        </View>

        <Text style={styles.footnote}>
          We're working hard to bring this feature to you.{"\n"}Stay tuned for updates!
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f9fb",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fef6e4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#e8d9b0",
    shadowColor: "#d4a836",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#242424",
    marginBottom: 12,
    textAlign: "center",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef6e4",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e8d9b0",
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8a6400",
    letterSpacing: 1,
  },

  description: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },

  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  footnote: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 18,
    fontStyle: "italic",
  },
});
