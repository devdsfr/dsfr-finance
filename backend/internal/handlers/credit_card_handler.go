package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreditCardHandler struct{ db *sql.DB }

func NewCreditCardHandler(db *sql.DB) *CreditCardHandler { return &CreditCardHandler{db: db} }

// List godoc
// @Summary Listar cartões de crédito
// @Description Retorna todos os cartões de crédito do workspace
// @Tags credit-cards
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /credit-cards [get]
func (h *CreditCardHandler) List(c *gin.Context) {
	rows, err := h.db.QueryContext(c, `SELECT id, name, limit_amount, closing_day, due_day, COALESCE(color,'') as color, COALESCE(icon,'') as icon, created_at FROM credit_cards WHERE workspace_id=$1 ORDER BY name`, middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var data []gin.H
	for rows.Next() {
		var id, name, color, icon string
		var limit float64
		var closing, due int
		var createdAt interface{}
		rows.Scan(&id, &name, &limit, &closing, &due, &color, &icon, &createdAt)
		data = append(data, gin.H{"id": id, "name": name, "limit_amount": limit, "closing_day": closing, "due_day": due, "color": color, "icon": icon, "created_at": createdAt})
	}
	if data == nil {
		data = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *CreditCardHandler) Create(c *gin.Context) {
	var body struct {
		Name        string  `json:"name"`
		LimitAmount float64 `json:"limit_amount"`
		ClosingDay  int     `json:"closing_day"`
		DueDay      int     `json:"due_day"`
		Color       string  `json:"color"`
		Icon        string  `json:"icon"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id := uuid.New().String()
	_, err := h.db.ExecContext(c, `INSERT INTO credit_cards (id, workspace_id, name, limit_amount, closing_day, due_day, color, icon, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
		id, middleware.GetWorkspaceID(c), body.Name, body.LimitAmount, body.ClosingDay, body.DueDay, body.Color, body.Icon)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": body.Name, "color": body.Color, "icon": body.Icon})
}

func (h *CreditCardHandler) Update(c *gin.Context) {
	var body struct {
		Name        string  `json:"name"`
		LimitAmount float64 `json:"limit_amount"`
		Color       string  `json:"color"`
		Icon        string  `json:"icon"`
	}
	c.ShouldBindJSON(&body)
	h.db.ExecContext(c, `UPDATE credit_cards SET name=$1, limit_amount=$2, color=$3, icon=$4, updated_at=NOW() WHERE id=$5 AND workspace_id=$6`,
		body.Name, body.LimitAmount, body.Color, body.Icon, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *CreditCardHandler) Delete(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM credit_cards WHERE id=$1 AND workspace_id=$2`, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
