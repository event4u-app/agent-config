package main

import "net/http"

func healthHandler(w http.ResponseWriter, r *http.Request) {}

type lru struct{}

func (c *lru) Get(key string, fallback interface{}) {}

func newCache() *lru { return &lru{} }
