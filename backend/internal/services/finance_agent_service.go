package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// FinanceAgentService interpreta a mensagem, executa a ação e devolve o texto
// de resposta. Regra de ouro: todo número vem de SQL ou de cálculo em Go;
// o modelo de linguagem só escolhe palavras.
type FinanceAgentService struct {
	db      *sql.DB
	profile *FinanceProfileService
	ai      *AIClient
}

func NewFinanceAgentService(db *sql.DB, profile *FinanceProfileService, ai *AIClient) *FinanceAgentService {
	return &FinanceAgentService{db: db, profile: profile, ai: ai}
}

// ── Guardrail regulatório ───────────────────────────────────────────────
// A Resolução CVM 19/2021 exige autorização para recomendação individualizada
// de investimentos, e isso vale para robôs. O agente opina sobre orçamento,
// dívidas e parcelamentos — nunca sobre comprar/vender/rebalancear ativo.

const agentSystemPrompt = `Você é o agente financeiro do DSFR Finance, falando por WhatsApp.

ESCOPO PERMITIDO
- Orçamento pessoal: se cabe no mês, impacto na sobra, reserva de emergência.
- Dívidas e parcelamentos: peso das parcelas, comprometimento da renda.
- Leitura dos números que o sistema te entrega.

PROIBIDO — RESPONDA COM RECUSA
- Recomendar comprar, vender ou rebalancear qualquer ativo, fundo ou papel.
- Opinar se um investimento específico é bom, ou prever mercado, juros ou câmbio.
Nesses casos responda: "Não recomendo investimentos específicos. Mas posso te
mostrar como está seu orçamento e sua alocação atual." E siga com os números.
Você pode citar a alocação como contexto ("boa parte do seu dinheiro está travada"),
sem sugerir mudança.

COMO ESCREVER
- Português do Brasil, WhatsApp, no máximo 2 frases.
- Conclusão primeiro, depois o número que a sustenta.
- Use os números fornecidos exatamente como vieram. Nunca calcule nada por conta.
- Sem emojis além de um no início, se ajudar. Sem markdown.`

// ── Interpretação ───────────────────────────────────────────────────────

type parsedIntent struct {
	Intent      string  `json:"intent"` // expense|income|advice|balance|spent|bills|undo|help|unknown
	Amount      float64 `json:"amount"`
	Installments int    `json:"installments"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Date        string  `json:"date"`
}

var (
	// "20", "R$ 20", "20 reais", "20,50", "1.250,00"
	reAmount = regexp.MustCompile(`(?i)(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{3})+|\d+)(?:\s*(?:reais|conto|pila))?`)
	reParcel = regexp.MustCompile(`(?i)(\d{1,2})\s*x|em\s+(\d{1,2})\s*(?:vezes|parcelas)`)
	reIncome = regexp.MustCompile(`(?i)\b(recebi|ganhei|entrou|caiu|salário|salario)\b`)
	reExpense = regexp.MustCompile(`(?i)\b(comprei|paguei|gastei|torrei|custou)\b`)
	reAdvice = regexp.MustCompile(`(?i)\b(vale a pena|posso comprar|devo comprar|consigo pagar|cabe no|é uma boa|e uma boa|compensa)\b`)
)

// parseAmount converte "1.250,00" e "20" para float.
func parseAmount(s string) float64 {
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", ".")
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

// parseFast tenta resolver sem IA. Retorna nil quando não tem certeza.
func (s *FinanceAgentService) parseFast(text string) *parsedIntent {
	low := strings.ToLower(strings.TrimSpace(text))

	switch low {
	case "desfazer", "cancelar", "undo":
		return &parsedIntent{Intent: "undo"}
	case "ajuda", "help", "menu", "?":
		return &parsedIntent{Intent: "help"}
	case "saldo", "meu saldo":
		return &parsedIntent{Intent: "balance"}
	case "contas a pagar", "vencimentos", "a pagar":
		return &parsedIntent{Intent: "bills"}
	}
	if strings.Contains(low, "quanto gastei") || strings.Contains(low, "gastos do mes") ||
		strings.Contains(low, "gastos do mês") {
		return &parsedIntent{Intent: "spent"}
	}

	// Pedido de opinião precisa de análise, não do caminho rápido.
	if reAdvice.MatchString(low) {
		return nil
	}

	// Lançamento direto: precisa de verbo e valor.
	isIncome := reIncome.MatchString(low)
	isExpense := reExpense.MatchString(low)
	if !isIncome && !isExpense {
		return nil
	}
	m := reAmount.FindStringSubmatch(low)
	if m == nil {
		return nil
	}
	amount := parseAmount(m[1])
	if amount <= 0 {
		return nil
	}

	// Descrição: remove verbo, valor e conectivos.
	desc := reAmount.ReplaceAllString(low, "")
	desc = reIncome.ReplaceAllString(desc, "")
	desc = reExpense.ReplaceAllString(desc, "")
	for _, w := range []string{" de ", " no ", " na ", " em ", " um ", " uma ", " por ", " com ", "r$"} {
		desc = strings.ReplaceAll(desc, w, " ")
	}
	desc = strings.Join(strings.Fields(desc), " ")
	if desc == "" {
		desc = "Lançamento via WhatsApp"
	}

	intent := "expense"
	if isIncome {
		intent = "income"
	}
	return &parsedIntent{
		Intent:      intent,
		Amount:      amount,
		Description: strings.ToUpper(desc[:1]) + desc[1:],
		Date:        time.Now().Format("2006-01-02"),
	}
}

const parsePrompt = `Classifique a mensagem do usuário sobre finanças pessoais.
Responda SOMENTE com JSON, sem texto ao redor:
{"intent":"expense|income|advice|balance|spent|bills|undo|help|unknown",
 "amount":0,"installments":0,"description":"","category":"","date":"YYYY-MM-DD"}

