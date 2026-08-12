// Tiered per-order commission: the rate is picked by that single order's own
// quantity, then applied to that same quantity.
export function calculateOrderCommission(quantity) {
  const qty = Number(quantity) || 0;
  if (qty <= 10) return qty * 0.1;
  if (qty <= 20) return qty * 0.15;
  return qty * 0.2;
}
