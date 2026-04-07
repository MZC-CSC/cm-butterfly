package handler

import (
	"log"
	"net/http"

	"api/internal/auth"
	"api/internal/middleware"
	"api/internal/model"
	"api/internal/repository"
	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// Re-export InitAuth from auth package for main.go convenience
var InitAuth = auth.InitAuth

// AuthHandler handles authentication related endpoints
type AuthHandler struct {
	repo *repository.UsersessRepository
}

// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		repo: repository.NewUsersessRepository(db),
	}
}

// Login handles user login
func (h *AuthHandler) Login(c echo.Context) error {
	var body struct {
		Request struct {
			ID       string `json:"id"`
			Password string `json:"password"`
		} `json:"request"`
	}

	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	tokenSet, err := auth.GetUserToken(body.Request.ID, body.Request.Password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	userSess := &model.Usersess{
		UserID:           body.Request.ID,
		AccessToken:      tokenSet.Accesstoken,
		ExpiresIn:        float64(tokenSet.ExpiresIn),
		RefreshToken:     tokenSet.RefreshToken,
		RefreshExpiresIn: float64(tokenSet.RefreshExpiresIn),
	}

	_, err = h.repo.CreateOrUpdate(userSess)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(tokenSet))
}

// LoginRefresh handles token refresh
func (h *AuthHandler) LoginRefresh(c echo.Context) error {
	userID := c.Get(middleware.ContextKeyUserID).(string)
	refreshToken := c.Get(middleware.ContextKeyRefreshToken).(string)

	sess, err := h.repo.FindByUserID(userID)
	if err != nil {
		log.Printf("Error finding user session: %v", err)
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	if refreshToken != sess.RefreshToken {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"error": http.StatusText(http.StatusForbidden),
		})
	}

	tokenSet, err := auth.RefreshAccessToken(sess.RefreshToken)
	if err != nil {
		log.Printf("Error refreshing token: %v", err)
		return c.JSON(http.StatusForbidden, response.CommonResponseStatusForbidden(err.Error()))
	}

	sess.AccessToken = tokenSet.Accesstoken
	sess.ExpiresIn = float64(tokenSet.ExpiresIn)
	sess.RefreshToken = tokenSet.RefreshToken
	sess.RefreshExpiresIn = float64(tokenSet.RefreshExpiresIn)

	if err := h.repo.Update(sess); err != nil {
		log.Printf("Error updating session: %v", err)
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}

	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(tokenSet))
}

// Logout handles user logout
func (h *AuthHandler) Logout(c echo.Context) error {
	userID := c.Get(middleware.ContextKeyUserID).(string)

	_, err := h.repo.DeleteByUserIDAndGetRefreshToken(userID)
	if err != nil {
		log.Printf("AuthLogout err: %v", err)
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest("no user session"))
	}

	return c.JSON(http.StatusOK, response.CommonResponseStatusNoContent(nil))
}

// Userinfo returns the current user's information
func (h *AuthHandler) Userinfo(c echo.Context) error {
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(map[string]interface{}{
		"userid":      c.Get(middleware.ContextKeyUserID).(string),
		"username":    c.Get(middleware.ContextKeyUserName).(string),
		"roles":       c.Get(middleware.ContextKeyRoles).([]string),
		"email":       c.Get(middleware.ContextKeyEmail).(string),
		"description": c.Get(middleware.ContextKeyDescription).(string),
		"company":     c.Get(middleware.ContextKeyCompany).(string),
	}))
}

// Validate validates the current token
func (h *AuthHandler) Validate(c echo.Context) error {
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(nil))
}
