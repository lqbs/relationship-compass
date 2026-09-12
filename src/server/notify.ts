import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { todayLocal } from '../domain/dates.ts';
import { buildWeeklyList } from '../domain/judgment.ts';
import { openStore } from './db.ts';
import { buildNotificationMessage } from './notify-message.ts';
import { seedIfNeeded } from './seed.ts';

const dataDir = process.env.RC_DATA_DIR ?? join(homedir(), 'Library', 'Application Support', 'RelationshipCompass');
const appUrl = process.env.RC_APP_URL ?? `http://127.0.0.1:${process.env.RC_PORT ?? 4780}/`;

function hasCommand(name: string): boolean {
  return spawnSync('which', [name], { stdio: 'ignore' }).status === 0;
}

function appleScriptQuote(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** 优先 terminal-notifier(支持点击打开应用);未安装则退化为 osascript(无点击动作)。 */
function sendNotification(message: string): string {
  const title = 'Relationship Compass';

  if (hasCommand('terminal-notifier')) {
    const result = spawnSync('terminal-notifier', [
      '-title',
      title,
      '-message',
      message,
      '-open',
      appUrl,
      '-group',
      'relationship-compass',
    ]);
    return result.status === 0 ? 'terminal-notifier(可点击打开)' : 'terminal-notifier(发送失败)';
  }

  const script = `display notification ${appleScriptQuote(message)} with title ${appleScriptQuote(title)}`;
  const result = spawnSync('osascript', ['-e', script]);
  return result.status === 0
    ? 'osascript(不支持点击跳转;可安装 terminal-notifier 获得点击打开)'
    : 'osascript(发送失败)';
}

const store = openStore(join(dataDir, 'data.sqlite'));
seedIfNeeded(store, todayLocal());

const today = todayLocal();
const list = buildWeeklyList(store.listContacts(), store.listInteractions(), today);
const message = buildNotificationMessage(list);

if (message === null) {
  console.log('[notify] 本周清单为空,保持安静。');
} else {
  const via = sendNotification(message);
  console.log(`[notify] 已发送(${via}):${message}`);
}

store.close();
