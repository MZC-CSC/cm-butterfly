package middleware

import (
	"net/http"
	"strings"

	"api/internal/auth"
	"api/internal/repository"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

const (
	ContextKeyAuthorization = "Authorization"
	ContextKeyUserID        = "UserId"
	ContextKeyUserName      = "UserName"
	ContextKeyRoles         = "Roles"
	ContextKeyEmail         = "Email"
	ContextKeyDescription   = "Description"
	ContextKeyCompany       = "Company"
	ContextKeyRefreshToken  = "refreshToken"
)

// AuthMiddleware validates JWT token and sets user context
func AuthMiddleware(db *gorm.DB) echo.MiddlewareFunc {
	repo := repository.NewUsersessRepository(db)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			accessToken := strings.TrimPrefix(authHeader, "Bearer ")

			claims, err := auth.GetTokenClaims(accessToken)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"error": "Unauthorized",
				})
			}

			// Check if user session exists
			exists, err := repo.ExistsByUserID(claims.Upn)
			if err != nil || !exists {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"error": "Unauthorized",
				})
			}

			// Set context values
			c.Set(ContextKeyAuthorization, authHeader)
			c.Set(ContextKeyUserID, claims.Upn)
			c.Set(ContextKeyUserName, claims.Name)
			c.Set(ContextKeyRoles, claims.Roles)
			c.Set(ContextKeyEmail, claims.Email)
			c.Set(ContextKeyDescription, claims.Description)
			c.Set(ContextKeyCompany, claims.Company)

			return next(c)
		}
	}
}

// RefreshTokenMiddleware validates refresh token for token refresh endpoint
func RefreshTokenMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			accessToken := strings.TrimPrefix(authHeader, "Bearer ")

			// Check token - allow expired tokens for refresh
			_, err := auth.GetTokenClaims(accessToken)
			if err != nil && !strings.Contains(err.Error(), "token is expired") {
				return c.JSON(http.StatusUnauthorized, map[string]interface{}{
					"error": "Unauthorized",
				})
			}

			// Parse request body to get refresh token
			var body map[string]interface{}
			if err := c.Bind(&body); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"error": "Bad Request",
				})
			}

			request, ok := body["request"].(map[string]interface{})
			if !ok {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"error": "Bad Request",
				})
			}

			refreshToken, ok := request["refresh_token"].(string)
			if !ok {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"error": "Bad Request: refresh_token is required",
				})
			}

			refreshTokenClaim, err := auth.GetRefreshTokenClaims(refreshToken)
			if err != nil {
				return c.JSON(http.StatusForbidden, map[string]interface{}{
					"error": "Forbidden",
				})
			}

			c.Set(ContextKeyUserID, refreshTokenClaim.Upn)
			c.Set(ContextKeyRefreshToken, refreshToken)

			return next(c)
		}
	}
}

// CORSMiddleware returns CORS middleware configuration
func CORSMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization, X-CSRF-Token")

			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusNoContent)
			}

			return next(c)
		}
	}
}

// RequestLoggerMiddleware logs incoming requests
func RequestLoggerMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Echo has built-in logger middleware, but this is a custom one if needed
			return next(c)
		}
	}
}
