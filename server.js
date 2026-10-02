/**
 * 从零聊天 App —— WebSocket 后端（Node.js + ws，无框架）
 *
 * 职责：
 *   1. 用户注册（昵称）与在线状态管理
 *   2. 在线用户列表广播
 *   3. 一对一文字消息路由（发送方回显 + 接收方推送）
 *   4. 消息历史记录（JSON 文件持久化，每对用户保留最近 200 条）
 *
 * 启动：npm install && npm start   （默认端口 3000）
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const WEB_INDEX = path.join(__dirname, '..', 'web', 'index.html');
const HISTORY_LIMIT = 200; // 每对用户保留的最大历史消息数

/* ---------------- 数据存储（内存 + JSON 文件持久化） ---------------- */

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { users: {}, history: {} };
  }
}

const state = loadData();
let saveTimer = null;

function saveData() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('保存数据失败:', err.message);
    }
  }, 500); // 防抖：合并 500ms 内的多次写
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function addHistory(fromId, toId, message) {
  const key = pairKey(fromId, toId);
  if (!state.history[key]) state.history[key] = [];
  state.history[key].push(message);
  if (state.history[key].length > HISTORY_LIMIT) {
    state.history[key] = state.history[key].slice(-HISTORY_LIMIT);
  }
  saveData();
}

function nextUserId() {
  // 简单自增 id：u1、u2、u3……
  let n = 0;
  for (const id of Object.keys(state.users)) {
    const m = /^u(\d+)$/.exec(id);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return 'u' + (n + 1);
}

/* ---------------- 用户与连接管理 ---------------- */

// 记录所有已注册的连接：ws.userId 指向用户的 id
const clients = new Set();

function userList() {
  return Object.values(state.users).map((u) => ({
    id: u.id,
    nickname: u.nickname,
    online: !!u.online,
  }));
}

function broadcastUserList() {
  const list = userList();
  for (const ws of clients) {
    if (ws.userId) {
      sendTo(ws, { type: 'userList', users: list });
    }
  }
}

function sendTo(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/* ---------------- 消息处理 ---------------- */

function handleMessage(ws, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return sendTo(ws, { type: 'error', message: '消息不是合法的 JSON' });
  }

  switch (data.type) {
    case 'register':
      return handleRegister(ws, data);
    case 'send':
      return handleSend(ws, data);
    case 'history':
      return handleHistory(ws, data);
    default:
      return sendTo(ws, { type: 'error', message: '未知的消息类型: ' + data.type });
  }
}

function handleRegister(ws, data) {
  const nickname = String(data.nickname || '').trim().slice(0, 20);
  if (!nickname) {
    return sendTo(ws, { type: 'error', message: '昵称不能为空' });
  }
  if (ws.userId) {
    return sendTo(ws, { type: 'error', message: '你已经注册过了' });
  }

  const id = nextUserId();
  state.users[id] = { id, nickname, online: true };
  ws.userId = id;
  clients.add(ws);
  saveData();

  sendTo(ws, {
    type: 'welcome',
    userId: id,
    nickname,
    users: userList(),
  });
  broadcastUserList();
  console.log(`[+] ${nickname}(${id}) 上线，当前在线用户: ${userList().filter((u) => u.online).length}`);
}

function handleSend(ws, data) {
  const fromId = ws.userId;
  if (!fromId) {
    return sendTo(ws, { type: 'error', message: '请先注册' });
  }
  const toId = String(data.to || '');
  const text = String(data.text || '').trim().slice(0, 2000);
  if (!toId || !text) {
    return sendTo(ws, { type: 'error', message: '缺少接收人或消息内容' });
  }
  const target = state.users[toId];
  if (!target) {
    return sendTo(ws, { type: 'error', message: '接收人不存在: ' + toId });
  }

  const msg = {
    type: 'message',
    from: fromId,
    fromNickname: state.users[fromId].nickname,
    to: toId,
    text,
    ts: Date.now(),
  };
  addHistory(fromId, toId, msg);

  // 推送给接收方（若在线）
  for (const c of clients) {
    if (c.userId === toId) {
      sendTo(c, msg);
      break;
    }
  }
  // 回显给发送方，保证自己这边也有一条
  sendTo(ws, msg);
}

function handleHistory(ws, data) {
  const fromId = ws.userId;
  if (!fromId) {
    return sendTo(ws, { type: 'error', message: '请先注册' });
  }
  const withId = String(data.with || '');
  if (!withId) {
    return sendTo(ws, { type: 'error', message: '缺少 with 参数' });
  }
  const key = pairKey(fromId, withId);
  const messages = state.history[key] || [];
  sendTo(ws, { type: 'history', with: withId, messages });
}

/* ---------------- 服务器启动 ---------------- */

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];
  // 托管网页版聊天客户端：浏览器打开 http://localhost:PORT 即可使用
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = fs.readFileSync(WEB_INDEX, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    } catch (_) { /* 页面缺失时回退到文本提示 */ }
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('从零聊天 后端服务运行中，浏览器打开 http://localhost:' + PORT + ' 使用网页版；WebSocket 地址 ws://localhost:' + PORT + '\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    try {
      handleMessage(ws, buf.toString());
    } catch (err) {
      console.error('处理消息出错:', err);
      sendTo(ws, { type: 'error', message: '服务器内部错误' });
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      state.users[ws.userId].online = false;
      clients.delete(ws);
      saveData();
      broadcastUserList();
      console.log(`[-] ${state.users[ws.userId].nickname}(${ws.userId}) 下线`);
    } else {
      clients.delete(ws);
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`聊天后端已启动: ws://localhost:${PORT}`);
  console.log(`网页版客户端:   http://localhost:${PORT}`);
  console.log(`历史数据文件:   ${DATA_FILE}`);
});
