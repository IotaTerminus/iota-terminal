# Build context: repo root (needs the npm workspace root to resolve deps), e.g.
#   docker build -f apps/react-ui/Dockerfile -t iota-terminal-react-ui .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/react-ui/package.json apps/react-ui/package.json
RUN npm ci --workspace=react-ui --include-workspace-root
COPY shared shared
COPY apps/react-ui apps/react-ui
RUN npm run build --workspace=react-ui

FROM caddy:2-alpine
COPY --from=build /repo/apps/react-ui/dist /usr/share/caddy
COPY apps/react-ui/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
