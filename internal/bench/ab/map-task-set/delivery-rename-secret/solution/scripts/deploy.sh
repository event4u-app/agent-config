#!/bin/sh
set -eu
: "${DEPLOY_KEY:?DEPLOY_KEY must be set}"
exec ./bin/push-release --target "$1" --token-env DEPLOY_KEY
