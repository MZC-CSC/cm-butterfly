package handler

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
)

// Context key for authorization (to avoid import cycle with middleware)
const contextKeyAuthorization = "Authorization"

// CommonRequest represents the standard request format
type CommonRequest struct {
	PathParams  map[string]string `json:"pathParams"`
	QueryParams map[string]string `json:"queryParams"`
	Request     interface{}       `json:"request"`
}

// Auth represents authentication configuration
type Auth struct {
	Type     string `mapstructure:"type"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

// Service represents a service configuration
type Service struct {
	BaseURL string `mapstructure:"baseurl"`
	Auth    Auth   `mapstructure:"auth"`
}

// Spec represents an API specification
type Spec struct {
	Method       string `mapstructure:"method"`
	ResourcePath string `mapstructure:"resourcePath"`
	Description  string `mapstructure:"description"`
}

// ApiYaml represents the API configuration
type ApiYaml struct {
	CLISpecVersion string                     `mapstructure:"cliSpecVersion"`
	Services       map[string]Service         `mapstructure:"services"`
	ServiceActions map[string]map[string]Spec `mapstructure:"serviceActions"`
}

var ApiYamlSet ApiYaml

// InitAPISpec initializes the API specification from api.yaml
func InitAPISpec() error {
	log.Println("DEBUG: Initializing ApiYamlSet...")

	exePath, err := os.Executable()
	if err != nil {
		log.Printf("ERROR: Failed to get executable path: %v", err)
		return err
	}

	exeDir := filepath.Dir(exePath)

	viper.SetConfigName("api")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(filepath.Join(exeDir, "conf"))
	viper.AddConfigPath("conf")

	log.Printf("DEBUG: exePath: %s", exePath)
	log.Printf("DEBUG: exeDir: %s", exeDir)
	log.Printf("DEBUG: conf path: %s", filepath.Join(exeDir, "conf"))

	if err := viper.ReadInConfig(); err != nil {
		log.Printf("ERROR: Failed to read config: %v", err)
		return fmt.Errorf("fatal error reading conf/api.yaml file: %s", err)
	}

	log.Printf("DEBUG: Config file loaded successfully")

	if err := viper.Unmarshal(&ApiYamlSet); err != nil {
		log.Printf("ERROR: Failed to unmarshal config: %v", err)
		return fmt.Errorf("unable to decode into struct: %v", err)
	}

	log.Printf("DEBUG: ApiYamlSet initialized successfully")
	log.Printf("DEBUG: - CLISpecVersion: %s", ApiYamlSet.CLISpecVersion)
	log.Printf("DEBUG: - Services count: %d", len(ApiYamlSet.Services))
	log.Printf("DEBUG: - ServiceActions count: %d", len(ApiYamlSet.ServiceActions))

	for serviceName, service := range ApiYamlSet.Services {
		log.Printf("DEBUG: - Service: %s -> %+v", serviceName, service)
	}

	return nil
}

// AnyCaller — 서브시스템을 지정하지 않은 프록시 호출.
//
// 더 이상 실제 호출을 중계하지 않는다. operationId 만으로는 어느 서브시스템의 API 인지
// 확정할 수 없기 때문이다 — 같은 이름이 여러 서브시스템에 존재한다(예: getinfra 는
// cb-tumblebug 과 cm-beetle 이 함께 정의한다). 예전에는 전체를 순회해 먼저 걸리는 것을
// 썼는데, Go 의 map 순회는 순서가 무작위라 같은 호출이 실행할 때마다 다른 서비스로 갈 수 있었다.
//
// 호출은 POST /api/{subsystem}/{operationId} 로 한다(SubsystemAnyCaller).
// cm-butterfly 자체 API 는 별도의 네이티브 라우트로 등록돼 있어 이 경로를 타지 않는다.
func AnyCaller(c echo.Context, operationId string, commonRequest *CommonRequest, auth bool) (*response.CommonResponse, error) {
	err := fmt.Errorf("operationId %q must be called as {subsystem}/%s", operationId, operationId)
	log.Printf("ERROR: AnyCaller rejected a call without a subsystem: %v", err)
	return response.CommonResponseStatusNotFound(err.Error()), err
}

// GetApiSpec — 더 이상 사용하지 않는다.
//
// operationId 는 서브시스템 안에서만 유일하다. 같은 이름이 여러 서브시스템에 존재하며
// (예: get-infra-info 는 cm-honeybee 가, getinfra 는 cb-tumblebug 과 cm-beetle 이 함께 정의한다),
// 전체를 놓고 보면 이름 중복을 피할 수 없다. 이 함수는 모든 서브시스템의 map 을 순회해
// 먼저 걸리는 것을 반환했는데, Go 의 map 순회는 순서가 무작위라 같은 호출이 실행할 때마다
// 다른 서비스로 갈 수 있었다.
//
// 따라서 서브시스템을 명시해 호출한다 — POST /api/{subsystem}/{operationId}.
// 프론트의 operationId 상수도 모두 그 형태로 지정돼 있다.
//
// func GetApiSpec(requestOpertinoId string) (string, Service, Spec, error) {
// 	for framework, api := range ApiYamlSet.ServiceActions {
// 		for opertinoId, spec := range api {
// 			if opertinoId == strings.ToLower(requestOpertinoId) {
// 				return framework, ApiYamlSet.Services[framework], spec, nil
// 			}
// 		}
// 	}
// 	return "", Service{}, Spec{}, fmt.Errorf("getApiSpec not found")
// }

// SubsystemAnyCaller routes requests to a specific subsystem
func SubsystemAnyCaller(c echo.Context, subsystemName, operationId string, commonRequest *CommonRequest, auth bool) (*response.CommonResponse, error) {
	targetFrameworkInfo, targetApiSpec, err := getApiSpecBySubsystem(subsystemName, operationId)
	if err != nil || targetFrameworkInfo == (Service{}) || targetApiSpec == (Spec{}) {
		return response.CommonResponseStatusNotFound(operationId + "-" + err.Error()), err
	}

	var authString string
	if auth {
		authString, err = getAuth(c, targetFrameworkInfo)
		if err != nil {
			return response.CommonResponseStatusBadRequest(err.Error()), err
		}
	} else {
		authString = ""
	}

	// 들어온 X-Request-Id 를 서브시스템까지 그대로 전달한다. cm-beetle 은 이 id 로 요청을
	// 추적하므로(핸들러 실행 전 Handling, 끝나면 Success/Error), 프론트가 긴 삭제를 기다리다
	// 끊겨도 GET /request/{id} 로 진행 상태를 조회할 수 있다. 없으면 빈 문자열이라 무시된다.
	reqID := c.Request().Header.Get(echo.HeaderXRequestID)

	commonResponse, err := CommonCaller(strings.ToUpper(targetApiSpec.Method), targetFrameworkInfo.BaseURL, targetApiSpec.ResourcePath, commonRequest, authString, reqID)
	if err != nil {
		return commonResponse, err
	}
	return commonResponse, err
}

func getApiSpecBySubsystem(subsystemName, requestOpertinoId string) (Service, Spec, error) {
	apis := ApiYamlSet.ServiceActions[strings.ToLower(subsystemName)]
	for opertinoId, spec := range apis {
		if strings.EqualFold(strings.ToLower(opertinoId), strings.ToLower(requestOpertinoId)) {
			return ApiYamlSet.Services[strings.ToLower(subsystemName)], spec, nil
		}
	}
	return Service{}, Spec{}, fmt.Errorf("getApiSpec not found")
}

func getAuth(c echo.Context, service Service) (string, error) {
	log.Printf("DEBUG: getAuth called with service.Auth.Type: %s", service.Auth.Type)

	switch service.Auth.Type {
	case "basic":
		if apiUserInfo := service.Auth.Username + ":" + service.Auth.Password; service.Auth.Username != "" && service.Auth.Password != "" {
			encA := base64.StdEncoding.EncodeToString([]byte(apiUserInfo))
			log.Printf("DEBUG: Basic auth generated: Basic %s", encA)
			return "Basic " + encA, nil
		}
		log.Printf("ERROR: username or password is empty")
		return "", fmt.Errorf("username or password is empty")

	case "bearer":
		if authValue, ok := c.Get(contextKeyAuthorization).(string); ok {
			log.Printf("DEBUG: Bearer auth from context: %s", authValue)
			return authValue, nil
		}
		log.Printf("ERROR: authorization key does not exist or is not a string")
		return "", fmt.Errorf("authorization key does not exist or is not a string")

	default:
		log.Printf("DEBUG: No auth required (type: %s)", service.Auth.Type)
		return "", nil
	}
}

// CommonCaller makes HTTP calls to subsystems
func CommonCaller(callMethod string, targetFwUrl string, endPoint string, commonRequest *CommonRequest, auth string, reqID string) (*response.CommonResponse, error) {
	log.Printf("DEBUG: CommonCaller called")
	log.Printf("DEBUG: - callMethod: %s", callMethod)
	log.Printf("DEBUG: - targetFwUrl: %s", targetFwUrl)
	log.Printf("DEBUG: - endPoint: %s", endPoint)
	log.Printf("DEBUG: - commonRequest: %+v", commonRequest)
	log.Printf("DEBUG: - auth: %s", auth)

	pathParamsUrl := mappingUrlPathParams(endPoint, commonRequest)
	log.Printf("DEBUG: - pathParamsUrl: %s", pathParamsUrl)

	queryParamsUrl := mappingQueryParams(pathParamsUrl, commonRequest)
	log.Printf("DEBUG: - queryParamsUrl: %s", queryParamsUrl)

	requestUrl := targetFwUrl + queryParamsUrl
	log.Printf("DEBUG: - final requestUrl: %s", requestUrl)

	log.Printf("DEBUG: About to call CommonHttpToCommonResponse")
	commonResponse, err := CommonHttpToCommonResponse(requestUrl, commonRequest.Request, callMethod, auth, reqID)

	if err != nil {
		log.Printf("ERROR: CommonHttpToCommonResponse failed: %v", err)
	} else {
		log.Printf("DEBUG: CommonHttpToCommonResponse succeeded")
		if commonResponse != nil {
			log.Printf("DEBUG: - response status: %+v", commonResponse.Status)
		}
	}

	return commonResponse, err
}

// CommonCallerWithoutToken makes HTTP calls without authentication
func CommonCallerWithoutToken(callMethod string, targetFwUrl string, endPoint string, commonRequest *CommonRequest) (*response.CommonResponse, error) {
	pathParamsUrl := mappingUrlPathParams(endPoint, commonRequest)
	queryParamsUrl := mappingQueryParams(pathParamsUrl, commonRequest)
	requestUrl := targetFwUrl + queryParamsUrl
	commonResponse, err := CommonHttpToCommonResponse(requestUrl, commonRequest.Request, callMethod, "", "")
	return commonResponse, err
}

func mappingUrlPathParams(endPoint string, commonRequest *CommonRequest) string {
	u := endPoint
	for k, r := range commonRequest.PathParams {
		u = strings.Replace(u, "{"+k+"}", r, -1)
	}
	return u
}

func mappingQueryParams(targeturl string, commonRequest *CommonRequest) string {
	u, err := url.Parse(targeturl)
	if err != nil {
		return ""
	}
	q := u.Query()
	for k, v := range commonRequest.QueryParams {
		q.Set(string(k), v)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// CommonHttpToCommonResponse makes HTTP request and converts response
func CommonHttpToCommonResponse(url string, s interface{}, httpMethod string, auth string, reqID string) (*response.CommonResponse, error) {
	log.Printf("DEBUG: CommonHttpToCommonResponse called")
	log.Printf("DEBUG: - METHOD: %s", httpMethod)
	log.Printf("DEBUG: - URL: %s", url)
	log.Printf("DEBUG: - Auth: %s", auth)
	log.Printf("DEBUG: - Request Data: %+v", s)

	jsonData, err := json.Marshal(s)
	if err != nil {
		log.Printf("ERROR: json.Marshal failed: %v", err)
		return nil, err
	}
	log.Printf("DEBUG: - JSON Data: %s", string(jsonData))

	req, err := http.NewRequest(httpMethod, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("ERROR: Failed to create HTTP request: %v", err)
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Add("Authorization", auth)
		log.Printf("DEBUG: - Authorization header added: %s", auth)
	}
	if reqID != "" {
		req.Header.Set(echo.HeaderXRequestID, reqID)
		log.Printf("DEBUG: - X-Request-Id forwarded: %s", reqID)
	}

	log.Printf("DEBUG: - Request Headers:")
	for name, values := range req.Header {
		for _, value := range values {
			log.Printf("DEBUG:   %s: %s", name, value)
		}
	}

	requestDump, err := httputil.DumpRequest(req, true)
	if err != nil {
		log.Printf("ERROR: Failed to dump request: %v", err)
	} else {
		log.Printf("DEBUG: - Full Request Dump:\n%s", string(requestDump))
	}

	customTransport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: customTransport}

	log.Printf("DEBUG: - Sending HTTP request...")
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("ERROR: HTTP request failed: %v", err)
		return response.CommonResponseStatusInternalServerError(err), err
	}
	defer resp.Body.Close()

	log.Printf("DEBUG: - HTTP Response received")
	log.Printf("DEBUG: - Response Status: %s", resp.Status)
	log.Printf("DEBUG: - Response Status Code: %d", resp.StatusCode)

	log.Printf("DEBUG: - Response Headers:")
	for name, values := range resp.Header {
		for _, value := range values {
			log.Printf("DEBUG:   %s: %s", name, value)
		}
	}

	respBody, ioerr := io.ReadAll(resp.Body)
	if ioerr != nil {
		log.Printf("ERROR: Failed to read response body: %v", ioerr)
	} else {
		log.Printf("DEBUG: - Response Body: %s", string(respBody))
	}

	commonResponse := &response.CommonResponse{}
	commonResponse.Status.Message = resp.Status
	commonResponse.Status.StatusCode = resp.StatusCode

	jsonerr := json.Unmarshal(respBody, &commonResponse.ResponseData)
	if jsonerr != nil {
		log.Printf("DEBUG: - Response is not valid JSON, treating as plain text")
		commonResponse.ResponseData = strings.TrimSpace(string(respBody))
	} else {
		log.Printf("DEBUG: - Response parsed as JSON successfully")
	}

	log.Printf("DEBUG: - Final CommonResponse: %+v", commonResponse)
	return commonResponse, nil
}
