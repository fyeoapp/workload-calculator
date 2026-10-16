/** Busy-week tuning. score = sum(weights) + PER_ITEM * count + HEAVIEST * max(weight). */
export const WORKLOAD = {
  UNKNOWN_WEIGHT: 3, // used when a weight is blank
  PER_ITEM: 1.5,
  HEAVIEST: 0.5,
  BUSY_AT: 25,
  HEAVY_AT: 50,
  // Same score formula, applied to a single day (calendar view).
  DAY_BUSY_AT: 15,
  DAY_HEAVY_AT: 35,
};
