FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 NETEASE_MUSIC_API_URL=http://127.0.0.1:3100 LLM_PROVIDER=disabled SERVE_STATIC=1
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
COPY music-api/package.json music-api/package-lock.json ./music-api/
RUN npm --prefix server ci --omit=dev && npm --prefix music-api ci --omit=dev && npm cache clean --force
COPY server/src ./server/src
COPY shared ./shared
COPY scripts/start-production.mjs ./scripts/start-production.mjs
COPY --from=frontend /app/dist ./dist
USER node
EXPOSE 10000
CMD ["node", "scripts/start-production.mjs"]
