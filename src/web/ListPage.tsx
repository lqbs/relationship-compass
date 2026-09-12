import { useCallback, useEffect, useState } from 'react';

import { describeReason, type ContactEvaluation, type WeeklyList } from '../domain/judgment.ts';
import { fetchWeeklyList, recordInteraction } from './api.ts';
import { Avatar, StatusBadge } from './components.tsx';

type Notify = (message: string) => void;
type RecordHandler = (contactId: string, note: string) => Promise<void>;

function ListRow({ entry, onRecord }: { entry: ContactEvaluation; onRecord: RecordHandler }) {
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
        <Avatar name={entry.contact.name} />
        <a className="row-main row-main-link" href={`#/contacts/${encodeURIComponent(entry.contact.id)}`}>
          <div className="row-name">{entry.contact.name}</div>
          <div className="row-reason">{describeReason(entry)}</div>
        </a>
        <StatusBadge entry={entry} />
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

export function ListPage({ onToast }: { onToast: Notify }) {
  const [list, setList] = useState<WeeklyList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setList(await fetchWeeklyList());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRecord = useCallback(
    async (contactId: string, note: string) => {
      await recordInteraction(contactId, { note });
      onToast('已记录 · 清单已更新');
      await load();
    },
    [load, onToast],
  );

  if (loading && list === null) {
    return <p className="hint">正在加载…</p>;
  }

  if (list === null) {
    return (
      <div className="error-banner">
        {error ?? '加载失败'}
        <button type="button" className="link-button" onClick={() => void load()}>
          重试
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>本周清单</h1>
        <p className="subtitle">{list.today} · 打开就知道该主动联系谁</p>
      </div>

      {error !== null && (
        <div className="error-banner">
          {error}
          <button type="button" className="link-button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      {list.listCount === 0 ? (
        <section className="empty-state">
          <h1>本周清单是空的</h1>
          <p>
            现在没有欠着的关系——好好休息,或者去<a href="#/contacts">联系人</a>里加上一位想维护的人。
          </p>
        </section>
      ) : (
        <>
          <Group className="group-overdue" title="逾期" entries={list.overdue} onRecord={handleRecord} />
          <Group className="group-never" title="还没联系过" entries={list.never} onRecord={handleRecord} />
          <Group className="group-soon" title="未来 7 天" entries={list.dueSoon} onRecord={handleRecord} />
        </>
      )}

      <p className="list-note">记录不分方向:对方主动联系你也算一次来往。</p>
    </>
  );
}
