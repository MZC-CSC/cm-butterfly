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

// NotificationHandler exposes the badge notifications.
//
// Per user, unlike the tracked deletes next door. A delete is something that happened to an
// infra and everyone benefits from seeing it; a notification is addressed to a person. With
// one account today the two look the same in practice, but the ownership is recorded so that
// adding accounts later is a policy decision rather than a data problem.
type NotificationHandler struct {
	repo *repository.NotificationRepository
}

// NewNotificationHandler creates a new NotificationHandler
func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{repo: repository.NewNotificationRepository(db)}
}

// NotificationPayload is what a tracker posts when a job it was watching ends.
type NotificationPayload struct {
	Category string `json:"category"`
	Level    string `json:"level"`
	Message  string `json:"message"`
	Detail   string `json:"detail"`
	DedupKey string `json:"dedup_key"`
}

// NotificationIDPayload identifies one notification.
type NotificationIDPayload struct {
	ID string `json:"id"`
}

// ListNotifications returns the caller's unread notifications.
func (h *NotificationHandler) ListNotifications(c echo.Context) error {
	userID, _ := c.Get(middleware.ContextKeyUserID).(string)

	notis, err := h.repo.FindByUser(userID)
	if err != nil {
		log.Printf("Failed to list notifications: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(notis))
}

// AddNotification stores one message for the caller.
//
// This is the whole interface a tracker needs. It says what happened and how bad it is; it
// does not say how it found out, and nothing here cares. A new kind of long job becomes a
// tracker that calls this, not a change to the badge.
func (h *NotificationHandler) AddNotification(c echo.Context) error {
	payload := new(NotificationPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.Message == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("message is required"))
	}

	level := payload.Level
	if level != model.NotificationLevelError {
		level = model.NotificationLevelInfo
	}

	userID, _ := c.Get(middleware.ContextKeyUserID).(string)
	noti := &model.Notification{
		UserID:   userID,
		Category: payload.Category,
		Level:    level,
		Message:  payload.Message,
		Detail:   payload.Detail,
		DedupKey: payload.DedupKey,
	}

	saved, err := h.repo.Create(noti)
	if err != nil {
		log.Printf("Failed to add notification: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK(saved))
}

// ReadNotification drops one notification the user has confirmed.
func (h *NotificationHandler) ReadNotification(c echo.Context) error {
	payload := new(NotificationIDPayload)
	if err := c.Bind(payload); err != nil {
		return c.JSON(400, response.CommonResponseStatusBadRequest(err.Error()))
	}
	if payload.ID == "" {
		return c.JSON(400, response.CommonResponseStatusBadRequest("id is required"))
	}

	userID, _ := c.Get(middleware.ContextKeyUserID).(string)
	if err := h.repo.DeleteByID(userID, payload.ID); err != nil {
		log.Printf("Failed to read notification: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK("read"))
}

// ReadAllNotifications clears the caller's notifications.
func (h *NotificationHandler) ReadAllNotifications(c echo.Context) error {
	userID, _ := c.Get(middleware.ContextKeyUserID).(string)
	if err := h.repo.DeleteAllByUser(userID); err != nil {
		log.Printf("Failed to read all notifications: %v", err)
		return c.JSON(500, response.CommonResponseStatusInternalServerError(err.Error()))
	}
	return c.JSON(200, response.CommonResponseStatusOK("read"))
}
