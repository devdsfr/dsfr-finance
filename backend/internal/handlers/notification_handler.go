package handlers

import (
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationHandler struct {
	svc *services.NotificationService
}

func NewNotificationHandler(svc *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	wsID := middleware.GetWorkspaceID(c)
	notifs, err := h.svc.ListForUser(userID, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": notifs})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if err := h.svc.MarkRead(c.Param("id"), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	wsID := middleware.GetWorkspaceID(c)
	if err := h.svc.MarkAllRead(userID, wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Alert configs — AC-AL-05, AC-AL-06
func (h *NotificationHandler) GetAlertConfigs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	wsID := middleware.GetWorkspaceID(c)
	configs, err := h.svc.GetAlertConfigs(userID, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

func (h *NotificationHandler) UpsertAlertConfig(c *gin.Context) {
	userID := middleware.GetUserID(c)
	wsID := middleware.GetWorkspaceID(c)
	var cfg models.AlertConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if cfg.ID == "" {
		cfg.ID = uuid.New().String()
	}
	cfg.UserID = userID
	cfg.WorkspaceID = wsID
	if err := h.svc.UpsertAlertConfig(&cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}
