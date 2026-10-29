# One development image for both services: PHP 8.4 CLI (with pdo_sqlite) for the API,
# Bun + Node for the Expo app and the test runner. Every base image is pinned to an exact tag.
# PHP 8.4.27 contains the fixes for the critical flaws disclosed on 2026-10-21.
# Debian trixie ships SQLite >= 3.44, needed for ORDER BY inside json_group_array().
FROM oven/bun:1.4.3-debian AS bun
FROM node:22.23.4-trixie-slim AS node
FROM composer:2.10.2 AS composer

# The API's PHP dependencies (symfony/mailer), installed from the lock file. Copied into the image below and kept in
# the api_vendor volume, like node_modules, because the source folder is mounted over /app.
FROM composer AS api-vendor
WORKDIR /api
COPY packages/api/composer.json packages/api/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --classmap-authoritative

FROM php:8.4.27-cli-trixie

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=node /usr/local/bin/node /usr/local/bin/node
# Composer itself, for `composer audit` in the test run.
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx \
    && php -m | grep -qi '^pdo_sqlite$'

WORKDIR /app

ENV EXPO_NO_TELEMETRY=1 \
    DB_PATH=/data/app.sqlite \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Chromium for the 390x844 screenshot tests in tests/e2e. Kept outside /app and node_modules,
# which are mounted as volumes in docker-compose.yml.
RUN bunx playwright install --with-deps chromium

COPY . .
COPY --from=api-vendor /api/vendor /app/packages/api/vendor

EXPOSE 8080 8081
