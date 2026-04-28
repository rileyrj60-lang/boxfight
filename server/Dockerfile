FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only the server's deps + workspace root, not the client
COPY package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Bring shared and server source before install so workspace symlink targets exist
COPY shared ./shared
COPY server ./server

RUN npm install --omit=dev --include=optional \
    --workspace=@boxfight/server --include-workspace-root \
    --no-audit --no-fund \
 && npm install --no-save tsx --workspace=@boxfight/server

EXPOSE 2567
WORKDIR /app/server
CMD ["npx", "tsx", "src/index.ts"]
