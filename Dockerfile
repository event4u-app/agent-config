FROM php:8.2-cli-alpine

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install Python for compress.py tests
RUN apk add --no-cache python3

WORKDIR /app
