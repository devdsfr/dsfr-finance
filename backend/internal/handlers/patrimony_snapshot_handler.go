package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/dsfr/finance/internal/middleware"
)

type PatrimonySnapshotHandler struct {
	db *sql.DB
}

func NewPatrimonySnapshotHandler(db *sql.DB) *PatrimonySnapshotHandler {
	return &PatrimonySnapshotHandler{db: db}
}

func (h *PatrimonySnapshotHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	rows, err := h.db.QueryContext(c, `
		SELECT id, month, wallet_name, total, invested, profit, capital_gains, dividends,
		       income_12m, variation_pct, variation_val, rentability, notes
		FROM patrimony_snapshots
		WHERE workspace_id = $1
		ORDER BY wallet_name ASC, month ASC`, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var data []gin.H
	for rows.Next() {
		var id, month, walletName, notes string
		var total, invested, profit, capitalGains, dividends, income12m float64
		var variationPct, variationVal, rentability float64
		rows.Scan(&id, &month, &walletName, &total, &invested, &profit, &capitalGains,
			&dividends, &income12m, &variationPct, &variationVal, &rentability, &notes)
		data = append(data, gin.H{
			"id": id, "month": month, "wallet_name": walletName,
			"total": total, "invested": invested, "profit": profit,
			"capital_gains": capitalGains, "dividends": dividends,
			"income_12m": income12m, "variation_pct": variationPct,
			"variation_val": variationVal, "rentability": rentability,
			"notes": notes,
		})
	}
	if data == nil {
		data = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *PatrimonySnapshotHandler) Upsert(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var body struct {
		Month        string  `json:"month"`
		WalletName   string  `json:"wallet_name"`
		Total        float64 `json:"total"`
		Invested     float64 `json:"invested"`
		Profit       float64 `json:"profit"`
		CapitalGains float64 `json:"capital_gains"`
		Dividends    float64 `json:"dividends"`
		Income12m    float64 `json:"income_12m"`
		VariationPct float64 `json:"variation_pct"`
		VariationVal float64 `json:"variation_val"`
		Rentability  float64 `json:"rentability"`
		Notes        string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month required (YYYY-MM)"})
		return
	}
	if body.WalletName == "" {
		body.WalletName = "Principal"
	}

	id := uuid.New().String()
	_, err := h.db.ExecContext(c, `
		INSERT INTO patrimony_snapshots
		  (id, workspace_id, month, wallet_name, total, invested, profit, capital_gains, dividends,
		   income_12m, variation_pct, variation_val, rentability, notes, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
		ON CONFLICT (workspace_id, month, wallet_name) DO UPDATE SET
		  total=$5, invested=$6, profit=$7, capital_gains=$8, dividends=$9,
		  income_12m=$10, variation_pct=$11, variation_val=$12, rentability=$13,
		  notes=$14, updated_at=NOW()`,
		id, wsID, body.Month, body.WalletName, body.Total, body.Invested, body.Profit,
		body.CapitalGains, body.Dividends, body.Income12m,
		body.VariationPct, body.VariationVal, body.Rentability, body.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *PatrimonySnapshotHandler) Delete(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	month := c.Param("month")
	wallet := c.DefaultQuery("wallet", "")
	if wallet == "" {
		// delete all wallets for that month (legacy behaviour)
		h.db.ExecContext(c, `DELETE FROM patrimony_snapshots WHERE workspace_id=$1 AND month=$2`, wsID, month)
	} else {
		h.db.ExecContext(c, `DELETE FROM patrimony_snapshots WHERE workspace_id=$1 AND month=$2 AND wallet_name=$3`, wsID, month, wallet)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
