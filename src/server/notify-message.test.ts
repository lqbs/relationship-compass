import { describe, expect, it } from 'vitest';

import type { ContactEvaluation, WeeklyList } from '../domain/judgment.ts';
import { buildNotificationMessage } from './notify-message.ts';

const TODAY = '2026-09-12';

function stub(name: string): ContactEvaluation {
  return {
    contact: {
      id: name,
      name,
      note: '',
      cadenceKey: '1m',
      deferredUntil: null,
      isSample: false,
      createdAt: '2026-01-01',
    },
    status: 'overdue',
    lastContactDate: null,
    daysSinceContact: null,
    dueDate: null,
    overdueDays: 3,
    daysUntilDue: null,
    isDeferred: false,
  };
}

function makeList(parts: Partial<Pick<WeeklyList, 'overdue' | 'never' | 'dueSoon'>>): WeeklyList {
  const overdue = parts.overdue ?? [];
  const never = parts.never ?? [];
  const dueSoon = parts.dueSoon ?? [];
  return { today: TODAY, overdue, never, dueSoon, listCount: overdue.length + never.length + dueSoon.length };
}

describe('buildNotificationMessage', () => {
  it('清单为空 → null(保持安静)', () => {
    expect(buildNotificationMessage(makeList({}))).toBeNull();
  });

  it('少数人 → 全部列名', () => {
    expect(buildNotificationMessage(makeList({ overdue: [stub('张三'), stub('李四')] }))).toBe('该联系:张三、李四');
  });

  it('顺序为 逾期 → 未联系过 → 7 天内', () => {
    const list = makeList({ overdue: [stub('甲')], never: [stub('乙')], dueSoon: [stub('丙')] });
    expect(buildNotificationMessage(list)).toBe('该联系:甲、乙、丙');
  });

  it('超过 4 人 → 只列前 4 个并给出总数', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'].map(stub);
    expect(buildNotificationMessage(makeList({ overdue: names }))).toBe('该联系:A、B、C、D 等 6 人');
  });
});
