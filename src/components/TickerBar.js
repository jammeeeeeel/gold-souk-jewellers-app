import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { fetchLiveRates } from "../utils/asawirScraper";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SPEED_PX_PER_SEC = 30;

export default function TickerBar() {
  const [items, setItems] = useState([]);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const tickerAnimRef = useRef(null);
  const hasEnteredRef = useRef(false);

  const loadTicker = async () => {
    try {
      const res = await fetchLiveRates();
      const allItems = [...res.topBar, ...res.products];
      if (allItems.length > 0) {
        setItems((prev) => {
          const same =
            prev.length === allItems.length &&
            prev.every(
              (p, i) =>
                p.label === allItems[i]?.label &&
                p.buy === allItems[i]?.buy &&
                p.sell === allItems[i]?.sell
            );
          return same ? prev : allItems;
        });
      }
    } catch (err) {
      console.log("Ticker fetch error:", err);
    }
  };

  // Fetch data periodically — but DON'T restart animation
  useEffect(() => {
    loadTicker();
    const interval = setInterval(loadTicker, 5000);
    return () => clearInterval(interval);
  }, []);

  // Seamless infinite marquee with constant speed
  useEffect(() => {
    if (items.length === 0 || segmentWidth <= 0) return;

    tickerAnimRef.current?.stop?.();

    const loopAnim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -segmentWidth,
        duration: Math.max(1000, Math.round((segmentWidth / SPEED_PX_PER_SEC) * 1000)),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true;
      translateX.setValue(SCREEN_WIDTH);

      tickerAnimRef.current = Animated.sequence([
        Animated.timing(translateX, {
          toValue: 0,
          duration: Math.max(1000, Math.round((SCREEN_WIDTH / SPEED_PX_PER_SEC) * 1000)),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        loopAnim,
      ]);
    } else {
      translateX.setValue(0);
      tickerAnimRef.current = loopAnim;
    }

    tickerAnimRef.current.start();

    return () => {
      tickerAnimRef.current?.stop?.();
    };
  }, [items, segmentWidth, translateX]);

  if (items.length === 0) return null;

  const renderItems = (suffix) =>
    items.map((item, idx) => {
      const price = item.sell && item.sell !== "-" ? item.sell : item.buy;
      return (
        <View key={`${suffix}-${item.label}-${idx}`} style={styles.item}>
          <Text style={styles.label}>
            {item.label}:{" "}
            <Text style={styles.price}>
              {price && price !== "-" ? `₹${price}` : "--"}
            </Text>
          </Text>
        </View>
      );
    });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
        <View
          style={styles.segment}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0) setSegmentWidth(width);
          }}
        >
          {renderItems("a")}
        </View>
        <View style={styles.segment}>{renderItems("b")}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 36,
    backgroundColor: "#f6d48f",
    overflow: "hidden",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    marginRight: 30,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4a3500",
  },
  price: {
    fontWeight: "800",
    color: "#1a6e00",
  },
});
