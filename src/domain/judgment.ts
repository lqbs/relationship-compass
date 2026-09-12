import { addDays, diffDays } from './dates.ts';
import { CADENCE_PRESETS, type Contact, type Interaction } from './types.ts';

/** 未来 7 天内到期的人进入清单。 */
const DUE_SOON_WINDOW_DAYS = 7;

export type ContactStatus = 'overdue' | 'dueSoon' | 'never' | 'notDue' | 'deferred';

export interface ContactEvaluation {
  contact: Contact;
  status: ContactStatus;
  lastContactDate: string | null;
  daysSinceContact: number | null;
  dueDate: string | null;
  /** 仅 overdue 时有值,>= 0。 */
  overdueDays: number | null;
  /** 仅 dueSoon 时有值,1..7。 */
  daysUntilDue: number | null;
  isDeferred: boolean;
}

export interface WeeklyList {
  today: string;
  /** 逾期者,按欠得最久降序(同欠期按姓名)。 */
  overdue: ContactEvaluation[];
  /** 从未联系过的人。 */
  never: ContactEvaluation[];
  /** 未来 7 天内到期,按到期先后。 */
  dueSoon: ContactEvaluation[];
  listCount: number;
}

function latestInteractionDate(contactId: string, interactions: Interaction[]): string | null {
  let latest: string | null = null;
  for (const interaction of interactions) {
    if (interaction.contactId !== contactId) continue;
    if (latest === null || interaction.date > latest) {
      latest = interaction.date;
    }
  }
  return latest;
}

function compareByName(a: ContactEvaluation, b: ContactEvaluation): number {
  return a.contact.name.localeCompare(b.contact.name, 'zh-Hans-CN');
}

/**
 * 判定单个联系人的状态 —— 这是产品的大脑,也是唯一的测试 seam。
 * 规则:上次联系时间由互动流水推导(不分方向);到期 = 上次联系 + 联系节奏;
 * 延后中(今天 < 延后至)不参与判定;从未联系过的人视为立即到期并单独标注。
 */
export function evaluateContact(contact: Contact, interactions: Interaction[], today: string): ContactEvaluation {
  const isDeferred = contact.deferredUntil !== null && today < contact.deferredUntil;
  const lastContactDate = latestInteractionDate(contact.id, interactions);
  const base = { contact, lastContactDate, isDeferred };

  if (isDeferred) {
    return { ...base, status: 'deferred', daysSinceContact: null, dueDate: null, overdueDays: null, daysUntilDue: null };
  }

  if (lastContactDate === null) {
    return { ...base, status: 'never', daysSinceContact: null, dueDate: null, overdueDays: null, daysUntilDue: null };
  }

  const cadenceDays = CADENCE_PRESETS[contact.cadenceKey].days;
  const dueDate = addDays(lastContactDate, cadenceDays);
  const daysSinceContact = diffDays(today, lastContactDate);
  const daysUntilDue = diffDays(dueDate, today);

  if (daysUntilDue <= 0) {
    return { ...base, status: 'overdue', dueDate, daysSinceContact, overdueDays: Math.abs(daysUntilDue), daysUntilDue: null };
  }

  if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
    return { ...base, status: 'dueSoon', dueDate, daysSinceContact, overdueDays: null, daysUntilDue };
  }

  return { ...base, status: 'notDue', dueDate, daysSinceContact, overdueDays: null, daysUntilDue: null };
}

/** 生成本周清单:逾期(欠得最久在前)+ 未联系过 + 未来 7 天内到期。 */
export function buildWeeklyList(contacts: Contact[], interactions: Interaction[], today: string): WeeklyList {
  const evaluations = contacts.map((contact) => evaluateContact(contact, interactions, today));

  const overdue = evaluations
    .filter((evaluation) => evaluation.status === 'overdue')
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0) || compareByName(a, b));

  const never = evaluations.filter((evaluation) => evaluation.status === 'never').sort(compareByName);

  const dueSoon = evaluations
    .filter((evaluation) => evaluation.status === 'dueSoon')
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) || compareByName(a, b));

  return { today, overdue, never, dueSoon, listCount: overdue.length + never.length + dueSoon.length };
}

/** 生成清单里"上榜依据"的展示文案。 */
export function describeReason(evaluation: ContactEvaluation): string {
  const cadence = CADENCE_PRESETS[evaluation.contact.cadenceKey];
  switch (evaluation.status) {
    case 'overdue':
      return `${evaluation.daysSinceContact} 天没联系 · 希望每 ${cadence.label}`;
    case 'never':
      return `还没联系过 · 希望每 ${cadence.label}`;
    case 'dueSoon':
      return `${evaluation.daysSinceContact} 天前联系过 · 还有 ${evaluation.daysUntilDue} 天到期`;
    case 'deferred':
      return `延后中 · ${evaluation.contact.deferredUntil} 回归`;
    case 'notDue':
      return `${evaluation.daysSinceContact} 天前联系过 · 希望每 ${cadence.label}`;
  }
}
