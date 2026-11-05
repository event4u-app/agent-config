# Oracle image for the code-graph benchmark v3 (road-to-a-graph-that-wins step 2.2).
#
# Holds exactly the indexers PREREGISTRATION-v3-2026-11-05.md names as the oracle arm:
# Psalm `--find-references-to` for PHP and scip-typescript for TypeScript, JavaScript and
# Vue script blocks. Built on demand by oracle.sh, never by CI, never by a consumer
# install: the oracle lives only under internal/bench/ and is never an arm or a
# provider (K1, ADR-259).
#
# Every version is pinned. Network is needed at build time and while installing a
# subject's dependencies; the indexing step itself runs with --network none.

FROM composer:2.8.12 AS composer
FROM node:22.21.1-bookworm-slim AS node

FROM php:8.4.14-cli-bookworm

ARG PSALM_VERSION=7.0.3
ARG SCIP_TYPESCRIPT_VERSION=0.6.1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev libpng-dev \
 && docker-php-ext-install -j"$(nproc)" zip intl gd bcmath pdo_mysql \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

ENV COMPOSER_HOME=/opt/composer COMPOSER_ALLOW_SUPERUSER=1 PATH=/opt/composer/vendor/bin:/opt/npm/bin:$PATH
RUN composer global require --no-interaction --no-progress "vimeo/psalm:${PSALM_VERSION}" \
 && npm install --global --prefix /opt/npm "@sourcegraph/scip-typescript@${SCIP_TYPESCRIPT_VERSION}" \
 && psalm --version \
 && scip-typescript --version

COPY enclosing.php OracleReferencesPlugin.php /opt/oracle/

WORKDIR /subject
