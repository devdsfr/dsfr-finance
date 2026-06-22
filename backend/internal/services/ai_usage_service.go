package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/crypto"
	"github.com/dsfr/finance/internal/models"
)

// AIUsageService handles encryption of stored API keys and best-effort
// synchronization of usage/cost data from AI provider APIs (OpenAI, Anthropic).
// Providers that don't expose a usage API (or whose key lacks admin scope)
// fall back gracefully — the caller can then register usage manually.
type AIUsageService struct {
	enc *crypto.Encryptor
}

func NewAIUsageService(encryptionKey string) (*AIUsageService, error) {
	enc, err := crypto.New(encryptionKey)
	if err != nil {
		return nil, err
	}
	return &AIUsageService{enc: enc}, nil
}

func (s *AIUsageService) EncryptKey(plain string) (string, error)  { return s.enc.Encrypt(plain) }
func (s *AIUsageService) DecryptKey(enc string) (string, error)    { return s.enc.Decrypt(enc) }
func (s *AIUsageService) MaskKey(plain string) string              { return crypto.Mask(plain) }

// CurrentPeriod returns the YYYY-MM string for the current month.
func CurrentPeriod() string { return time.Now().Format("2006-01") }

// SyncUsage dispatches to the right provider client. Returns a usage snapshot
// (source=api) or an error explaining why automatic sync isn't possible.
func (s *AIUsageService) SyncUsage(provider, apiKey string) (*models.AIUsageSnapshot, error) {
	switch provider {
	case "openai":
		return s.syncOpenAI(apiKey)
	case "anthropic":
		return s.syncAnthropic(apiKey)
	default:
		return nil, fmt.Errorf("sincronização automática não disponível para este provedor — informe o uso manualmente")
	}
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
// Uses the Costs API (requires an Admin API key, scope api.usage.read).
// https://api.openai.com/v1/organization/costs
func (s *AIUsageService) syncOpenAI(apiKey string) (*models.AIUsageSnapshot, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	url := fmt.Sprintf("https://api.openai.com/v1/organization/costs?start_time=%d&bucket_width=1d&limit=31", startOfMonth.Unix())

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao conectar à OpenAI: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("a API key não tem permissão de leitura de uso (use uma Admin API Key da OpenAI) ou expirou")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI respondeu com status %d", resp.StatusCode)
	}

	var parsed struct {
		Data []struct {
			Results []struct {
				Amount struct {
					Value float64 `json:"value"`
				} `json:"amount"`
				NumRequests int `json:"num_model_requests"`
			} `json:"results"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("resposta inesperada da OpenAI: %w", err)
	}

	var totalCost float64
	var totalRequests int
	for _, bucket := range parsed.Data {
		for _, r := range bucket.Results {
			totalCost += r.Amount.Value
			totalRequests += r.NumRequests
		}
	}

	return &models.AIUsageSnapshot{
		Period:        CurrentPeriod(),
		RequestsCount: totalRequests,
		CostUSD:       totalCost,
		Source:        "api",
		SyncedAt:      time.Now(),
	}, nil
}

// ── Anthropic ────────────────────────────────────────────────────────────────
// Uses the Admin usage report API (requires an Admin API key, sk-ant-admin...).
// https://api.anthropic.com/v1/organization/usage_report/messages
func (s *AIUsageService) syncAnthropic(apiKey string) (*models.AIUsageSnapshot, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	url := fmt.Sprintf(
		"https://api.anthropic.com/v1/organization/usage_report/messages?starting_at=%s&bucket_width=1d",
		startOfMonth.Format("2006-01-02T15:04:05Z"),
	)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao conectar à Anthropic: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("a API key não tem permissão de leitura de uso (use uma Admin API Key da Anthropic) ou expirou")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Anthropic respondeu com status %d", resp.StatusCode)
	}

	var parsed struct {
		Data []struct {
			Results []struct {
				Uncached struct {
					InputTokens  int64 `json:"input_tokens"`
					OutputTokens int64 `json:"output_tokens"`
				} `json:"uncached_input_tokens"`
				OutputTokens int64 `json:"output_tokens"`
			} `json:"results"`
		} `json:"data"`
	}
	_ = json.Unmarshal(body, &parsed) // best-effort; shape varies by API version

	var totalTokens int64
	var totalRequests int
	for _, bucket := range parsed.Data {
		totalRequests += len(bucket.Results)
		for _, r := range bucket.Results {
			totalTokens += r.OutputTokens
		}
	}

	return &models.AIUsageSnapshot{
		Period:        CurrentPeriod(),
		RequestsCount: totalRequests,
		TokensUsed:    totalTokens,
		Source:        "api",
		SyncedAt:      time.Now(),
	}, nil
}

// ComputeRecommendation produces a human-readable verdict on whether the
// subscription is worth keeping, based on this month's usage vs. its cost.
func ComputeRecommendation(monthlyCost float64, usage *models.AIUsageSnapshot) *models.AIRecommendation {
	if usage == nil || (usage.RequestsCount == 0 && usage.CostUSD == 0 && usage.TokensUsed == 0) {
		if monthlyCost <= 0 {
			return &models.AIRecommendation{Label: "Sem dados", Score: "unknown", Message: "Cadastre o custo mensal e sincronize ou informe o uso para receber uma recomendação."}
		}
		return &models.AIRecommendation{
			Label: "Cancelar", Score: "bad",
			Message: "Nenhum uso registrado este mês. Provavelmente não compensa manter esta assinatura.",
		}
	}

	uses := usage.RequestsCount
	if uses == 0 {
		uses = 1
	}
	costPerUse := monthlyCost / float64(uses)

	switch {
	case usage.RequestsCount > 0 && usage.RequestsCount < 5:
		return &models.AIRecommendation{
			Label: "Baixo uso", Score: "warning", CostPerUse: costPerUse,
			Message: fmt.Sprintf("Apenas %d uso(s) este mês — R$ %.2f por uso. Considere cancelar ou trocar para um plano menor.", usage.RequestsCount, costPerUse),
		}
	case costPerUse > 5:
		return &models.AIRecommendation{
			Label: "Baixo uso", Score: "warning", CostPerUse: costPerUse,
			Message: fmt.Sprintf("Custo de R$ %.2f por uso está alto em relação ao volume. Avalie se compensa manter.", costPerUse),
		}
	default:
		return &models.AIRecommendation{
			Label: "Compensa manter", Score: "good", CostPerUse: costPerUse,
			Message: "Uso saudável em relação ao custo da assinatura.",
		}
	}
}
