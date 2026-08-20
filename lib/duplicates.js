// Returns the set of "orderId|department|branch" keys that appear more than
// once in the given logs — the same order legitimately passes through both
// Washing and Ironing, so a duplicate only counts within the same department
// & branch (i.e. someone registered the same order twice by mistake).
export function findDuplicateOrderKeys(logsArr) {
  const counts = new Map();
  logsArr.forEach((log) => {
    const key = `${log.orderId}|${log.department}|${log.branch}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}
