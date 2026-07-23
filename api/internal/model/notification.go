package model

import (
	"time"

	"github.com/gofrs/uuid"
	"gorm.io/gorm"
)

// Notification is one thing the console wants to tell a user about after the fact.
//
// Long jobs - deleting an infra, running a load test, running a workflow - finish while the
// user is somewhere else, and today the outcome is only visible on the screen that started
// them. This table is what the badge reads.
//
// Deliberately dumb: it does not know what kind of job produced it or how that job was
// watched. Whoever tracks a job decides when it is over and posts one of these. That way a
// new kind of job needs a tracker, not a change here.
type Notification struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	// UserID is who this is for.
	//
	// The product runs on a single admin account today, so in practice everything lands on
	// one user. The column exists anyway because the expensive part of splitting later is
	// not the code - it is deciding who already-stored rows belonged to. With the column
	// there is nothing to decide.
	UserID string `gorm:"column:user_id;type:text;index" json:"user_id"`

	// Category is the area the message came from: Workload, Workflow, Perf.
	Category string `gorm:"column:category;type:text" json:"category"`

	// Level is Info or Error. The badge counts everything but colours itself by whether any
	// Error is waiting, so "there is something to look at" and "something went wrong" stay
	// distinguishable without splitting the badge in two.
	Level string `gorm:"column:level;type:text" json:"level"`

	// Message is the one line shown in the list. Detail is the rest, shown when the row is
	// expanded - typically the failure reason.
	Message string `gorm:"column:message;type:text" json:"message"`
	Detail  string `gorm:"column:detail;type:text" json:"detail"`

	// DedupKey stops the same completion being posted twice.
	//
	// Trackers run in the browser, so two open tabs both notice the same job finishing. The
	// key is the job's own identity (a delete request id, a load test id, a workflow run id),
	// which makes the second post a no-op rather than a duplicate row.
	DedupKey string `gorm:"column:dedup_key;type:text;uniqueIndex" json:"dedup_key"`

	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
}

// Notification categories.
const (
	NotificationCategoryWorkload = "Workload"
	NotificationCategoryWorkflow = "Workflow"
	NotificationCategoryPerf     = "Perf"
)

// Notification levels.
const (
	NotificationLevelInfo  = "Info"
	NotificationLevelError = "Error"
)

// How long an unread notification is kept.
//
// Reading one deletes it, so these only bound the ones nobody ever looked at. Informational
// messages age out sooner because "a workflow ran" stops being worth reading long before a
// failure does: the failure may have been someone else's, or something the user forgot.
const (
	NotificationTTLInfo  = 14 * 24 * time.Hour
	NotificationTTLError = 30 * 24 * time.Hour
)

// TableName specifies the table name for GORM
func (Notification) TableName() string {
	return "notifications"
}

// BeforeCreate is a GORM hook to generate UUID before creating a record
func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		newUUID, err := uuid.NewV4()
		if err != nil {
			return err
		}
		n.ID = newUUID
	}
	return nil
}
