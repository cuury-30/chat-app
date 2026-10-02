# 公网部署说明（Koyeb 免费版）

本目录是**部署用仓库**：只包含运行所需的最小文件（backend + web + README）。

## 为什么这样设计

- 后端在启动时自动托管网页版客户端（`/` 返回 `web/index.html`）
- 端口读取环境变量 `PORT`，云平台自动注入，本地默认 3000
- 网页版会自动识别当前域名：部署后访问 `https://你的应用.koyeb.app`，页面自动连 `wss://你的应用.koyeb.app`，无需改代码
- WebSocket 与 HTTP 同端口，Koyeb 免费实例即可运行，无需额外配置

## 部署步骤（Koyeb）

1. 把本目录上传到 GitHub 公开仓库（例如 `chat-app`，默认分支 `main`）
2. 打开 https://app.koyeb.com → Create App → GitHub 仓库选择该仓库
3. 配置：
   - Build command: `npm install`（在 `backend/` 目录内：`cd backend && npm install`）
   - Run command: `node server.js`（`cd backend && node server.js`）
   - 端口：Koyeb 自动注入 `PORT`，服务监听 `$PORT`，无需手动指定
4. Deploy 等待构建完成，访问分配的 `https://xxx.koyeb.app` 即可

> 仓库根目录不是运行目录，构建/运行命令需要先 `cd backend`。也可以在 Koyeb 的 "Root Directory" 配置里直接填 `backend`，此时命令为 `npm install` / `node server.js`。

## 免费版的限制（务必了解）

- **磁盘是临时的**：实例重建/重新部署后，`data.json`（用户和历史消息）会清空。要持久保存需要接免费数据库（后续可加）
- 免费额度：1 个 nano 实例（512MB 内存 / 2GB 磁盘 / 100GB 流量每月），无信用卡
- 免费域名是 `https://你的应用.koyeb.app`，想用自己的域名需购买并绑定（非必需）

## 本地验证

```bash
cd backend
npm install
PORT=8080 node server.js          # 换端口验证环境变量兼容
WS_URL=ws://localhost:8080 node test-client.js   # 全部 PASS 即兼容
```