- expense: registrou um gasto ("comprei um picolé de 8 reais")
- income: registrou uma entrada ("recebi 3000 de salário")
- advice: pede opinião sobre gastar/comprar ("vale a pena comprar um notebook de 4 mil em 10x")
- balance/spent/bills: consultas
- undo: quer desfazer o último
- unknown: não deu para entender
Em advice, preencha amount e installments com o que foi citado.
date padrão é hoje.`

func (s *FinanceAgentService) parse(text string) *parsedIntent {
	if fast := s.parseFast(text); fast != nil {
		return fast
	}
	if !s.ai.Enabled() {
		return &parsedIntent{Intent: "unknown"}
	}
	var out parsedIntent
	today := time.Now().Format("2006-01-02")
	if err := s.ai.CompleteJSON(parsePrompt, "Hoje é "+today+".\nMensagem: "+text, &out); err != nil {
		return &parsedIntent{Intent: "unknown"}
	}
	if out.Date == "" {
		out.Date = today
	}
	return &out
}

// ── Execução ────────────────────────────────────────────────────────────

// Handle processa a mensagem e devolve (resposta, transactionID, intent).
// O transactionID volta para permitir o DESFAZER.
func (s *FinanceAgentService) Handle(ctx context.Context, wsID, phone, text string) (string, *string, string) {
	p := s.parse(text)

	switch p.Intent {
	case "expense", "income":
		return s.createTransaction(ctx, wsID, p)
	case "advice":
		return s.advise(ctx, wsID, text, p), nil, "advice"
	case "balance":
		return s.replyBalance(ctx, wsID), nil, "balance"
	case "spent":
		return s.replySpent(ctx, wsID), nil, "spent"
	case "bills":
		return s.replyBills(ctx, wsID), nil, "bills"
	case "undo":
		return s.undo(ctx, wsID, phone), nil, "undo"
	case "help":
		return helpText(), nil, "help"
	default:
		return "Não entendi. Você pode dizer algo como “comprei um lanche de 25 reais”, " +
			"perguntar “vale a pena comprar X?”, ou mandar “ajuda”.", nil, "unknown"
	}
}

func helpText() string {
	return "Sou seu agente financeiro. Você pode:\n" +
		"• Registrar: “comprei um picolé de 8 reais”\n" +
		"• Pedir opinião: “vale a pena comprar um notebook de 4 mil em 10x?”\n" +
		"• Consultar: “saldo”, “quanto gastei esse mês”, “contas a pagar”\n" +
		"• Corrigir: “desfazer”\n\n" +
		"Ajudo com orçamento e dívidas. Não recomendo investimentos específicos."
}

// createTransaction grava o lançamento e ajusta o saldo da conta principal.
func (s *FinanceAgentService) createTransaction(ctx context.Context, wsID string, p *parsedIntent) (string, *string, string) {
	if p.Amount <= 0 {
		return "Não peguei o valor. Pode repetir com o número? Ex.: “comprei um lanche de 25 reais”.", nil, p.Intent
	}
	date := p.Date
	if _, err := time.Parse("2006-01-02", date); err != nil {
		date = time.Now().Format("2006-01-02")
	}

	// Conta padrão: a primeira ativa do workspace.
	var accountID sql.NullString
	_ = s.db.QueryRowContext(ctx,
		`SELECT id FROM accounts WHERE workspace_id=$1 AND is_active=TRUE
		 ORDER BY created_at LIMIT 1`, wsID).Scan(&accountID)

	// Categoria: reaproveita a memória do importador de OFX.
	catID := s.guessCategory(ctx, wsID, p.Description, p.Intent)

	txID := uuid.New().String()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO transactions
		  (id, workspace_id, account_id, category_id, type, amount, date, description,
		   paid, paid_at, source, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW(),'whatsapp',NOW(),NOW())`,
		txID, wsID, accountID, catID, p.Intent, p.Amount, date, p.Description)
	if err != nil {
		return "Não consegui registrar agora. Tenta de novo em instantes.", nil, p.Intent
	}

	// Lançamento de extrato/dinheiro já aconteceu, então o saldo acompanha.
	delta := p.Amount
	if p.Intent == "expense" {
		delta = -p.Amount
	}
	if accountID.Valid {
		_, _ = s.db.ExecContext(ctx,
			`UPDATE accounts SET balance = balance + $1, updated_at=NOW()
			 WHERE id=$2 AND workspace_id=$3`, delta, accountID.String, wsID)
	}

	catName := "Sem categoria"
	if catID != nil {
		_ = s.db.QueryRowContext(ctx, `SELECT name FROM categories WHERE id=$1`, *catID).Scan(&catName)
	}

	verb := "Gasto"
	if p.Intent == "income" {
		verb = "Entrada"
	}
	msg := fmt.Sprintf("✅ %s · %s · %s · %s\nResponda DESFAZER para cancelar.",
		p.Description, brl(p.Amount), catName, verb)
	return msg, &txID, p.Intent
}

