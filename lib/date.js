// Log.date is stored as a YYYY-MM-DD string (UTC-based, matching how the
// frontend generates it via `new Date().toISOString().split('T')[0]`).
export const todayStr = () => new Date().toISOString().split('T')[0];

export const isToday = (dateStr) => dateStr === todayStr();
