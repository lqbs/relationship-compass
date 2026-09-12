import { describeReason, type ContactEvaluation, type WeeklyList } from '../domain/judgment.ts';

function avatarHue(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

function badgeText(entry: ContactEvaluation): string {
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
      return '';
  }
}

function badgeClass(entry: ContactEvaluation): string {
  switch (entry.status) {
    case 'overdue':
      return 'badge badge-overdue';
    case 'never':
      return 'badge badge-never';
    case 'dueSoon':
      return 'badge badge-soon';
    default:
      return 'badge';
  }
}

function ListRow({ entry }: { entry: ContactEvaluation }) {
  const hue = avatarHue(entry.contact.name);
  return (
    <li className="row">
      <span
        className="avatar"
        style={{ background: `hsl(${hue} 72% 90%)`, color: `hsl(${hue} 45% 32%)` }}
        aria-hidden="true"
      >
        {entry.contact.name.trim().slice(0, 1)}
      </span>
      <div className="row-main">
        <div className="row-name">{entry.contact.name}</div>
        <div className="row-reason">{describeReason(entry)}</div>
      </div>
      <span className={badgeClass(entry)}>{badgeText(entry)}</span>
    </li>
  );
}

function Group({ className, title, entries }: { className: string; title: string; entries: ContactEvaluation[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="group">
      <h2 className={`group-title ${className}`}>
        {title} · {entries.length} 人
      </h2>
      <ul className="rows">
        {entries.map((entry) => (
          <ListRow key={entry.contact.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

export function ListPage({ list }: { list: WeeklyList }) {
  if (list.listCount === 0) {
    return (
      <section className="empty-state">
        <h1>本周清单是空的</h1>
        <p>现在没有欠着的关系——好好休息,或者去「联系人」里加上一位想维护的人。</p>
      </section>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>本周清单</h1>
        <p className="subtitle">打开就知道该主动联系谁</p>
      </div>

      <Group className="group-overdue" title="逾期" entries={list.overdue} />
      <Group className="group-never" title="还没联系过" entries={list.never} />
      <Group className="group-soon" title="未来 7 天" entries={list.dueSoon} />
    </>
  );
}
