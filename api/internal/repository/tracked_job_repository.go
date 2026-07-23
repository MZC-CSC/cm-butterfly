package repository

import (
	"api/internal/model"

	"gorm.io/gorm"
)

// TrackedJobRepository handles database operations for TrackedJob
type TrackedJobRepository struct {
	db *gorm.DB
}

// NewTrackedJobRepository creates a new TrackedJobRepository
func NewTrackedJobRepository(db *gorm.DB) *TrackedJobRepository {
	return &TrackedJobRepository{db: db}
}

// FindAll returns every job still being tracked, newest first.
//
// The console asks for this after logging in so that whichever browser is open picks up
// jobs started somewhere else. Rows are removed once a job ends, so this stays small.
func (r *TrackedJobRepository) FindAll() ([]model.TrackedJob, error) {
	var jobs []model.TrackedJob
	err := r.db.Order("started_at desc").Find(&jobs).Error
	return jobs, err
}

// Upsert stores a tracked job, replacing an earlier one with the same kind and natural key.
//
// Starting another load test on the same node - or another run of the same workflow -
// makes the previous attempt irrelevant. Keeping one row per target also stops the table
// growing with attempts nobody will ask about.
func (r *TrackedJobRepository) Upsert(job *model.TrackedJob) error {
	var existing model.TrackedJob
	err := r.db.Where("kind = ? AND natural_key = ?", job.Kind, job.NaturalKey).First(&existing).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return r.db.Create(job).Error
		}
		return err
	}

	existing.Label = job.Label
	existing.Action = job.Action
	existing.StartedAt = job.StartedAt
	if job.RequestedBy != "" {
		existing.RequestedBy = job.RequestedBy
	}
	return r.db.Save(&existing).Error
}

// Delete removes a tracked job once it has ended and been reported.
func (r *TrackedJobRepository) Delete(kind, naturalKey string) error {
	return r.db.Where("kind = ? AND natural_key = ?", kind, naturalKey).
		Delete(&model.TrackedJob{}).Error
}
