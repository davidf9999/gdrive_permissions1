FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
COPY . .

RUN npm ci
RUN npm run build

RUN npm prune --production

FROM node:20-slim
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/backend/openapi.yaml ./backend/openapi.yaml
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs/common ./docs/common
COPY --from=build /app/GPT_KNOWLEDGE.md ./GPT_KNOWLEDGE.md
COPY --from=build /app/meta.json ./meta.json

ENV PORT=8080
EXPOSE 8080

CMD ["node", "backend/server.js"]
