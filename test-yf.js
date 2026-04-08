const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance();

async function test() {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    console.log('Fetching from', start, 'to', end);
    const result = await yf.historical('GC=F', { period1: start, period2: end, interval: '1d' });
    console.log('Success!', result.length, 'records found.');
    if (result.length > 0) console.log(result[0]);
  } catch (e) {
    console.error('Failed:', e);
  }
}
test();
