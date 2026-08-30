package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

// BuildMarkdown monta um retrato completo da situação financeira em Markdown,
// pensado para ser colado em outra IA como contexto.
//
// Propositalmente sem dado identificável: nada de nome, e-mail, número de conta
// ou descrição de lançamento individual. São agregados e posições — o suficiente
// para uma análise, sem entregar o extrato inteiro a um terceiro.
func (s *FinanceProfileService) BuildMarkdown(ctx context.Context, wsID string) (string, error) {
	p, err := s.Build(ctx, wsID)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	now := time.Now()

	b.WriteString("# Contexto financeiro\n\n")
	b.WriteString(fmt.Sprintf("Gerado em %s pelo DSFR Finance.\n\n", now.Format("02/01/2006")))
	b.WriteString("> Este arquivo resume a situação financeira para servir de contexto a um assistente.\n")
	b.WriteString("> Contém apenas valores agregados — sem nomes, contas ou lançamentos individuais.\n\n")

	// ── Resumo ──
	b.WriteString("## Resumo do mês\n\n")
	b.WriteString("| Indicador | Valor |\n|---|---|\n")
	b.WriteString(fmt.Sprintf("| Saldo em contas | %s |\n", brl(p.SaldoContas)))
	b.WriteString(fmt.Sprintf("| Receitas do mês | %s |\n", brl(p.ReceitaMesAtual)))
	b.WriteString(fmt.Sprintf("| Despesas do mês | %s |\n", brl(p.GastoMesAtual)))
	b.WriteString(fmt.Sprintf("| Sobra do mês | %s |\n", brl(p.SobraMesAtual)))
	b.WriteString(fmt.Sprintf("| Sobra média (6 meses) | %s |\n", brl(p.SobraMediaMensal)))
	b.WriteString("\n")

	// ── Reserva ──
	b.WriteString("## Reserva de emergência\n\n")
	b.WriteString(fmt.Sprintf("- Valor reservado: **%s**\n", brl(p.ReservaEmergencia)))
	b.WriteString(fmt.Sprintf("- Cobertura estimada: **%.1f meses** de despesa\n", p.MesesDeReserva))
	switch {
	case p.MesesDeReserva >= 6:
		b.WriteString("- Situação: confortável (6 meses ou mais)\n")
	case p.MesesDeReserva >= 3:
		b.WriteString("- Situação: intermediária (entre 3 e 6 meses)\n")
	default:
		b.WriteString("- Situação: abaixo do recomendado (menos de 3 meses)\n")
	}
	b.WriteString("\n")

	// ── Compromissos ──
	b.WriteString("## Compromissos e dívidas\n\n")
	b.WriteString("| Item | Valor |\n|---|---|\n")
	b.WriteString(fmt.Sprintf("| Parcelamentos no mês | %s |\n", brl(p.ParcelasMensais)))
	if p.ParcelasAte != "" {
		b.WriteString(fmt.Sprintf("| Última parcela em | %s |\n", p.ParcelasAte))
	}
	b.WriteString(fmt.Sprintf("| Dívidas (saldo devedor) | %s |\n", brl(p.DividasTotal)))
	b.WriteString(fmt.Sprintf("| Faturas de cartão em aberto | %s |\n", brl(p.FaturasAbertas)))
	b.WriteString(fmt.Sprintf("| A pagar nos próximos 7 dias | %s |\n", brl(p.ContasAPagar7Dias)))

	if p.SobraMediaMensal > 0 {
		pct := p.ParcelasMensais / p.SobraMediaMensal * 100
		b.WriteString(fmt.Sprintf("\nOs parcelamentos consomem **%.0f%%** da sobra média mensal.\n", pct))
	}
	b.WriteString("\n")

	// ── Gastos por categoria ──
	if len(p.GastoPorCategoria) > 0 {
		b.WriteString("## Gastos do mês por categoria\n\n")
		b.WriteString("| Categoria | Valor | % do total |\n|---|---|---|\n")

		type kv struct {
			k string
			v float64
		}
		list := make([]kv, 0, len(p.GastoPorCategoria))
		for k, v := range p.GastoPorCategoria {
			list = append(list, kv{k, v})
		}
		sort.Slice(list, func(i, j int) bool { return list[i].v > list[j].v })

		for _, e := range list {
			pct := 0.0
			if p.GastoMesAtual > 0 {
				pct = e.v / p.GastoMesAtual * 100
			}
			b.WriteString(fmt.Sprintf("| %s | %s | %.0f%% |\n", e.k, brl(e.v), pct))
		}
		b.WriteString("\n")
	}

	// ── Patrimônio ──
	b.WriteString("## Patrimônio\n\n")
	b.WriteString(fmt.Sprintf("- Investimentos: **%s**\n", brl(p.PatrimonioTotal)))
	if len(p.Alocacao) > 0 {
		b.WriteString("- Distribuição por carteira:\n")
		for k, v := range p.Alocacao {
			b.WriteString(fmt.Sprintf("  - %s: %.0f%%\n", k, v*100))
		}
	}

	// Bens físicos, se houver
	rows, err := s.db.QueryContext(ctx, `
		SELECT type, name, purchase_value, market_value, is_financed,
		       installment_count, installment_value, credit_letter_value, is_awarded,
		       COALESCE((SELECT COUNT(*) FROM transactions t
		                 WHERE t.asset_id = a.id AND t.paid),0) AS pagas
		FROM assets a
		WHERE a.workspace_id = $1 AND a.archived = FALSE
		ORDER BY a.created_at`, wsID)
	if err == nil {
		defer rows.Close()
		var lines []string
		var totalBens float64
		for rows.Next() {
			var typ, name string
			var purchase, market, instValue, letter float64
			var financed, awarded bool
			var instCount, pagas int
			if rows.Scan(&typ, &name, &purchase, &market, &financed,
				&instCount, &instValue, &letter, &awarded, &pagas) != nil {
				continue
			}
			totalBens += market
			line := fmt.Sprintf("  - **%s** (%s): vale %s", name, typ, brl(market))
			if typ == "consorcio" {
				status := "aguardando contemplação"
				if awarded {
					status = "contemplado"
				}
				line = fmt.Sprintf("  - **%s** (consórcio, %s): carta de %s, pago %s",
					name, status, brl(letter), brl(market))
			}
			if financed && instCount > 0 {
				line += fmt.Sprintf(" — %d/%d parcelas pagas de %s", pagas, instCount, brl(instValue))
			}
			lines = append(lines, line)
		}
		if len(lines) > 0 {
			b.WriteString(fmt.Sprintf("- Bens e propriedades: **%s**\n", brl(totalBens)))
			b.WriteString(strings.Join(lines, "\n"))
			b.WriteString("\n")
		}
	}
	b.WriteString("\n")

	// ── Orientação para a IA que vai ler ──
	b.WriteString("## Como usar este contexto\n\n")
	b.WriteString("Ao analisar, considere que:\n\n")
	b.WriteString("- A **sobra média mensal** é a melhor base para avaliar se uma nova despesa cabe, ")
	b.WriteString("porque o mês corrente pode estar incompleto.\n")
	b.WriteString("- Parcelamentos já assumidos comprometem a sobra futura, mesmo sem aparecer no gasto do mês.\n")
	b.WriteString("- Bens como lotes e terrenos são **ilíquidos**: não servem como reserva de emergência.\n")
	b.WriteString("- Consórcio não contemplado é um direito, não um bem disponível.\n\n")
	b.WriteString("Análises de orçamento, dívidas e planejamento são bem-vindas. ")
	b.WriteString("Recomendação de compra ou venda de ativos específicos é atividade regulada no Brasil ")
	b.WriteString("(Resolução CVM 19) e deve ser evitada.\n")

	return b.String(), nil
}
