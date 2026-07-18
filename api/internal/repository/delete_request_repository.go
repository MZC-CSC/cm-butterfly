package repository

import (
	"api/internal/model"

	"gorm.io/gorm"
)

// DeleteRequestRepository handles database operations for DeleteRequest
type DeleteRequestRepository struct {
	db *gorm.DB
}

// NewDeleteRequestRepository creates a new DeleteRequestRepository
func NewDeleteRequestRepository(db *gorm.DB) *DeleteRequestRepository {
	return &DeleteRequestRepository{db: db}
}

// FindAll returns every tracked delete request.
//
// The console asks for this on start-up and after logging in, so whichever browser is open
// picks up whatever was left unfinished. Only in-flight and failed deletes are ever stored,
// so this stays small.
func (r *DeleteRequestRepository) FindAll() ([]model.DeleteRequest, error) {
	var reqs []model.DeleteRequest
	err := r.db.Order("created_at desc").Find(&reqs).Error
	return reqs, err
}

// FindByUid finds a tracked delete request by infra uid
func (r *DeleteRequestRepository) FindByUid(uid string) (*model.DeleteRequest, error) {
	var req model.DeleteRequest
	if err := r.db.Where("uid = ?", uid).First(&req).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

// Upsert stores a delete request, replacing any earlier one for the same infra.
//
// Re-deleting an infra makes the previous attempt irrelevant: its request id answers a
// question nobody is asking any more. Keeping one row per infra also means the list only
// ever has one state to show per row.
func (r *DeleteRequestRepository) Upsert(req *model.DeleteRequest) error {
	existing, err := r.FindByUid(req.Uid)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return r.db.Create(req).Error
		}
		return err
	}

	existing.NsId = req.NsId
	existing.InfraId = req.InfraId
	existing.ReqId = req.ReqId
	existing.Option = req.Option
	existing.Status = req.Status
	existing.ErrorReason = req.ErrorReason
	if req.RequestedBy != "" {
		existing.RequestedBy = req.RequestedBy
	}
	return r.db.Save(existing).Error
}

// UpdateStatus updates the status (and failure reason) of a tracked delete request
func (r *DeleteRequestRepository) UpdateStatus(uid, status, errorReason string) error {
	return r.db.Model(&model.DeleteRequest{}).
		Where("uid = ?", uid).
		Updates(map[string]any{
			"status":       status,
			"error_reason": errorReason,
		}).Error
}

// DeleteByUid removes a tracked delete request.
//
// Called when the delete succeeded, or when the infra is no longer listed at all - someone
// removed it another way, so there is nothing left to report.
func (r *DeleteRequestRepository) DeleteByUid(uid string) error {
	return r.db.Where("uid = ?", uid).Delete(&model.DeleteRequest{}).Error
}
