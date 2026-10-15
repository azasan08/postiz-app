FROM node:22.20-bookworm-slim

ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_VERSION=$NEXT_PUBLIC_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    python3-pip \
    bash \
    nginx \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system www \
  && adduser --system --ingroup www --home /www --shell /usr/sbin/nologin www \
  && mkdir -p /www \
  && chown -R www:www /www /var/lib/nginx

RUN npm --no-update-notifier --no-fund --global install pnpm@10.6.1 pm2

WORKDIR /app

COPY . /app
COPY var/docker/nginx.conf /etc/nginx/nginx.conf

RUN pnpm install --frozen-lockfile
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# Run the pm2-run chain directly: `pnpm run pm2` -> `pnpm run pm2-run` left two resident pnpm wrappers (~128MB) blocked on `pm2 logs`.
CMD ["sh", "-c", "nginx && (pm2 delete all || true) && pnpm run prisma-db-push && pnpm --filter ./apps/backend run pm2 && sleep 10 && pnpm run --filter ./apps/orchestrator --filter ./apps/frontend --parallel pm2 && exec pm2 logs"]
