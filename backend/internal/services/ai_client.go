package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// AIClient fala com um provedor de LLM. Suporta dois formatos de API:
//
//   - Anthropic (padrão quando AI_BASE_URL está vazio)
//   - OpenAI-compatível — cobre Groq, OpenRouter, DeepSeek, NVIDIA NIM,
//     Together, Cerebras, SiliconFlow e afins, que usam o mesmo contrato
//
// Trocar de provedor é só mudar AI_BASE_URL, AI_MODEL e AI_API_KEY.
// Serve apenas para interpretar frases e redigir respostas: nenhum cálculo
// financeiro passa por aqui.
// aiProvider é um destino configurado (chave + modelo + endpoint).
type aiProvider struct {
	name    string
	apiKey  string
	model   string
	baseURL string // vazio = Anthropic
}

type AIClient struct {
	providers []aiProvider
	client    *http.Client
}

func NewAIClient(apiKey, model, baseURL string) *AIClient {
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}
	c := &AIClient{client: &http.Client{Timeout: 45 * time.Second}}
	if apiKey != "" {
		c.providers = append(c.providers, aiProvider{
			name:    "principal",
			apiKey:  apiKey,
			model:   model,
			baseURL: strings.TrimRight(baseURL, "/"),
		})
	}
	return c
}

// WithFallback adiciona um provedor reserva. Os free tiers têm teto diário
// baixo — o do OpenRouter é 50 requisições/dia — então um segundo destino
// evita o agente parar de responder no meio do dia.
func (a *AIClient) WithFallback(apiKey, model, baseURL string) *AIClient {
	if apiKey != "" {
		a.providers = append(a.providers, aiProvider{
			name:    "reserva",
			apiKey:  apiKey,
			model:   model,
			baseURL: strings.TrimRight(baseURL, "/"),
		})
	}
	return a
}

func (a *AIClient) Enabled() bool { return len(a.providers) > 0 }

// Complete tenta cada provedor na ordem até um responder.
func (a *AIClient) Complete(system, user string, maxTokens int) (string, error) {
	if !a.Enabled() {
		return "", fmt.Errorf("IA não configurada")
	}
	if maxTokens <= 0 {
		maxTokens = 400
	}

	var lastErr error
	for _, p := range a.providers {
		var txt string
		var err error
		if p.baseURL != "" {
			txt, err = a.completeOpenAI(p, system, user, maxTokens)
		} else {
			txt, err = a.completeAnthropic(p, system, user, maxTokens)
		}
		if err == nil && txt != "" {
			return txt, nil
		}
		if err != nil {
			log.Printf("ia: provedor %s falhou: %v", p.name, err)
			lastErr = err
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("resposta vazia")
	}
	return "", lastErr
}

// ── Anthropic ───────────────────────────────────────────────────────────

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (a *AIClient) completeAnthropic(p aiProvider, system, user string, maxTokens int) (string, error) {
	payload := map[string]any{
		"model":      p.model,
		"max_tokens": maxTokens,
		"system":     system,
		"messages":   []map[string]any{{"role": "user", "content": user}},
	}
	buf, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", p.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	raw, err := a.do(req)
	if err != nil {
		return "", err
	}

	var out anthropicResponse
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

// ── OpenAI-compatível (Groq, OpenRouter, DeepSeek, NVIDIA NIM…) ─────────

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (a *AIClient) completeOpenAI(p aiProvider, system, user string, maxTokens int) (string, error) {
	payload := map[string]any{
		"model":      p.model,
		"max_tokens": maxTokens,
		"messages": []map[string]any{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
	}
	buf, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	// O OpenRouter pede estes cabeçalhos; os demais provedores ignoram.
	req.Header.Set("HTTP-Referer", "https://dsfr-finance.app")
	req.Header.Set("X-Title", "DSFR Finance")

	raw, err := a.do(req)
	if err != nil {
		return "", err
	}

	var out openAIResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	if out.Error != nil {
		return "", fmt.Errorf("ia: %s", out.Error.Message)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("ia: resposta vazia")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}

// ── Comum ───────────────────────────────────────────────────────────────

func (a *AIClient) do(req *http.Request) ([]byte, error) {
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		msg := string(raw)
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return nil, fmt.Errorf("ia %d: %s", resp.StatusCode, msg)
	}
	return raw, nil
}

// CompleteJSON pede uma resposta em JSON e devolve só o objeto, tolerando
// que o modelo embrulhe em ```json — comum nos modelos abertos.
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
