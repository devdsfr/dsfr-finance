package handlers

import (
	"database/sql"
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

// ── Portfolios ───────────────────────────────────────────────────────────

func (h *InvestmentHandler) ListPortfolios(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	list, err := h.repo.ListPortfolios(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if list == nil {
		list = []*models.InvestmentPortfolio{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *InvestmentHandler) CreatePortfolio(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var p models.InvestmentPortfolio
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if p.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nome é obrigatório"})
		return
	}
	p.WorkspaceID = wsID
	if p.Icon == "" {
		p.Icon = "👤"
	}
	if p.Color == "" {
		p.Color = "#2e7736"
	}
	if err := h.repo.CreatePortfolio(&p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *InvestmentHandler) UpdatePortfolio(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var p models.InvestmentPortfolio
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = c.Param("id")
	p.WorkspaceID = wsID
	if p.Icon == "" {
		p.Icon = "👤"
	}
	if p.Color == "" {
		p.Color = "#2e7736"
	}
	if err := h.repo.UpdatePortfolio(&p); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "carteira não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *InvestmentHandler) DeletePortfolio(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if err := h.repo.DeletePortfolio(c.Param("id"), wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ── Monthly entries ──────────────────────────────────────────────────────

// GetMonth returns the entry for ?portfolio_id=&month=YYYY-MM
func (h *InvestmentHandler) GetMonth(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	portfolioID := c.Query("portfolio_id")
	month := c.Query("month")
	if portfolioID == "" || month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "portfolio_id e month são obrigatórios"})
		return
	}
	entry, err := h.repo.GetMonthEntry(wsID, portfolioID, month)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "carteira não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, entry)
}

func (h *InvestmentHandler) SaveMonth(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var e models.InvestmentMonthEntry
	if err := c.ShouldBindJSON(&e); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if e.PortfolioID == "" || e.Month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "portfolio_id e month são obrigatórios"})
		return
	}
	if err := h.repo.UpsertMonthEntry(wsID, &e); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "carteira não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, e)
}

func (h *InvestmentHandler) History(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	points, err := h.repo.History(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if points == nil {
		points = []*models.InvestmentHistoryPoint{}
	}
	c.JSON(http.StatusOK, gin.H{"data": points})
}
