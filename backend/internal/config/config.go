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
	APIURL           string
	GoogleClientID     string
	GoogleClientSecret string
	FacebookClientID     string
	FacebookClientSecret string
	SpendingAlertPct float64
	AppEnv           string
	CORSOrigins      string
	EncryptionKey    string
	// WhatsApp Cloud API
	WhatsAppVerifyToken string
	WhatsAppAppSecret   string
	WhatsAppToken       string
	WhatsAppPhoneID     string
	// Agente financeiro (IA)
	AIAPIKey          string
	AIModel           string
	AIMonthlyCallCap  int
}

func Load() *Config {
	_ = godotenv.Load()

	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))
	alertPct, _ := strconv.ParseFloat(getEnv("SPENDING_ALERT_PCT", "80"), 64)
	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	aiCap, _ := strconv.Atoi(getEnv("AI_MONTHLY_CALL_LIMIT", "1000"))

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
		APIURL:           getEnv("API_URL", "http://localhost:8080"),
		GoogleClientID:       getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:   getEnv("GOOGLE_CLIENT_SECRET", ""),
		FacebookClientID:     getEnv("FACEBOOK_CLIENT_ID", ""),
		FacebookClientSecret: getEnv("FACEBOOK_CLIENT_SECRET", ""),
		SpendingAlertPct: alertPct,
		AppEnv:           getEnv("APP_ENV", "development"),
		CORSOrigins:      getEnv("CORS_ORIGINS", "http://localhost:4200"),
		EncryptionKey:    getEnv("ENCRYPTION_KEY", jwtSecret),

		WhatsAppVerifyToken: getEnv("WHATSAPP_VERIFY_TOKEN", ""),
		WhatsAppAppSecret:   getEnv("WHATSAPP_APP_SECRET", ""),
		WhatsAppToken:       getEnv("WHATSAPP_TOKEN", ""),
		WhatsAppPhoneID:     getEnv("WHATSAPP_PHONE_ID", ""),

		AIAPIKey:         getEnv("AI_API_KEY", ""),
		AIModel:          getEnv("AI_MODEL", "claude-haiku-4-5-20251001"),
		AIMonthlyCallCap: aiCap,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
