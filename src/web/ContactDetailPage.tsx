import { useCallback, useEffect, useState } from 'react';

import { addDays } from '../domain/dates.ts';
import { describeReason, type ContactEvaluation } from '../domain/judgment.ts';
import { CADENCE_KEYS, CADENCE_PRESETS, type CadenceKey, type Interaction } from '../domain/types.ts';
import { deleteContact, deleteInteraction, fetchContact, recordInteraction, updateContact, updateInteraction } from './api.ts';
import { Avatar, StatusBadge } from './components.tsx';
import { navigate } from './router.ts';

type Notify = (message: string) => void;

export function ContactDetailPage({ id, onToast }: { id: string; onToast: Notify }) {
  const [evaluation, setEvaluation] = useState<ContactEvaluation | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newDate, setNewDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [recording, setRecording] = useState(false);

  const [deferDate, setDeferDate] = useState('');
  const [savingDefer, setSavingDefer] = useState(false);

  const [today, setToday] = useState('');
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [confirmingContact, setConfirmingContact] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setMissing(false);
      const data = await fetchContact(id);
      setEvaluation(data.evaluation);
      setInteractions(data.interactions);
      setName(data.evaluation.contact.name);
      setNote(data.evaluation.contact.note);
      setNewDate(data.today);
      setToday(data.today);
      setDeferDate(addDays(data.today, 7));
      setDirty(false);
    } catch (err) {
      if (err instanceof Error && err.message === '联系人不存在') {
        setMissing(true);
      } else {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) {
    return (
      <section className="empty-state">
        <h1>联系人不存在</h1>
        <p>
          TA 可能已经被删除。<a href="#/contacts">返回联系人</a>
        </p>
      </section>
    );
  }

  if (evaluation === null) {
    return <p className="hint">正在加载…</p>;
  }

  const contact = evaluation.contact;

  const saveProfile = async (): Promise<void> => {
    setSavingProfile(true);
    try {
      await updateContact(contact.id, { name: name.trim(), note });
      onToast('已保存');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const changeCadence = async (key: CadenceKey): Promise<void> => {
    try {
      await updateContact(contact.id, { cadenceKey: key });
      onToast('已更新联系节奏');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '更新失败');
    }
  };

  const record = async (): Promise<void> => {
    setRecording(true);
    try {
      await recordInteraction(contact.id, { date: newDate, note: newNote.trim() });
      setNewNote('');
      onToast('已记录互动');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '记录失败');
    } finally {
      setRecording(false);
    }
  };

  const setDefer = async (date: string | null): Promise<void> => {
    setSavingDefer(true);
    try {
      await updateContact(contact.id, { deferredUntil: date });
      onToast(date === null ? '已取消延后' : '已延后,到期自动回归');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSavingDefer(false);
    }
  };

  const startEditInteraction = (interaction: Interaction): void => {
    setConfirmingDelete(null);
    setEditingInteractionId(interaction.id);
    setEditDate(interaction.date);
    setEditNote(interaction.note);
  };

  const saveInteraction = async (): Promise<void> => {
    if (editingInteractionId === null) return;
    setSavingEdit(true);
    try {
      await updateInteraction(editingInteractionId, { date: editDate, note: editNote.trim() });
      setEditingInteractionId(null);
      onToast('已修正该条记录');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '修正失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const removeInteraction = async (interactionId: string): Promise<void> => {
    try {
      await deleteInteraction(interactionId);
      setConfirmingDelete(null);
      onToast('已删除该条记录');
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  const removeContact = async (): Promise<void> => {
    try {
      await deleteContact(contact.id);
      onToast('已删除联系人');
      navigate('#/contacts');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <>
      <p className="breadcrumb">
        <a href="#/contacts">← 联系人</a>
      </p>

      <section className="card detail-head">
        <Avatar name={contact.name} large />
        <div className="detail-head-main">
          <div className="detail-name">{contact.name}</div>
          <div className="row-reason">{describeReason(evaluation)}</div>
        </div>
        <StatusBadge entry={evaluation} />
      </section>

      {error !== null && (
        <div className="error-banner">
          {error}
          <button type="button" className="link-button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">资料</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <label className="field">
            <span>姓名</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDirty(true);
              }}
              maxLength={40}
            />
          </label>
          <label className="field">
            <span>备注</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setDirty(true);
              }}
              placeholder="TA 是谁、怎么认识的、在意什么…"
              maxLength={300}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={!dirty || savingProfile || name.trim() === ''}>
              {savingProfile ? '保存中…' : '保存'}
            </button>
          </div>
        </form>

        <label className="field">
          <span>联系节奏</span>
          <select value={contact.cadenceKey} onChange={(event) => void changeCadence(event.target.value as CadenceKey)}>
            {CADENCE_KEYS.map((key) => (
              <option key={key} value={key}>
                希望每 {CADENCE_PRESETS[key].label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">延后</h2>
        <div className="defer-row">
          <input type="date" value={deferDate} onChange={(event) => setDeferDate(event.target.value)} />
          <button
            type="button"
            className="btn-primary"
            disabled={deferDate === '' || savingDefer}
            onClick={() => void setDefer(deferDate)}
          >
            {evaluation.isDeferred ? '改期到这' : '延后到这天'}
          </button>
          {evaluation.isDeferred && (
            <button type="button" className="btn-ghost" disabled={savingDefer} onClick={() => void setDefer(null)}>
              取消延后
            </button>
          )}
        </div>
        {evaluation.isDeferred ? (
          <p className="list-note">
            延后中:期间不出现在本周清单,将在 {evaluation.contact.deferredUntil} 自动回归。
          </p>
        ) : (
          <p className="list-note">延后期间 TA 不出现在本周清单,到这天自动回来。</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">记录一次来往</h2>
        <div className="record-inline">
          <input type="date" value={newDate} max={today} onChange={(event) => setNewDate(event.target.value)} />
          <input
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            placeholder="一句话(可留空)"
            maxLength={200}
          />
          <button type="button" className="btn-primary" onClick={() => void record()} disabled={recording || newDate === ''}>
            {recording ? '记录中…' : '记录'}
          </button>
        </div>
        <p className="list-note">不分方向:对方主动联系你也算一次来往。</p>
      </section>

      <section className="card">
        <h2 className="card-title">互动流水 · {interactions.length} 条</h2>
        {interactions.length === 0 ? (
          <p className="hint">还没有记录。联系过之后,在上面记一笔。</p>
        ) : (
          <ul className="timeline">
            {interactions.map((interaction) => (
              <li key={interaction.id} className="timeline-item">
                <span className="timeline-date">{interaction.date}</span>
                {editingInteractionId === interaction.id ? (
                  <>
                    <input
                      type="date"
                      value={editDate}
                      max={today}
                      onChange={(event) => setEditDate(event.target.value)}
                    />
                    <input
                      value={editNote}
                      onChange={(event) => setEditNote(event.target.value)}
                      placeholder="一句话(可留空)"
                      maxLength={200}
                    />
                    <span className="timeline-actions">
                      <button
                        type="button"
                        className="link-button"
                        disabled={savingEdit}
                        onClick={() => void saveInteraction()}
                      >
                        保存
                      </button>
                      <button type="button" className="link-button" onClick={() => setEditingInteractionId(null)}>
                        取消
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="timeline-note">{interaction.note === '' ? '—' : interaction.note}</span>
                    {confirmingDelete === interaction.id ? (
                      <span className="timeline-actions">
                        <button
                          type="button"
                          className="link-button danger"
                          onClick={() => void removeInteraction(interaction.id)}
                        >
                          确认删除
                        </button>
                        <button type="button" className="link-button" onClick={() => setConfirmingDelete(null)}>
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="timeline-actions">
                        <button
                          type="button"
                          className="link-button timeline-hover-action"
                          onClick={() => startEditInteraction(interaction)}
                        >
                          修正
                        </button>
                        <button
                          type="button"
                          className="link-button timeline-hover-action"
                          onClick={() => setConfirmingDelete(interaction.id)}
                        >
                          删除
                        </button>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card danger-zone">
        <h2 className="card-title">危险区</h2>
        {confirmingContact ? (
          <div className="confirm-row">
            <span>删除后无法恢复,连同全部互动记录。</span>
            <button type="button" className="btn-danger" onClick={() => void removeContact()}>
              确认删除
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmingContact(false)}>
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="btn-danger-ghost" onClick={() => setConfirmingContact(true)}>
            删除联系人
          </button>
        )}
      </section>
    </>
  );
}
