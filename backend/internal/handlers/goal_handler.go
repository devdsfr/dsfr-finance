package handlers

import (
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type GoalHandler struct {
	repo *repositories.GoalRepository
}

func NewGoalHandler(repo *repositories.GoalRepository) *GoalHandler {
	return &GoalHandler{repo}
}

func (h *GoalHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	goals, err := h.repo.List(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for _, g := range goals {
		h.repo.Enrich(g)
	}
	if goals == nil {
		goals = []*models.Goal{}
	}
	c.JSON(http.StatusOK, gin.H{"data": goals})
}

func (h *GoalHandler) Create(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	var g models.Goal
	if err := c.ShouldBindJSON(&g); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g.ID = uuid.New().String()
	g.WorkspaceID = wsID
	if g.ChartStyle == "" {
		g.ChartStyle = "ring"
	}
	if g.Color == "" {
		g.Color = "#2e7736"
	}
	if g.Icon == "" {
		g.Icon = "🎯"
	}
	if err := h.repo.Create(&g); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.repo.Enrich(&g)
	c.JSON(http.StatusCreated, g)
}

func (h *GoalHandler) Update(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	existing, err := h.repo.GetByID(c.Param("id"), wsID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var body models.Goal
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	existing.Name = body.Name
	existing.Type = body.Type
	existing.TargetAmount = body.TargetAmount
	existing.TargetDate = body.TargetDate
	existing.CategoryID = body.CategoryID
	existing.AccountID = body.AccountID
	existing.ChartStyle = body.ChartStyle
	existing.Color = body.Color
	existing.Icon = body.Icon
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.repo.Enrich(existing)
	c.JSON(http.StatusOK, existing)
}

func (h *GoalHandler) Delete(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if err := h.repo.Delete(c.Param("id"), wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
