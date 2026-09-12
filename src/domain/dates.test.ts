import { describe, expect, it } from 'vitest';

import { addDays, diffDays, todayLocal } from './dates.ts';

describe('addDays', () => {
  it('跨月末', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
  });

  it('跨年', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('闰年二月', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('负天数', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('diffDays', () => {
  it('返回 a - b 的天数', () => {
    expect(diffDays('2026-03-01', '2026-02-01')).toBe(28);
    expect(diffDays('2026-02-01', '2026-03-01')).toBe(-28);
    expect(diffDays('2026-09-12', '2026-09-12')).toBe(0);
  });
});

describe('todayLocal', () => {
  it('返回本地日期的 YYYY-MM-DD 格式', () => {
    expect(todayLocal(new Date(2026, 8, 12, 23, 59))).toBe('2026-09-12');
    expect(todayLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
