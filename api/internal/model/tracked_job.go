package model

import (
	"time"

	"github.com/gofrs/uuid"
	"gorm.io/gorm"
)

// TrackedJob is a long job someone started that nobody is watching any more.
//
// The console tracks these so it can tell the user how they ended (see Notification).
// Tracking has to survive leaving the screen, a reload, and moving to another browser,
// which is why it lives here rather than in the tab that started the job.
//
// Why a row is needed at all: **neither load tests nor workflow runs hand back an id when
// you start them.** A load test returns nothing the console reads, and a workflow run has
// to be found afterwards by listing runs and taking the newest. So the only thing available
// at start time is a natural key - which node, or which workflow - and that is what gets
// stored. The checker uses it later to ask "what happened to the last one of these?".
//
// Deliberately generic. Infra deletes predate this and keep their own table (DeleteRequest)
// because that one carries delete-specific fields; everything since shares this one.
type TrackedJob struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	// Kind says which checker owns the row: "perf" or "workflow".
	Kind string `gorm:"column:kind;type:text;index" json:"kind"`

	// NaturalKey identifies the job by what we knew when it started - not by its own id,
	// which we do not get. Uniqueness is per kind: starting another load test on the same
	// node replaces the previous row, since the earlier attempt answers a question nobody
	// is asking any more.
	//
	// perf     : "{nsId}/{infraId}/{nodeId}"
	// workflow : "{wfId}/{runId}" (run id is resolved shortly after the run starts)
	NaturalKey string `gorm:"column:natural_key;type:text" json:"natural_key"`

	// Label is what the user should see - a VM name, a workflow name. Captured at start
	// because it cannot be recovered later: by the time the job ends there is only an id.
	Label string `gorm:"column:label;type:text" json:"label"`

	// Action distinguishes runs of the same thing: "run", "rerun", "rerun-failed".
	// Without it a finished workflow can only be described as "finished", which is not
	// what the user asked for.
	Action string `gorm:"column:action;type:text" json:"action"`

	// StartedAt is part of the notification's dedup key. Reruns reuse the same workflow run
	// id, so the id alone cannot tell two attempts apart.
	StartedAt time.Time `gorm:"column:started_at" json:"started_at"`

	RequestedBy string    `gorm:"column:requested_by;type:text" json:"requested_by"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// Tracked job kinds.
const (
	TrackedJobKindPerf     = "perf"
	TrackedJobKindWorkflow = "workflow"
)

// Tracked job actions.
const (
	TrackedJobActionRun         = "run"
	TrackedJobActionRerun       = "rerun"
	TrackedJobActionRerunFailed = "rerun-failed"
)

// TableName specifies the table name for GORM
func (TrackedJob) TableName() string {
	return "tracked_jobs"
}

// BeforeCreate is a GORM hook to generate UUID before creating a record
func (t *TrackedJob) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		newUUID, err := uuid.NewV4()
		if err != nil {
			return err
		}
		t.ID = newUUID
	}
	return nil
}
