FROM node:20-slim

WORKDIR /app
COPY backend/server.js ./
COPY GPT_KNOWLEDGE.md ./GPT_KNOWLEDGE.md
COPY dist/apps_scripts_bundle.gs ./dist/apps_scripts_bundle.gs

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
