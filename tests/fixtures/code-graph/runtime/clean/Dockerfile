FROM node:22.11-alpine AS build
RUN npm ci
FROM build AS final
EXPOSE 8080
CMD ["node", "server.js"]
