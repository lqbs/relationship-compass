import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { todayLocal } from '../domain/dates.ts';
import { buildWeeklyList, evaluateContact, type ContactEvaluation } from '../domain/judgment.ts';
import { CADENCE_KEYS, type CadenceKey } from '../domain/types.ts';
import { openStore, type Store, type UpdateContactPatch } from './db.ts';
import { seedIfNeeded } from './seed.ts';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = process.env.RC_DATA_DIR ?? join(homedir(), 'Library', 'Application Support', 'RelationshipCompass');
const dataFile = join(dataDir, 'data.sqlite');
const port = Number(process.env.RC_PORT ?? 4780);
const webDist = join(projectRoot, 'dist', 'web');

const store = openStore(dataFile);
seedIfNeeded(store, todayLocal());

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > 1_000_000) throw new HttpError(413, '请求体过大');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON');
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

function isCadenceKey(value: unknown): value is CadenceKey {
  return typeof value === 'string' && (CADENCE_KEYS as readonly string[]).includes(value);
}

function evaluationsFor(targetStore: Store, today: string): ContactEvaluation[] {
  const contacts = targetStore.listContacts();
  const interactions = targetStore.listInteractions();
  return contacts.map((contact) => evaluateContact(contact, interactions, today));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const today = todayLocal();
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (path === '/api/list' && method === 'GET') {
    sendJson(res, 200, buildWeeklyList(store.listContacts(), store.listInteractions(), today));
    return;
  }

  if (path === '/api/contacts' && method === 'GET') {
    sendJson(res, 200, { today, contacts: evaluationsFor(store, today) });
    return;
  }

  if (path === '/api/contacts' && method === 'POST') {
    const body = await readJsonBody(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      sendJson(res, 400, { error: '姓名不能为空' });
      return;
    }
    if (body.cadenceKey !== undefined && !isCadenceKey(body.cadenceKey)) {
      sendJson(res, 400, { error: '节奏档不合法' });
      return;
    }
    const contact = store.createContact({
      name,
      note: typeof body.note === 'string' ? body.note : '',
      cadenceKey: isCadenceKey(body.cadenceKey) ? body.cadenceKey : undefined,
    });
    sendJson(res, 201, evaluateContact(contact, [], today));
    return;
  }

  const contactMatch = path.match(/^\/api\/contacts\/([^/]+)$/);
  if (contactMatch) {
    const id = decodeURIComponent(contactMatch[1] ?? '');
    const contact = store.getContact(id);
    if (!contact) {
      sendJson(res, 404, { error: '联系人不存在' });
      return;
    }

    if (method === 'GET') {
      const interactions = store.listInteractions(id);
      sendJson(res, 200, { today, evaluation: evaluateContact(contact, interactions, today), interactions });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      const patch: UpdateContactPatch = {};
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim() === '') {
          sendJson(res, 400, { error: '姓名不能为空' });
          return;
        }
        patch.name = body.name.trim();
      }
      if (body.note !== undefined) {
        if (typeof body.note !== 'string') {
          sendJson(res, 400, { error: '备注必须是文本' });
          return;
        }
        patch.note = body.note;
      }
      if (body.cadenceKey !== undefined) {
        if (!isCadenceKey(body.cadenceKey)) {
          sendJson(res, 400, { error: '节奏档不合法' });
          return;
        }
        patch.cadenceKey = body.cadenceKey;
      }
      if (body.deferredUntil !== undefined) {
        if (body.deferredUntil !== null && !isDateString(body.deferredUntil)) {
          sendJson(res, 400, { error: '延后日期格式应为 YYYY-MM-DD 或 null' });
          return;
        }
        patch.deferredUntil = body.deferredUntil;
      }
      const updated = store.updateContact(id, patch);
      if (!updated) {
        sendJson(res, 404, { error: '联系人不存在' });
        return;
      }
      sendJson(res, 200, evaluateContact(updated, store.listInteractions(id), today));
      return;
    }

    if (method === 'DELETE') {
      store.deleteContact(id);
      res.writeHead(204);
      res.end();
      return;
    }
  }

  const interactionsMatch = path.match(/^\/api\/contacts\/([^/]+)\/interactions$/);
  if (interactionsMatch && method === 'POST') {
    const contactId = decodeURIComponent(interactionsMatch[1] ?? '');
    const body = await readJsonBody(req);
    const date = body.date === undefined ? today : body.date;
    if (!isDateString(date)) {
      sendJson(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
      return;
    }
    if (body.note !== undefined && typeof body.note !== 'string') {
      sendJson(res, 400, { error: '备注必须是文本' });
      return;
    }
    const interaction = store.addInteraction(contactId, {
      date,
      note: typeof body.note === 'string' ? body.note : '',
    });
    if (!interaction) {
      sendJson(res, 404, { error: '联系人不存在' });
      return;
    }
    sendJson(res, 201, interaction);
    return;
  }

  const interactionMatch = path.match(/^\/api\/interactions\/([^/]+)$/);
  if (interactionMatch) {
    const interactionId = decodeURIComponent(interactionMatch[1] ?? '');

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      const patch: { date?: string; note?: string } = {};
      if (body.date !== undefined) {
        if (!isDateString(body.date)) {
          sendJson(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
          return;
        }
        patch.date = body.date;
      }
      if (body.note !== undefined) {
        if (typeof body.note !== 'string') {
          sendJson(res, 400, { error: '备注必须是文本' });
          return;
        }
        patch.note = body.note;
      }
      const updated = store.updateInteraction(interactionId, patch);
      if (!updated) {
        sendJson(res, 404, { error: '互动不存在' });
        return;
      }
      sendJson(res, 200, updated);
      return;
    }

    if (method === 'DELETE') {
      const removed = store.deleteInteraction(interactionId);
      if (!removed) {
        sendJson(res, 404, { error: '互动不存在' });
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  if (path === '/api/sample/clear' && method === 'POST') {
    const removed = store.clearSampleData();
    sendJson(res, 200, { removed });
    return;
  }

  sendJson(res, 404, { error: '接口不存在' });
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const indexFile = join(webDist, 'index.html');
  let filePath = resolve(webDist, `.${pathname}`);
  if (!filePath.startsWith(webDist)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    try {
      data = await readFile(indexFile);
      filePath = indexFile;
    } catch {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>Relationship Compass</h1><p>前端尚未构建:请先运行 <code>pnpm build</code>。</p>');
      return;
    }
  }

  res.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
  res.end(data);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  void (async () => {
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(res, url.pathname);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        if (!res.headersSent) {
          sendJson(res, error.status, { error: error.message });
        } else {
          res.end();
        }
        return;
      }
      console.error('[relationship-compass] 请求处理失败:', error);
      if (res.headersSent) {
        res.end();
      } else {
        sendJson(res, 500, { error: '服务器内部错误' });
      }
    }
  })();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Relationship Compass 已启动:http://127.0.0.1:${port}`);
  console.log(`数据文件:${dataFile}`);
});

process.on('SIGINT', () => {
  store.close();
  process.exit(0);
});
