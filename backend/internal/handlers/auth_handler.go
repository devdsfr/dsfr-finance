package handlers

import (
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	svc *services.AuthService
}

func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req services.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, token, err := h.svc.Register(req)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, token, err := h.svc.Login(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	if token == "mfa_required" {
		c.JSON(http.StatusOK, gin.H{"mfa_required": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

// EnableMFA — AC-MC-10
func (h *AuthHandler) EnableMFA(c *gin.Context) {
	userID := middleware.GetUserID(c)
	secret, url, err := h.svc.EnableMFA(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	_ = secret
	c.JSON(http.StatusOK, gin.H{"provisioning_url": url})
}

func (h *AuthHandler) ConfirmMFA(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ConfirmMFA(userID, body.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MFA ativado com sucesso"})
}

func (h *AuthHandler) DisableMFA(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if err := h.svc.DisableMFA(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MFA desativado"})
}
