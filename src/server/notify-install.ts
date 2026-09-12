import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LABEL = 'com.lqbs.relationshipcompass.notify';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = process.env.RC_DATA_DIR ?? join(homedir(), 'Library', 'Application Support', 'RelationshipCompass');
const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const logDir = join(dataDir, 'logs');
const nodePath = process.execPath;
const scriptPath = join(projectRoot, 'src', 'server', 'notify.ts');

function xmlEscape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function plistXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(scriptPath)}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(join(logDir, 'notify.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(join(logDir, 'notify.error.log'))}</string>
</dict>
</plist>
`;
}

function launchctl(args: string[]): { ok: boolean; stderr: string } {
  const result = spawnSync('launchctl', args, { encoding: 'utf8' });
  return { ok: result.status === 0, stderr: result.stderr ?? '' };
}

function uid(): number {
  return process.getuid?.() ?? 501;
}

function install(): void {
  mkdirSync(logDir, { recursive: true });
  mkdirSync(dirname(plistPath), { recursive: true });
  writeFileSync(plistPath, plistXml(), 'utf8');

  const bootstrap = launchctl(['bootstrap', `gui/${uid()}`, plistPath]);
  if (!bootstrap.ok) {
    const load = launchctl(['load', '-w', plistPath]);
    if (!load.ok) {
      console.error('注册定时任务失败:');
      console.error(bootstrap.stderr.trim());
      console.error(load.stderr.trim());
      process.exitCode = 1;
      return;
    }
  }

  console.log('✅ 已安装每周提醒(每周一 09:30,清单为空时保持安静)');
  console.log(`   任务文件:${plistPath}`);
  console.log('   立即试一次:pnpm notify');
  console.log('   卸载:pnpm notify:uninstall');
}

function uninstall(): void {
  launchctl(['bootout', `gui/${uid()}`, plistPath]);
  launchctl(['bootout', `gui/${uid()}/${LABEL}`]);
  if (existsSync(plistPath)) {
    rmSync(plistPath);
  }
  console.log('✅ 已卸载每周提醒');
}

const action = process.argv[2];
if (action === 'install') {
  install();
} else if (action === 'uninstall') {
  uninstall();
} else {
  console.log('用法:node src/server/notify-install.ts <install|uninstall>');
  process.exitCode = 1;
}
