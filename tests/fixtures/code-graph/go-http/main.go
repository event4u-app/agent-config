package main

import (
	"net/http"

	"example.com/shop/internal/handlers"
)

type server struct{}

func (s *server) handleOrders(w http.ResponseWriter, r *http.Request) {}

func index(w http.ResponseWriter, r *http.Request) {}

func main() {
	http.HandleFunc("/", index)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /users", handlers.ListUsers)
	mux.HandleFunc("POST /users/{id}", handlers.UpdateUser)
	mux.Handle("/health", healthHandler)

	s := &server{}
	mux.HandleFunc("/orders", s.handleOrders)

	cache := newCache()
	cache.Get("/not-a-route", index)

	http.ListenAndServe(":8080", mux)
}
