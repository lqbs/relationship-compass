import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openStore } from './db.ts';

function tempDbFile(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'rc-store-'));
  return { dir, file: join(dir, 'data.sqlite') };
}

describe('SQLite 存储层', () => {
  it('联系人/互动可写可读,重开数据库后仍在', () => {
    const { dir, file } = tempDbFile();
    const store = openStore(file);
    const contact = store.createContact({ name: '张三', note: '测试联系人' });
    store.addInteraction(contact.id, { date: '2026-09-01', note: '聊了聊近况' });
    store.close();

    const reopened = openStore(file);
    const contacts = reopened.listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe('张三');
    expect(contacts[0]?.cadenceKey).toBe('1m');

    const interactions = reopened.listInteractions(contact.id);
    expect(interactions).toHaveLength(1);
    expect(interactions[0]?.date).toBe('2026-09-01');
    expect(interactions[0]?.note).toBe('聊了聊近况');
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('更新与删除联系人', () => {
    const { dir, file } = tempDbFile();
    const store = openStore(file);
    const contact = store.createContact({ name: '李四' });
    const updated = store.updateContact(contact.id, { name: '李四四', cadenceKey: '2w', deferredUntil: '2026-10-01' });
    expect(updated?.name).toBe('李四四');
    expect(updated?.cadenceKey).toBe('2w');
    expect(updated?.deferredUntil).toBe('2026-10-01');

    expect(store.deleteContact(contact.id)).toBe(true);
    expect(store.getContact(contact.id)).toBeNull();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('删除联系人的同时删除其互动(级联)', () => {
    const { dir, file } = tempDbFile();
    const store = openStore(file);
    const contact = store.createContact({ name: '王五' });
    store.addInteraction(contact.id, { date: '2026-09-01', note: '' });
    store.deleteContact(contact.id);
    expect(store.listInteractions()).toHaveLength(0);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('可修正互动的日期与备注', () => {
    const { dir, file } = tempDbFile();
    const store = openStore(file);
    const contact = store.createContact({ name: '赵六' });
    const created = store.addInteraction(contact.id, { date: '2026-09-01', note: '笔误' });
    if (created === null) throw new Error('创建互动失败');

    const updated = store.updateInteraction(created.id, { date: '2026-09-02', note: '改正后' });
    expect(updated?.date).toBe('2026-09-02');
    expect(updated?.note).toBe('改正后');
    expect(store.updateInteraction('不存在', { note: 'x' })).toBeNull();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('清空示例数据只删示例联系人及其互动', () => {
    const { dir, file } = tempDbFile();
    const store = openStore(file);
    const sample = store.createContact({ name: '示例', isSample: true });
    store.addInteraction(sample.id, { date: '2026-09-01', note: '' });
    store.createContact({ name: '真人' });

    const removed = store.clearSampleData();
    expect(removed).toBe(1);
    expect(store.listContacts().map((c) => c.name)).toEqual(['真人']);
    expect(store.listInteractions()).toHaveLength(0);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
