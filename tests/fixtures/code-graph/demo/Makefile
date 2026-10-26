.PHONY: up test

up: build
	docker compose up -d

build:
	docker build -t drift-app .

test: up
	npm test
