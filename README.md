# Relationship Compass

本地优先的个人 CRM:打开就知道这周该主动联系谁。

- 首屏是「本周清单」:逾期的人置顶(欠得最久在前),其后是未来 7 天内到期的人;从未联系过的人直接上榜
- 联系完点「已联系」记一笔;欠得久了,macOS 通知会来找你
- 数据只存本机(单个 SQLite 文件):没有账号、没有云、没有部署

设计文档:`CONTEXT.md`(领域词汇)、`docs/v1-spec.md`(v1 需求规格)、`docs/adr/`(架构决定)。

## 快速开始

```bash
pnpm install
pnpm start
```

`pnpm start` 会构建前端并启动本机服务;浏览器打开 http://127.0.0.1:4780 即可使用。首次启动会自动预置一批示例数据(在「联系人」页可以一键清空)。

## 每周提醒(可选)

```bash
pnpm notify:install    # 安装:每周一 09:30 检查,有该联系的人时发系统通知
pnpm notify            # 立即手动触发一次(用于测试)
pnpm notify:uninstall  # 卸载
```

- 清单为空时保持安静,不会打扰
- 若安装了 [terminal-notifier](https://github.com/julienXX/terminal-notifier)(`brew install terminal-notifier`),通知可点击直接打开应用;否则使用系统默认通知(无点击跳转)
- 日志在 `~/Library/Application Support/RelationshipCompass/logs/`

## 数据与备份

- 数据文件:`~/Library/Application Support/RelationshipCompass/data.sqlite`
- 备份 = 拷贝这一个文件;恢复 = 放回原位
- 清空示例数据后不会再次自动生成

## 开发

```bash
pnpm test        # 单元测试(判定逻辑 / 存储 / 通知文案)
pnpm typecheck   # 类型检查
pnpm dev:web     # 前端热更新开发(Vite,代理 /api 到本机服务)
pnpm dev:server  # 本机服务(--watch)
```
