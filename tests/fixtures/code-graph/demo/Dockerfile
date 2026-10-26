FROM node:22-alpine AS build
WORKDIR /app
RUN npm ci
FROM nginx:latest
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80/tcp 443
