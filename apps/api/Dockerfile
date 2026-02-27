FROM node:18-alpine AS base
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY contracts/package.json ./contracts/package.json
RUN npm install

COPY . .
RUN npm run build -w @confchain/api

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/apps/api/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
