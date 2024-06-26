package service

import (
	// "encoding/base64"
	"fmt"
	// "log"
	// "io"
	// "net/http"
	"os"
	"strconv"
	"time"
	"encoding/json"
	"net/http"

	echosession "github.com/go-session/echo-session"
	"github.com/labstack/echo"

	"github.com/cloud-barista/cm-butterfly/src/model"
	util "github.com/cloud-barista/cm-butterfly/src/util"

	cicada_common "github.com/cloud-barista/cm-butterfly/src/model/cicada/common"
	//cicada "github.com/cloud-barista/cm-butterfly/src/model/cicada/workflow"
)

var SpiderURL = os.Getenv("SPIDER_URL")
var TumbleBugURL = os.Getenv("TUMBLE_URL")
var DragonFlyURL = os.Getenv("DRAGONFLY_URL")
var LadyBugURL = os.Getenv("LADYBUG_URL")
var CicadaURL = os.Getenv("CICADA_URL")
var HoneyBeeURL = os.Getenv("HONEYBEE_URL")

// type CredentialInfo struct {
// 	Username string
// 	Password string
// }
type CommonURL struct {
	SpiderURL    string
	TumbleBugURL string
	DragonFlyURL string
	LadyBugURL   string
	HoneyBeeURL   string
	CicadaURL   string
}

func GetCommonURL() CommonURL {
	common_url := CommonURL{
		SpiderURL:    os.Getenv("SPIDER_URL"),
		TumbleBugURL: os.Getenv("TUMBLE_URL"),
		DragonFlyURL: os.Getenv("DRAGONFLY_URL"),
		LadyBugURL:   os.Getenv("LADYBUG_URL"),
		HoneyBeeURL:   os.Getenv("HONEYBEE_URL"),
		CicadaURL:   os.Getenv("CICADA_URL"),
	}
	return common_url
}

// POST 호출하는 공통함수 --> 생성할 것.
// func CommonHttpPost()(io.ReadCloser, err) {
// }

// func GetCredentialInfo(c echo.Context, userid string) CredentialInfo {
// 	store := echosession.FromContext(c)
// 	getObj, ok := store.Get(userid)
// 	if !ok {
// 		return CredentialInfo{}
// 	}
// 	result := getObj.(map[string]string)
// 	credentialInfo := CredentialInfo{
// 		UserID:   result["userid"],
// 		Password: result["password"],
// 	}
// 	return credentialInfo
// }

// func SetLoginInfo(c echo.Context) LoginInfo {
// 	store := echosession.FromContext(c)
// 	nsList := service.GetNSList()
// 	store.Set("username")
// }

// func SetNameSpace(c echo.Context) error {
// 	fmt.Println("====== SET NAME SPACE ========")
// 	store := echosession.FromContext(c)
// 	ns := c.Param("nsid")
// 	fmt.Println("SetNameSpaceID : ", ns)
// 	store.Set("namespace", ns)
// 	err := store.Save()
// 	res := map[string]string{
// 		"message": "success",
// 	}
// 	if err != nil {
// 		res["message"] = "fail"
// 		return c.JSON(http.StatusNotAcceptable, res)
// 	}
// 	return c.JSON(http.StatusOK, res)
// }

// move to NameSpaceController.go
// func GetNameSpace(c echo.Context) error {
// 	fmt.Println("====== GET NAME SPACE ========")
// 	store := echosession.FromContext(c)

// 	getInfo, ok := store.Get("namespace")
// 	if !ok {
// 		return c.JSON(http.StatusNotAcceptable, map[string]string{
// 			"message": "Not Exist",
// 		})
// 	}
// 	nsId := getInfo.(string)

// 	res := map[string]string{
// 		"message": "success",
// 		"nsID":    nsId,
// 	}

// 	return c.JSON(http.StatusOK, res)
// }

func GetNameSpaceToString(c echo.Context) string {
	fmt.Println("====== GET NAME SPACE ========")
	store := echosession.FromContext(c)

	getInfo, ok := store.Get("namespace")
	if !ok {
		return ""
	}
	nsId := getInfo.(string)

	return nsId
}

