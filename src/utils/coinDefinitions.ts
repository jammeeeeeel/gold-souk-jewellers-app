/**
 * coinDefinitions.ts
 *
 * Static MMTC-PAMP coin/bar denomination list.
 * These are the products displayed in the app — prices are calculated
 * dynamically from MCX futures rates via mmtcDistributorRates.ts.
 *
 * No external API calls needed. Just a fixed list of denominations.
 */

import { RateItem } from "./asawirScraper";
import { MMTC_GOLD_MAKING, MMTC_SILVER_MAKING } from "./mmtcDistributorRates";

/* ──── Gold coin denominations (from MMTC product line) ──── */
const GOLD_COINS: RateItem[] = [
  { id: "mmtc_gold_0.5", label: "MMTC Gold Coin 0.500 GM", buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_1",   label: "MMTC Gold Coin 1 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_2",   label: "MMTC Gold Coin 2 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_4",   label: "MMTC Gold Coin 4 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_5",   label: "MMTC Gold Coin 5 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_8",   label: "MMTC Gold Bar 8 GM",      buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_10",  label: "MMTC Gold Coin 10 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_20",  label: "MMTC Gold Bar 20 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_50",  label: "MMTC Gold Bar 50 GM",     buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_gold_100", label: "MMTC Gold Bar 100 GM",    buy: "-", sell: "-", high: "-", low: "-" },
];

/* ──── Silver coin denominations (from MMTC product line) ──── */
const SILVER_COINS: RateItem[] = [
  { id: "mmtc_silver_10",   label: "MMTC Silver Coin 10 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_20",   label: "MMTC Silver Coin 20 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_50",   label: "MMTC Silver Coin 50 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_100",  label: "MMTC Silver Bar 100 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_250",  label: "MMTC Silver Bar 250 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_500",  label: "MMTC Silver Bar 500 GM",    buy: "-", sell: "-", high: "-", low: "-" },
  { id: "mmtc_silver_1000", label: "MMTC Silver Bar 1000 GM",   buy: "-", sell: "-", high: "-", low: "-" },
];

/**
 * Returns the static list of gold coin denominations.
 * These don't change — prices are calculated from MCX rates.
 */
export function getGoldCoinList(): RateItem[] {
  return GOLD_COINS;
}

/**
 * Returns the static list of silver coin denominations.
 */
export function getSilverCoinList(): RateItem[] {
  return SILVER_COINS;
}
