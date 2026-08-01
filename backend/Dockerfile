FROM node:24.18.0-alpine3.23

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev --workspace backend

COPY --chown=node:node backend ./backend
COPY --chown=node:node scripts ./scripts

USER node

EXPOSE 5000

CMD ["npm", "--workspace", "backend", "run", "start"]
