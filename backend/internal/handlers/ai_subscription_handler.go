package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AISubscriptionHandler struct {
	db  *sql.DB
	svc *services.AIUsageService
}

func NewAISubscriptionHandler(db *sql.DB, svc *services.AIUsageService) *AISubscriptionHandler {
	return &AISubscriptionHandler{db: db, svc: svc}
}

func (h *AISubscriptionHandler) List(c *gin.Context) {
	rows, err := h.db.QueryContext(c, `
		SELECT id, provider, name, plan_name, monthly_cost, billing_day, (api_key_enc IS NOT NULL AND api_key_enc != ''),
		       color, logo, status, COALESCE(category,'other'), COALESCE(billing_cycle,'monthly'), last_synced_at, created_at, updated_at
		FROM ai_subscriptions WHERE workspace_id=$1 ORDER BY category, name`, middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []*models.AISubscription
	for rows.Next() {
		s := &models.AISubscription{}
		if err := rows.Scan(&s.ID, &s.Provider, &s.Name, &s.PlanName, &s.MonthlyCost, &s.BillingDay, &s.HasAPIKey,
			&s.Color, &s.Logo, &s.Status, &s.Category, &s.BillingCycle, &s.LastSyncedAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
			continue
		}
		s.WorkspaceID = middleware.GetWorkspaceID(c)
		list = append(list, s)
	}
	if list == nil {
		list = []*models.AISubscription{}
	}

	period := services.CurrentPeriod()
	for _, s := range list {
		usage := h.fetchUsage(c, s.ID, period)
		s.CurrentUsage = usage
		s.Recommendation = services.ComputeRecommendation(s.MonthlyCost, usage)
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *AISubscriptionHandler) fetchUsage(c *gin.Context, subID, period string) *models.AIUsageSnapshot {
	var u models.AIUsageSnapshot
	err := h.db.QueryRowContext(c, `
		SELECT id, subscription_id, period, requests_count, tokens_used, cost_usd, source, synced_at
		FROM ai_usage_snapshots WHERE subscription_id=$1 AND period=$2`, subID, period).
		Scan(&u.ID, &u.SubscriptionID, &u.Period, &u.RequestsCount, &u.TokensUsed, &u.CostUSD, &u.Source, &u.SyncedAt)
	if err != nil {
		return nil
	}
	return &u
}

func (h *AISubscriptionHandler) Create(c *gin.Context) {
	var body struct {
		Provider     string  `json:"provider"`
		Name         string  `json:"name"`
		PlanName     string  `json:"plan_name"`
		MonthlyCost  float64 `json:"monthly_cost"`
		BillingDay   *int    `json:"billing_day"`
		APIKey       string  `json:"api_key"`
		Color        string  `json:"color"`
		Logo         string  `json:"logo"`
		Category     string  `json:"category"`
		BillingCycle string  `json:"billing_cycle"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Category == "" { body.Category = "other" }
	if body.BillingCycle == "" { body.BillingCycle = "monthly" }
	if body.Provider == "" { body.Provider = "other" }

	var encKey string
	if body.APIKey != "" {
		enc, err := h.svc.EncryptKey(body.APIKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao proteger a chave de API"})
			return
		}
		encKey = enc
	}

	id := uuid.New().String()
	_, err := h.db.ExecContext(c, `
		INSERT INTO ai_subscriptions (id, workspace_id, provider, name, plan_name, monthly_cost, billing_day, api_key_enc, color, logo, category, billing_cycle, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW(),NOW())`,
		id, middleware.GetWorkspaceID(c), body.Provider, body.Name, nullable(body.PlanName), body.MonthlyCost, body.BillingDay, nullable(encKey), nullable(body.Color), nullable(body.Logo), body.Category, body.BillingCycle)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *AISubscriptionHandler) Update(c *gin.Context) {
	var body struct {
		Provider     string  `json:"provider"`
		Name         string  `json:"name"`
		PlanName     string  `json:"plan_name"`
		MonthlyCost  float64 `json:"monthly_cost"`
		BillingDay   *int    `json:"billing_day"`
		APIKey       *string `json:"api_key"` // nil = keep current; "" = clear; value = update
		Color        string  `json:"color"`
		Logo         string  `json:"logo"`
		Category     string  `json:"category"`
		BillingCycle string  `json:"billing_cycle"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Category == "" { body.Category = "other" }
	if body.BillingCycle == "" { body.BillingCycle = "monthly" }
	if body.Provider == "" { body.Provider = "other" }

	id := c.Param("id")
	wsID := middleware.GetWorkspaceID(c)

	if body.APIKey == nil {
		_, err := h.db.ExecContext(c, `
			UPDATE ai_subscriptions SET provider=$1, name=$2, plan_name=$3, monthly_cost=$4, billing_day=$5, color=$6, logo=$7, category=$8, billing_cycle=$9, updated_at=NOW()
			WHERE id=$10 AND workspace_id=$11`,
			body.Provider, body.Name, nullable(body.PlanName), body.MonthlyCost, body.BillingDay, nullable(body.Color), nullable(body.Logo), body.Category, body.BillingCycle, id, wsID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		var encKey string
		if *body.APIKey != "" {
			enc, err := h.svc.EncryptKey(*body.APIKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao proteger a chave de API"})
				return
			}
			encKey = enc
		}
		_, err := h.db.ExecContext(c, `
			UPDATE ai_subscriptions SET provider=$1, name=$2, plan_name=$3, monthly_cost=$4, billing_day=$5, api_key_enc=$6, color=$7, logo=$8, category=$9, billing_cycle=$10, updated_at=NOW()
			WHERE id=$11 AND workspace_id=$12`,
			body.Provider, body.Name, nullable(body.PlanName), body.MonthlyCost, body.BillingDay, nullable(encKey), nullable(body.Color), nullable(body.Logo), body.Category, body.BillingCycle, id, wsID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AISubscriptionHandler) Delete(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM ai_subscriptions WHERE id=$1 AND workspace_id=$2`, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Sync attempts to fetch real usage/cost data from the provider's API using
// the stored (encrypted) key. Falls back with a clear error if the provider
// doesn't support it or the key lacks permission — the user can then use the
// manual usage endpoint instead.
func (h *AISubscriptionHandler) Sync(c *gin.Context) {
	id := c.Param("id")
	wsID := middleware.GetWorkspaceID(c)

	var provider string
	var encKey sql.NullString
	err := h.db.QueryRowContext(c, `SELECT provider, api_key_enc FROM ai_subscriptions WHERE id=$1 AND workspace_id=$2`, id, wsID).
		Scan(&provider, &encKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "assinatura não encontrada"})
		return
	}
	if !encKey.Valid || encKey.String == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cadastre uma API key para sincronizar automaticamente, ou informe o uso manualmente"})
		return
	}

	apiKey, err := h.svc.DecryptKey(encKey.String)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "não foi possível decifrar a chave armazenada"})
		return
	}

	usage, err := h.svc.SyncUsage(provider, apiKey)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	h.upsertUsage(c, id, usage)
	h.db.ExecContext(c, `UPDATE ai_subscriptions SET last_synced_at=NOW(), updated_at=NOW() WHERE id=$1`, id)

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// Usage lets the user register usage/cost manually for providers without a
// usage API (or when the API key doesn't have admin scope).
func (h *AISubscriptionHandler) Usage(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Period        string  `json:"period"`
		RequestsCount int     `json:"requests_count"`
		TokensUsed    int64   `json:"tokens_used"`
		CostUSD       float64 `json:"cost_usd"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Period == "" {
		body.Period = services.CurrentPeriod()
	}

	usage := &models.AIUsageSnapshot{
		Period:        body.Period,
		RequestsCount: body.RequestsCount,
		TokensUsed:    body.TokensUsed,
		CostUSD:       body.CostUSD,
		Source:        "manual",
		SyncedAt:      time.Now(),
	}
	h.upsertUsage(c, id, usage)
	c.JSON(http.StatusOK, gin.H{"data": usage})
}

func (h *AISubscriptionHandler) upsertUsage(c *gin.Context, subID string, u *models.AIUsageSnapshot) {
	h.db.ExecContext(c, `
		INSERT INTO ai_usage_snapshots (id, subscription_id, period, requests_count, tokens_used, cost_usd, source, synced_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
		ON CONFLICT (subscription_id, period) DO UPDATE SET
			requests_count=$4, tokens_used=$5, cost_usd=$6, source=$7, synced_at=NOW()`,
		uuid.New().String(), subID, u.Period, u.RequestsCount, u.TokensUsed, u.CostUSD, u.Source)
}

func nullable(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
