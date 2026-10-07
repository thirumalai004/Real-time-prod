# ---- Stage 1: dependencies (incl. dev, for tests) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---- Stage 2: unit tests (build fails if any test fails) ----
FROM deps AS test
COPY server.js ./
COPY public ./public
COPY test ./test
RUN npm test

# ---- Stage 3: production dependencies only ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ---- Stage 4: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

# ENV = harmless defaults only. NEVER put ADMIN_TOKEN here.
ENV NODE_ENV=production \
    PORT=3000

# ARG = build-time value from Jenkins, copied into ENV so /version can show it
ARG BUILD_NUMBER=local
ENV BUILD_NUMBER=${BUILD_NUMBER}

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
