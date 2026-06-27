package main

import (
	"log"
	"path/filepath"
	"runtime"

	_ "github.com/dsfr/finance/docs"
	"github.com/dsfr/finance/internal/config"
	"github.com/dsfr/finance/internal/database"
	"github.com/dsfr/finance/internal/handlers"
	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title DSFR Finance API
// @version 1.0
// @description API de gestão financeira pessoal
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.email admin@dsfr.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Digite "Bearer" seguido do token JWT

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
	aiUsageSvc, err := services.NewAIUsageService(cfg.EncryptionKey)
	if err != nil {
		log.Fatalf("failed to init ai usage service: %v", err)
	}

	// ── Handlers ─────────────────────────────────────────────────────────────
	authH := handlers.NewAuthHandler(authSvc)
	txH := handlers.NewTransactionHandler(txSvc, txRepo)
	reportH := handlers.NewReportHandler(reportRepo)
	spendingH := handlers.NewSpendingHandler(spendingRepo)
	notifH := handlers.NewNotificationHandler(notifSvc)
	activityH := handlers.NewActivityHandler(activitySvc)
	accountH := handlers.NewAccountHandler(db)
	creditCardH := handlers.NewCreditCardHandler(db)
	categoryH := handlers.NewCategoryHandler(db)
	workspaceH := handlers.NewWorkspaceHandler(db)
	debtH := handlers.NewDebtHandler(db)
	importH := handlers.NewImportHandler(db)
	aiSubH := handlers.NewAISubscriptionHandler(db, aiUsageSvc)
	planH := handlers.NewPlanHandler(db)
	settingsH := handlers.NewSettingsHandler(db)
	patrimonySnapH := handlers.NewPatrimonySnapshotHandler(db)

	// ── Router ────────────────────────────────────────────────────────────────
	r := gin.Default()

	corsOrigins := []string{"http://localhost:4200"}
	if cfg.CORSOrigins != "" {
		corsOrigins = []string{cfg.CORSOrigins}
	}
	log.Printf("CORS Origins configured: %v", corsOrigins)
	r.Use(middleware.Gzip())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
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
		auth.PATCH("/transactions/:id/unpay", txH.MarkUnpaid)
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
		auth.GET("/reports/export/csv", middleware.RequirePremium(db), reportH.ExportCSV)
		auth.GET("/reports/export/excel", middleware.RequirePremium(db), reportH.ExportExcel)

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

		// Accounts
		auth.GET("/accounts", accountH.List)
		auth.POST("/accounts", accountH.Create)
		auth.PUT("/accounts/:id", accountH.Update)
		auth.DELETE("/accounts/:id", accountH.Delete)

		// Credit Cards
		auth.GET("/credit-cards", creditCardH.List)
		auth.POST("/credit-cards", creditCardH.Create)
		auth.PUT("/credit-cards/:id", creditCardH.Update)
		auth.DELETE("/credit-cards/:id", creditCardH.Delete)

		// Categories
		auth.GET("/categories", categoryH.List)
		auth.POST("/categories", categoryH.Create)
		auth.PUT("/categories/:id", categoryH.Update)
		auth.DELETE("/categories/:id", categoryH.Delete)

		// Import — Organizze PDF
		auth.POST("/import/organizze", importH.ImportOrganizze)

		// Debt Strategy — Premium
		auth.GET("/debts", middleware.RequirePremium(db), debtH.List)
		auth.POST("/debts", middleware.RequirePremium(db), debtH.Create)
		auth.PUT("/debts/:id", middleware.RequirePremium(db), debtH.Update)
		auth.DELETE("/debts/:id", middleware.RequirePremium(db), debtH.Delete)

		// Workspace
		auth.GET("/workspace", workspaceH.GetInfo)
		auth.GET("/workspace/members", workspaceH.GetMembers)
		auth.POST("/workspace/members/invite", workspaceH.InviteMember)
		auth.DELETE("/workspace/members/:user_id", workspaceH.RemoveMember)

		// AI Subscriptions — Premium
		auth.GET("/ai-subscriptions", middleware.RequirePremium(db), aiSubH.List)
		auth.POST("/ai-subscriptions", middleware.RequirePremium(db), aiSubH.Create)
		auth.PUT("/ai-subscriptions/:id", middleware.RequirePremium(db), aiSubH.Update)
		auth.DELETE("/ai-subscriptions/:id", middleware.RequirePremium(db), aiSubH.Delete)
		auth.POST("/ai-subscriptions/:id/sync", middleware.RequirePremium(db), aiSubH.Sync)
		auth.POST("/ai-subscriptions/:id/usage", middleware.RequirePremium(db), aiSubH.Usage)

		// Plan / Access Control
		auth.GET("/plan", planH.GetPlan)
		auth.PUT("/plan", planH.UpdatePlan)

		// Settings / GDPR (profile, currency, data export, account deletion)
		auth.GET("/me", settingsH.GetMe)
		auth.PUT("/me/settings", settingsH.UpdateSettings)
		auth.GET("/me/export", settingsH.ExportData)
		auth.DELETE("/me", settingsH.DeleteAccount)

		// Patrimony snapshots
		auth.GET("/patrimony-snapshots", patrimonySnapH.List)
		auth.POST("/patrimony-snapshots", patrimonySnapH.Upsert)
		auth.DELETE("/patrimony-snapshots/:month", patrimonySnapH.Delete)
	}

	r.GET("/api/v1/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	log.Printf("server listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
