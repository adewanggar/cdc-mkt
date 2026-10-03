FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY --chown=node:node . .
RUN mkdir -p public/uploads && chown -R node:node public/uploads
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
