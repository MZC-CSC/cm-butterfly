package handler

import (
	"log"
	"os"

	"gopkg.in/yaml.v2"

	v "github.com/cloud-barista/cm-butterfly/variables"
)

func init() {
	err := createMenuResource()
	if err != nil {
		log.Fatal("create menu fail : ", err.Error())
	}
	log.Println("Menu init success")
}

type Menu struct {
	Id          string `json:"id", yaml:"id"`
	ParentId    string `json:"parentid", yaml:"parentid"`
	DisplayName string `json:"displayname", yaml:"displayname"`
	Restype     string `json:"restype", yaml:"restype"`
	IsAction    string `json:"isaction", yaml:"isaction"`
	Priority    string `json:"priority", yaml:"priority"`
	Menus       Menus  `json:"menus", yaml:"menus"`
}

type Menus []Menu

var CmigMenuTree Menu

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

func createMenuResource() error {
	data, err := os.ReadFile(v.MENU_CONF_DATA_PATH)
	if err != nil {
		return err
	}

	var cmigMenus Menu
	err = yaml.Unmarshal(data, &cmigMenus)
	if err != nil {
		return err
	}

	CmigMenuTree.Menus = buildMenuTree(cmigMenus.Menus, "home")

	return nil
}

func GetMenuTree(menuList Menus) (*Menus, error) {
	menuTree := buildMenuTree(menuList, "")
	return &menuTree, nil
}
