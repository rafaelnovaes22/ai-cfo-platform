# Build multi-stage do backend Aicfo — substitui o bootstrap Nixpacks.
# Secrets são injetadas em RUNTIME via ENV (Railway dashboard), nunca em ARG/ENV de build.
# Único ARG permitido é o que não é sensível (nenhum, hoje).
FROM node:20-alpine AS build
WORKDIR /app

# Dependências primeiro (cache de camada). prisma/ é necessário para prisma generate.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Gera o client Prisma antes do build (tsup importa @prisma/client).
RUN npx prisma generate

# Resto do código fonte
COPY . .
RUN npm run build

# --- Runtime ---
# Imagem enxuta: apenas deps de produção + client Prisma gerado + dist compilado.
# prisma CLI fica disponível para `prisma migrate deploy` no startup.
FROM node:20-alpine AS run
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i --no-save prisma

# Client Prisma gerado na stage de build (.prisma/client). --omit=dev não o produz.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Artefatos de build e migrations (necessários para `prisma migrate deploy`).
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Railway injeta PORT em runtime. Fallback 3000 para `docker run` local.
EXPOSE 3000
# migrate deploy (idempotente) antes de subir o servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
