package repository

import (
	"api/internal/model"

	"gorm.io/gorm"
)

// UsersessRepository handles database operations for Usersess
type UsersessRepository struct {
	db *gorm.DB
}

// NewUsersessRepository creates a new UsersessRepository
func NewUsersessRepository(db *gorm.DB) *UsersessRepository {
	return &UsersessRepository{db: db}
}

// Create creates a new user session
func (r *UsersessRepository) Create(sess *model.Usersess) error {
	return r.db.Create(sess).Error
}

// FindByUserID finds a user session by user ID
func (r *UsersessRepository) FindByUserID(userID string) (*model.Usersess, error) {
	var sess model.Usersess
	err := r.db.Where("user_id = ?", userID).First(&sess).Error
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// ExistsByUserID checks if a user session exists by user ID
func (r *UsersessRepository) ExistsByUserID(userID string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Usersess{}).Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// Update updates a user session
func (r *UsersessRepository) Update(sess *model.Usersess) error {
	return r.db.Save(sess).Error
}

// Delete deletes a user session
func (r *UsersessRepository) Delete(sess *model.Usersess) error {
	return r.db.Delete(sess).Error
}

// CreateOrUpdate creates a new session or updates existing one
func (r *UsersessRepository) CreateOrUpdate(sess *model.Usersess) (*model.Usersess, error) {
	exists, err := r.ExistsByUserID(sess.UserID)
	if err != nil {
		return nil, err
	}

	if exists {
		existingSess, err := r.FindByUserID(sess.UserID)
		if err != nil {
			return nil, err
		}
		sess.ID = existingSess.ID
		sess.CreatedAt = existingSess.CreatedAt
		if err := r.Update(sess); err != nil {
			return nil, err
		}
		return sess, nil
	}

	if err := r.Create(sess); err != nil {
		return nil, err
	}
	return sess, nil
}

// DeleteByUserIDAndGetRefreshToken deletes session by user ID and returns refresh token
func (r *UsersessRepository) DeleteByUserIDAndGetRefreshToken(userID string) (string, error) {
	sess, err := r.FindByUserID(userID)
	if err != nil {
		return "", err
	}
	refreshToken := sess.RefreshToken
	if err := r.Delete(sess); err != nil {
		return "", err
	}
	return refreshToken, nil
}
