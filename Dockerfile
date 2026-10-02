# 从零聊天 App —— 云端构建镜像（Koyeb / Render 通用）
FROM node:22-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 后端主程序
COPY backend/server.js .

# 网页版客户端（server.js 会从 ../web 读取，容器内对应 /web）
COPY web /web

# 数据目录（可选挂载持久卷）
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
