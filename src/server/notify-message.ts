import type { WeeklyList } from '../domain/judgment.ts';

const MAX_NAMES = 4;

/**
 * 生成系统通知的正文;清单为空时返回 null(不打扰)。
 * 顺序:逾期 → 未联系过 → 7 天内;超过 4 人只列前 4 个并给出总数。
 */
export function buildNotificationMessage(list: WeeklyList): string | null {
  const names = [...list.overdue, ...list.never, ...list.dueSoon].map((entry) => entry.contact.name);
  if (names.length === 0) return null;

  const preview = names.slice(0, MAX_NAMES).join('、');
  return names.length > MAX_NAMES ? `该联系:${preview} 等 ${names.length} 人` : `该联系:${preview}`;
}
