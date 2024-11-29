package models

import (
	"log"
	"os"
	"time"

	v "github.com/cloud-barista/cm-butterfly/variables"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func init() {
	dblogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold:             time.Second,   // Slow SQL threshold
			LogLevel:                  logger.Silent, // Log level
			IgnoreRecordNotFoundError: true,          // Ignore ErrRecordNotFound error for logger
			ParameterizedQueries:      true,          // Don't include params in the SQL log
			Colorful:                  false,         // Disable color
		},
	)

	var err error
	DB, err = gorm.Open(postgres.Open(v.DATABASE_URL), &gorm.Config{
		Logger: dblogger,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
}
