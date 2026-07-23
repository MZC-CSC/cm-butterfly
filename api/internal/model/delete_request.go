package model

import (
	"time"

	"github.com/gofrs/uuid"
	"gorm.io/gorm"
)

// DeleteRequest tracks an in-flight or failed infra delete so the console can pick it up
// again from any browser.
//
// Why this lives in the database rather than the browser: a delete takes minutes and can
// fail. The request id is the only handle for asking cm-beetle what happened, and keeping
// it in local storage means a different browser - or the same user after logging out -
// has no way to learn that a delete failed, or why.
//
// Keyed by Uid, not by the infra name. In cb-tumblebug an infra's id *is* its name, so
// deleting "infra101" and creating another "infra101" would make the old record look like
// it belongs to the new infra. The uid stays unique across that.
type DeleteRequest struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	// Uid is cb-tumblebug's stable identifier for the infra - the key we match list rows on.
	Uid string `gorm:"column:uid;type:text;uniqueIndex" json:"uid"`

	// NsId and InfraId are what the APIs actually take. InfraId is the infra *name*, kept
	// for calling cm-beetle and for showing the user which infra this was.
	NsId    string `gorm:"column:ns_id;type:text" json:"ns_id"`
	InfraId string `gorm:"column:infra_id;type:text" json:"infra_id"`

	// ReqId is the X-Request-Id sent with the delete. Only the latest one is kept - asking
	// about an earlier attempt tells us nothing once the user has retried.
	ReqId string `gorm:"column:req_id;type:text" json:"req_id"`

	// Option records whether this was a normal or forced delete, so the UI can say which
	// one left CSP resources behind.
	Option string `gorm:"column:option;type:text" json:"option"`

	// Status is Handling, Error, or Unknown. Success is never stored - a successful delete
	// removes the row, since the infra is gone from the list and there is nothing to show.
	// Unknown means cm-beetle no longer knows the request id (it does not survive a restart)
	// and the infra is still listed, so we cannot tell how it ended.
	Status string `gorm:"column:status;type:text" json:"status"`

	// ErrorReason is what cm-beetle reported. This is the part users cannot get anywhere
	// else once the request record is gone.
	ErrorReason string `gorm:"column:error_reason;type:text" json:"error_reason"`

	RequestedBy string    `gorm:"column:requested_by;type:text" json:"requested_by"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// Delete request status values.
const (
	DeleteStatusHandling = "Handling"
	DeleteStatusError    = "Error"
	DeleteStatusUnknown  = "Unknown"
)

// TableName specifies the table name for GORM
func (DeleteRequest) TableName() string {
	return "delete_requests"
}

// BeforeCreate is a GORM hook to generate UUID before creating a record
func (d *DeleteRequest) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		newUUID, err := uuid.NewV4()
		if err != nil {
			return err
		}
		d.ID = newUUID
	}
	return nil
}
