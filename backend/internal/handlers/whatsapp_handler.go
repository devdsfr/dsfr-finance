package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WhatsAppHandler struct {
	db          *sql.DB
	wa          *services.WhatsAppService
	agent       *services.FinanceAgentService
	verifyToken string
}

func NewWhatsAppHandler(db *sql.DB, wa *services.WhatsAppService, agent *services.FinanceAgentService, verifyToken string) *WhatsAppHandler {
	return &WhatsAppHandler{db: db, wa: wa, agent: agent, verifyToken: verifyToken}
}

// ── Webhook: verificação (GET) ──────────────────────────────────────────
// A Meta chama este endpoint uma vez ao cadastrar a URL.
func (h *WhatsAppHandler) Verify(c *gin.Context) {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && h.verifyToken != "" && token == h.verifyToken {
		c.String(http.StatusOK, challenge)
		return
	}
	c.Status(http.StatusForbidden)
}

// ── Webhook: mensagens (POST) ───────────────────────────────────────────

type waWebhook struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Messages []struct {
					From string `json:"from"`
					ID   string `json:"id"`
					Type string `json:"type"`
					Text struct {
						Body string `json:"body"`
					} `json:"text"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

func (h *WhatsAppHandler) Receive(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	// Assinatura HMAC antes de qualquer processamento. Sem isso, quem
	// descobrisse a URL conseguiria injetar lançamentos.
	if !h.wa.ValidateSignature(body, c.GetHeader("X-Hub-Signature-256")) {
		log.Println("whatsapp: assinatura inválida, descartando")
		c.Status(http.StatusForbidden)
		return
	}

	var hook waWebhook
	if err := json.Unmarshal(body, &hook); err != nil {
		c.Status(http.StatusOK) // 200 evita reenvio infinito de payload inválido
		return
	}

	// Responde rápido à Meta; o processamento segue em background.
	c.Status(http.StatusOK)

	for _, entry := range hook.Entry {
		for _, ch := range entry.Changes {
			for _, msg := range ch.Value.Messages {
				if msg.Type != "text" {
					continue
				}
				go h.process(msg.ID, msg.From, msg.Text.Body)
			}
		}
	}
}

func (h *WhatsAppHandler) process(messageID, phone, text string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("whatsapp: panic ao processar: %v", r)
		}
	}()

	// A requisição HTTP já respondeu, então o contexto dela morreu:
	// precisamos de um próprio para o trabalho em background.
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()

	// Idempotência: a Meta reenvia webhooks. Sem isso, um picolé vira três.
	// O INSERT com UNIQUE falha na segunda vez, e aí paramos.
	logID := uuid.New().String()
	res, err := h.db.ExecContext(ctx, `
		INSERT INTO whatsapp_messages (id, message_id, phone, direction, body, created_at)
		VALUES ($1,$2,$3,'in',$4,NOW())
		ON CONFLICT (message_id) DO NOTHING`,
		logID, messageID, phone, text)
	if err != nil {
		log.Printf("whatsapp: erro ao registrar mensagem: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return // já processada
	}

	// Allowlist: número não vinculado recebe silêncio. Responder confirmaria
	// que o serviço existe para quem estiver sondando.
	var wsID, linkID string
	var verified bool
	err = h.db.QueryRowContext(ctx,
		`SELECT id, workspace_id, verified FROM whatsapp_links WHERE phone=$1`,
		phone).Scan(&linkID, &wsID, &verified)

	if err == sql.ErrNoRows {
		// Único caso em que atendemos desconhecido: tentativa de pareamento.
		if code := extractPairingCode(text); code != "" {
			h.tryPair(ctx, phone, code)
		}
		return
	}
	if err != nil {
		log.Printf("whatsapp: erro ao buscar vínculo: %v", err)
		return
	}
	if !verified {
		if code := extractPairingCode(text); code != "" {
			h.tryPair(ctx, phone, code)
		}
		return
	}

	// Limite simples: no máximo 30 mensagens por hora por telefone.
	var recent int
	_ = h.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM whatsapp_messages
		WHERE phone=$1 AND direction='in' AND created_at > NOW() - interval '1 hour'`,
		phone).Scan(&recent)
	if recent > 30 {
		h.reply(phone, "Muitas mensagens seguidas. Tenta de novo daqui a pouco.")
		return
	}

	answer, txID, intent := h.agent.Handle(ctx, wsID, phone, text)

	// Guarda o resultado na mensagem que originou, para o DESFAZER encontrar.
	_, _ = h.db.ExecContext(ctx,
		`UPDATE whatsapp_messages SET workspace_id=$1, intent=$2, transaction_id=$3
		 WHERE id=$4`, wsID, intent, txID, logID)

	h.reply(phone, answer)
}

