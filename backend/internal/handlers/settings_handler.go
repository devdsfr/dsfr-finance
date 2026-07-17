package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
)

// SUPPORTED_CURRENCIES — keep in sync with the frontend currency picker.
var SUPPORTED_CURRENCIES = map[string]bool{
	"BRL": true, "USD": true, "EUR": true, "RON": true,
}

type SettingsHandler struct{ db *sql.DB }

func NewSettingsHandler(db *sql.DB) *SettingsHandler { return &SettingsHandler{db: db} }

// GetMe returns the current user's profile, including plan and currency —
// used by the frontend to hydrate settings screens without re-deriving
// everything from the JWT.
func (h *SettingsHandler) GetMe(c *gin.Context) {
	var (
		id, name, email, plan, currency string
		mfaEnabled                      bool
	)
	err := h.db.QueryRowContext(c, `SELECT id, name, email, plan, currency, mfa_enabled FROM users WHERE id=$1`,
		middleware.GetUserID(c)).Scan(&id, &name, &email, &plan, &currency, &mfaEnabled)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": id, "name": name, "email": email, "plan": plan,
		"currency": currency, "mfa_enabled": mfaEnabled,
	})
}

// UpdateSettings — currently just the display currency, but kept generic so
// future profile-level settings (locale, date format, etc.) can be added
// without a new endpoint.
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var body struct {
		Currency string `json:"currency"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Currency != "" && !SUPPORTED_CURRENCIES[body.Currency] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "moeda não suportada"})
		return
	}
	_, err := h.db.ExecContext(c, `UPDATE users SET currency=$1, updated_at=NOW() WHERE id=$2`,
		body.Currency, middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"currency": body.Currency})
}

// ExportData — GDPR Art. 20 (data portability). Dumps every record tied to
// the user's workspace as a single JSON file the user can download.
func (h *SettingsHandler) ExportData(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)

	tables := map[string]string{
		"user":            `SELECT id, name, email, plan, currency, mfa_enabled, created_at FROM users WHERE id=$1`,
		"workspace":       `SELECT id, name, type, owner_id, created_at FROM workspaces WHERE id=$1`,
		"accounts":        `SELECT id, name, type, currency, balance, color, icon, is_active, created_at FROM accounts WHERE workspace_id=$1`,
		"credit_cards":    `SELECT id, name, limit_amount, closing_day, due_day, color, icon, is_active, created_at FROM credit_cards WHERE workspace_id=$1`,
		"categories":      `SELECT id, parent_id, name, type, icon, color, created_at FROM categories WHERE workspace_id=$1`,
		"tags":            `SELECT id, name, color, created_at FROM tags WHERE workspace_id=$1`,
		"transactions":    `SELECT id, account_id, credit_card_id, category_id, type, amount, date, description, notes, paid, ignored, created_at FROM transactions WHERE workspace_id=$1`,
		"spending_limits": `SELECT id, category_id, account_id, credit_card_id, amount, period, alert_pct, created_at FROM spending_limits WHERE workspace_id=$1`,
		"ai_subscriptions": `SELECT id, provider, name, plan_name, monthly_cost, billing_day, status, created_at FROM ai_subscriptions WHERE workspace_id=$1`,
	}

	result := gin.H{"exported_at": time.Now().Format(time.RFC3339)}
	for key, q := range tables {
		arg := wsID
		if key == "user" {
			arg = userID
		}
		rows, data, err := dumpRows(c, h.db, q, arg)
		if err == nil {
			result[key] = data
		}
		if rows != nil {
			rows.Close()
		}
	}

	c.Header("Content-Disposition", "attachment; filename=dsfr-finance-export.json")
	c.JSON(http.StatusOK, result)
}

// dumpRows runs a query and returns every row as a column-name -> value map,
// without needing a hand-written struct per table — handy for a one-off
// "export everything" endpoint like this one.
func dumpRows(c *gin.Context, db *sql.DB, query string, arg interface{}) (*sql.Rows, []map[string]interface{}, error) {
	rows, err := db.QueryContext(c, query, arg)
	if err != nil {
		return nil, nil, err
	}
	cols, err := rows.Columns()
	if err != nil {
		return rows, nil, err
	}
	var out []map[string]interface{}
	for rows.Next() {
		raw := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range raw {
			ptrs[i] = &raw[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		row := make(map[string]interface{}, len(cols))
		for i, col := range cols {
			v := raw[i]
			if b, ok := v.([]byte); ok {
				v = string(b)
			}
			row[col] = v
		}
		out = append(out, row)
	}
	if out == nil {
		out = []map[string]interface{}{}
	}
	return rows, out, nil
}

// DeleteAccount — GDPR Art. 17 (right to erasure). Deleting the user cascades
// to their owned workspace and everything in it (accounts, transactions,
// categories, etc.) via ON DELETE CASCADE foreign keys.
func (h *SettingsHandler) DeleteAccount(c *gin.Context) {
	userID := middleware.GetUserID(c)
	_, err := h.db.ExecContext(c, `DELETE FROM users WHERE id=$1`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
