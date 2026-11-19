# 魔搭创空间仅需上传这个 Dockerfile；从公开 GitHub 仓库获取已验证版本。
FROM node:22-bookworm-slim AS frontend
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/source
RUN git init && git remote add origin https://github.com/tzm1111/aurora-music.git && git fetch --depth=1 origin 0f4f44892c83f5a25117c9806dca159ef73b889d && git checkout --detach FETCH_HEAD && rm -rf .git
RUN npm ci
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=7860 NETEASE_MUSIC_API_URL=http://127.0.0.1:3100 LLM_PROVIDER=disabled SERVE_STATIC=1
WORKDIR /app
COPY --from=frontend /app/source/server/package.json /app/source/server/package-lock.json ./server/
COPY --from=frontend /app/source/music-api/package.json /app/source/music-api/package-lock.json ./music-api/
RUN npm --prefix server ci --omit=dev && npm --prefix music-api ci --omit=dev && npm cache clean --force
COPY --from=frontend /app/source/server/src ./server/src
COPY --from=frontend /app/source/shared ./shared
COPY --from=frontend /app/source/scripts/start-production.mjs ./scripts/start-production.mjs
COPY --from=frontend /app/source/dist ./dist
USER node
EXPOSE 7860
CMD ["node", "scripts/start-production.mjs"]
