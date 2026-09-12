import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DEFAULT_CADENCE, type CadenceKey, type Contact, type Interaction } from '../domain/types.ts';

interface ContactRow {
  id: string;
  name: string;
  note: string;
  cadence_key: string;
  deferred_until: string | null;
  is_sample: number;
  created_at: string;
}

interface InteractionRow {
  id: string;
  contact_id: string;
  date: string;
  note: string;
  created_at: string;
}

export interface CreateContactInput {
  name: string;
  note?: string;
  cadenceKey?: CadenceKey;
  isSample?: boolean;
  deferredUntil?: string | null;
}

export interface UpdateContactPatch {
  name?: string;
  note?: string;
  cadenceKey?: CadenceKey;
  /** undefined = 不修改;null = 取消延后。 */
  deferredUntil?: string | null;
}

export interface CreateInteractionInput {
  date: string;
  note?: string;
}

export interface Store {
  countContacts(): number;
  listContacts(): Contact[];
  getContact(id: string): Contact | null;
  createContact(input: CreateContactInput): Contact;
  updateContact(id: string, patch: UpdateContactPatch): Contact | null;
  deleteContact(id: string): boolean;

  listInteractions(contactId?: string): Interaction[];
  addInteraction(contactId: string, input: CreateInteractionInput): Interaction | null;
  updateInteraction(id: string, patch: { date?: string; note?: string }): Interaction | null;
  deleteInteraction(id: string): boolean;

  clearSampleData(): number;

  getMeta(key: string): string | null;
  setMeta(key: string, value: string): void;

  close(): void;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      cadence_key TEXT NOT NULL,
      deferred_until TEXT,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions (contact_id);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    cadenceKey: row.cadence_key as CadenceKey,
    deferredUntil: row.deferred_until,
    isSample: row.is_sample === 1,
    createdAt: row.created_at,
  };
}

function toInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    contactId: row.contact_id,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function openStore(filePath: string): Store {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  migrate(db);

  const insertContact = db.prepare(
    `INSERT INTO contacts (id, name, note, cadence_key, deferred_until, is_sample, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertInteraction = db.prepare(
    `INSERT INTO interactions (id, contact_id, date, note, created_at) VALUES (?, ?, ?, ?, ?)`,
  );

  return {
    countContacts() {
      const row = db.prepare('SELECT COUNT(*) AS count FROM contacts').get() as { count: number };
      return row.count;
    },

    listContacts() {
      const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at, rowid').all() as unknown as ContactRow[];
      return rows.map(toContact);
    },

    getContact(id) {
      const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as unknown as ContactRow | undefined;
      return row ? toContact(row) : null;
    },

    createContact(input) {
      const contact: Contact = {
        id: randomUUID(),
        name: input.name,
        note: input.note ?? '',
        cadenceKey: input.cadenceKey ?? DEFAULT_CADENCE,
        deferredUntil: input.deferredUntil ?? null,
        isSample: input.isSample ?? false,
        createdAt: new Date().toISOString(),
      };
      insertContact.run(
        contact.id,
        contact.name,
        contact.note,
        contact.cadenceKey,
        contact.deferredUntil,
        contact.isSample ? 1 : 0,
        contact.createdAt,
      );
      return contact;
    },

    updateContact(id, patch) {
      const current = this.getContact(id);
      if (!current) return null;

      const next: Contact = {
        ...current,
        name: patch.name ?? current.name,
        note: patch.note ?? current.note,
        cadenceKey: patch.cadenceKey ?? current.cadenceKey,
        deferredUntil: patch.deferredUntil === undefined ? current.deferredUntil : patch.deferredUntil,
      };
      db.prepare('UPDATE contacts SET name = ?, note = ?, cadence_key = ?, deferred_until = ? WHERE id = ?').run(
        next.name,
        next.note,
        next.cadenceKey,
        next.deferredUntil,
        id,
      );
      return next;
    },

    deleteContact(id) {
      const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
      return result.changes > 0;
    },

    listInteractions(contactId) {
      const rows = (
        contactId === undefined
          ? db.prepare('SELECT * FROM interactions ORDER BY date DESC, rowid DESC').all()
          : db.prepare('SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC, rowid DESC').all(contactId)
      ) as unknown as InteractionRow[];
      return rows.map(toInteraction);
    },

    addInteraction(contactId, input) {
      if (!this.getContact(contactId)) return null;
      const interaction: Interaction = {
        id: randomUUID(),
        contactId,
        date: input.date,
        note: input.note ?? '',
        createdAt: new Date().toISOString(),
      };
      insertInteraction.run(interaction.id, interaction.contactId, interaction.date, interaction.note, interaction.createdAt);
      return interaction;
    },

    updateInteraction(id, patch) {
      const row = db.prepare('SELECT * FROM interactions WHERE id = ?').get(id) as unknown as InteractionRow | undefined;
      if (!row) return null;
      const current = toInteraction(row);
      const next: Interaction = {
        ...current,
        date: patch.date ?? current.date,
        note: patch.note ?? current.note,
      };
      db.prepare('UPDATE interactions SET date = ?, note = ? WHERE id = ?').run(next.date, next.note, id);
      return next;
    },

    deleteInteraction(id) {
      const result = db.prepare('DELETE FROM interactions WHERE id = ?').run(id);
      return result.changes > 0;
    },

    clearSampleData() {
      const result = db.prepare('DELETE FROM contacts WHERE is_sample = 1').run();
      return Number(result.changes);
    },

    getMeta(key) {
      const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    setMeta(key, value) {
      db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(
        key,
        value,
      );
    },

    close() {
      db.close();
    },
  };
}