func (h *WhatsAppHandler) reply(phone, text string) {
	if err := h.wa.SendText(phone, text); err != nil {
		log.Printf("whatsapp: falha ao responder: %v", err)
	}
}

var rePairing = regexp.MustCompile(`(?i)\b(?:vincular|parear|codigo|código)\s*:?\s*(\d{6})\b`)

func extractPairingCode(text string) string {
	if m := rePairing.FindStringSubmatch(text); m != nil {
		return m[1]
	}
	// Aceita a mensagem contendo só os 6 dígitos.
	t := strings.TrimSpace(text)
	if len(t) == 6 {
		if _, err := fmt.Sscanf(t, "%6d", new(int)); err == nil {
			return t
		}
	}
	return ""
}

// tryPair confere o código e conclui o vínculo.
func (h *WhatsAppHandler) tryPair(ctx context.Context, phone, code string) {
	var linkID, wsID string
	err := h.db.QueryRowContext(ctx, `
		SELECT id, workspace_id FROM whatsapp_links
		WHERE pairing_code=$1 AND code_expires > NOW() AND verified=false
		LIMIT 1`, code).Scan(&linkID, &wsID)
	if err != nil {
		// Silêncio proposital: não confirmamos se o código existe.
		return
	}

	// O telefone que respondeu passa a ser o dono do vínculo.
	if _, err := h.db.ExecContext(ctx, `
		UPDATE whatsapp_links
		SET phone=$1, verified=true, pairing_code=NULL, code_expires=NULL, updated_at=NOW()
		WHERE id=$2`, phone, linkID); err != nil {
		log.Printf("whatsapp: erro ao vincular: %v", err)
		return
	}

	_ = h.wa.SendText(phone,
		"✅ Número vinculado ao DSFR Finance.\n\n"+
			"Já pode registrar gastos (“comprei um picolé de 8 reais”) ou pedir opinião "+
			"(“vale a pena comprar um notebook de 4 mil em 10x?”).\n\n"+
			"Ajudo com orçamento, dívidas e parcelamentos. Não recomendo investimentos específicos.")
}

// ── Endpoints autenticados (app) ────────────────────────────────────────

// POST /whatsapp/pairing-code — gera código de 6 dígitos, validade 10 min.
func (h *WhatsAppHandler) GeneratePairingCode(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	userID := middleware.GetUserID(c)

	code, err := randomCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao gerar código"})
		return
	}
	expires := time.Now().Add(10 * time.Minute)

	// Placeholder no campo phone (UNIQUE) até o número real responder.
	placeholder := "pending-" + uuid.New().String()[:12]

	var existingID string
	err = h.db.QueryRow(
		`SELECT id FROM whatsapp_links WHERE workspace_id=$1 AND verified=false LIMIT 1`,
		wsID).Scan(&existingID)

	if err == nil {
		_, err = h.db.Exec(`
			UPDATE whatsapp_links SET pairing_code=$1, code_expires=$2, updated_at=NOW()
			WHERE id=$3`, code, expires, existingID)
	} else {
		_, err = h.db.Exec(`
			INSERT INTO whatsapp_links (id, workspace_id, user_id, phone, verified, pairing_code, code_expires)
			VALUES ($1,$2,$3,$4,false,$5,$6)`,
			uuid.New().String(), wsID, userID, placeholder, code, expires)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":       code,
		"expires_at": expires,
		"instructions": "Mande a mensagem “vincular " + code + "” para o número do agente.",
	})
}

// GET /whatsapp/link — estado atual do vínculo.
func (h *WhatsAppHandler) GetLink(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var phone string
	var verified bool
	err := h.db.QueryRow(
		`SELECT phone, verified FROM whatsapp_links
		 WHERE workspace_id=$1 ORDER BY verified DESC LIMIT 1`, wsID).Scan(&phone, &verified)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"linked": false})
		return
	}
	if !verified {
		c.JSON(http.StatusOK, gin.H{"linked": false, "pending": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{"linked": true, "phone": maskPhone(phone)})
}

// DELETE /whatsapp/link — desvincula.
func (h *WhatsAppHandler) DeleteLink(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	if _, err := h.db.Exec(`DELETE FROM whatsapp_links WHERE workspace_id=$1`, wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ── Auxiliares ──────────────────────────────────────────────────────────

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// maskPhone mostra só o final: 5511•••••4321
func maskPhone(p string) string {
	if len(p) < 6 {
		return "•••"
	}
	return p[:4] + "•••••" + p[len(p)-4:]
}