// 해당 유저가 유효한지만 체크. : store에 저장되어 있으면 OK.
// TODO : token이 유효하면 시간연장, 유효하지 않으면 refresh token이 유효하면 시간연장, 둘다 expired되었으면 login으로
func CallLoginInfo(c echo.Context) model.LoginInfo {
	// cookie에 go_session_id 가 있는데 뭐지??

	// tk, cookeierr := c.Request().Cookie("access-token")
	// cookieUsername, cookeierr := c.Request().Cookie("Username")
	cookieUserID, cookeierr := c.Request().Cookie("UserID")
	if cookeierr != nil {
		fmt.Println("cookeierr ", cookeierr)
		// return nil
		return model.LoginInfo{}
	}
	fmt.Println(cookieUserID)
	if cookieUserID == nil {
		return model.LoginInfo{}
	}
	cookieUserIDStr := cookieUserID.Value
	fmt.Println(cookieUserIDStr)

	// TODO: token 유효성 검증 로직 필요
	// fmt.Println("step2")
	// cookieAccessToken, cookeierr2 := c.Request().Cookie("AccessToken")
	// if cookeierr2 != nil {
	// 	fmt.Println("cookieAccessToken ", cookeierr2) // -> http: named cookie not present
	// 	// return nil
	// }
	// cookieAccessTokenStr := cookieAccessToken.Value
	// fmt.Println(cookieAccessTokenStr)

	fmt.Println("step3")
	store := echosession.FromContext(c)

	// param으로 username, token을 받아 store에서 찾는다.
	// username := c.request.Header.Get("username")

	fmt.Println("========= CallLoginInfo cookieUserID =========" + cookieUserIDStr)
	result, ok := store.Get(cookieUserIDStr)
	if !ok {
		fmt.Println("========= CallLoginInfo Nothing ========= ", ok)
		return model.LoginInfo{}
	}

	// fmt.Println("GETUSER : ", result.(string))
	storedUser := result.(map[string]string)
	// getObj, ok := store.Get(storedUser.(string))
	// if !ok {
	// 	return LoginInfo{}
	// }

	// result := getObj.(map[string]string)

	// loginInfo := model.LoginInfo{
	// 	Username:           storedUser["username"],
	// 	AccessToken:        storedUser["accesstoken"],
	// 	DefaultNameSpaceID: storedUser["defaultnamespaceid"],
	// 	DefaultNameSpaceName: storedUser["defaultnameSpacename"],
	// }
	loginInfo := model.LoginInfo{
		UserID:               storedUser["userid"],
		Username:             storedUser["username"],
		AccessToken:          storedUser["accesstoken"],
		DefaultNameSpaceID:   storedUser["defaultnamespaceid"],
		DefaultNameSpaceName: storedUser["defaultnameSpacename"],
	}
	fmt.Println("========= return loginInfo =========,", loginInfo)
	return loginInfo
}

// func LoginCheck(c echo.Context) bool {
// 	store := echosession.FromContext(c)

// 	inputName := c.FormValue("username")
// 	inputPass := c.FormValue("password")

// 	getInfo, ok := store.Get(inputName)
// 	if !ok {
// 		return false
// 	}
// 	result := getInfo.(map[string]string)
// 	if result["password"] == inputPass && result["username"] == inputName {
// 		return true
// 	}

// 	return false
// }

func MakeNameSpace(name string) string {
	now := time.Now()
	nanos := strconv.FormatInt(now.UnixNano(), 10)

	result := name + "-" + nanos
	fmt.Println("makeNameSpace : ", result)
	return result
}

// Readyz of Cicada
func GetCicadaReadyz()(model.WebStatus){
	var originalUrl = "/readyz"	
	url := util.CICADA + originalUrl

	resp, err := util.CommonHttpWithoutParam(url, http.MethodGet)

	// defer body.Close()
	returnStatus := model.WebStatus{}
	simpleMsg := cicada_common.SimpleMsg{}
	if err != nil {
		fmt.Println(err)
		return model.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// util.DisplayResponse(resp) // 수신내용 확인

	//spew.Dump(resp.Body)
	respBody := resp.Body
	respStatus := resp.StatusCode

	json.NewDecoder(respBody).Decode(&simpleMsg)
	fmt.Println(simpleMsg)

	returnStatus.Message = simpleMsg.Message
	returnStatus.StatusCode = respStatus

	return returnStatus
}

func GetHoneyBeeReadyz()(model.WebStatus){
	var originalUrl = "/readyz"	
	url := util.HONEYBEE + originalUrl

	resp, err := util.CommonHttpWithoutParam(url, http.MethodGet)

	// defer body.Close()
	returnStatus := model.WebStatus{}
	simpleMsg := cicada_common.SimpleMsg{}
	if err != nil {
		fmt.Println(err)
		return model.WebStatus{StatusCode: 500, Message: err.Error()}
	}
	// util.DisplayResponse(resp) // 수신내용 확인

	//spew.Dump(resp.Body)
	respBody := resp.Body
	respStatus := resp.StatusCode

	json.NewDecoder(respBody).Decode(&simpleMsg)
	fmt.Println(simpleMsg)

	returnStatus.Message = simpleMsg.Message
	returnStatus.StatusCode = respStatus

	return returnStatus
}