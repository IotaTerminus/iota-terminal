# Build context: repo root (needs the npm workspace root to resolve deps), e.g.
#   docker build -f apps/angular-ui/Dockerfile -t iota-terminal-angular-ui .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/angular-ui/package.json apps/angular-ui/package.json
RUN npm ci --workspace=angular-ui --include-workspace-root
COPY shared shared
COPY apps/angular-ui apps/angular-ui
RUN npm run build --workspace=angular-ui -- --configuration production

FROM caddy:2-alpine
COPY --from=build /repo/apps/angular-ui/dist/angular-ui /usr/share/caddy
COPY apps/angular-ui/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
