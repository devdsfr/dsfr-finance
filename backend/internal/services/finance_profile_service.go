package services

import (
	"context"
	"database/sql"
	"math"
	"time"
)

// FinanceProfileService monta o retrato financeiro agregado do workspace e
// executa as simulações. Tudo aqui é aritmética em Go — o modelo de linguagem
// apenas verbaliza o resultado, nunca calcula.
type FinanceProfileService struct{ db *sql.DB }

func NewFinanceProfileService(db *sql.DB) *FinanceProfileService {
	return &FinanceProfileService{db: db}
}

// FinanceProfile é o bloco enviado ao modelo. Propositalmente agregado:
// sem descrição de lançamento e sem nome de estabelecimento, para não
// entregar hábitos de consumo ao provedor do modelo.
type FinanceProfile struct {
	SobraMesAtual     float64            `json:"sobra_mes_atual"`
	SobraMediaMensal  float64            `json:"sobra_media_mensal"`
	ReservaEmergencia float64            `json:"reserva_emergencia"`
	MesesDeReserva    float64            `json:"meses_de_reserva"`
	SaldoContas       float64            `json:"saldo_contas"`
	ParcelasMensais   float64            `json:"parcelas_mensais"`
	ParcelasAte       string             `json:"parcelas_ate,omitempty"`
	DividasTotal      float64            `json:"dividas_total"`
	FaturasAbertas    float64            `json:"faturas_abertas"`
	ContasAPagar7Dias float64            `json:"contas_a_pagar_7_dias"`
	GastoMesAtual     float64            `json:"gasto_mes_atual"`
	ReceitaMesAtual   float64            `json:"receita_mes_atual"`
	GastoPorCategoria map[string]float64 `json:"gasto_por_categoria,omitempty"`
	Alocacao          map[string]float64 `json:"alocacao,omitempty"`
	PatrimonioTotal   float64            `json:"patrimonio_total"`
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// Build monta o perfil consolidado do workspace.
func (s *FinanceProfileService) Build(ctx context.Context, wsID string) (*FinanceProfile, error) {
	p := &FinanceProfile{
		GastoPorCategoria: map[string]float64{},
		Alocacao:          map[string]float64{},
	}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	monthEnd := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")

	// Saldo das contas ativas
	_ = s.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(balance),0) FROM accounts
		 WHERE workspace_id=$1 AND is_active = TRUE`, wsID).Scan(&p.SaldoContas)

	// Receita e despesa do mês corrente
	_ = s.db.QueryRowContext(ctx, `
		SELECT
		  COALESCE(SUM(amount) FILTER (WHERE type='income'),0),
		  COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)
		FROM transactions
		WHERE workspace_id=$1 AND date BETWEEN $2 AND $3 AND COALESCE(ignored,false)=false`,
		wsID, monthStart, monthEnd).Scan(&p.ReceitaMesAtual, &p.GastoMesAtual)
	p.SobraMesAtual = round2(p.ReceitaMesAtual - p.GastoMesAtual)

	// Sobra média dos últimos 6 meses fechados — base mais estável que o mês corrente
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(AVG(saldo),0) FROM (
		  SELECT date_trunc('month', date) AS m,
		         SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS saldo
		  FROM transactions
		  WHERE workspace_id=$1
		    AND COALESCE(ignored,false)=false
		    AND date >= date_trunc('month', CURRENT_DATE) - interval '6 months'
		    AND date <  date_trunc('month', CURRENT_DATE)
		  GROUP BY m
		) t`, wsID).Scan(&p.SobraMediaMensal)

	// Reserva de emergência: snapshots são histórico mensal por carteira,
	// então só vale o mês mais recente de cada uma — somar tudo inflaria.
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(emergency_reserve),0) FROM (
		  SELECT DISTINCT ON (wallet_name) emergency_reserve
		  FROM patrimony_snapshots
		  WHERE workspace_id=$1
		  ORDER BY wallet_name, month DESC
		) t`, wsID).Scan(&p.ReservaEmergencia)

	// Quantos meses a reserva cobre, usando o gasto médio mensal
	var gastoMedio float64
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(AVG(total),0) FROM (
		  SELECT date_trunc('month', date) AS m, SUM(amount) AS total
		  FROM transactions
		  WHERE workspace_id=$1 AND type='expense' AND COALESCE(ignored,false)=false
		    AND date >= date_trunc('month', CURRENT_DATE) - interval '6 months'
		    AND date <  date_trunc('month', CURRENT_DATE)
		  GROUP BY m
		) t`, wsID).Scan(&gastoMedio)
	if gastoMedio > 0 {
		p.MesesDeReserva = round2(p.ReservaEmergencia / gastoMedio)
	}

	// Parcelamentos em aberto: quanto pesa por mês e até quando
	var parcelasAte sql.NullString
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount),0), TO_CHAR(MAX(date),'YYYY-MM')
		FROM transactions
		WHERE workspace_id=$1 AND type='expense' AND paid=false
		  AND COALESCE(ignored,false)=false
		  AND installment_group_id IS NOT NULL
		  AND date >= date_trunc('month', CURRENT_DATE)
		  AND date <  date_trunc('month', CURRENT_DATE) + interval '1 month'`,
		wsID).Scan(&p.ParcelasMensais, &parcelasAte)
	_ = s.db.QueryRowContext(ctx, `
		SELECT TO_CHAR(MAX(date),'YYYY-MM') FROM transactions
		WHERE workspace_id=$1 AND paid=false AND installment_group_id IS NOT NULL`,
		wsID).Scan(&parcelasAte)
	if parcelasAte.Valid {
		p.ParcelasAte = parcelasAte.String
	}

	// Dívidas cadastradas
	_ = s.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(remaining_balance),0) FROM debts WHERE workspace_id=$1`,
		wsID).Scan(&p.DividasTotal)

	// Faturas de cartão em aberto
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount),0) FROM transactions
		WHERE workspace_id=$1 AND credit_card_id IS NOT NULL
		  AND type='expense' AND paid=false AND COALESCE(ignored,false)=false`,
		wsID).Scan(&p.FaturasAbertas)

	// Contas a pagar nos próximos 7 dias
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount),0) FROM transactions
		WHERE workspace_id=$1 AND type='expense' AND paid=false
		  AND COALESCE(ignored,false)=false
		  AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'`,
		wsID).Scan(&p.ContasAPagar7Dias)

	// Gasto por categoria no mês (top 8)
	rows, err := s.db.QueryContext(ctx, `
		SELECT COALESCE(c.name,'Sem categoria'), SUM(t.amount) AS total
		FROM transactions t
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.workspace_id=$1 AND t.type='expense'
		  AND COALESCE(t.ignored,false)=false
		  AND t.date BETWEEN $2 AND $3
		GROUP BY 1 ORDER BY total DESC LIMIT 8`, wsID, monthStart, monthEnd)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var total float64
			if rows.Scan(&name, &total) == nil {
				p.GastoPorCategoria[name] = round2(total)
			}
		}
	}

	// Alocação por carteira, usando o snapshot mais recente de cada uma.
	// Enviamos proporção, não valor absoluto, para o modelo ter contexto
	// sem receber o tamanho exato do patrimônio.
	arows, err := s.db.QueryContext(ctx, `
		SELECT wallet_name, total FROM (
		  SELECT DISTINCT ON (wallet_name) wallet_name, total
		  FROM patrimony_snapshots
		  WHERE workspace_id=$1
		  ORDER BY wallet_name, month DESC
		) t`, wsID)
	if err == nil {
		defer arows.Close()
		totals := map[string]float64{}
		var grand float64
		for arows.Next() {
			var name string
			var v float64
			if arows.Scan(&name, &v) == nil {
				totals[name] = v
				grand += v
			}
		}
		p.PatrimonioTotal = round2(grand)
		if grand > 0 {
			for k, v := range totals {
				p.Alocacao[k] = round2(v / grand)
			}
		}
	}

	p.SobraMediaMensal = round2(p.SobraMediaMensal)
	p.ReservaEmergencia = round2(p.ReservaEmergencia)
	p.GastoMesAtual = round2(p.GastoMesAtual)
	p.ReceitaMesAtual = round2(p.ReceitaMesAtual)
	return p, nil
}

