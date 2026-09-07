package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
)

// AgentHandler expõe o agente financeiro dentro do app (Visão Geral).
type AgentHandler struct {
	agent   *services.FinanceAgentService
	profile *services.FinanceProfileService
}

func NewAgentHandler(agent *services.FinanceAgentService, profile *services.FinanceProfileService) *AgentHandler {
	return &AgentHandler{agent: agent, profile: profile}
}

// POST /agent/ask
// Body: { question, history: [{question, answer}] }
func (h *AgentHandler) Ask(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var body struct {
		Question string              `json:"question" binding:"required"`
		History  []services.ChatTurn `json:"history"`
		// Foco da tela que perguntou. Só valores conhecidos passam — o campo
		// vem do cliente e não pode virar injeção no prompt.
		Focus string `json:"focus"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(body.Question) > 1000 {
		body.Question = body.Question[:1000]
	}
	// Só as últimas rodadas importam, e limitam o custo da chamada.
	if len(body.History) > 6 {
		body.History = body.History[len(body.History)-6:]
	}

	if body.Focus != "debt" {
		body.Focus = ""
	}

	answer, err := h.agent.Consult(c, wsID, body.Question, body.History, body.Focus)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"answer": answer})
}

// GET /agent/status — diagnóstico da configuração de IA.
// Com ?ping=1 faz uma chamada real em cada provedor e devolve o erro de cada
// um, separando "variável não chegou no deploy" de "chave inválida",
// "modelo errado" e "cota estourada". Nunca devolve a chave.
func (h *AgentHandler) Status(c *gin.Context) {
	ai := h.agent.AI()
	res := gin.H{
		"enabled":   ai.Enabled(),
		"providers": ai.Providers(),
	}
	if !ai.Enabled() {
		res["hint"] = "AI_API_KEY não está definida no ambiente do backend."
	}
	if c.Query("ping") != "" && ai.Enabled() {
		res["ping"] = ai.Ping()
	}
	c.JSON(http.StatusOK, res)
}

// GET /agent/context — visualização do contexto em JSON (números crus).
func (h *AgentHandler) Context(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	p, err := h.profile.Build(c, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": p})
}

// GET /agent/context.md — download do contexto em Markdown.
func (h *AgentHandler) ContextMarkdown(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	md, err := h.profile.BuildMarkdown(c, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("contexto-financeiro-%s.md", time.Now().Format("2006-01-02"))
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(md))
}
