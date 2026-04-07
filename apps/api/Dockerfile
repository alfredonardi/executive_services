FROM node:20-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/

# Install dependencies
FROM base AS deps
RUN npm install --workspace=@executive/api --workspace=@executive/types --production=false

# Build types
FROM deps AS build-types
COPY packages/types packages/types
RUN npm run build --workspace=@executive/types

# Build API
FROM build-types AS build-api
COPY apps/api apps/api
COPY apps/api/prisma apps/api/prisma
RUN npm run build --workspace=@executive/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build-api /app/apps/api/dist apps/api/dist
COPY --from=build-api /app/apps/api/node_modules apps/api/node_modules
COPY --from=build-api /app/apps/api/prisma apps/api/prisma
COPY --from=build-api /app/packages/types/dist packages/types/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main"]
