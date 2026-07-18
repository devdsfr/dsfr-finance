package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	StorageEndpoint  string
	StorageBucket    string
	StorageAccessKey string
	StorageSecretKey string
	SMTPHost         string
	SMTPPort         int
	SMTPUser         string
	SMTPPassword     string
	SMTPFrom         string
	ResendAPIKey     string
	EmailFrom        string
	AppURL           string
	SpendingAlertPct float64
	AppEnv           string
	CORSOrigins      string
	EncryptionKey    string
}

func Load() *Config {
	_ = godotenv.Load()

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	alertPct, _ := strconv.ParseFloat(getEnv("SPENDING_ALERT_PCT", "80"), 64)
	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")

	return &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/finance?sslmode=disable"),
		JWTSecret:        jwtSecret,
		StorageEndpoint:  getEnv("STORAGE_ENDPOINT", "localhost:9000"),
		StorageBucket:    getEnv("STORAGE_BUCKET", "finance"),
		StorageAccessKey: getEnv("STORAGE_ACCESS_KEY", "minioadmin"),
		StorageSecretKey: getEnv("STORAGE_SECRET_KEY", "minioadmin"),
		SMTPHost:         getEnv("SMTP_HOST", "localhost"),
		SMTPPort:         smtpPort,
		SMTPUser:         getEnv("SMTP_USER", ""),
		SMTPPassword:     getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:         getEnv("SMTP_FROM", "no-reply@finance.local"),
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		EmailFrom:        getEnv("EMAIL_FROM", "DSFR Finance <onboarding@resend.dev>"),
		AppURL:           getEnv("APP_URL", "http://localhost:4200"),
		SpendingAlertPct: alertPct,
		AppEnv:           getEnv("APP_ENV", "development"),
		CORSOrigins:      getEnv("CORS_ORIGINS", "http://localhost:4200"),
		EncryptionKey:    getEnv("ENCRYPTION_KEY", jwtSecret),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
