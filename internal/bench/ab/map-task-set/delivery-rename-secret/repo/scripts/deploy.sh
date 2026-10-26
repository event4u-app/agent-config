#!/bin/sh
set -eu
: "${DEPLOY_TOKEN:?DEPLOY_TOKEN must be set}"
exec ./bin/push-release --target "$1" --token-env DEPLOY_TOKEN
