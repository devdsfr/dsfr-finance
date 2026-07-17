package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DebtHandler struct{ db *sql.DB }

func NewDebtHandler(db *sql.DB) *DebtHandler { return &DebtHandler{db: db} }

func (h *DebtHandler) List(c *gin.Context) {
	rows, err := h.db.QueryContext(c,
		`SELECT id, name, type, system, original_amount, remaining_balance,
		        monthly_rate, monthly_payment, remaining_months, notes, created_at
		   FROM debts WHERE workspace_id = $1 ORDER BY created_at DESC`,
		middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var data []gin.H
	for rows.Next() {
		var id, name, typ, sys, notes string
		var origAmt, balance, rate, payment float64
		var months int
		var createdAt interface{}
		rows.Scan(&id, &name, &typ, &sys, &origAmt, &balance, &rate, &payment, &months, &notes, &createdAt)
		data = append(data, gin.H{
			"id": id, "name": name, "type": typ, "system": sys,
			"original_amount": origAmt, "remaining_balance": balance,
			"monthly_rate": rate, "monthly_payment": payment,
			"remaining_months": months, "notes": notes, "created_at": createdAt,
		})
	}
	if data == nil { data = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *DebtHandler) Create(c *gin.Context) {
	var body struct {
		Name            string  `json:"name"`
		Type            string  `json:"type"`
		System          string  `json:"system"`
		OriginalAmount  float64 `json:"original_amount"`
		RemainingBalance float64 `json:"remaining_balance"`
		MonthlyRate     float64 `json:"monthly_rate"`
		MonthlyPayment  float64 `json:"monthly_payment"`
		RemainingMonths int     `json:"remaining_months"`
		Notes           string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.System == "" { body.System = "price" }
	id := uuid.New().String()
	_, err := h.db.ExecContext(c,
		`INSERT INTO debts (id, workspace_id, name, type, system, original_amount,
		  remaining_balance, monthly_rate, monthly_payment, remaining_months, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		id, middleware.GetWorkspaceID(c), body.Name, body.Type, body.System,
		body.OriginalAmount, body.RemainingBalance, body.MonthlyRate,
		body.MonthlyPayment, body.RemainingMonths, body.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *DebtHandler) Update(c *gin.Context) {
	var body struct {
		Name             string  `json:"name"`
		RemainingBalance float64 `json:"remaining_balance"`
		MonthlyRate      float64 `json:"monthly_rate"`
		MonthlyPayment   float64 `json:"monthly_payment"`
		RemainingMonths  int     `json:"remaining_months"`
		Notes            string  `json:"notes"`
	}
	c.ShouldBindJSON(&body)
	_, err := h.db.ExecContext(c,
		`UPDATE debts SET name=$1, remaining_balance=$2, monthly_rate=$3,
		  monthly_payment=$4, remaining_months=$5, notes=$6, updated_at=NOW()
		 WHERE id=$7 AND workspace_id=$8`,
		body.Name, body.RemainingBalance, body.MonthlyRate,
		body.MonthlyPayment, body.RemainingMonths, body.Notes,
		c.Param("id"), middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *DebtHandler) Delete(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM debts WHERE id=$1 AND workspace_id=$2`,
		c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
