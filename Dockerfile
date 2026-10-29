# otto web app (dashboard + API) — Next.js standalone build with Prisma/PostgreSQL
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/extension/package.json apps/extension/
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL="postgresql://otto:otto@db:5432/otto?schema=public"
RUN cd apps/web && npx prisma generate && npx next build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S otto && adduser -S otto -G otto
COPY --from=build --chown=otto:otto /app/apps/web/.next/standalone ./
COPY --from=build --chown=otto:otto /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=otto:otto /app/apps/web/public ./apps/web/public
USER otto
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
