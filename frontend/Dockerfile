FROM node:22-alpine

WORKDIR /usr/src/app

# Habilita pnpm (el proyecto ya usa pnpm-lock.yaml).
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile

EXPOSE 5173

# El comando real y el hot-reload los provee el bind mount en docker-compose.yml.
CMD ["pnpm", "dev"]