package actions

import (
	"api/handler"
	"net/http"
	"strings"

	"github.com/gobuffalo/buffalo"
	"github.com/gobuffalo/buffalo/render"
	"github.com/gobuffalo/pop/v6"
)

func SetContextMiddleware(next buffalo.Handler) buffalo.Handler {
	return func(c buffalo.Context) error {
		accessToken := strings.TrimPrefix(c.Request().Header.Get("Authorization"), "Bearer ")
		claims, err := handler.GetTokenClaims(accessToken)
		if err != nil {
			app.Logger.Error(err.Error())
			return c.Render(http.StatusUnauthorized, render.JSON(map[string]interface{}{"error": "Unauthorized"}))
		}
		tx := c.Value("tx").(*pop.Connection)

		isUser, err := handler.IsUserSessExistByUserId(tx, claims.Upn)
		if err != nil || !isUser {
			return c.Render(http.StatusUnauthorized, render.JSON(map[string]interface{}{"error": "Unauthorized"}))
		}

		c.Set("Authorization", c.Request().Header.Get("Authorization"))

		c.Set("UserId", claims.Upn)
		c.Set("UserName", claims.Name)
		c.Set("Roles", claims.Roles)
		c.Set("Email", claims.Email)
		c.Set("Description", claims.Description)
		c.Set("Company", claims.Company)

		return next(c)
	}
}
