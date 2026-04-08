export type ChartDataPoint = {
    value: number;
    label: string; // E.g., 'Mon', 'Tue'
    date: string; // ISO date string or formatted date
};

// Generate somewhat realistic looking dummy data based on a base price
const generateDummyData = (days: number, basePrice: number, volatility: number): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];
    let currentPrice = basePrice;

    const today = new Date();

    for (let i = days; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);

        // Add some random movement
        const change = (Math.random() - 0.5) * volatility;
        currentPrice = currentPrice + change;

        // Format label based on timeframe
        let label = '';
        if (days <= 7) {
            label = d.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (days <= 30) {
            // Show label every 5 days for monthly
            label = i % 5 === 0 ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '';
        } else {
            // Show label every month for yearly
            label = d.getDate() === 1 ? d.toLocaleDateString('en-US', { month: 'short' }) : '';
        }

        data.push({
            value: Math.round(currentPrice),
            label,
            date: d.toISOString(),
        });
    }

    return data;
};

export const fetchHistoricalData = async (
    metal: 'Gold' | 'Silver',
    period: '1W' | '1M' | '6M' | '1Y'
): Promise<ChartDataPoint[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Base prices to start the dummy generation
    const baseGold = 75000;
    const baseSilver = 85000;

    let days = 7;
    let volatility = 500;

    switch (period) {
        case '1W':
            days = 7;
            volatility = 400;
            break;
        case '1M':
            days = 30;
            volatility = 800;
            break;
        case '6M':
            days = 180;
            volatility = 1200;
            break;
        case '1Y':
            days = 365;
            volatility = 1500;
            break;
    }

    const basePrice = metal === 'Gold' ? baseGold : baseSilver;
    const metalVolatility = metal === 'Gold' ? volatility : volatility * 0.8; // Silver slightly less volatile in absolute INR terms in this dummy data

    return generateDummyData(days, basePrice, metalVolatility);
};
