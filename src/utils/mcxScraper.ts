import { Alert } from "react-native";

import { saveDailyPrice } from "./priceHistoryStore";

/**
 * Fetches real-time MCX Gold and Silver rates by scraping IBJA Rates via CORS Proxy
 * Returns { gold: number, silver: number }
 */
export const fetchMCXRates = async () => {
    try {
        // using AllOrigins proxy because React Native strict fetch will fail on regular websites without CORS headers
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://ibjarates.com/')}&t=${Date.now()}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            }
        });

        const json = await response.json();
        const htmlText = json.contents;

        let goldRate = null;
        let silverRate = null;

        const goldMatch = htmlText.match(/data-label="Gold 999"[^>]*>([\d,]+)/);
        const silverMatch = htmlText.match(/data-label="Silver 999"[^>]*>([\d,]+)/);

        if (goldMatch && goldMatch[1]) {
            goldRate = parseFloat(goldMatch[1].replace(/,/g, ''));
            await saveDailyPrice('Gold', goldRate);
        }

        if (silverMatch && silverMatch[1]) {
            silverRate = parseFloat(silverMatch[1].replace(/,/g, ''));
            await saveDailyPrice('Silver', silverRate);
        }

        return {
            gold: goldRate || "----",
            silver: silverRate || "----",
        };
    } catch (error: any) {
        console.log("Error scraping MCX rates:", error);
        Alert.alert("MCX Scrape Error", error?.message || String(error));
        return { gold: "----", silver: "----" };
    }
};
