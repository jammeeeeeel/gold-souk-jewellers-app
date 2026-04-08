import { fetchMmtcGoldPrices, fetchMmtcSilverPrices } from "./src/utils/mmtcPampScraper";
async function test() {
  console.log("Fetching Gold...");
  const gold = await fetchMmtcGoldPrices();
  console.log("Gold:", gold);
  console.log("Fetching Silver...");
  const silver = await fetchMmtcSilverPrices();
  console.log("Silver:", silver);
}
test().catch(console.error);
