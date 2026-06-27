package handlers

import (
	"net/http"
	"strconv"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
)

type TransactionHandler struct {
	svc  *services.TransactionService
	repo *repositories.TransactionRepository
}

func NewTransactionHandler(svc *services.TransactionService, repo *repositories.TransactionRepository) *TransactionHandler {
	return &TransactionHandler{svc, repo}
}

// List godoc
// @Summary Listar transações
// @Description Retorna lista paginada de transações com filtros
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param account_id query string false "ID da conta"
// @Param category_id query string false "ID da categoria"
// @Param type query string false "Tipo (expense, income, transfer)"
// @Param paid query boolean false "Filtrar por pago/não pago"
// @Param page query int false "Página" default(1)
// @Param limit query int false "Itens por página" default(20)
// @Success 200 {object} map[string]interface{} "transactions e total"
// @Failure 401 {object} map[string]string "Não autorizado"
// @Failure 500 {object} map[string]string "Erro interno"
// @Router /transactions [get]
func (h *TransactionHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	paid := parseBoolPtr(c.Query("paid"))
	ignored := parseBoolPtr(c.Query("ignored"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	f := repositories.TransactionFilter{
		WorkspaceID:  wsID,
		AccountID:    c.Query("account_id"),
		CategoryID:   c.Query("category_id"),
		CreditCardID: c.Query("credit_card_id"),
		Type:         c.Query("type"),
		Paid:         paid,
		Ignored:      ignored,
		DateFrom:     c.Query("date_from"),
		DateTo:       c.Query("date_to"),
		Search:       c.Query("search"),
		Page:         page,
		Limit:        limit,
	}

	txs, total, err := h.repo.List(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Attach tags in a single batched query (was previously one query per
	// transaction — with limit=500 that meant up to 500 round-trips and was
	// the single biggest contributor to dashboard load time).
	ids := make([]string, len(txs))
	for i, tx := range txs {
		ids[i] = tx.ID
	}
	tagsByTx, _ := h.repo.GetTagsForTransactions(ids)
	for _, tx := range txs {
		tx.Tags = tagsByTx[tx.ID]
	}

	overdue, _ := h.repo.CountOverdue(wsID)

	c.JSON(http.StatusOK, gin.H{
		"data":          txs,
		"total":         total,
		"page":          page,
		"limit":         limit,
		"overdue_count": overdue, // AC-UX-01 / AC-UX-02 banner data
	})
}

func (h *TransactionHandler) Get(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	tx, err := h.repo.GetByID(c.Param("id"), wsID)
	if err != nil || tx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	tx.Tags, _ = h.repo.GetTags(tx.ID)
	c.JSON(http.StatusOK, tx)
}

func (h *TransactionHandler) Create(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)
	var req services.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	txs, err := h.svc.Create(wsID, userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": txs})
}

func (h *TransactionHandler) Update(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)
	var req services.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tx, err := h.svc.Update(wsID, userID, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *TransactionHandler) Delete(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if err := h.repo.Delete(c.Param("id"), wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// MarkPaid marks a single transaction as paid (AC-UX-07)
func (h *TransactionHandler) MarkPaid(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)
	tx, err := h.svc.MarkPaid(wsID, userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tx, "toast": "Lançamento marcado como pago!"})
}

// MarkUnpaid removes the paid status from a transaction
func (h *TransactionHandler) MarkUnpaid(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)
	tx, err := h.svc.MarkUnpaid(wsID, userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tx, "toast": "Lançamento marcado como não pago."})
}

// MarkAllPaid marks all overdue as paid (AC-UX-01)
func (h *TransactionHandler) MarkAllPaid(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	count, err := h.repo.MarkAllPaid(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": count, "toast": "Todos os lançamentos foram marcados como pagos!"})
}

// IgnoreAll ignores all overdue (AC-UX-02)
func (h *TransactionHandler) IgnoreAll(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	count, err := h.repo.IgnoreAll(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": count, "toast": "Todos os lançamentos foram ignorados."})
}

// Duplicate duplicates a transaction (AC-UX-06)
func (h *TransactionHandler) Duplicate(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)
	tx, err := h.svc.Duplicate(wsID, userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tx)
}

// SuggestTags returns tag suggestions for a description (AC-TG-05)
func (h *TransactionHandler) SuggestTags(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	desc := c.Query("description")
	tags, err := h.repo.SuggestTags(wsID, desc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tags})
}

func parseBoolPtr(s string) *bool {
	if s == "" {
		return nil
	}
	v := s == "true" || s == "1"
	return &v
}