// ── Simulação de compra ────────────────────────────────────────────────
// Esta é a ferramenta central do agente. O cálculo precisa ser exato e
// auditável, então roda aqui — nunca no modelo.

type PurchaseSimulation struct {
	Valor                 float64 `json:"valor"`
	Parcelas              int     `json:"parcelas"`
	ValorParcela          float64 `json:"valor_parcela"`
	SobraAtual            float64 `json:"sobra_media_mensal"`
	SobraAposCompra       float64 `json:"sobra_apos_compra"`
	ComprometimentoSobra  float64 `json:"comprometimento_da_sobra"` // 0..1
	ParcelasJaAssumidas   float64 `json:"parcelas_ja_assumidas"`
	ComprometimentoTotal  float64 `json:"comprometimento_total"` // já assumidas + nova
	MesesDeReserva        float64 `json:"meses_de_reserva"`
	CabeNaSobra           bool    `json:"cabe_na_sobra"`
	ReservaAbaixoDeTresMeses bool `json:"reserva_abaixo_de_tres_meses"`
	Veredito              string  `json:"veredito"` // "confortavel" | "apertado" | "nao_cabe"
}

// SimulatePurchase avalia o impacto de uma compra na folga mensal.
func (s *FinanceProfileService) SimulatePurchase(ctx context.Context, wsID string, valor float64, parcelas int) (*PurchaseSimulation, error) {
	if parcelas < 1 {
		parcelas = 1
	}
	p, err := s.Build(ctx, wsID)
	if err != nil {
		return nil, err
	}

	sim := &PurchaseSimulation{
		Valor:               round2(valor),
		Parcelas:            parcelas,
		ValorParcela:        round2(valor / float64(parcelas)),
		SobraAtual:          p.SobraMediaMensal,
		ParcelasJaAssumidas: round2(p.ParcelasMensais),
		MesesDeReserva:      p.MesesDeReserva,
	}
	sim.SobraAposCompra = round2(p.SobraMediaMensal - sim.ValorParcela)

	if p.SobraMediaMensal > 0 {
		sim.ComprometimentoSobra = round2(sim.ValorParcela / p.SobraMediaMensal)
		sim.ComprometimentoTotal = round2((sim.ValorParcela + p.ParcelasMensais) / p.SobraMediaMensal)
	} else {
		// Sem sobra média não há folga: qualquer parcela compromete tudo.
		sim.ComprometimentoSobra = 1
		sim.ComprometimentoTotal = 1
	}

	sim.CabeNaSobra = sim.SobraAposCompra > 0
	sim.ReservaAbaixoDeTresMeses = p.MesesDeReserva < 3

	switch {
	case !sim.CabeNaSobra || sim.ComprometimentoTotal > 1:
		sim.Veredito = "nao_cabe"
	case sim.ComprometimentoTotal > 0.5 || sim.ReservaAbaixoDeTresMeses:
		sim.Veredito = "apertado"
	default:
		sim.Veredito = "confortavel"
	}
	return sim, nil
}
