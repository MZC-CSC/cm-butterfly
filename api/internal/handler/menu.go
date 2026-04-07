package handler

import (
	"log"
	"net/http"
	"os"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"gopkg.in/yaml.v2"
)

// Menu represents a menu item
type Menu struct {
	Id          string `json:"id" yaml:"id"`
	ParentId    string `json:"parentid" yaml:"parentid"`
	DisplayName string `json:"displayname" yaml:"displayname"`
	Restype     string `json:"restype" yaml:"restype"`
	IsAction    string `json:"isaction" yaml:"isaction"`
	Priority    string `json:"priority" yaml:"priority"`
	Menus       Menus  `json:"menus" yaml:"menus"`
}

// Menus is a slice of Menu
type Menus []Menu

// CmigMenuTree holds the menu tree
var CmigMenuTree Menu

// InitMenu initializes the menu system
func InitMenu(menuConfPath string) error {
	data, err := os.ReadFile(menuConfPath)
	if err != nil {
		return err
	}

	var cmigMenus Menu
	err = yaml.Unmarshal(data, &cmigMenus)
	if err != nil {
		return err
	}

	CmigMenuTree.Menus = buildMenuTree(cmigMenus.Menus, "home")
	log.Println("Menu init success")
	return nil
}

func buildMenuTree(menus Menus, parentID string) Menus {
	var tree Menus

	for _, menu := range menus {
		if menu.ParentId == parentID {
			menu.Menus = buildMenuTree(menus, menu.Id)
			tree = append(tree, menu)
		}
	}
	return tree
}

// MenuHandler handles menu-related endpoints
type MenuHandler struct{}

// NewMenuHandler creates a new MenuHandler
func NewMenuHandler() *MenuHandler {
	return &MenuHandler{}
}

// GetMenuTree returns the menu tree
func (h *MenuHandler) GetMenuTree(c echo.Context) error {
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(CmigMenuTree.Menus))
}