// guessCategory usa o histórico já categorizado, mesma lógica do importador OFX.
func (s *FinanceAgentService) guessCategory(ctx context.Context, wsID, desc, txType string) *string {
	key := MerchantKey(desc)
	if key == "" {
		return nil
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.description, t.category_id
		FROM transactions t
		WHERE t.workspace_id=$1 AND t.category_id IS NOT NULL AND t.type=$2
		  AND t.description IS NOT NULL AND t.description <> ''
		ORDER BY t.date DESC LIMIT 2000`, wsID, txType)
	if err != nil {
		return nil
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var d, cid string
		if rows.Scan(&d, &cid) != nil {
			continue
		}
		if MerchantKey(d) == key {
			counts[cid]++
		}
	}
	best, bestN := "", 0
	for id, n := range counts {
		if n > bestN {
			best, bestN = id, n
		}
	}
	if best == "" {
		return nil
	}
	return &best
}

// undo remove o último lançamento criado por aquele telefone e reverte o saldo.
func (s *FinanceAgentService) undo(ctx context.Context, wsID, phone string) string {
	var txID string
	err := s.db.QueryRowContext(ctx, `
		SELECT transaction_id FROM whatsapp_messages
		WHERE phone=$1 AND transaction_id IS NOT NULL
		ORDER BY created_at DESC LIMIT 1`, phone).Scan(&txID)
	if err != nil || txID == "" {
		return "Não achei nenhum lançamento recente para desfazer."
	}

	var amount float64
	var txType string
	var accountID sql.NullString
	err = s.db.QueryRowContext(ctx,
		`SELECT amount, type, account_id FROM transactions WHERE id=$1 AND workspace_id=$2`,
		txID, wsID).Scan(&amount, &txType, &accountID)
	if err != nil {
		return "Esse lançamento já não existe mais."
	}

	if _, err := s.db.ExecContext(ctx,
		`DELETE FROM transactions WHERE id=$1 AND workspace_id=$2`, txID, wsID); err != nil {
		return "Não consegui desfazer agora."
	}

	// Reverte o impacto no saldo.
	if accountID.Valid {
		delta := -amount
		if txType == "expense" {
			delta = amount
		}
		_, _ = s.db.ExecContext(ctx,
			`UPDATE accounts SET balance = balance + $1, updated_at=NOW() WHERE id=$2`,
			delta, accountID.String)
	}

	// Zera o ponteiro para não desfazer duas vezes o mesmo lançamento.
	_, _ = s.db.ExecContext(ctx,
		`UPDATE whatsapp_messages SET transaction_id=NULL WHERE transaction_id=$1`, txID)

	return "↩️ Desfeito. O lançamento foi removido e o saldo voltou ao que era."
}

// advise responde "vale a pena?" — cálculo em Go, redação pela IA.
func (s *FinanceAgentService) advise(ctx context.Context, wsID, text string, p *parsedIntent) string {
	prof, err := s.profile.Build(ctx, wsID)
	if err != nil {
		return "Não consegui consultar seu perfil agora."
	}

	var simJSON []byte
	if p.Amount > 0 {
		parcelas := p.Installments
		if parcelas < 1 {
			parcelas = 1
		}
		if sim, err := s.profile.SimulatePurchase(ctx, wsID, p.Amount, parcelas); err == nil {
			simJSON, _ = json.Marshal(sim)
		}
	}
	profJSON, _ := json.Marshal(prof)

	if !s.ai.Enabled() {
		return s.adviseFallback(ctx, wsID, p)
	}

	user := fmt.Sprintf(
		"Pergunta do usuário: %s\n\nPerfil financeiro (números do sistema):\n%s\n",
		text, string(profJSON))
	if simJSON != nil {
		user += "\nSimulação da compra (já calculada, use como está):\n" + string(simJSON)
	}
	user += "\nResponda em no máximo 2 frases, começando pela conclusão."

	answer, err := s.ai.Complete(agentSystemPrompt, user, 300)
	if err != nil || answer == "" {
		return s.adviseFallback(ctx, wsID, p)
	}
	return answer
}

// adviseFallback responde sem IA, direto dos números.
func (s *FinanceAgentService) adviseFallback(ctx context.Context, wsID string, p *parsedIntent) string {
	if p.Amount <= 0 {
		return "Me diz o valor que eu avalio. Ex.: “vale a pena comprar um notebook de 4 mil em 10x?”"
	}
	parcelas := p.Installments
	if parcelas < 1 {
		parcelas = 1
	}
	sim, err := s.profile.SimulatePurchase(ctx, wsID, p.Amount, parcelas)
	if err != nil {
		return "Não consegui simular agora."
	}

	head := map[string]string{
		"confortavel": "👍 Cabe.",
		"apertado":    "⚠️ Apertado.",
		"nao_cabe":    "🚫 Não cabe.",
	}[sim.Veredito]

	return fmt.Sprintf("%s Parcela de %s consome %.0f%% da sua sobra média (%s). "+
		"Somando o que já está parcelado, o comprometimento vai a %.0f%%.",
		head, brl(sim.ValorParcela), sim.ComprometimentoSobra*100,
		brl(sim.SobraAtual), sim.ComprometimentoTotal*100)
}

// ── Consultas ───────────────────────────────────────────────────────────

func (s *FinanceAgentService) replyBalance(ctx context.Context, wsID string) string {
	prof, err := s.profile.Build(ctx, wsID)
	if err != nil {
		return "Não consegui consultar agora."
	}
	return fmt.Sprintf("💰 Saldo em contas: %s\nSobra do mês: %s\nReserva: %s (%.1f meses)",
		brl(prof.SaldoContas), brl(prof.SobraMesAtual),
		brl(prof.ReservaEmergencia), prof.MesesDeReserva)
}

func (s *FinanceAgentService) replySpent(ctx context.Context, wsID string) string {
	prof, err := s.profile.Build(ctx, wsID)
	if err != nil {
		return "Não consegui consultar agora."
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📊 Gasto no mês: %s\nEntradas: %s\nSobra: %s",
		brl(prof.GastoMesAtual), brl(prof.ReceitaMesAtual), brl(prof.SobraMesAtual)))

	if len(prof.GastoPorCategoria) > 0 {
		sb.WriteString("\n\nMaiores categorias:")
		// Top 3 por valor
		type kv struct {
			k string
			v float64
		}
		list := make([]kv, 0, len(prof.GastoPorCategoria))
		for k, v := range prof.GastoPorCategoria {
			list = append(list, kv{k, v})
		}
		for i := 0; i < len(list); i++ {
			for j := i + 1; j < len(list); j++ {
				if list[j].v > list[i].v {
					list[i], list[j] = list[j], list[i]
				}
			}
		}
		for i, e := range list {
			if i == 3 {
				break
			}
			sb.WriteString(fmt.Sprintf("\n• %s: %s", e.k, brl(e.v)))
		}
	}
	return sb.String()
}

func (s *FinanceAgentService) replyBills(ctx context.Context, wsID string) string {
	rows, err := s.db.QueryContext(ctx, `
		SELECT description, amount, TO_CHAR(date,'DD/MM')
		FROM transactions
		WHERE workspace_id=$1 AND type='expense' AND paid=false
		  AND COALESCE(ignored,false)=false
		  AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
		ORDER BY date LIMIT 10`, wsID)
	if err != nil {
		return "Não consegui consultar agora."
	}
	defer rows.Close()

	var sb strings.Builder
	var total float64
	n := 0
	for rows.Next() {
		var desc string
		var amt float64
		var d string
		if rows.Scan(&desc, &amt, &d) != nil {
			continue
		}
		sb.WriteString(fmt.Sprintf("\n• %s — %s (%s)", d, brl(amt), desc))
		total += amt
		n++
	}
	if n == 0 {
		return "🎉 Nada vencendo nos próximos 7 dias."
	}
	return fmt.Sprintf("📅 Próximos 7 dias: %s%s", brl(total), sb.String())
}

// brl formata no padrão brasileiro: R$ 1.234,56
func brl(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	s := strconv.FormatFloat(v, 'f', 2, 64)
	parts := strings.SplitN(s, ".", 2)
	intPart, dec := parts[0], parts[1]

	var out []byte
	for i, c := range []byte(intPart) {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, c)
	}
	res := "R$ " + string(out) + "," + dec
	if neg {
		res = "-" + res
	}
	return res
}
