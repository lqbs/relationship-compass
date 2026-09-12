import { describe, expect, it } from 'vitest';

import { addDays, diffDays } from './dates.ts';
import { buildWeeklyList, describeReason, evaluateContact } from './judgment.ts';
import { CADENCE_PRESETS, type CadenceKey, type Contact, type Interaction } from './types.ts';

const TODAY = '2026-09-12';

function makeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: id,
    note: '',
    cadenceKey: '1m',
    deferredUntil: null,
    isSample: false,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function makeInteraction(contactId: string, date: string): Interaction {
  return { id: `${contactId}@${date}`, contactId, date, note: '', createdAt: `${date}T00:00:00.000Z` };
}

function daysAgo(n: number): string {
  return addDays(TODAY, -n);
}

describe('evaluateContact 判定单个联系人的状态', () => {
  it('从未有互动 → never,且没有上次联系时间与到期日', () => {
    const result = evaluateContact(makeContact('a'), [], TODAY);
    expect(result.status).toBe('never');
    expect(result.lastContactDate).toBeNull();
    expect(result.dueDate).toBeNull();
    expect(result.daysSinceContact).toBeNull();
  });

  it('恰好到期(今天 = 上次联系 + 节奏)→ 逾期,欠 0 天', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [makeInteraction('a', daysAgo(14))], TODAY);
    expect(result.status).toBe('overdue');
    expect(result.overdueDays).toBe(0);
    expect(result.dueDate).toBe(TODAY);
  });

  it('逾期一天 → 欠 1 天', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [makeInteraction('a', daysAgo(15))], TODAY);
    expect(result.status).toBe('overdue');
    expect(result.overdueDays).toBe(1);
  });

  it('明天到期 → 未来 7 天内,还有 1 天', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [makeInteraction('a', daysAgo(13))], TODAY);
    expect(result.status).toBe('dueSoon');
    expect(result.daysUntilDue).toBe(1);
  });

  it('边界:7 天后到期在清单内,8 天后到期不在清单', () => {
    const seven = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [makeInteraction('a', daysAgo(7))], TODAY);
    expect(seven.status).toBe('dueSoon');
    expect(seven.daysUntilDue).toBe(7);

    const eight = evaluateContact(makeContact('b', { cadenceKey: '2w' }), [makeInteraction('b', daysAgo(6))], TODAY);
    expect(eight.status).toBe('notDue');
    expect(eight.daysUntilDue).toBeNull();
  });

  it('多条互动时,取最近一次计算到期', () => {
    const result = evaluateContact(
      makeContact('a', { cadenceKey: '1m' }),
      [makeInteraction('a', daysAgo(50)), makeInteraction('a', daysAgo(25)), makeInteraction('a', daysAgo(90))],
      TODAY,
    );
    expect(result.lastContactDate).toBe(daysAgo(25));
    expect(result.status).toBe('dueSoon');
    expect(result.daysUntilDue).toBe(5);
  });

  it('五个节奏档都能算出正确的到期日', () => {
    for (const [key, preset] of Object.entries(CADENCE_PRESETS)) {
      const result = evaluateContact(
        makeContact(key, { cadenceKey: key as CadenceKey }),
        [makeInteraction(key, TODAY)],
        TODAY,
      );
      expect(result.dueDate).toBe(addDays(TODAY, preset.days));
    }
  });

  it('延后中(today < 延后至)→ deferred,不参与清单', () => {
    const result = evaluateContact(makeContact('a', { deferredUntil: addDays(TODAY, 3) }), [], TODAY);
    expect(result.status).toBe('deferred');
    expect(result.isDeferred).toBe(true);
  });

  it('延后到期当天自动回归,按正常规则分类', () => {
    const result = evaluateContact(
      makeContact('a', { cadenceKey: '2w', deferredUntil: TODAY }),
      [makeInteraction('a', daysAgo(20))],
      TODAY,
    );
    expect(result.isDeferred).toBe(false);
    expect(result.status).toBe('overdue');
    expect(result.overdueDays).toBe(6);
  });
});

describe('buildWeeklyList 生成本周清单', () => {
  it('分组与排序:逾期(欠得最久在前)、未联系过、7 天内到期;其余不进清单', () => {
    const contacts = [
      makeContact('久', { name: '久' }),
      makeContact('近', { name: '近' }),
      makeContact('新', { name: '新' }),
      makeContact('将', { name: '将', cadenceKey: '2w' }),
      makeContact('闲', { name: '闲' }),
    ];
    const interactions = [
      makeInteraction('久', daysAgo(60)),
      makeInteraction('近', daysAgo(40)),
      makeInteraction('将', daysAgo(10)),
      makeInteraction('闲', daysAgo(5)),
    ];

    const list = buildWeeklyList(contacts, interactions, TODAY);

    expect(list.overdue.map((entry) => entry.contact.id)).toEqual(['久', '近']);
    expect(list.never.map((entry) => entry.contact.id)).toEqual(['新']);
    expect(list.dueSoon.map((entry) => entry.contact.id)).toEqual(['将']);
    expect(list.listCount).toBe(4);
    expect(list.today).toBe(TODAY);
  });

  it('逾期同欠期时按姓名排序', () => {
    const contacts = [makeContact('一', { name: '白安' }), makeContact('二', { name: '安乐' })];
    const interactions = [makeInteraction('一', daysAgo(60)), makeInteraction('二', daysAgo(60))];
    const list = buildWeeklyList(contacts, interactions, TODAY);
    expect(list.overdue.map((entry) => entry.contact.name)).toEqual(['安乐', '白安']);
  });

  it('跨年计算正确', () => {
    const list = buildWeeklyList(
      [makeContact('a', { cadenceKey: '2w' })],
      [makeInteraction('a', '2025-12-28')],
      '2026-01-11',
    );
    expect(list.overdue).toHaveLength(1);
    expect(list.overdue[0]?.overdueDays).toBe(0);
  });

  it('延后中的人不计入清单人数', () => {
    const list = buildWeeklyList([makeContact('a', { deferredUntil: addDays(TODAY, 10) })], [], TODAY);
    expect(list.listCount).toBe(0);
  });
});

describe('describeReason 生成上榜依据文案', () => {
  it('逾期:显示已有多久没联系与期望节奏', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '1m' }), [makeInteraction('a', daysAgo(42))], TODAY);
    expect(describeReason(result)).toBe('42 天没联系 · 希望每 1 个月');
  });

  it('未联系过:显示还没联系过', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [], TODAY);
    expect(describeReason(result)).toBe('还没联系过 · 希望每 2 周');
  });

  it('即将到期:显示上次联系与还有几天到期', () => {
    const result = evaluateContact(makeContact('a', { cadenceKey: '2w' }), [makeInteraction('a', daysAgo(10))], TODAY);
    expect(describeReason(result)).toBe('10 天前联系过 · 还有 4 天到期');
  });

  it('延后中:显示回归日期', () => {
    const result = evaluateContact(makeContact('a', { deferredUntil: '2026-10-01' }), [], TODAY);
    expect(describeReason(result)).toBe('延后中 · 2026-10-01 回归');
  });
});

describe('日期工具在判定中的边界', () => {
  it('diffDays 与 addDays 互为逆运算(跨月)', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(diffDays('2026-03-02', '2026-01-31')).toBe(30);
  });
});
