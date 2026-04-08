/**
 * mmtcDistributorRates.ts
 *
 * Calculates MMTC-PAMP distributor/partner prices from live MCX Futures rates.
 *
 * Formula (standard MMTC pricing):
 *   Distributor Price = (MCX rate/gram × weight)
 *                     + makingCharge
 *                     + 3%  GST on metal value
 *                     + 18% GST on making charge
 *
 * Data source: Asawir broadcast feed
 *   - GOLD FUTURE  → ÷ 10    = INR per gram (MCX gold is quoted per 10g)
 *   - SILVER FUTURE → ÷ 1000 = INR per gram (MCX silver is quoted per kg)
 *
 * This gives prices that closely match what MMTC charges its distributor
 * partners — without the additional Asawir dealer margin embedded in the
 * asawircoins broadcast feed.
 */

import { MmtcWeightPriceMap } from "./mmtcPampScraper";

// ---------------------------------------------------------------------------
// MMTC Making Charges (INR per piece, by weight in grams)
// Source: MMTC-PAMP published making charge schedule
// ---------------------------------------------------------------------------

export const MMTC_GOLD_MAKING: Record<string, number> = {
  "0.5": 220,
  "1":   275,
  "2":   350,
  "4":   600,
  "5":   800,
  "8":   1300,
  "10":  1400,
  "20":  2500,
  "31.1": 2800,
  "50":  3500,
  "100": 5750,
};

export const MMTC_SILVER_MAKING: Record<string, number> = {
  "10":   210,
  "20":   280,
  "50":   600,
  "100":  1100,
  "250":  2000,
  "500":  2850,
  "1000": 4110,
};

// ---------------------------------------------------------------------------
// Core formula
// ---------------------------------------------------------------------------

/**
 * Calculate MMTC distributor price for a single coin/bar weight.
 *
 * @param baseRatePerGram  MCX futures rate in INR per gram
 * @param weightGrams      Weight of the product in grams
 * @param makingCharge     MMTC making charge for this weight (INR per piece)
 * @returns                Distributor price inclusive of GST (rounded to ₹)
 */
export function calcDistributorPrice(
  baseRatePerGram: number,
  weightGrams: number,
  makingCharge: number
): number {
  const metalValue = baseRatePerGram * weightGrams;
  const gstOnMetal   = metalValue * 0.03;   // 3% GST on metal
  const gstOnMaking  = makingCharge * 0.18; // 18% GST on making charge
  return Math.round(metalValue + makingCharge + gstOnMetal + gstOnMaking);
}

// ---------------------------------------------------------------------------
// Build weight→price maps
// ---------------------------------------------------------------------------

/**
 * Returns a weight→price map for gold coins using MCX futures base rate.
 *
 * @param goldBasePerGram  MCX Gold Futures price ÷ 10  (INR per gram)
 */
export function buildGoldDistributorRates(
  goldBasePerGram: number
): MmtcWeightPriceMap {
  if (goldBasePerGram <= 0) return {};
  const map: MmtcWeightPriceMap = {};
  for (const [weightStr, making] of Object.entries(MMTC_GOLD_MAKING)) {
    const weight = parseFloat(weightStr);
    map[weightStr] = calcDistributorPrice(goldBasePerGram, weight, making);
  }
  return map;
}

/**
 * Returns a weight→price map for silver coins using MCX futures base rate.
 *
 * @param silverBasePerGram  MCX Silver Futures price ÷ 1000  (INR per gram)
 */
export function buildSilverDistributorRates(
  silverBasePerGram: number
): MmtcWeightPriceMap {
  if (silverBasePerGram <= 0) return {};
  const map: MmtcWeightPriceMap = {};
  for (const [weightStr, making] of Object.entries(MMTC_SILVER_MAKING)) {
    const weight = parseFloat(weightStr);
    map[weightStr] = calcDistributorPrice(silverBasePerGram, weight, making);
  }
  return map;
}
