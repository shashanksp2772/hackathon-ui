# --- Build stage -----------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build

# --- Runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine

COPY --from=build /app/dist/hackathon-ui/browser/ /usr/share/nginx/html/
COPY docker/env.template.js /usr/share/nginx/html/env.template.js
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh

RUN apk add --no-cache gettext \
    && chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
