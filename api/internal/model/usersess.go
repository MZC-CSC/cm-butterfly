package model

import (
	"time"

	"github.com/gofrs/uuid"
	"gorm.io/gorm"
)

// Usersess represents the user session in the database
type Usersess struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID           string    `gorm:"column:user_id;type:text;uniqueIndex" json:"user_id"`
	AccessToken      string    `gorm:"column:access_token;type:text" json:"access_token"`
	ExpiresIn        float64   `gorm:"column:expires_in;type:decimal" json:"expires_in"`
	RefreshToken     string    `gorm:"column:refresh_token;type:text" json:"refresh_token"`
	RefreshExpiresIn float64   `gorm:"column:refresh_expires_in;type:decimal" json:"refresh_expires_in"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// TableName specifies the table name for GORM
func (Usersess) TableName() string {
	return "usersesses"
}

// BeforeCreate is a GORM hook to generate UUID before creating a record
func (u *Usersess) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		newUUID, err := uuid.NewV4()
		if err != nil {
			return err
		}
		u.ID = newUUID
	}
	return nil
}
