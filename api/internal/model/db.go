package model

import (
	"log"
	"sync"

	"api/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	db   *gorm.DB
	once sync.Once
)

// InitDB initializes the database connection
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	var err error
	once.Do(func() {
		dsn := cfg.GetDSN()
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err != nil {
			log.Printf("Failed to connect to database: %v", err)
			return
		}

		// Auto-migrate the schema
		if err = db.AutoMigrate(&Usersess{}, &DeleteRequest{}, &Notification{}); err != nil {
			log.Printf("Failed to auto-migrate: %v", err)
			return
		}

		log.Println("Database connection established successfully")
	})

	return db, err
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return db
}

// CloseDB closes the database connection
func CloseDB() error {
	if db != nil {
		sqlDB, err := db.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}
