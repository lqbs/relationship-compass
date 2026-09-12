import { useState } from 'react';

import { describeReason, type ContactEvaluation, type WeeklyList } from '../domain/judgment.ts';

type RecordHandler = (contactId: string, note: string) => Promise<void>;

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

function ListRow({ entry, onRecord }: { entry: ContactEvaluation; onRecord: RecordHandler }) {
  const hue = avatarHue(entry.contact.name);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (): Promise<void> => {
    setSaving(true);
    try {
      await onRecord(entry.contact.id, note.trim());
      setEditing(false);
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="row-wrap">
      <div className="row">
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
        {!editing && (
          <button type="button" className="btn-record" onClick={() => setEditing(true)}>
            已联系
          </button>
        )}
      </div>

      {editing && (
        <form
          className="record-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="顺手记一句?(可留空)"
            maxLength={200}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '记录中…' : '记录'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setEditing(false);
              setNote('');
            }}
          >
            取消
          </button>
        </form>
      )}
    </li>
  );
}

function Group({
  className,
  title,
  entries,
  onRecord,
}: {
  className: string;
  title: string;
  entries: ContactEvaluation[];
  onRecord: RecordHandler;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="group">
      <h2 className={`group-title ${className}`}>
        {title} · {entries.length} 人
      </h2>
      <ul className="rows">
        {entries.map((entry) => (
          <ListRow key={entry.contact.id} entry={entry} onRecord={onRecord} />
        ))}
      </ul>
    </section>
  );
}

export function ListPage({ list, onRecord }: { list: WeeklyList; onRecord: RecordHandler }) {
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

      <Group className="group-overdue" title="逾期" entries={list.overdue} onRecord={onRecord} />
      <Group className="group-never" title="还没联系过" entries={list.never} onRecord={onRecord} />
      <Group className="group-soon" title="未来 7 天" entries={list.dueSoon} onRecord={onRecord} />

      <p className="list-note">记录不分方向:对方主动联系你也算一次来往。</p>
    </>
  );
}
