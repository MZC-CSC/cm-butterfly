package handler

import (
	"log"
	"time"

	"api/internal/middleware"
	"api/internal/model"
	"api/internal/repository"
	"api/internal/util/response"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// TrackedJobHandler exposes the long jobs the console is still watching.
//
// Shared rather than per-user, like the tracked deletes: a load test or workflow run is
// something happening to a resource, and whoever opens the console next benefits from
// seeing it through. The resulting notification is the part that belongs to a person.
type TrackedJobHandler struct {
	repo *repository.TrackedJobRepository
}

// NewTrackedJobHandler creates a new TrackedJobHandler
func NewTrackedJobHandler(db *gorm.DB) *TrackedJobHandler {
	return &TrackedJobHandler{repo: repository.NewTrackedJobRepository(db)}
}

// TrackedJobPayload is what the console sends when a long job starts.
type TrackedJobPayload struct {
	Kind       string `json:"kind"`
	NaturalKey string `json:"natural_key"`
	Label      string `json:"label"`
	Action     string `json:"action"`
	StartedAt  string `json:"started_at"`
}

// ListTrackedJobs returns every job still being tracked.
func (h *TrackedJobHandler) ListTrackedJobs(c echo.Context) error {
	jobs, err := h.repo.FindAll()
	if err != nil {
		log.Printf("Failed to list tracked jobs: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(jobs))
}

// SaveTrackedJob records a job that just started, replacing an earlier one on the same target.
func (h *TrackedJobHandler) SaveTrackedJob(c echo.Context) error {
	payload := new(TrackedJobPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Kind == "" || payload.NaturalKey == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("kind and natural_key are required"))
	}

	startedAt := time.Now()
	if payload.StartedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, payload.StartedAt); err == nil {
			startedAt = parsed
		}
	}

	requestedBy, _ := c.Get(middleware.ContextKeyUserID).(string)
	job := &model.TrackedJob{
		Kind:        payload.Kind,
		NaturalKey:  payload.NaturalKey,
		Label:       payload.Label,
		Action:      payload.Action,
		StartedAt:   startedAt,
		RequestedBy: requestedBy,
	}
	if err := h.repo.Upsert(job); err != nil {
		log.Printf("Failed to save tracked job: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(job))
}

// RemoveTrackedJob drops a tracked job once it has ended and the user has been told.
func (h *TrackedJobHandler) RemoveTrackedJob(c echo.Context) error {
	payload := new(TrackedJobPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Kind == "" || payload.NaturalKey == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("kind and natural_key are required"))
	}
	if err := h.repo.Delete(payload.Kind, payload.NaturalKey); err != nil {
		log.Printf("Failed to remove tracked job: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK("removed"))
}
