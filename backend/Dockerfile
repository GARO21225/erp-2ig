FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 4000

# Applique le schéma Prisma (db push) + données de base idempotentes, puis démarre l'API
CMD ["sh", "-c", "node src/seed.js; exec node src/index.js"]
