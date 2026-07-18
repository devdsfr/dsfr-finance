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

// Register godoc
// @Summary Registrar novo usuário
// @Description Cria uma nova conta de usuário
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.RegisterRequest true "Dados de registro"
// @Success 201 {object} map[string]interface{} "user e token"
// @Failure 400 {object} map[string]string "Erro de validação"
// @Failure 409 {object} map[string]string "Usuário já existe"
// @Router /auth/register [post]
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

// Login godoc
// @Summary Fazer login
// @Description Autentica um usuário e retorna um token JWT
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.LoginRequest true "Credenciais de login"
// @Success 200 {object} map[string]interface{} "user e token"
// @Failure 400 {object} map[string]string "Erro de validação"
// @Failure 401 {object} map[string]string "Credenciais inválidas"
// @Router /auth/login [post]
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

// ForgotPassword godoc
// @Summary Solicitar redefinição de senha
// @Description Envia um e-mail com link de redefinição de senha
// @Tags auth
// @Accept json
// @Produce json
// @Router /auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.RequestPasswordReset(body.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Always return success so we don't leak which emails are registered.
	c.JSON(http.StatusOK, gin.H{"message": "Se o e-mail estiver cadastrado, um link de redefinição foi enviado."})
}

// ResetPassword godoc
// @Summary Redefinir senha
// @Description Define uma nova senha a partir de um token de redefinição
// @Tags auth
// @Accept json
// @Produce json
// @Router /auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ResetPassword(body.Token, body.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Senha redefinida com sucesso."})
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
