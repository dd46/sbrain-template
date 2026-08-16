FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY mcp_server/ ./mcp_server/

CMD ["node", "mcp_server/server.js"]
