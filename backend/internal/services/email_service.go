package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EmailService sends transactional emails through the Resend API.
type EmailService struct {
	apiKey string
	from   string
	client *http.Client
}

func NewEmailService(apiKey, from string) *EmailService {
	return &EmailService{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// Enabled reports whether an API key is configured.
func (s *EmailService) Enabled() bool { return s.apiKey != "" }

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// Send delivers an HTML email via Resend. Returns an error on non-2xx responses.
func (s *EmailService) Send(to, subject, html string) error {
	if !s.Enabled() {
		return fmt.Errorf("email service not configured")
	}

	body, _ := json.Marshal(resendPayload{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	})

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend error %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// PasswordResetHTML builds the reset email body.
func PasswordResetHTML(name, resetURL string) string {
	if name == "" {
		name = "Olá"
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
        <tr><td style="background:#2e7736;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.03em;">DSFR</span>
          <span style="color:#e2e8f5;font-size:20px;"> finance</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#1a2035;">Redefinição de senha</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5a6a83;">
            %s, recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:8px;background:#2e7736;">
              <a href="%s" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                Redefinir senha
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#8393ad;">
            Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
          </p>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#8393ad;word-break:break-all;">
            Se o botão não funcionar, copie e cole este endereço no navegador:<br>
            <a href="%s" style="color:#2e7736;">%s</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f4f6fb;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#8393ad;">DSFR Finance — gestão financeira pessoal</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, name, resetURL, resetURL, resetURL)
}
