package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AccountHandler struct{ db *sql.DB }

func NewAccountHandler(db *sql.DB) *AccountHandler { return &AccountHandler{db: db} }

// List godoc
// @Summary Listar contas
// @Description Retorna todas as contas do workspace
// @Tags accounts
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /accounts [get]
func (h *AccountHandler) List(c *gin.Context) {
	rows, err := h.db.QueryContext(c, `SELECT id, name, type, balance, currency, created_at FROM accounts WHERE workspace_id = $1 ORDER BY name`, middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var data []gin.H
	for rows.Next() {
		var id, name, typ, currency string
		var balance float64
		var createdAt interface{}
		rows.Scan(&id, &name, &typ, &balance, &currency, &createdAt)
		data = append(data, gin.H{"id": id, "name": name, "type": typ, "balance": balance, "currency": currency, "created_at": createdAt})
	}
	if data == nil {
		data = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// Create godoc
// @Summary Criar conta
// @Description Cria uma nova conta bancária
// @Tags accounts
// @Security BearerAuth
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{}
// @Router /accounts [post]
func (h *AccountHandler) Create(c *gin.Context) {
	var body struct {
		Name     string  `json:"name"`
		Type     string  `json:"type"`
		Balance  float64 `json:"balance"`
		Currency string  `json:"currency"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Currency == "" {
		body.Currency = "BRL"
	}
	id := uuid.New().String()
	_, err := h.db.ExecContext(c, `INSERT INTO accounts (id, workspace_id, name, type, balance, currency, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
		id, middleware.GetWorkspaceID(c), body.Name, body.Type, body.Balance, body.Currency)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": body.Name, "type": body.Type, "balance": body.Balance, "currency": body.Currency})
}

func (h *AccountHandler) Update(c *gin.Context) {
	var body struct {
		Name    string  `json:"name"`
		Balance float64 `json:"balance"`
	}
	c.ShouldBindJSON(&body)
	_, err := h.db.ExecContext(c, `UPDATE accounts SET name=$1, balance=$2, updated_at=NOW() WHERE id=$3 AND workspace_id=$4`,
		body.Name, body.Balance, c.Param("id"), middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AccountHandler) Delete(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM accounts WHERE id=$1 AND workspace_id=$2`, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
