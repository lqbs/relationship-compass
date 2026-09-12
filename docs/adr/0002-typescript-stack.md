# 技术栈:TypeScript + Vite/React + 本机 Node 服务 + SQLite 单文件

实现选型为 pnpm + TypeScript:前端 Vite + React,后端是一个极小的本机 Node 服务,数据存 SQLite 单文件(使用 Node 内置 `node:sqlite`,零原生依赖),放在 `~/Library/Application Support/RelationshipCompass/`。被否掉的替代方案:极简无构建路线(Node 直出 HTML,活动件最少,但界面长期打磨吃亏)与 Python 路线(uv + FastAPI,同样熟悉,但会多维护一个运行时和提醒脚本的跨语言边界)。选 TypeScript 全栈的理由:单一运行时、依赖最少、与既有 pnpm 工作流一致。
