package models

type Usersess struct {
	UserID           string  `json:"user_id" gorm:"column:user_id;type:varchar(255);not null"`
	AccessToken      string  `json:"access_token" gorm:"column:access_token;type:text;not null"`
	ExpiresIn        float64 `json:"expires_in" gorm:"column:expires_in;not null"`
	RefreshToken     string  `json:"refresh_token" gorm:"column:refresh_token;type:text;not null"`
	RefreshExpiresIn float64 `json:"refresh_expires_in" gorm:"column:refresh_expires_in;not null"`
}
