FROM node:22-alpine AS build
WORKDIR /app
# better-sqlite3 braucht einen C++-Compiler zum Bauen
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
VOLUME ["/app/.data"]
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
