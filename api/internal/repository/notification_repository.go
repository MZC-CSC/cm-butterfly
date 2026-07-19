package repository

import (
	"time"

	"api/internal/model"

	"gorm.io/gorm"
)

// NotificationRepository handles database operations for Notification
type NotificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository creates a new NotificationRepository
func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// FindByUser returns a user's unread notifications, newest first.
//
// Expired rows are dropped on the way past. There is no scheduler: deleting a message that
// nobody is looking at, at the exact moment it expires, buys nothing. Clearing them here
// means the user never sees an expired one, which is the part that matters.
func (r *NotificationRepository) FindByUser(userID string) ([]model.Notification, error) {
	if err := r.deleteExpired(); err != nil {
		return nil, err
	}

	var notis []model.Notification
	err := r.db.Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&notis).Error
	return notis, err
}

// deleteExpired removes notifications past their retention window.
func (r *NotificationRepository) deleteExpired() error {
	now := time.Now()
	return r.db.Where("level = ? AND created_at < ?", model.NotificationLevelError, now.Add(-model.NotificationTTLError)).
		Or("level <> ? AND created_at < ?", model.NotificationLevelError, now.Add(-model.NotificationTTLInfo)).
		Delete(&model.Notification{}).Error
}

// Create stores a notification, ignoring one that has already been posted.
//
// Trackers run in the browser, so two open tabs both see the same job finish and both post.
// The dedup key is the job's own id, so the second call finds the row already there and
// leaves it alone rather than adding a duplicate the user has to dismiss twice.
func (r *NotificationRepository) Create(noti *model.Notification) (*model.Notification, error) {
	if noti.DedupKey != "" {
		var existing model.Notification
		err := r.db.Where("dedup_key = ?", noti.DedupKey).First(&existing).Error
		if err == nil {
			return &existing, nil
		}
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}

	if err := r.db.Create(noti).Error; err != nil {
		return nil, err
	}
	return noti, nil
}

// DeleteByID removes one notification once the user has confirmed it.
//
// Reading deletes rather than flags: the message only ever pointed at something, and that
// something is still on its own screen. Keeping read messages would grow a list nobody asked
// for and force a second decision about when *those* expire.
func (r *NotificationRepository) DeleteByID(userID, id string) error {
	return r.db.Where("user_id = ? AND id = ?", userID, id).
		Delete(&model.Notification{}).Error
}

// DeleteAllByUser clears a user's notifications.
func (r *NotificationRepository) DeleteAllByUser(userID string) error {
	return r.db.Where("user_id = ?", userID).Delete(&model.Notification{}).Error
}
