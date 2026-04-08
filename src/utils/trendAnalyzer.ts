import { ChartDataPoint } from './priceHistoryStore';

export type TrendStatus = 'Bullish' | 'Bearish' | 'Neutral';

export const calculateSMA = (data: ChartDataPoint[], period: number = 7): number | null => {
    if (!data || data.length < period) {
        return null;
    }

    // Get the last `period` number of days
    const recentData = data.slice(data.length - period);

    const sum = recentData.reduce((acc, point) => acc + point.value, 0);
    return sum / period;
};

export const getTrendForecast = (
    currentPrice: number,
    historicalData: ChartDataPoint[],
    period: number = 7
): { status: TrendStatus; sma: number | null } => {

    const sma = calculateSMA(historicalData, period);

    if (sma === null) {
        return { status: 'Neutral', sma: null }; // Not enough data
    }

    // If current price is > 0.5% above SMA, it's solidly Bullish
    // If current price is < 0.5% below SMA, it's solidly Bearish
    // Otherwise, Neutral (sideways movement)
    const differencePercentage = ((currentPrice - sma) / sma) * 100;

    let status: TrendStatus = 'Neutral';
    if (differencePercentage > 0.2) {
        status = 'Bullish';
    } else if (differencePercentage < -0.2) {
        status = 'Bearish';
    }

    return { status, sma };
};
