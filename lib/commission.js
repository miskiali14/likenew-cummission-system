// Tiered per-order commission: an order's own quantity picks its tier, and
// that tier's flat rate is the commission for that one order (not multiplied
// by the quantity) — e.g. 5 orders in the 1-10 tier at 0.1 = 5 x 0.1 = $0.5.
// Ironing and Washing use different rate tables.
const TIERS_BY_DEPARTMENT = {
  IRONING: [
    { max: 10, rate: 0.1 },
    { max: 20, rate: 0.15 },
    { max: Infinity, rate: 0.2 },
  ],
  WASHING: [
    
    { max: 10, rate: 0.07 },
    { max: 20, rate: 0.1 },
    { max: Infinity, rate: 0.15 },
  ],
};

export function calculateOrderCommission(quantity, department) {
  const qty = Number(quantity) || 0;
  const tiers = TIERS_BY_DEPARTMENT[department] || TIERS_BY_DEPARTMENT.WASHING;
  const tier = tiers.find((t) => qty <= t.max);
  return tier.rate;
}
