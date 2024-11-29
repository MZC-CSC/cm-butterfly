package actions

import (
	"github.com/cloud-barista/cm-butterfly/common"
	"github.com/cloud-barista/cm-butterfly/handler"

	"github.com/labstack/echo/v4"
)

func GetmenuTree(c echo.Context) error {
	commonResponse := common.CommonResponseStatusOK(handler.CmigMenuTree.Menus)
	return c.JSON(commonResponse.Status.StatusCode, commonResponse)
}
