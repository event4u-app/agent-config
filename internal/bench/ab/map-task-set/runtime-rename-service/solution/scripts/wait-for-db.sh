#!/bin/sh
until pg_isready -h postgres -p 5432; do
  sleep 1
done
