package variables

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

var (
	API_ADDR            = ""
	API_PORT            = ""
	SWAGGER             = false
	DATABASE_URL        = ""
	USER_AUTH_CONF_PATH = ""
	USER_AUTH_DATA_PATH = ""
	MENU_CONF_DATA_PATH = ""
)

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	API_ADDR = os.Getenv("API_ADDR")
	API_PORT = os.Getenv("API_PORT")
	SWAGGER, _ = strconv.ParseBool(os.Getenv("SWAGGER"))
	DATABASE_URL = os.Getenv("DATABASE_URL")
	USER_AUTH_CONF_PATH = os.Getenv("USER_AUTH_CONF_PATH")
	USER_AUTH_DATA_PATH = os.Getenv("USER_AUTH_DATA_PATH")
	MENU_CONF_DATA_PATH = os.Getenv("MENU_CONF_DATA_PATH")
}
