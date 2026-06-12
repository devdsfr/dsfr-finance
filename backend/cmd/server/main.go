package main

import (
	"log"
	"path/filepath"
	"runtime"

	"github.com/dsfr/finance/internal/config"
	"github.com/dsfr/finance/internal/database"
	"github.com/dsfr/finance/internal/handlers"
	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	// Run migrations
	_, file, _, _ := runtime.Caller(0)
	migrationsPath := filepath.Join(filepath.Dir(file), "..", "..", "migrations")
	if err := database.RunMigrations(db, migrationsPath); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	// ── Repositories ─────────────────────────────────────────────────────────
	txRepo := repositories.NewTransactionRepository(db)
	reportRepo := repositories.NewReportRepository(db)
	spendingRepo := repositories.NewSpendingRepository(db)

	// ── Services ─────────────────────────────────────────────────────────────
	notifSvc := services.NewNotificationService(db)
	activitySvc := services.NewActivityService(db)
	authSvc := services.NewAuthService(db, cfg.JWTSecret)
	txSvc := services.NewTransactionService(txRepo, spendingRepo, notifSvc, activitySvc)

	// ── Handlers ─────────────────────────────────────────────────────────────
	authH := handlers.NewAuthHandler(authSvc)
	txH := handlers.NewTransactionHandler(txSvc, txRepo)
	reportH := handlers.NewReportHandler(reportRepo)
	spendingH := handlers.NewSpendingHandler(spendingRepo)
	notifH := handlers.NewNotificationHandler(notifSvc)
	activityH := handlers.NewActivityHandler(activitySvc)

	// ── Router ────────────────────────────────────────────────────────────────
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:4200", "https://app.dsfr-finance.com", "https://finance-frontend-3tf6.onrender.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	v1 := r.Group("/api/v1")

	// Public
	v1.POST("/auth/register", authH.Register)
	v1.POST("/auth/login", authH.Login)

	// Protected
	auth := v1.Group("/", middleware.Auth(cfg.JWTSecret))
	{
		// Auth / MFA — AC-MC-10
		auth.POST("/auth/mfa/enable", authH.EnableMFA)
		auth.POST("/auth/mfa/confirm", authH.ConfirmMFA)
		auth.DELETE("/auth/mfa", authH.DisableMFA)

		// Transactions — AC-UX-01..07, AC-TG-04, AC-TG-05
		auth.GET("/transactions", txH.List)
		auth.POST("/transactions", txH.Create)
		auth.GET("/transactions/:id", txH.Get)
		auth.PUT("/transactions/:id", txH.Update)
		auth.DELETE("/transactions/:id", txH.Delete)
		auth.PATCH("/transactions/:id/pay", txH.MarkPaid)
		auth.POST("/transactions/:id/duplicate", txH.Duplicate)
		auth.POST("/transactions/mark-all-paid", txH.MarkAllPaid)
		auth.POST("/transactions/ignore-all", txH.IgnoreAll)
		auth.GET("/transactions/tag-suggestions", txH.SuggestTags)

		// Reports — AC-RL-18..22, AC-FC-08, AC-FC-09
		auth.GET("/reports/flow", reportH.MonthlyFlow)
		auth.GET("/reports/patrimony", reportH.PatrimonyEvolution)
		auth.GET("/reports/accounts", reportH.AccountBalanceHistory)
		auth.GET("/reports/categories", reportH.CategorySummary)
		auth.GET("/reports/tags-cta", reportH.TagsCTA)
		auth.GET("/reports/installments", reportH.ActiveInstallments)
		auth.GET("/reports/cards/:card_id/invoices", reportH.CardInvoiceHistory)
		auth.GET("/reports/export/csv", reportH.ExportCSV)
		auth.GET("/reports/export/excel", reportH.ExportExcel)

		// Spending limits — AC-LG-07..11
		auth.GET("/spending-limits", spendingH.List)
		auth.POST("/spending-limits", spendingH.Create)
		auth.PUT("/spending-limits/:id", spendingH.Update)
		auth.DELETE("/spending-limits/:id", spendingH.Delete)

		// Notifications & alerts — AC-AL-05, AC-AL-06
		auth.GET("/notifications", notifH.List)
		auth.PATCH("/notifications/:id/read", notifH.MarkRead)
		auth.POST("/notifications/read-all", notifH.MarkAllRead)
		auth.GET("/alert-configs", notifH.GetAlertConfigs)
		auth.PUT("/alert-configs", notifH.UpsertAlertConfig)

		// Activity log — AC-AT-05
		auth.GET("/activity", activityH.List)
	}

	r.GET("/api/v1/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	log.Printf("server listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
