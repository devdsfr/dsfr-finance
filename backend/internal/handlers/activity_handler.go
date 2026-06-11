package handlers

import (
	"net/http"
	"strconv"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
)

type ActivityHandler struct {
	svc *services.ActivityService
}

func NewActivityHandler(svc *services.ActivityService) *ActivityHandler {
	return &ActivityHandler{svc}
}

// List — AC-AT-05: filter by action type
func (h *ActivityHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))

	f := services.ActivityFilter{
		WorkspaceID: wsID,
		Action:      c.Query("action"),
		EntityType:  c.Query("entity_type"),
		Page:        page,
		Limit:       limit,
	}

	logs, total, err := h.svc.List(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": logs, "total": total, "page": page, "limit": limit})
}
