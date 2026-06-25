FROM golang:1.22-alpine AS builder
WORKDIR /app

# Install git (needed for go modules with VCS)
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -o /finance ./cmd/server

FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /finance /app/finance
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
ENTRYPOINT ["/app/finance"]
