package actions

import (
	"log"
	"net/http"
	"strings"

	"github.com/cloud-barista/cm-butterfly/handler"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func SetContextMiddleware(skipPaths ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			for _, path := range skipPaths {
				if c.Path() == path {
					return next(c)
				}
			}

			accessToken := strings.TrimPrefix(c.Request().Header.Get("Authorization"), "Bearer ")

			claims, err := handler.GetTokenClaims(accessToken)
			if err != nil {
				log.Println(err.Error())
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{"error": "Unauthorized"})
			}

			tx, ok := c.Get("tx").(*gorm.DB)
			if !ok {
				log.Println("failed to get transaction from context")
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": "Internal Server Error"})
			}

			isUser, err := handler.IsUserSessExistByUserId(tx, claims.Upn)
			if err != nil || !isUser {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{"error": "Unauthorized"})
			}

			c.Set("Authorization", accessToken)
			c.Set("UserId", claims.Upn)
			c.Set("UserName", claims.Name)
			c.Set("Roles", claims.Roles)
			c.Set("Email", claims.Email)
			c.Set("Description", claims.Description)
			c.Set("Company", claims.Company)

			return next(c)
		}
	}
}

func TransactionMiddleware(db *gorm.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tx := db.Begin()
			if tx.Error != nil {
				log.Print(tx.Error)
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to start transaction")
			}
			c.Set("tx", tx)
			err := next(c)
			if err != nil {
				tx.Rollback()
				return err
			}
			if commitErr := tx.Commit().Error; commitErr != nil {
				log.Print(commitErr)
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to commit transaction")
			}
			return nil
		}
	}
}
