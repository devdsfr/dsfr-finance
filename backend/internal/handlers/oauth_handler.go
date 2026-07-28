package handlers

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
)

type OAuthHandler struct {
	svc    *services.OAuthService
	appURL string
}

func NewOAuthHandler(svc *services.OAuthService, appURL string) *OAuthHandler {
	return &OAuthHandler{svc: svc, appURL: strings.TrimRight(appURL, "/")}
}

// Login redirects the browser to the provider's consent screen.
// GET /auth/oauth/:provider/login
func (h *OAuthHandler) Login(c *gin.Context) {
	provider := c.Param("provider")
	if !h.svc.Enabled(provider) {
		// Bounce back to the login page with a friendly message.
		c.Redirect(http.StatusFound, h.appURL+"/auth/login?oauth_error="+
			url.QueryEscape("Login com "+providerLabel(provider)+" ainda não está configurado."))
		return
	}
	authURL, err := h.svc.AuthURL(provider)
	if err != nil {
		c.Redirect(http.StatusFound, h.appURL+"/auth/login?oauth_error="+url.QueryEscape(err.Error()))
		return
	}
	c.Redirect(http.StatusFound, authURL)
}

// Callback is where the provider redirects back with an authorization code.
// GET /auth/oauth/:provider/callback
func (h *OAuthHandler) Callback(c *gin.Context) {
	provider := c.Param("provider")

	if errParam := c.Query("error"); errParam != "" {
		h.fail(c, "Login cancelado ou negado pelo provedor.")
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" {
		h.fail(c, "Código de autorização ausente.")
		return
	}

	token, err := h.svc.HandleCallback(provider, code, state)
	if err != nil {
		h.fail(c, err.Error())
		return
	}

	// Hand the token to the SPA via a dedicated callback route.
	c.Redirect(http.StatusFound, h.appURL+"/auth/callback?token="+url.QueryEscape(token))
}

func (h *OAuthHandler) fail(c *gin.Context, msg string) {
	c.Redirect(http.StatusFound, h.appURL+"/auth/login?oauth_error="+url.QueryEscape(msg))
}

func providerLabel(p string) string {
	switch p {
	case "google":
		return "Google"
	case "facebook":
		return "Facebook"
	}
	return p
}
