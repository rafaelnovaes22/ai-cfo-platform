# Build multi-stage do frontend Aicfo — substitui o bootstrap Nix do nixpacks.
# VITE_API_URL é injetado em build-time (Vite embute em tempo de build, não runtime).
# No Railway, declare a env VITE_API_URL no serviço; o build arg abaixo a recebe.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
RUN npm i -g serve
COPY --from=build /app/dist ./dist
# Railway injeta PORT e variáveis em runtime. Geramos env.js antes de servir
# para permitir frontend staging/prod com a mesma imagem e APIs diferentes.
EXPOSE 3000
CMD ["sh", "-c", "printf 'window.__AICFO_CONFIG__ = { VITE_API_URL: \"%s\" }\\n' \"${VITE_API_URL:-}\" > dist/env.js && serve -s dist -l ${PORT:-3000}"]
