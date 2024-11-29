package actions

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/cloud-barista/cm-butterfly/models"
	v "github.com/cloud-barista/cm-butterfly/variables"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	_ "github.com/cloud-barista/cm-butterfly/docs"
	echoSwagger "github.com/swaggo/echo-swagger"
)

var (
	app     *echo.Echo
	appOnce sync.Once
)

// @title cm-butterfly
// @version 0.2.3+edge
// @description cloud-barista GUI framework for seamless multi-cloud migration.
// @host localhost:4000
// @BasePath /
func App() *echo.Echo {
	appOnce.Do(func() {
		app = echo.New()
		app.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
			LogStatus: true, LogURI: true, LogMethod: true, LogRemoteIP: true,
			LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
				fmt.Printf("⇨ %v [%v] %v (%v)\n", v.RemoteIP, v.Method, v.URI, v.Status)
				return nil
			},
		}))

		app.Use(TransactionMiddleware(models.DB))
		app.Use(SetContextMiddleware([]string{
			"/readyz",
			v.ApiPath + "/auth/login",
			"/swagger/*",
		}...))

		app.Any("/readyz", readyz)
		if v.SWAGGER {
			app.GET("/swagger/*", echoSwagger.WrapHandler)
		}

		auth := app.Group(v.ApiPath + "/auth")
		auth.POST("/login", AuthLogin)
		auth.POST("/refresh", AuthLoginRefresh)
		auth.POST("/validate", AuthValidate)
		auth.POST("/logout", AuthLogout)
		auth.POST("/userinfo", AuthUserinfo)

		api := app.Group(v.ApiPath)
		api.POST("/getmenutree", GetmenuTree)
		api.POST("/:operationId", AnyController)
		api.POST("/:subsystemName/:operationId", SubsystemAnyController)

	})
	return app
}

func readyz(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{"status": "OK"})
}
