# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pixel-squeeze-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM deps AS builder
COPY . .
ARG GITHUB_PAGES=false
ARG NEXT_PUBLIC_ADSENSE_CLIENT=""
ENV GITHUB_PAGES=$GITHUB_PAGES \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT
RUN --mount=type=cache,id=pixel-squeeze-pnpm,target=/pnpm/store pnpm build

FROM nginx:alpine AS preview
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
