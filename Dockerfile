# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend-builder /app/backend/dist ./dist
RUN go build -o tofilepath .

# Stage 3: Run
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=backend-builder /app/tofilepath .
COPY --from=backend-builder /app/dist ./dist
EXPOSE 8085
CMD ["./tofilepath"]
