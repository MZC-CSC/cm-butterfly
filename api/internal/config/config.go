package config

import (
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	Paths    PathsConfig
}

type ServerConfig struct {
	Addr string
	Port string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type AuthConfig struct {
	EncryptionKey string
}

type PathsConfig struct {
	UserAuthDataPath string
	UserAuthConfPath string
	MenuConfDataPath string
	APISpecPath      string
}

var (
	cfg  *Config
	once sync.Once
)

func Load() *Config {
	once.Do(func() {
		cfg = &Config{}

		// Server config
		cfg.Server.Addr = getEnv("API_ADDR", "0.0.0.0")
		cfg.Server.Port = getEnv("API_PORT", "4000")

		// Database config
		cfg.Database.Host = getEnv("POSTGRES_DATABASE_HOST", "localhost")
		cfg.Database.Port = getEnv("POSTGRES_PORT", "5432")
		cfg.Database.User = getEnv("POSTGRES_USER", "postgres")
		cfg.Database.Password = getEnv("POSTGRES_PASSWORD", "postgres")
		cfg.Database.DBName = getEnv("POSTGRES_DB", "butterfly-db")
		cfg.Database.SSLMode = getEnv("POSTGRES_SSLMODE", "disable")

		// Paths config
		cfg.Paths.UserAuthDataPath = getEnv("USER_AUTH_DATA_PATH", "conf/user.dat")
		cfg.Paths.UserAuthConfPath = getEnv("USER_AUTH_CONF_PATH", "conf/authsetting.yaml")
		cfg.Paths.MenuConfDataPath = getEnv("MENU_CONF_DATA_PATH", "conf/menu.yaml")
		cfg.Paths.APISpecPath = getEnv("API_SPEC_PATH", "conf/api.yaml")

		// Load auth settings from yaml
		loadAuthSettings(cfg)
	})

	return cfg
}

func loadAuthSettings(cfg *Config) {
	v := viper.New()
	v.SetConfigFile(cfg.Paths.UserAuthConfPath)
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		log.Printf("Warning: Could not read auth config file: %v", err)
		cfg.Auth.EncryptionKey = "default-secret-key"
		return
	}

	cfg.Auth.EncryptionKey = v.GetString("setting.encryptionkey")
	if cfg.Auth.EncryptionKey == "" {
		cfg.Auth.EncryptionKey = "default-secret-key"
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.DBName,
		c.Database.SSLMode,
	)
}

func (c *Config) GetServerAddr() string {
	return fmt.Sprintf("%s:%s", c.Server.Addr, c.Server.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func Get() *Config {
	if cfg == nil {
		return Load()
	}
	return cfg
}
