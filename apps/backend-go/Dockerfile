# Build context: apps/backend-go (this backend has no monorepo/npm dependencies)
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
COPY main.go ./
RUN go mod download && CGO_ENABLED=0 go build -o /out/backend-go .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/backend-go /backend-go
EXPOSE 8080
ENTRYPOINT ["/backend-go"]
