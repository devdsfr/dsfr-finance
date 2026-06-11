package handlers

import (
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SpendingHandler struct {
	repo *repositories.SpendingRepository
}

func NewSpendingHandler(repo *repositories.SpendingRepository) *SpendingHandler {
	return &SpendingHandler{repo}
}

func (h *SpendingHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	limits, err := h.repo.List(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Enrich with current spend
	for _, l := range limits {
		spend, _ := h.repo.ComputeCurrentSpend(l)
		l.CurrentSpend = spend
		if l.Amount > 0 {
			l.UsagePct = (spend / l.Amount) * 100
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": limits})
}

func (h *SpendingHandler) Create(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var l models.SpendingLimit
	if err := c.ShouldBindJSON(&l); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	l.ID = uuid.New().String()
	l.WorkspaceID = wsID
	if l.AlertPct == 0 {
		l.AlertPct = 80
	}
	if err := h.repo.Create(&l); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, l)
}

func (h *SpendingHandler) Update(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	existing, err := h.repo.GetByID(c.Param("id"), wsID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var body models.SpendingLimit
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing.Amount = body.Amount
	existing.Period = body.Period
	existing.AlertPct = body.AlertPct
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (h *SpendingHandler) Delete(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if err := h.repo.Delete(c.Param("id"), wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
