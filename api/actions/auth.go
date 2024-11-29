package actions

import (
	"net/http"

	"github.com/cloud-barista/cm-butterfly/common"
	"github.com/cloud-barista/cm-butterfly/handler"
	"github.com/cloud-barista/cm-butterfly/models"

	"log"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// AuthLogin handles the user login process and generates user tokens.
// @Summary User Login
// @Description Authenticates a user using ID and password, generates tokens, and stores the session in the database.
// @Tags Authentication
// @Accept json
// @Produce json
// @Param request body common.CommonRequest true "Login Request"
// @Success 200 {object} common.CommonResponse "Login Successful, Tokens Returned"
// @Failure 400 {object} common.CommonResponse "Bad Request, Invalid Parameters"
// @Failure 500 {object} common.CommonResponse "Internal Server Error"
// @Router /auth/login [post]
func AuthLogin(c echo.Context) error {
	commonRequest := &common.CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		commonResponse := common.CommonResponseStatusBadRequest(err)
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	id := commonRequest.Request.(map[string]interface{})["id"].(string)
	password := commonRequest.Request.(map[string]interface{})["password"].(string)
	tokenSet, err := handler.GetUserToken(id, password)
	if err != nil {
		commonResponse := common.CommonResponseStatusBadRequest(err)
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	tx := c.Get("tx").(*gorm.DB)
	userSess := &models.Usersess{
		UserID:           id,
		AccessToken:      tokenSet.Accesstoken,
		ExpiresIn:        float64(tokenSet.ExpiresIn),
		RefreshToken:     tokenSet.RefreshToken,
		RefreshExpiresIn: float64(tokenSet.RefreshExpiresIn),
	}
	_, err = handler.CreateUserSess(tx, userSess)
	if err != nil {
		commonResponse := common.CommonResponseStatusBadRequest(err)
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	commonResponse := common.CommonResponseStatusOK(tokenSet)
	return c.JSON(commonResponse.Status.StatusCode, commonResponse)
}

// AuthLoginRefresh handles the refreshing of user tokens.
// @Summary Refresh User Tokens
// @Description Refreshes the access token using a valid refresh token.
// @Tags Authentication
// @Accept json
// @Produce json
// @Success 200 {object} common.CommonResponse "Token Refresh Successful"
// @Failure 400 {object} common.CommonResponse "Bad Request, Invalid Parameters"
// @Failure 500 {object} common.CommonResponse "Internal Server Error"
// @Router /auth/refresh [post]
func AuthLoginRefresh(c echo.Context) error {
	tx := c.Get("tx").(*gorm.DB)
	userId := c.Get("UserId").(string)
	sess, err := handler.GetUserByUserId(tx, userId)
	if err != nil {
		app.Logger.Error(err.Error())
		commonResponse := common.CommonResponseStatusBadRequest(err.Error())
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	tokenSet, err := handler.RefreshAccessToken(sess.RefreshToken)
	if err != nil {
		app.Logger.Error(err.Error())
		commonResponse := common.CommonResponseStatusBadRequest(err.Error())
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	sess.AccessToken = tokenSet.Accesstoken
	sess.ExpiresIn = float64(tokenSet.ExpiresIn)
	sess.RefreshToken = tokenSet.Accesstoken
	sess.RefreshExpiresIn = float64(tokenSet.RefreshExpiresIn)
	_, err = handler.UpdateUserSess(tx, sess)
	if err != nil {
		app.Logger.Error(err.Error())
		commonResponse := common.CommonResponseStatusBadRequest(err.Error())
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	commonResponse := common.CommonResponseStatusOK(tokenSet)
	return c.JSON(commonResponse.Status.StatusCode, commonResponse)
}

// AuthLogout handles user logout and session destruction.
// @Summary User Logout
// @Description Destroys the user's session and invalidates the tokens.
// @Tags Authentication
// @Accept json
// @Produce json
// @Success 204 {object} common.CommonResponse "Logout Successful"
// @Failure 400 {object} common.CommonResponse "Bad Request, Invalid Parameters"
// @Failure 500 {object} common.CommonResponse "Internal Server Error"
// @Router /auth/logout [post]
func AuthLogout(c echo.Context) error {
	tx := c.Get("tx").(*gorm.DB)
	_, err := handler.DestroyUserSessByAccessTokenForLogout(tx, c.Get("Authorization").(string))
	if err != nil {
		log.Println("AuthLogout err : ", err.Error())
		commonResponse := common.CommonResponseStatusBadRequest("no user session")
		return c.JSON(commonResponse.Status.StatusCode, commonResponse)
	}
	commonResponse := common.CommonResponseStatusNoContent(nil)
	return c.JSON(http.StatusOK, commonResponse)
}

// AuthUserinfo retrieves information about the authenticated user.
// @Summary User Info
// @Description Returns the user's information based on the session.
// @Tags Authentication
// @Accept json
// @Produce json
// @Router /auth/userinfo [get]
func AuthUserinfo(c echo.Context) error {
	commonResponse := common.CommonResponseStatusOK(map[string]interface{}{
		"userid":      c.Get("UserId").(string),
		"username":    c.Get("UserName").(string),
		"roles":       c.Get("Roles").([]string),
		"email":       c.Get("Email").(string),
		"description": c.Get("Description").(string),
		"company":     c.Get("Company").(string),
	})
	return c.JSON(commonResponse.Status.StatusCode, commonResponse)
}

// AuthValidate validates the current user's session.
// @Summary Validate User Session
// @Description Validates the current session to ensure the user is still authenticated.
// @Tags Authentication
// @Accept json
// @Produce json
// @Success 200 {object} common.CommonResponse "Session Valid"
// @Failure 400 {object} common.CommonResponse "Bad Request, Invalid Parameters"
// @Router /auth/validate [get]
func AuthValidate(c echo.Context) error {
	commonResponse := common.CommonResponseStatusOK(nil)
	return c.JSON(commonResponse.Status.StatusCode, commonResponse)
}
