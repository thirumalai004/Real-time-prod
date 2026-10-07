# One environment-neutral image. All settings arrive as env vars at `docker run` time.
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

USER node

# No ENV defaults for the poll, port or password: the app refuses to start without them.
CMD ["node", "server.js"]
