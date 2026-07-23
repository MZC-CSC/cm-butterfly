package handler

import (
	"log"

	"api/internal/middleware"
	"api/internal/model"
	"api/internal/repository"
	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// DeleteRequestHandler exposes the tracked infra deletes.
//
// These are shared, not per-user. A delete is something that happened to an infra, not a
// private action: if one operator's delete failed, the next person to open the console
// needs to see that too, otherwise they retry into the same wall.
type DeleteRequestHandler struct {
	repo *repository.DeleteRequestRepository
}

// NewDeleteRequestHandler creates a new DeleteRequestHandler
func NewDeleteRequestHandler(db *gorm.DB) *DeleteRequestHandler {
	return &DeleteRequestHandler{repo: repository.NewDeleteRequestRepository(db)}
}

// DeleteRequestPayload is what the console sends when recording or updating a delete.
type DeleteRequestPayload struct {
	Uid         string `json:"uid"`
	NsId        string `json:"ns_id"`
	InfraId     string `json:"infra_id"`
	ReqId       string `json:"req_id"`
	Option      string `json:"option"`
	Status      string `json:"status"`
	ErrorReason string `json:"error_reason"`
}

// UidPayload identifies a tracked delete by infra uid.
type UidPayload struct {
	Uid string `json:"uid"`
}

// ListDeleteRequests returns every tracked delete.
//
// The console calls this on start-up and after login so that any browser resumes watching
// whatever is still in flight, and shows failures that happened while nobody was looking.
func (h *DeleteRequestHandler) ListDeleteRequests(c echo.Context) error {
	reqs, err := h.repo.FindAll()
	if err != nil {
		log.Printf("Failed to list delete requests: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(reqs))
}

// SaveDeleteRequest records a delete, replacing any earlier attempt on the same infra.
//
// Keyed by uid rather than name: in cb-tumblebug an infra's id is its name, so deleting
// "infra101" and creating another "infra101" would otherwise inherit the old record.
func (h *DeleteRequestHandler) SaveDeleteRequest(c echo.Context) error {
	payload := new(DeleteRequestPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Uid == "" || payload.ReqId == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("uid and req_id are required"))
	}

	requestedBy, _ := c.Get(middleware.ContextKeyUserID).(string)
	status := payload.Status
	if status == "" {
		status = model.DeleteStatusHandling
	}

	req := &model.DeleteRequest{
		Uid:         payload.Uid,
		NsId:        payload.NsId,
		InfraId:     payload.InfraId,
		ReqId:       payload.ReqId,
		Option:      payload.Option,
		Status:      status,
		ErrorReason: payload.ErrorReason,
		RequestedBy: requestedBy,
	}
	if err := h.repo.Upsert(req); err != nil {
		log.Printf("Failed to save delete request: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(req))
}

// UpdateDeleteRequestStatus moves a tracked delete to failed or unknown.
//
// Success is not an update - it deletes the row (see RemoveDeleteRequest). There is nothing
// to show for a delete that worked: the infra is gone from the list.
func (h *DeleteRequestHandler) UpdateDeleteRequestStatus(c echo.Context) error {
	payload := new(DeleteRequestPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Uid == "" || payload.Status == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("uid and status are required"))
	}
	if err := h.repo.UpdateStatus(payload.Uid, payload.Status, payload.ErrorReason); err != nil {
		log.Printf("Failed to update delete request: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK("updated"))
}

// RemoveDeleteRequest drops a tracked delete.
//
// Called when the delete succeeded, when the user retries (the new attempt replaces it), or
// when the infra is no longer listed because it was removed some other way.
func (h *DeleteRequestHandler) RemoveDeleteRequest(c echo.Context) error {
	payload := new(UidPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Uid == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("uid is required"))
	}
	if err := h.repo.DeleteByUid(payload.Uid); err != nil {
		log.Printf("Failed to remove delete request: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK("removed"))
}
