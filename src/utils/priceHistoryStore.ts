import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChartDataPoint = {
    value: number;
    label: string;
    date: string;
};

const STORAGE_KEY_GOLD = '@history_gold_v2';
const STORAGE_KEY_SILVER = '@history_silver_v2';

// Need to require the JSON file so bundler includes it
const authenticSeed = require('./authenticSeed.json');

// Seed initial data so the charts aren't empty on day 1
const seedInitialData = async () => {
    try {
        const existingGold = await AsyncStorage.getItem(STORAGE_KEY_GOLD);
        if (!existingGold) {
            console.log('Seeding initial authentic market history...');
            await AsyncStorage.setItem(STORAGE_KEY_GOLD, JSON.stringify(authenticSeed.gold));
            await AsyncStorage.setItem(STORAGE_KEY_SILVER, JSON.stringify(authenticSeed.silver));
        }
    } catch (e) {
        console.error('Error seeding historical data', e);
    }
};

export const saveDailyPrice = async (metal: 'Gold' | 'Silver', currentPrice: number) => {
    if (!currentPrice || currentPrice <= 0) return;

    const key = metal === 'Gold' ? STORAGE_KEY_GOLD : STORAGE_KEY_SILVER;

    try {
        const jsonValue = await AsyncStorage.getItem(key);
        let history: ChartDataPoint[] = jsonValue ? JSON.parse(jsonValue) : [];

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight for daily deduplication
        const dateStr = today.toISOString();
        const label = today.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

        // Check if we already have an entry for today
        const existingIndex = history.findIndex(p => {
            const d = new Date(p.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        });

        if (existingIndex >= 0) {
            // Update today's closing price
            history[existingIndex].value = currentPrice;
        } else {
            // Add new day
            history.push({ value: currentPrice, label, date: dateStr });
        }

        // Keep only the last 365 records to avoid massive storage bloat
        if (history.length > 365) {
            history = history.slice(history.length - 365);
        }

        await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.error(`Failed to save daily price for ${metal}`, e);
    }
};

export const getHistoricalPrices = async (
    metal: 'Gold' | 'Silver',
    period: '1W' | '1M' | '6M' | '1Y'
): Promise<ChartDataPoint[]> => {

    // Ensure seed data exists
    await seedInitialData();

    const key = metal === 'Gold' ? STORAGE_KEY_GOLD : STORAGE_KEY_SILVER;
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        if (!jsonValue) return [];

        const history: ChartDataPoint[] = JSON.parse(jsonValue);

        let daysToInclude = 7;
        switch (period) {
            case '1W': daysToInclude = 7; break;
            case '1M': daysToInclude = 30; break;
            case '6M': daysToInclude = 180; break;
            case '1Y': daysToInclude = 365; break;
        }

        // Filter to requested period
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - daysToInclude);
        cutoffDate.setHours(0, 0, 0, 0);

        const filtered = history.filter(p => new Date(p.date) >= cutoffDate);

        // Format labels depending on the number of points for a cleaner chart
        return filtered.map((point, i) => {
            const d = new Date(point.date);
            let cleanLabel = '';

            if (daysToInclude <= 7) {
                cleanLabel = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue
            } else if (daysToInclude <= 30) {
                // Show label every ~5 days
                cleanLabel = i % 5 === 0 ? point.label : '';
            } else if (daysToInclude <= 180) {
                // Show label once a month
                cleanLabel = i % 30 === 0 ? d.toLocaleDateString('en-US', { month: 'short' }) : '';
            } else {
                cleanLabel = i % 60 === 0 ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '';
            }

            return { ...point, label: cleanLabel };
        });

    } catch (e) {
        console.error(`Failed to load historical data for ${metal}`, e);
        return [];
    }
};
