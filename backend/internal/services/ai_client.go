package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AIClient é um wrapper mínimo sobre a Messages API da Anthropic.
// Serve só para interpretar frases e redigir respostas curtas — nenhum
// cálculo financeiro passa por aqui.
type AIClient struct {
	apiKey string
	model  string
	client *http.Client
}

func NewAIClient(apiKey, model string) *AIClient {
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}
	return &AIClient{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 25 * time.Second},
	}
}

func (a *AIClient) Enabled() bool { return a.apiKey != "" }

type aiResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Complete manda system + user e devolve o texto da resposta.
func (a *AIClient) Complete(system, user string, maxTokens int) (string, error) {
	if !a.Enabled() {
		return "", fmt.Errorf("IA não configurada")
	}
	if maxTokens <= 0 {
		maxTokens = 400
	}

	payload := map[string]any{
		"model":      a.model,
		"max_tokens": maxTokens,
		"system":     system,
		"messages": []map[string]any{
			{"role": "user", "content": user},
		},
	}
	buf, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("ia %d: %s", resp.StatusCode, string(raw))
	}

	var out aiResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	if out.Error != nil {
		return "", fmt.Errorf("ia: %s", out.Error.Message)
	}

	var sb strings.Builder
	for _, c := range out.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	return strings.TrimSpace(sb.String()), nil
}

// CompleteJSON pede uma resposta em JSON e devolve só o objeto, tolerando
// que o modelo embrulhe em ```json.
func (a *AIClient) CompleteJSON(system, user string, target any) error {
	txt, err := a.Complete(system, user, 500)
	if err != nil {
		return err
	}
	txt = strings.TrimSpace(txt)
	if i := strings.Index(txt, "{"); i >= 0 {
		if j := strings.LastIndex(txt, "}"); j > i {
			txt = txt[i : j+1]
		}
	}
	return json.Unmarshal([]byte(txt), target)
}
