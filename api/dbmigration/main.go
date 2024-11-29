package main

import (
	"log"
	"syscall"
	"time"

	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	m "github.com/cloud-barista/cm-butterfly/models"
	v "github.com/cloud-barista/cm-butterfly/variables"
)

func main() {
	db, err := gorm.Open(postgres.Open(v.DATABASE_URL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Printf("Database connection failed: %v", err)
		syscall.Exit(1)
	}

	dbmigrationID := time.Now().Format("20060102150405")

	mig := gormigrate.New(db, gormigrate.DefaultOptions, []*gormigrate.Migration{
		{
			ID: dbmigrationID,
			Migrate: func(tx *gorm.DB) error {
				return tx.AutoMigrate(&m.Usersess{}) // 이 곳에 마이그레이션 할 모델을 추가합니다.
			},
			Rollback: func(tx *gorm.DB) error {
				return tx.Migrator().DropTable("usersess") // 이 곳에 마이그레이션 할 모델을 추가합니다. (struct name lowercase)
			},
		},
	})

	if err = mig.Migrate(); err != nil {
		log.Printf("Migration failed: %v", err)
		syscall.Exit(1)
	}

	log.Println("Migration did run successfully")
}
