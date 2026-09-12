import type { ContactEvaluation } from '../domain/judgment.ts';

function avatarHue(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const hue = avatarHue(name);
  return (
    <span
      className={large ? 'avatar avatar-large' : 'avatar'}
      style={{ background: `hsl(${hue} 72% 90%)`, color: `hsl(${hue} 45% 32%)` }}
      aria-hidden="true"
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

export function badgeText(entry: ContactEvaluation): string {
  switch (entry.status) {
    case 'overdue':
      return entry.overdueDays === 0 ? '今天到期' : `欠 ${entry.overdueDays} 天`;
    case 'never':
      return '没联系过';
    case 'dueSoon':
      return `还有 ${entry.daysUntilDue} 天`;
    case 'deferred':
      return '延后中';
    case 'notDue':
      return '正常';
  }
}

export function badgeClass(entry: ContactEvaluation): string {
  switch (entry.status) {
    case 'overdue':
      return 'badge badge-overdue';
    case 'never':
      return 'badge badge-never';
    case 'dueSoon':
      return 'badge badge-soon';
    case 'deferred':
      return 'badge badge-deferred';
    default:
      return 'badge badge-quiet';
  }
}

export function StatusBadge({ entry }: { entry: ContactEvaluation }) {
  return <span className={badgeClass(entry)}>{badgeText(entry)}</span>;
}
