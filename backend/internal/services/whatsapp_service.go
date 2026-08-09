package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WhatsAppService fala com a Cloud API da Meta.
type WhatsAppService struct {
	token     string
	phoneID   string
	appSecret string
	client    *http.Client
}

func NewWhatsAppService(token, phoneID, appSecret string) *WhatsAppService {
	return &WhatsAppService{
		token:     token,
		phoneID:   phoneID,
		appSecret: appSecret,
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *WhatsAppService) Enabled() bool { return s.token != "" && s.phoneID != "" }

// ValidateSignature confere o header X-Hub-Signature-256 contra o corpo bruto.
// Sem isso, qualquer um que descubra a URL consegue injetar lançamentos.
func (s *WhatsAppService) ValidateSignature(body []byte, header string) bool {
	if s.appSecret == "" {
		return false // sem segredo configurado, nada é aceito
	}
	header = strings.TrimPrefix(header, "sha256=")
	if header == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.appSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	// Comparação em tempo constante evita vazar o segredo por timing.
	return hmac.Equal([]byte(expected), []byte(header))
}

// SendText envia uma mensagem de texto simples.
func (s *WhatsAppService) SendText(to, body string) error {
	if !s.Enabled() {
		return fmt.Errorf("whatsapp não configurado")
	}
	payload := map[string]any{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text":              map[string]any{"body": body},
	}
	buf, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://graph.facebook.com/v21.0/%s/messages", s.phoneID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("whatsapp api %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
