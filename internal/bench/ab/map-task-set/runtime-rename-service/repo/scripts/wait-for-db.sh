#!/bin/sh
until pg_isready -h db -p 5432; do
  sleep 1
done
