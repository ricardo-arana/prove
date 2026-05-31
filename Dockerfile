FROM node:24-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/prove.sqlite

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["sh", "-c", "npx vite preview --host 0.0.0.0 --port ${PORT:-3000}"]
