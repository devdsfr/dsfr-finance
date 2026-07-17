package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/gin-gonic/gin"
)

// PremiumFeatures is the catalog of features gated behind the Premium plan.
// Keep this in sync with middleware.RequirePremium call sites in main.go and
// the frontend's PlanService feature checks.
var PremiumFeatures = []models.FeatureInfo{
	{Key: "export_reports", Label: "Exportar Relatórios", Description: "Exportar relatórios em CSV e Excel"},
	{Key: "debt_strategy", Label: "Estratégia de Dívidas", Description: "Simulador avançado de quitação de dívidas (bola de neve / avalanche)"},
	{Key: "ai_subscriptions", Label: "Assinaturas de IA", Description: "Monitoramento de consumo e recomendação de cancelamento das suas IAs"},
}

type PlanHandler struct{ db *sql.DB }

func NewPlanHandler(db *sql.DB) *PlanHandler { return &PlanHandler{db: db} }

func (h *PlanHandler) GetPlan(c *gin.Context) {
	var plan string
	err := h.db.QueryRowContext(c, `SELECT plan FROM users WHERE id=$1`, middleware.GetUserID(c)).Scan(&plan)
	if err != nil {
		plan = "free"
	}

	isPremium := plan == "premium"
	features := make([]models.FeatureInfo, len(PremiumFeatures))
	for i, f := range PremiumFeatures {
		f.Enabled = isPremium
		features[i] = f
	}

	c.JSON(http.StatusOK, gin.H{"plan": plan, "features": features})
}

func (h *PlanHandler) UpdatePlan(c *gin.Context) {
	var body struct {
		Plan string `json:"plan"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || (body.Plan != "free" && body.Plan != "premium") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plano inválido — use 'free' ou 'premium'"})
		return
	}
	_, err := h.db.ExecContext(c, `UPDATE users SET plan=$1, updated_at=NOW() WHERE id=$2`, body.Plan, middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plan": body.Plan})
}
