package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/dsfr/finance/internal/middleware"
)

type ThermometerHandler struct {
	db *sql.DB
}

func NewThermometerHandler(db *sql.DB) *ThermometerHandler {
	return &ThermometerHandler{db: db}
}

// List returns every saved monthly thermometer for the workspace, oldest first.
func (h *ThermometerHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	rows, err := h.db.QueryContext(c, `
		SELECT month, score, label, color, payload
		FROM thermometer_snapshots
		WHERE workspace_id = $1
		ORDER BY month ASC`, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	data := []gin.H{}
	for rows.Next() {
		var month, label, color string
		var score int
		var payload []byte
		if err := rows.Scan(&month, &score, &label, &color, &payload); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var pl map[string]any
		_ = json.Unmarshal(payload, &pl)
		data = append(data, gin.H{
			"month": month, "score": score, "label": label, "color": color,
			"pillars": pl["pillars"], "tips": pl["tips"],
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// Upsert saves (or overwrites) the thermometer for a given month. The frontend
// recomputes the live score and calls this on every dashboard load, so the
// stored value for a month always reflects the latest state of that month.
func (h *ThermometerHandler) Upsert(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var body struct {
		Month   string          `json:"month"`
		Score   int             `json:"score"`
		Label   string          `json:"label"`
		Color   string          `json:"color"`
		Pillars json.RawMessage `json:"pillars"`
		Tips    json.RawMessage `json:"tips"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(body.Month) != 7 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month inválido (use YYYY-MM)"})
		return
	}

	if len(body.Pillars) == 0 {
		body.Pillars = json.RawMessage("[]")
	}
	if len(body.Tips) == 0 {
		body.Tips = json.RawMessage("[]")
	}
	payload, _ := json.Marshal(map[string]json.RawMessage{
		"pillars": body.Pillars,
		"tips":    body.Tips,
	})

	_, err := h.db.ExecContext(c, `
		INSERT INTO thermometer_snapshots (id, workspace_id, month, score, label, color, payload, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
		ON CONFLICT (workspace_id, month) DO UPDATE SET
		  score=$4, label=$5, color=$6, payload=$7, updated_at=NOW()`,
		uuid.New().String(), wsID, body.Month, body.Score, body.Label, body.Color, payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
