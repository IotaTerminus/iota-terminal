# Build context: repo root (needs the npm workspace root to resolve deps), e.g.
#   docker build -f apps/backend-ts/Dockerfile -t iota-terminal-backend-ts .
FROM node:22-alpine AS build
WORKDIR /repo
# better-sqlite3 has no prebuilt binary for Alpine's musl libc, so npm ci
# falls back to compiling it from source via node-gyp, which needs Python
# and a C/C++ toolchain that the base alpine image doesn't ship with.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY apps/backend-ts/package.json apps/backend-ts/package.json
RUN npm ci --workspace=backend-ts --include-workspace-root
COPY apps/backend-ts apps/backend-ts
RUN npm run build --workspace=backend-ts

FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/apps/backend-ts/dist ./dist
COPY --from=build /repo/apps/backend-ts/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
EXPOSE 8082
CMD ["node", "dist/index.js"]
