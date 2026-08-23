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

// When two or more logs share the same orderId/department/branch, only the
// earliest-registered one should earn commission — the later duplicate(s)
// are the same physical order re-logged by mistake, not extra work done.
// Requires each log to have `id` and `createdAt`. Returns the set of log ids
// whose commission should be counted.
export function getCommissionCountedIds(logsArr) {
  const groups = new Map();
  logsArr.forEach((log) => {
    const key = `${log.orderId}|${log.department}|${log.branch}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  });

  const countedIds = new Set();
  groups.forEach((group) => {
    const earliest = group.reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b));
    countedIds.add(earliest.id);
  });
  return countedIds;
}
