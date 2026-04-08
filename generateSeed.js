const YahooFinance = require('yahoo-finance2').default;
const fs = require('fs');

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function generateSeed() {
    try {
        console.log("Fetching live rates from proxy...");
        const url = 'http://bcast.asawirjewellers.com:7767/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/asawir';
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`;

        const res = await fetch(proxyUrl);
        const text = await res.text();

        // Parse live MCX from text
        let liveGold = 0;
        let liveSilver = 0;

        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
            const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
            if (parts.length < 4) continue;
            const label = parts[1].toUpperCase();
            if (label === 'GOLD 999' || label === 'GOLD 995') {
                if (!liveGold) liveGold = parseFloat(parts[2]);
            }
            if (label === 'SILVER 999') {
                if (!liveSilver) liveSilver = parseFloat(parts[2]);
            }
        }

        if (!liveGold || !liveSilver) {
            console.log("Could not fetch live MCX rates. Falling back to defaults.");
            liveGold = 73000;
            liveSilver = 88000;
        }

        console.log(`Live MCX -> Gold: ${liveGold}, Silver: ${liveSilver}`);

        // Fetch 30 days COMEX
        const end = new Date();
        const start = new Date(end.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days to ensure we get 30 trading days

        console.log("Fetching historical COMEX Gold (GC=F) & Silver (SI=F)...");
        const goldHistory = await yf.historical('GC=F', { period1: start, period2: end, interval: '1d' });
        const silverHistory = await yf.historical('SI=F', { period1: start, period2: end, interval: '1d' });

        // Take exactly last 30 trading days
        const recentGold = goldHistory.slice(-30);
        const recentSilver = silverHistory.slice(-30);

        const latestComexGold = recentGold[recentGold.length - 1].close;
        const latestComexSilver = recentSilver[recentSilver.length - 1].close;

        console.log(`Latest COMEX -> Gold: ${latestComexGold}, Silver: ${latestComexSilver}`);

        const goldRatio = liveGold / latestComexGold;
        // For silver, MCX is per kg, COMEX is per oz... Ratio handles all conversions automatically!
        const silverRatio = liveSilver / latestComexSilver;

        const finalGoldData = recentGold.map(day => ({
            value: Math.round(day.close * goldRatio),
            label: new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            date: new Date(day.date).toISOString()
        }));

        const finalSilverData = recentSilver.map(day => ({
            value: Math.round(day.close * silverRatio),
            label: new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            date: new Date(day.date).toISOString()
        }));

        const seedData = {
            gold: finalGoldData,
            silver: finalSilverData,
            generatedAt: new Date().toISOString()
        };

        fs.writeFileSync('./src/utils/authenticSeed.json', JSON.stringify(seedData, null, 2));
        console.log("✅ Successfully generated authentic MCX seed data at src/utils/authenticSeed.json!");

    } catch (error) {
        console.error("Error generating seed:", error);
    }
}

generateSeed();
