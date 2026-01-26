package handler

import (
	"fmt"
	"net/http"
	"strings"

	"api/internal/util/response"

	"github.com/labstack/echo/v4"
)

// Context key for roles (to avoid import cycle with middleware)
const contextKeyRoles = "Roles"

// GetWorkspaceUserRoleMappingListResponse represents the response for workspace user role mapping
type GetWorkspaceUserRoleMappingListResponse struct {
	Role                    Role                    `json:"role"`
	WorkspaceProjectMapping WorkspaceProjectMapping `json:"workspaceProject"`
}

// Role represents a user role
type Role struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// WorkspaceProjectMapping represents workspace to project mapping
type WorkspaceProjectMapping struct {
	Workspace Workspace `json:"workspace"`
	Projects  Projects  `json:"projects"`
}

// Workspace represents a workspace
type Workspace struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Project represents a project
type Project struct {
	ID          string `json:"id"`
	NsID        string `json:"ns_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Projects is a slice of Project
type Projects []Project

// DefaultWorkspace is the default workspace
var DefaultWorkspace = Workspace{
	ID:          "ws01",
	Name:        "ws01",
	Description: "this is only workspace for default workspace",
}

// WorkspaceHandler handles workspace-related endpoints
type WorkspaceHandler struct{}

// NewWorkspaceHandler creates a new WorkspaceHandler
func NewWorkspaceHandler() *WorkspaceHandler {
	return &WorkspaceHandler{}
}

// PostNs creates a new namespace/project
func PostNs(c echo.Context, commonRequest *CommonRequest) (*Project, error) {
	operationId := strings.ToLower("PostNs")
	commonResponse, err := AnyCaller(c, operationId, commonRequest, true)
	if err != nil {
		return nil, err
	}
	nsAssert := commonResponse.ResponseData.(map[string]interface{})
	project := Project{
		ID:          nsAssert["id"].(string),
		NsID:        nsAssert["id"].(string),
		Name:        nsAssert["name"].(string),
		Description: nsAssert["description"].(string),
	}
	return &project, nil
}

// GetAllNs gets all namespaces/projects
func GetAllNs(c echo.Context) (*Projects, error) {
	operationId := strings.ToLower("GetAllNs")
	commonResponse, err := AnyCaller(c, operationId, &CommonRequest{}, true)
	if err != nil {
		return nil, err
	}

	var projects Projects
	responseData := commonResponse.ResponseData.(map[string]interface{})
	if nsList, ok := responseData["ns"].([]interface{}); ok {
		for _, ns := range nsList {
			nsAssert := ns.(map[string]interface{})
			project := Project{
				ID:          nsAssert["id"].(string),
				NsID:        nsAssert["id"].(string),
				Name:        nsAssert["name"].(string),
				Description: nsAssert["description"].(string),
			}
			projects = append(projects, project)
		}
	}

	return &projects, nil
}

// GetNs gets a namespace/project by ID
func GetNs(c echo.Context, commonRequest *CommonRequest) (*Project, error) {
	operationId := strings.ToLower("GetNs")
	commonResponse, err := AnyCaller(c, operationId, commonRequest, true)
	if err != nil {
		return nil, err
	}

	nsAssert := commonResponse.ResponseData.(map[string]interface{})
	project := Project{
		ID:          nsAssert["id"].(string),
		NsID:        nsAssert["id"].(string),
		Name:        nsAssert["name"].(string),
		Description: nsAssert["description"].(string),
	}

	return &project, nil
}

// DelNs deletes a namespace/project
func DelNs(c echo.Context, commonRequest *CommonRequest) error {
	operationId := strings.ToLower("DelNs")
	commonResponse, err := AnyCaller(c, operationId, commonRequest, true)
	if err != nil {
		return err
	}
	if commonResponse.Status.StatusCode != 200 {
		return fmt.Errorf("job finished with code %d", commonResponse.Status.StatusCode)
	}
	return nil
}

// PutNs updates a namespace/project
func PutNs(c echo.Context, commonRequest *CommonRequest) (*Project, error) {
	operationId := strings.ToLower("PutNs")
	commonResponse, err := AnyCaller(c, operationId, commonRequest, true)
	if err != nil {
		return nil, err
	}
	nsAssert := commonResponse.ResponseData.(map[string]interface{})
	project := Project{
		ID:          nsAssert["id"].(string),
		NsID:        nsAssert["id"].(string),
		Name:        nsAssert["name"].(string),
		Description: nsAssert["description"].(string),
	}
	return &project, nil
}

// GetWPmappingListByWorkspaceId handles workspace project mapping list
func (h *WorkspaceHandler) GetWPmappingListByWorkspaceId(c echo.Context) error {
	projects, err := GetAllNs(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	result := &WorkspaceProjectMapping{
		Workspace: DefaultWorkspace,
		Projects:  *projects,
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(result))
}

// GetWorkspaceUserRoleMappingListByUserId handles user role mapping list
func (h *WorkspaceHandler) GetWorkspaceUserRoleMappingListByUserId(c echo.Context) error {
	projects, err := GetAllNs(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}

	roles := c.Get(contextKeyRoles).([]string)
	roleName := ""
	if len(roles) > 0 {
		roleName = roles[0]
	}

	result := &GetWorkspaceUserRoleMappingListResponse{
		Role: Role{
			Name:        roleName,
			Description: "this is default role.",
		},
		WorkspaceProjectMapping: WorkspaceProjectMapping{
			Workspace: DefaultWorkspace,
			Projects:  *projects,
		},
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(result))
}

// CreateProject creates a new project
func (h *WorkspaceHandler) CreateProject(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	project, err := PostNs(c, commonRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(project))
}

// GetProjectById gets a project by ID
func (h *WorkspaceHandler) GetProjectById(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	project, err := GetNs(c, commonRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(project))
}

// GetProjectList gets all projects
func (h *WorkspaceHandler) GetProjectList(c echo.Context) error {
	projects, err := GetAllNs(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(projects))
}

// UpdateProjectById updates a project
func (h *WorkspaceHandler) UpdateProjectById(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	project, err := PutNs(c, commonRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(project))
}

// DeleteProjectById deletes a project
func (h *WorkspaceHandler) DeleteProjectById(c echo.Context) error {
	commonRequest := &CommonRequest{}
	if err := c.Bind(commonRequest); err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(nil))
	}
	err := DelNs(c, commonRequest)
	if err != nil {
		return c.JSON(http.StatusBadRequest, response.CommonResponseStatusBadRequest(err.Error()))
	}
	return c.JSON(http.StatusOK, response.CommonResponseStatusOK(nil))
}
