# Dependencies stage (used by both dev and production)
#
# The build context is the REPO ROOT (see docker-compose.yml), because the web
# app shares the ONE canonical codegen with the api service (issue #40):
# src/export/manim.js imports '../../../api/src/compiler/{codegen,normalizer}.js'.
# The image keeps the repo-relative layout (/app/services/web +
# /app/services/api/src) so that import resolves exactly as in a local
# checkout. Mirrors the renderer service's repo-root context (issue #32).
FROM node:20-alpine AS deps

WORKDIR /app/services/web

COPY services/web/package*.json ./
RUN npm install

# Web app source (tests included; dist/ and media/ are excluded by the root
# .dockerignore, node_modules by the npm layer above)
COPY services/web/ ./

# Shared canonical compiler source imported by src/export/manim.js
COPY services/api/src/ ../api/src/

# Build stage (production)
FROM deps AS build

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/services/web/dist /usr/share/nginx/html

# Copy nginx config
COPY services/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
