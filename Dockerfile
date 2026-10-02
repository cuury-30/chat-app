# 从零聊天 —— 一键部署镜像（平铺版）
# 所有文件都在仓库根目录（无 backend/、web/ 子目录），便于 GitHub 网页上传
FROM node:22-alpine

WORKDIR /app

# 先复制依赖清单并安装（利用镜像层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 服务端主程序
COPY server.js ./

# 网页版客户端（server.js 从 ../web 读取，容器内对应 /web）
COPY index.html /web/index.html

# Koyeb / Render 等平台会注入 $PORT；本地默认 3000
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
