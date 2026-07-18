package handlers

import (
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/gin-gonic/gin"
)

type InvestmentHandler struct {
	repo *repositories.InvestmentRepository
}

func NewInvestmentHandler(repo *repositories.InvestmentRepository) *InvestmentHandler {
	return &InvestmentHandler{repo}
}

// ── Config ───────────────────────────────────────────────────────────────

func (h *InvestmentHandler) GetConfig(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	cfg, err := h.repo.GetConfig(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *InvestmentHandler) UpdateConfig(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var body models.InvestmentConfigResponse
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.UpsertConfig(wsID, body.MonthlyContribution, body.Classes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	cfg, err := h.repo.GetConfig(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// ── Assets ───────────────────────────────────────────────────────────────

func (h *InvestmentHandler) ListAssets(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	assets, err := h.repo.ListAssets(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if assets == nil {
		assets = []*models.InvestmentAsset{}
	}
	c.JSON(http.StatusOK, gin.H{"data": assets})
}

func (h *InvestmentHandler) CreateAsset(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var a models.InvestmentAsset
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	a.WorkspaceID = wsID
	if a.Sector == "" {
		a.Sector = "Outros"
	}
	if err := h.repo.CreateAsset(&a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *InvestmentHandler) UpdateAsset(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	existing, err := h.repo.GetAssetByID(c.Param("id"), wsID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var body models.InvestmentAsset
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing.ClassName = body.ClassName
	existing.Sector = body.Sector
	existing.Ticker = body.Ticker
	existing.DisplayOrder = body.DisplayOrder
	if err := h.repo.UpdateAsset(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (h *InvestmentHandler) DeleteAsset(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if err := h.repo.DeleteAsset(c.Param("id"), wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
