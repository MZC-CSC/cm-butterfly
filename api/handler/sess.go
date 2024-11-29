package handler

import (
	"log"

	"github.com/cloud-barista/cm-butterfly/common"
	"github.com/cloud-barista/cm-butterfly/models"

	"gorm.io/gorm"
)

func CreateUserSessFromResponseData(tx *gorm.DB, r *common.CommonResponse, userId string) (*models.Usersess, error) {
	t := r.ResponseData.(map[string]interface{})
	var s models.Usersess
	s.UserID = userId
	if accessToken, ok := t["access_token"]; ok {
		s.AccessToken = accessToken.(string)
	}
	if expiresIn, ok := t["expires_in"]; ok {
		s.ExpiresIn = expiresIn.(float64)
	}
	if refreshToken, ok := t["refresh_token"]; ok {
		s.RefreshToken = refreshToken.(string)
	}
	if refreshExpiresIn, ok := t["refresh_expires_in"]; ok {
		s.RefreshExpiresIn = refreshExpiresIn.(float64)
	}
	sess, err := CreateUserSess(tx, &s)
	if err != nil {
		log.Println(err)
		return nil, err
	}
	return sess, nil
}

func CreateUserSess(tx *gorm.DB, s *models.Usersess) (*models.Usersess, error) {
	userExist, err := IsUserSessExistByUserId(tx, s.UserID)
	if err != nil {
		log.Println(err)
		return nil, err
	}
	if userExist {
		existingSess, err := GetUserByUserId(tx, s.UserID)
		if err != nil {
			log.Println(err)
			return nil, err
		}
		s.UserID = existingSess.UserID

		update, err := UpdateUserSess(tx, s)
		if err != nil {
			log.Println(err)
			return nil, err
		}
		return update, nil
	} else {
		if err := tx.Create(s).Error; err != nil {
			log.Println(err)
			return nil, err
		}
		return s, nil
	}
}

func IsUserSessExistByUserId(tx *gorm.DB, userId string) (bool, error) {
	var cnt int64
	if err := tx.Model(&models.Usersess{}).Where("user_id = ?", userId).Count(&cnt).Error; err != nil {
		log.Println(err)
		return false, err
	}
	return cnt > 0, nil
}

func GetUserByUserId(tx *gorm.DB, userId string) (*models.Usersess, error) {
	var s models.Usersess
	if err := tx.Where("user_id = ?", userId).First(&s).Error; err != nil {
		log.Println(err)
		return nil, err
	}
	return &s, nil
}

func UpdateUserSessFromResponseData(tx *gorm.DB, r *common.CommonResponse, userId string) (*models.Usersess, error) {
	t := r.ResponseData.(map[string]interface{})

	s, err := GetUserByUserId(tx, userId)
	if err != nil {
		log.Println(err)
		return nil, err
	}

	if accessToken, ok := t["access_token"]; ok {
		s.AccessToken = accessToken.(string)
	}
	if expiresIn, ok := t["expires_in"]; ok {
		s.ExpiresIn = expiresIn.(float64)
	}
	if refreshToken, ok := t["refresh_token"]; ok {
		s.RefreshToken = refreshToken.(string)
	}
	if refreshExpiresIn, ok := t["refresh_expires_in"]; ok {
		s.RefreshExpiresIn = refreshExpiresIn.(float64)
	}

	if err := tx.Save(s).Error; err != nil {
		log.Println(err)
		return nil, err
	}

	return s, nil
}

func UpdateUserSess(tx *gorm.DB, s *models.Usersess) (*models.Usersess, error) {
	if err := tx.Model(&models.Usersess{}).
		Where("user_id = ?", s.UserID).
		Updates(s).Error; err != nil {
		log.Printf("Failed to update user session: %v", err)
		return nil, err
	}
	return s, nil
}

func DestroyUserSessByAccessTokenForLogout(tx *gorm.DB, accessToken string) (string, error) {
	s, err := GetUserByAccessToken(tx, accessToken)
	if err != nil {
		log.Println(err)
		return "", err
	}
	if err := DestroyUserSess(tx, s); err != nil {
		log.Println(err)
		return "", err
	}
	return "", nil
}

func GetUserByAccessToken(tx *gorm.DB, accessToken string) (*models.Usersess, error) {
	var s models.Usersess
	if err := tx.Where("access_token = ?", accessToken).First(&s).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Printf("User session not found for access_token: %s", accessToken)
			return nil, err
		}
		log.Printf("Failed to retrieve user session: %v", err)
		return nil, err
	}
	return &s, nil
}

func DestroyUserSess(tx *gorm.DB, s *models.Usersess) error {
	if err := tx.Where("user_id = ?", s.UserID).Delete(&models.Usersess{}).Error; err != nil {
		log.Printf("Failed to delete user session: %v", err)
		return err
	}
	return nil
}
