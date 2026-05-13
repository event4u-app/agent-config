# tests/fixtures/hermetic-smoke.Dockerfile
#
# Phase 2 Step 7 outcome check: prove `scripts/hermetic-install.sh`
# runs end-to-end inside a container with `--network=none` once the
# image is built. Build with network (apk fetch), then run with
# `--network=none` so the install path is verifiably offline.
#
# Usage (from repo root):
#   docker build -f tests/fixtures/hermetic-smoke.Dockerfile -t hermetic-smoke:latest .
#   docker run --rm --network=none hermetic-smoke:latest
#
# Exit 0 means: pytest suite passed inside an air-gapped container.

FROM alpine:3.20

RUN apk add --no-cache bash gnupg tar python3 py3-pytest coreutils

WORKDIR /work
COPY scripts/hermetic-install.sh /work/scripts/hermetic-install.sh
COPY tests/test_hermetic_install.py /work/tests/test_hermetic_install.py
COPY pyproject.toml /work/pyproject.toml

RUN chmod +x /work/scripts/hermetic-install.sh

ENTRYPOINT ["python3", "-m", "pytest", "-q", "tests/test_hermetic_install.py"]
