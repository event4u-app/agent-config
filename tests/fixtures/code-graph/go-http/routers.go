package main

import (
	"github.com/gin-gonic/gin"
	"github.com/go-chi/chi/v5"
	"github.com/labstack/echo/v4"

	"example.com/shop/internal/handlers"
)

func ginRoutes() {
	r := gin.Default()
	r.GET("/ping", ping)
	api := r.Group("/api")
	api.POST("/items", handlers.CreateItem)
	v1 := api.Group("/v1")
	v1.DELETE("/items/:id", handlers.DeleteItem)
}

func echoRoutes() {
	e := echo.New()
	e.GET("/status", ping)
}

func chiRoutes(r chi.Router) {
	r.Get("/chi", ping)
	r.Post("/inline", func() {})
}

func ping() {}
