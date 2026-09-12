const DAY_MS = 86_400_000;

/** 把 YYYY-MM-DD 解析为 UTC 零点毫秒数;用 UTC 做整数天运算,避开夏令时。 */
function parseToUtc(date: string): number {
  const [year, month, day] = date.split('-');
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatUtc(parseToUtc(date) + days * DAY_MS);
}

/** 返回 a - b 的天数(可为负)。 */
export function diffDays(a: string, b: string): number {
  return Math.round((parseToUtc(a) - parseToUtc(b)) / DAY_MS);
}

/** 以本机本地时区求"今天",返回 YYYY-MM-DD。 */
export function todayLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
