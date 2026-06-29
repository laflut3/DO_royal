FROM docker.io/library/node:20.19.2-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian13:nonroot

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=dev

LABEL org.opencontainers.image.title="DO Royal Frontend" \
      org.opencontainers.image.description="Static frontend for DO Royal" \
      org.opencontainers.image.source="https://github.com/laflut3/DO_royal" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NO_UPDATE_NOTIFIER=1

COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules

USER nonroot:nonroot
EXPOSE 5000

CMD ["node_modules/serve/bin/serve.js", "dist", "-l", "5000", "--single"]
