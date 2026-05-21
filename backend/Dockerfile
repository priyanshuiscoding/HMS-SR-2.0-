FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev --workspace backend

COPY backend ./backend

EXPOSE 5000

CMD ["npm", "--workspace", "backend", "run", "start"]
