# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Server Runtime
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production
COPY server/ ./

# Copy built frontend into public directory
COPY --from=client-builder /app/client/dist /app/server/public

EXPOSE 5001
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
