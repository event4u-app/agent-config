FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build
