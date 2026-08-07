ARG MEDIA_WORKER_NODE_IMAGE=node:22-bookworm-slim

FROM ${MEDIA_WORKER_NODE_IMAGE}

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
USER node
EXPOSE 8088
CMD ["node", "src/worker.js"]
