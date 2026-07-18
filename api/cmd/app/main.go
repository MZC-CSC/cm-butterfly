package main

import (
	"log"
	"net/http"

	"api/internal/config"
	"api/internal/handler"
	"api/internal/middleware"
	"api/internal/model"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := model.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer model.CloseDB()

	// Initialize authentication
	if err := handler.InitAuth(cfg.Paths.UserAuthConfPath, cfg.Paths.UserAuthDataPath); err != nil {
		log.Fatalf("Failed to initialize auth: %v", err)
	}

	// Initialize API spec
	if err := handler.InitAPISpec(); err != nil {
		log.Fatalf("Failed to initialize API spec: %v", err)
	}

	// Initialize menu
	if err := handler.InitMenu(cfg.Paths.MenuConfDataPath); err != nil {
		log.Fatalf("Failed to initialize menu: %v", err)
	}

	// Create Echo instance
	e := echo.New()

	// Global middleware
	e.Use(echoMiddleware.Logger())
	e.Use(echoMiddleware.Recover())
	e.Use(middleware.CORSMiddleware())
	e.Use(echoMiddleware.BodyDump(func(c echo.Context, reqBody, resBody []byte) {
		// Optional: log request/response bodies
	}))

	// Health check endpoint (no auth required)
	e.Any("/readyz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{"status": "OK"})
	})

	// Create handlers
	authHandler := handler.NewAuthHandler(db)
	diskHandler := handler.NewDiskHandler()
	menuHandler := handler.NewMenuHandler()
	workspaceHandler := handler.NewWorkspaceHandler()

	// API routes
	apiPath := "/api"

	// Auth routes (no auth middleware for login)
	auth := e.Group(apiPath + "/auth")
	auth.POST("/login", authHandler.Login)
	auth.POST("/validate", authHandler.Validate, middleware.AuthMiddleware(db))
	auth.POST("/logout", authHandler.Logout, middleware.AuthMiddleware(db))
	auth.POST("/userinfo", authHandler.Userinfo, middleware.AuthMiddleware(db))

	// Refresh token route (uses refresh token middleware)
	auth.POST("/refresh", authHandler.LoginRefresh, middleware.RefreshTokenMiddleware())

	// API routes (with auth middleware)
	api := e.Group(apiPath, middleware.AuthMiddleware(db))

	// Disk endpoints
	api.POST("/disklookup", diskHandler.DiskLookup)
	api.POST("/availabledisktypebyproviderregion", diskHandler.AvailableDiskTypeByProviderRegion)

	// Menu endpoint
	api.POST("/getmenutree", menuHandler.GetMenuTree)

	// Project management endpoints
	api.POST("/createproject", workspaceHandler.CreateProject)
	api.POST("/getprojectlist", workspaceHandler.GetProjectList)
	api.POST("/getprojectbyid", workspaceHandler.GetProjectById)
	api.POST("/updateprojectbyid", workspaceHandler.UpdateProjectById)
	api.POST("/deleteprojectbyid", workspaceHandler.DeleteProjectById)

	// Workspace endpoints
	api.POST("/getwpmappinglistbyworkspaceid", workspaceHandler.GetWPmappingListByWorkspaceId)
	api.POST("/getworkspaceuserrolemappinglistbyuserid", workspaceHandler.GetWorkspaceUserRoleMappingListByUserId)

	// API Test endpoints
	// 워크로드 삭제 상태 추적 — 브라우저가 아니라 서버에 남겨 어느 자리에서든 이어받는다.
	deleteRequestHandler := handler.NewDeleteRequestHandler(db)
	api.POST("/listdeleterequests", deleteRequestHandler.ListDeleteRequests)
	api.POST("/savedeleterequest", deleteRequestHandler.SaveDeleteRequest)
	api.POST("/updatedeleterequeststatus", deleteRequestHandler.UpdateDeleteRequestStatus)
	api.POST("/removedeleterequest", deleteRequestHandler.RemoveDeleteRequest)

	api.POST("/test", handler.ApiTestController)

	// API list endpoint (no auth required)
	e.GET(apiPath+"/list", handler.GetApiListController)

	// Generic API routing
	api.POST("/:operationId", handler.AnyController)
	api.POST("/:subsystemName/:operationId", handler.SubsystemAnyController)

	// Start server
	addr := cfg.GetServerAddr()
	log.Printf("Starting server on %s", addr)
	if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}
