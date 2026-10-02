# 从零聊天 App

一个从零开始实现的**一对一文字聊天应用**：**网页版（浏览器即用）+ 安卓客户端（Kotlin + Jetpack Compose）**，共用一套 **Node.js（ws）自建 WebSocket 后端**，不依赖任何 IM 云服务。

- 后端：注册/在线管理、私聊消息路由、在线列表广播、消息历史（JSON 文件持久化），并直接托管网页版客户端
- 网页版：浏览器打开 `http://localhost:3000` 即用，零安装
- 安卓端：昵称登录 → 在线用户列表 → 一对一聊天窗口（需 Android Studio 构建）
- 已验证：后端通过 10 项双客户端端到端自动化测试；网页版已在真实浏览器中双账号互发实测通过

架构与消息流转见 `architecture.html`（浏览器打开即可查看）。

---

## 目录结构

```
chat-app/
├── architecture.html        # 架构示意图
├── web/
│   └── index.html           # 网页版聊天客户端（纯 HTML/JS，无构建）
├── 截图/                     # 网页版浏览器实测截图
├── backend/                 # Node.js WebSocket 后端
│   ├── server.js            # 服务器主程序（含网页托管）
│   ├── test-client.js       # 双客户端端到端测试
│   ├── package.json
│   └── data.json            # 运行时自动生成（用户 + 历史消息）
└── android-chat/            # 安卓客户端工程（Kotlin + Compose）
    ├── settings.gradle.kts
    ├── build.gradle.kts
    └── app/
        ├── build.gradle.kts
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/example/chatapp/
            │   ├── MainActivity.kt      # 入口：按连接状态切换界面
            │   ├── ChatClient.kt        # WebSocket 连接管理（单例）
            │   ├── LoginScreen.kt       # 登录页
            │   └── MainScreen.kt        # 用户列表 + 聊天窗口
            └── res/values/              # 字符串与主题
```

---

## 第一步：启动后端

要求：Node.js ≥ 16。

```bash
cd backend
npm install        # 安装唯一依赖 ws
npm start          # 启动，监听 ws://localhost:3000
```

启动后浏览器打开 `http://localhost:3000` 即可直接使用**网页版聊天客户端**；数据保存在同目录 `data.json`。

### 跑自动化测试（另开一个终端）

```bash
cd backend
node test-client.js
```

覆盖：注册、在线列表广播、私聊送达、发送方回显、回复、历史记录、错误处理，全部通过输出 `✅ 全部测试通过`。

---

## 第二步：电脑上直接用（网页版，零安装）

后端启动后：

1. 浏览器打开 `http://localhost:3000`
2. 输入昵称（服务器地址会自动填好），点"进入聊天"
3. 左侧是用户列表（带在线状态），点任意用户开始一对一聊天

**双人测试**：再开一个浏览器窗口（普通窗口 + 无痕窗口，或 Edge/Chrome 各一个），登录另一个昵称，两边互发消息即可。

---

## 第三步：构建安卓 App（手机端）

环境要求：

- **Android Studio Ladybug (2024.2) 或更新版本**（内置 Gradle 8.7+ 与 JDK 17，本项目需要的版本）
- 首次打开时按提示自动安装 Android SDK Platform 34

操作步骤：

1. Android Studio → **Open** → 选择 `android-chat` 目录（不是 app 子目录）
2. 等待 Gradle 同步完成（首次会下载依赖，需要网络）
3. 菜单 **Build → Build APK(s)** 生成安装包，或直接点 Run 装到模拟器/真机

### 连接服务器（重要）

服务器地址写在 `app/src/main/java/com/example/chatapp/LoginScreen.kt` 的 `ServerConfig.DEFAULT_WS_URL`：

| 运行方式 | 服务器地址 | 说明 |
|---|---|---|
| 安卓模拟器 | `ws://10.0.2.2:3000`（默认） | `10.0.2.2` 是模拟器访问宿主机的专用地址 |
| 真机（同一 Wi-Fi） | `ws://<电脑局域网IP>:3000` | 例如 `ws://192.168.1.100:3000`，需在登录页手动改成你的 IP |

局域网 IP 查看：Windows `ipconfig`，macOS/Linux `ipconfig getifaddr en0` 或 `hostname -I`。

### 双人联调

- 方式一：电脑上开两个浏览器窗口（普通窗口 + 无痕窗口）登录两个昵称，互发消息——最省事
- 方式二：开两个安卓模拟器，各自登录不同昵称，互发消息
- 方式三：一台模拟器 + 一台真机（真机改 IP，见上表）
- 方式四：真机/模拟器 + 电脑网页版，电脑浏览器登录一个昵称，手机登录另一个

---

## 通信协议（JSON over WebSocket）

**客户端 → 服务器**

| 类型 | 字段 | 说明 |
|---|---|---|
| `register` | `nickname` | 注册/上线，服务器回 `welcome` |
| `send` | `to`（用户id）, `text` | 发送私聊消息 |
| `history` | `with`（用户id） | 拉取与该用户的聊天历史 |

**服务器 → 客户端**

| 类型 | 字段 | 说明 |
|---|---|---|
| `welcome` | `userId`, `nickname`, `users` | 注册成功，附带完整用户列表 |
| `userList` | `users` | 用户上下线时的列表广播 |
| `message` | `from`, `fromNickname`, `to`, `text`, `ts` | 私聊消息（发送方回显 + 接收方推送） |
| `history` | `with`, `messages` | 历史消息数组 |
| `error` | `message` | 错误提示 |

示例：发送 `{"type":"send","to":"u2","text":"你好"}`

---

## 常见问题

**连不上服务器 / 提示"无法连接服务器"**
1. 后端是否已 `npm start` 且端口为 3000？
2. 模拟器用 `10.0.2.2`；真机必须改成电脑局域网 IP 且与电脑同一 Wi-Fi
3. 电脑防火墙放行 3000 端口（Windows 弹窗允许 Node.js 访问网络）

**新开聊天页看不到旧消息** —— 进入聊天页会自动拉取历史；服务器重启前发送的消息会保存在 `data.json`，重启后仍在。

**昵称重复了怎么办** —— 当前版本不限制重名（按 id 区分用户）。后续可加登录密码/唯一昵称校验。

---

## 后续扩展方向

- 群聊：新增 `createGroup` / `joinGroup` / `groupMessage` 类型
- 图片/文件/语音：先走 HTTP 上传拿 URL，再在消息里带 URL 字段
- 消息可靠性：消息 ack + 离线存储（离线消息队列）
- 账号体系：手机号/密码 + token 鉴权，替代现在的"昵称即身份"
- 数据库：从 JSON 文件换成 SQLite / PostgreSQL
- 安全：WebSocket 走 `wss://`（TLS），消息内容加密

## 免责说明

本项目为学习用途的从零实现示例，不适用于生产环境（无鉴权、无消息加密、无离线推送）。上线前请补齐账号体系与安全措施。
