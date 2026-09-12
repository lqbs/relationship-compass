import { useCallback, useEffect, useState } from 'react';

import { describeReason, type ContactEvaluation } from '../domain/judgment.ts';
import { CADENCE_KEYS, CADENCE_PRESETS, type CadenceKey } from '../domain/types.ts';
import { createContact, fetchContacts } from './api.ts';
import { Avatar, StatusBadge } from './components.tsx';

type Notify = (message: string) => void;

const STATUS_ORDER: Record<ContactEvaluation['status'], number> = {
  overdue: 0,
  never: 1,
  dueSoon: 2,
  deferred: 3,
  notDue: 4,
};

function sortForRoster(contacts: ContactEvaluation[]): ContactEvaluation[] {
  return [...contacts].sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (order !== 0) return order;
    if (a.status === 'overdue' && b.status === 'overdue') {
      return (b.overdueDays ?? 0) - (a.overdueDays ?? 0);
    }
    if (a.status === 'dueSoon' && b.status === 'dueSoon') {
      return (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0);
    }
    return a.contact.name.localeCompare(b.contact.name, 'zh-Hans-CN');
  });
}

export function ContactsPage({ onToast }: { onToast: Notify }) {
  const [contacts, setContacts] = useState<ContactEvaluation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [cadenceKey, setCadenceKey] = useState<CadenceKey>('1m');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchContacts();
      setContacts(data.contacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setSaving(true);
    try {
      await createContact({ name: trimmed, note: note.trim(), cadenceKey });
      setAdding(false);
      setName('');
      setNote('');
      setCadenceKey('1m');
      onToast('已添加联系人');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '添加失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>联系人</h1>
        <p className="subtitle">共 {contacts?.length ?? 0} 人 · 你正在维护的名单</p>
      </div>

      {!adding && (
        <div className="toolbar">
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            ＋ 新增联系人
          </button>
        </div>
      )}

      {adding && (
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            <span>姓名</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="必填" maxLength={40} />
          </label>
          <label className="field">
            <span>备注</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="TA 是谁、怎么认识的…(可留空)"
              maxLength={300}
            />
          </label>
          <label className="field">
            <span>联系节奏</span>
            <select value={cadenceKey} onChange={(event) => setCadenceKey(event.target.value as CadenceKey)}>
              {CADENCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  希望每 {CADENCE_PRESETS[key].label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving || name.trim() === ''}>
              {saving ? '保存中…' : '添加'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      {error !== null && (
        <div className="error-banner">
          {error}
          <button type="button" className="link-button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      {contacts !== null && contacts.length === 0 && (
        <section className="empty-state">
          <h1>还没有联系人</h1>
          <p>点击上面的「新增联系人」,把第一个想维护的人放进来。</p>
        </section>
      )}

      {contacts !== null && contacts.length > 0 && (
        <ul className="rows">
          {sortForRoster(contacts).map((entry) => (
            <li className="row-wrap" key={entry.contact.id}>
              <a className="row row-link-plain" href={`#/contacts/${encodeURIComponent(entry.contact.id)}`}>
                <Avatar name={entry.contact.name} />
                <div className="row-main">
                  <div className="row-name">{entry.contact.name}</div>
                  <div className="row-reason">{describeReason(entry)}</div>
                </div>
                <StatusBadge entry={entry} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
