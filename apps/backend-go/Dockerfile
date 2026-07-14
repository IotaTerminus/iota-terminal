# Build context: apps/backend-go (this backend has no monorepo/npm dependencies)
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 go build -o /out/backend-go .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/backend-go /backend-go
EXPOSE 8080
ENTRYPOINT ["/backend-go"]
