module dbmigration

go 1.23.0

require (
	github.com/cloud-barista/cm-butterfly v0.0.0
	github.com/go-gormigrate/gormigrate/v2 v2.1.3
	gorm.io/driver/postgres v1.5.10
	gorm.io/gorm v1.25.12
)

require (
	github.com/gofrs/uuid v4.2.0+incompatible // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.7.1 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	golang.org/x/crypto v0.29.0 // indirect
	golang.org/x/sync v0.9.0 // indirect
	golang.org/x/text v0.20.0 // indirect
)

replace github.com/cloud-barista/cm-butterfly => ../

replace github.com/cloud-barista/cm-butterfly/variables => ../variables

replace github.com/cloud-barista/cm-butterfly/models => ../models
