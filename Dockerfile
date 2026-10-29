# One image: the API server, which also serves the built web app.
FROM node:26-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --workspaces --include-workspace-root
COPY web web
RUN npm run build --workspace web

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production STATIC_DIR=/app/web/dist PORT=3001
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --workspace server --omit=dev && npm cache clean --force
COPY server/src server/src
COPY server/drizzle server/drizzle
COPY --from=web /app/web/dist web/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "server/src/index.ts"]
