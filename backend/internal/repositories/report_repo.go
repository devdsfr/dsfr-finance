package repositories

import (
	"database/sql"
	"fmt"

	"github.com/dsfr/finance/internal/models"
)

type ReportRepository struct {
	db *sql.DB
}

func NewReportRepository(db *sql.DB) *ReportRepository {
	return &ReportRepository{db: db}
}

// MonthlyFlow returns income/expense/net per month (AC-RL-19, AC-RL-22)
func (r *ReportRepository) MonthlyFlow(workspaceID, from, to string) ([]models.MonthlyBalance, error) {
	q := `
		SELECT TO_CHAR(date, 'YYYY-MM') AS month,
		       COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) AS income,
		       COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense
		FROM transactions
		WHERE workspace_id=$1 AND ignored=false AND date BETWEEN $2 AND $3
		GROUP BY month ORDER BY month`
	rows, err := r.db.Query(q, workspaceID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.MonthlyBalance
	for rows.Next() {
		var m models.MonthlyBalance
		if err := rows.Scan(&m.Month, &m.Income, &m.Expense); err != nil {
			return nil, err
		}
		m.Net = m.Income - m.Expense
		result = append(result, m)
	}
	return result, nil
}

// PatrimonyEvolution computes net worth per month (AC-RL-22)
func (r *ReportRepository) PatrimonyEvolution(workspaceID, from, to string) ([]models.PatrimonyPoint, error) {
	months, err := r.MonthlyFlow(workspaceID, from, to)
	if err != nil {
		return nil, err
	}
	var acc float64
	// get initial balance from accounts
	_ = r.db.QueryRow(
		"SELECT COALESCE(SUM(balance),0) FROM accounts WHERE workspace_id=$1 AND is_active=true",
		workspaceID,
	).Scan(&acc)

	var points []models.PatrimonyPoint
	for _, m := range months {
		acc += m.Net
		points = append(points, models.PatrimonyPoint{Month: m.Month, NetWorth: acc})
	}
	return points, nil
}

// AccountBalanceHistory returns monthly balance per account (AC-RL-18, AC-RL-19)
func (r *ReportRepository) AccountBalanceHistory(workspaceID string, accountIDs []string, from, to string) ([]models.AccountBalance, error) {
	args := []interface{}{workspaceID, from, to}
	inClause := ""
	if len(accountIDs) > 0 {
		placeholders := make([]string, len(accountIDs))
		for i, id := range accountIDs {
			args = append(args, id)
			placeholders[i] = fmt.Sprintf("$%d", len(args))
		}
		inClause = fmt.Sprintf("AND t.account_id IN (%s)", joinStrings(placeholders, ","))
	}

	q := fmt.Sprintf(`
		SELECT a.id, a.name, TO_CHAR(t.date,'YYYY-MM') AS month,
		       SUM(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END) AS balance
		FROM transactions t
		JOIN accounts a ON a.id = t.account_id
		WHERE t.workspace_id=$1 AND t.paid=true AND t.date BETWEEN $2 AND $3 %s
		GROUP BY a.id, a.name, month
		ORDER BY a.name, month`, inClause)

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.AccountBalance
	for rows.Next() {
		var ab models.AccountBalance
		if err := rows.Scan(&ab.AccountID, &ab.AccountName, &ab.Month, &ab.Balance); err != nil {
			return nil, err
		}
		result = append(result, ab)
	}
	return result, nil
}

// CategorySummary returns totals per category (AC-RL-21)
func (r *ReportRepository) CategorySummary(workspaceID, txType, from, to string) ([]models.CategorySummary, error) {
	var q string
	var rows *sql.Rows
	var err error

	if txType == "" {
		q = `
			SELECT c.id, c.name, c.color, c.icon,
			       COALESCE(SUM(t.amount),0) AS total,
			       COUNT(t.id) AS cnt
			FROM transactions t
			JOIN categories c ON c.id = t.category_id
			WHERE t.workspace_id=$1 AND t.ignored=false AND t.date BETWEEN $2 AND $3
			GROUP BY c.id, c.name, c.color, c.icon
			ORDER BY total DESC`
		rows, err = r.db.Query(q, workspaceID, from, to)
	} else {
		q = `
			SELECT c.id, c.name, c.color, c.icon,
			       COALESCE(SUM(t.amount),0) AS total,
			       COUNT(t.id) AS cnt
			FROM transactions t
			JOIN categories c ON c.id = t.category_id
			WHERE t.workspace_id=$1 AND t.type=$2 AND t.ignored=false AND t.date BETWEEN $3 AND $4
			GROUP BY c.id, c.name, c.color, c.icon
			ORDER BY total DESC`
		rows, err = r.db.Query(q, workspaceID, txType, from, to)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.CategorySummary
	for rows.Next() {
		var cs models.CategorySummary
		if err := rows.Scan(&cs.CategoryID, &cs.CategoryName, &cs.Color, &cs.Icon, &cs.Total, &cs.Count); err != nil {
			return nil, err
		}
		result = append(result, cs)
	}
	return result, nil
}

// HasTaggedTransactions checks if there are tagged transactions in period (AC-RL-20)
func (r *ReportRepository) HasTaggedTransactions(workspaceID, from, to string) (bool, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(DISTINCT t.id) FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		WHERE t.workspace_id=$1 AND t.date BETWEEN $2 AND $3`,
		workspaceID, from, to,
	).Scan(&count)
	return count > 0, err
}

// ActiveInstallments returns all active installments across all cards (AC-FC-09)
func (r *ReportRepository) ActiveInstallments(workspaceID string) ([]models.ActiveInstallment, error) {
	q := `
		SELECT t.id, t.description, cc.id, cc.name,
		       t.installment_number, t.installment_total,
		       (t.installment_total - t.installment_number) AS remaining,
		       t.amount
		FROM transactions t
		JOIN credit_cards cc ON cc.id = t.credit_card_id
		WHERE t.workspace_id=$1
		  AND t.installment_group_id IS NOT NULL
		  AND t.paid=false
		ORDER BY cc.name, t.description`
	rows, err := r.db.Query(q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.ActiveInstallment
	for rows.Next() {
		var ai models.ActiveInstallment
		if err := rows.Scan(
			&ai.TransactionID, &ai.Description, &ai.CardID, &ai.CardName,
			&ai.InstallmentNum, &ai.InstallmentTotal, &ai.Remaining, &ai.AmountPerPart,
		); err != nil {
			return nil, err
		}
		ai.TotalRemaining = float64(ai.Remaining) * ai.AmountPerPart
		result = append(result, ai)
	}
	return result, nil
}

// CardInvoiceHistory returns yearly invoice summary for a card (AC-FC-08)
func (r *ReportRepository) CardInvoiceHistory(workspaceID, cardID string) ([]models.MonthlyBalance, error) {
	// Agrupa por CICLO de fatura, não por mês-calendário: um lançamento feito
	// depois do dia de fechamento (closing_day) entra na fatura do mês seguinte.
	// Se closing_day não estiver definido (0/null), usa 31 = mesmo que mês-calendário.
	q := `
		SELECT TO_CHAR(
		         CASE WHEN EXTRACT(DAY FROM t.date)::int <= COALESCE(NULLIF(cc.closing_day,0), 31)
		              THEN date_trunc('month', t.date)
		              ELSE date_trunc('month', t.date) + interval '1 month'
		         END, 'YYYY-MM') AS month,
		       COALESCE(SUM(t.amount),0) AS total,
		       COALESCE(SUM(t.amount) FILTER (WHERE t.paid = false),0) AS unpaid,
		       COUNT(*) AS cnt
		FROM transactions t
		JOIN credit_cards cc ON cc.id = t.credit_card_id
		WHERE t.workspace_id=$1 AND t.credit_card_id=$2 AND t.type='expense'
		GROUP BY month ORDER BY month DESC`
	rows, err := r.db.Query(q, workspaceID, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.MonthlyBalance
	for rows.Next() {
		var m models.MonthlyBalance
		var cnt int
		if err := rows.Scan(&m.Month, &m.Expense, &m.Unpaid, &cnt); err != nil {
			return nil, err
		}
		m.Net = float64(cnt)
		result = append(result, m)
	}
	return result, nil
}

// InvoiceDue é uma fatura em aberto vista como conta a pagar: o que importa
// para o caixa é o VENCIMENTO, não a data das compras que a formaram.
type InvoiceDue struct {
	CardID   string  `json:"card_id"`
	CardName string  `json:"card_name"`
	Color    string  `json:"color"`
	Icon     string  `json:"icon"`
	Month    string  `json:"month"`    // competência da fatura (YYYY-MM)
	DueDate  string  `json:"due_date"` // YYYY-MM-DD
	Amount   float64 `json:"amount"`   // apenas o que continua em aberto
	Count    int     `json:"count"`
}

// InvoicesDue devolve uma linha por fatura em aberto de cada cartão, com o
// vencimento já calculado a partir do ciclo.
//
// A regra do vencimento: a fatura da competência M fecha no dia `closing` do
// mês M. Se o dia de vencimento for depois do fechamento, vence no próprio
// mês M; senão, cai no mês seguinte (fecha dia 16, vence dia 26 → mesmo mês;
// fecha dia 27, vence dia 1 → mês seguinte).
//
// Faturas antigas ainda em aberto aparecem com o vencimento delas, no
// passado — é assim que uma fatura atrasada aparece como atrasada.
func (r *ReportRepository) InvoicesDue(workspaceID, from, to string) ([]InvoiceDue, error) {
	q := `
		WITH ciclo AS (
			SELECT t.credit_card_id AS card_id,
			       CASE WHEN EXTRACT(DAY FROM t.date)::int <= COALESCE(NULLIF(cc.closing_day,0), 31)
			            THEN date_trunc('month', t.date)
			            ELSE date_trunc('month', t.date) + interval '1 month'
			       END AS competencia,
			       t.amount,
			       cc.name, cc.closing_day, cc.due_day,
			       COALESCE(cc.color,'') AS color, COALESCE(cc.icon,'') AS icon
			  FROM transactions t
			  JOIN credit_cards cc ON cc.id = t.credit_card_id
			 WHERE t.workspace_id = $1
			   AND t.type = 'expense'
			   AND t.paid = false
			   AND COALESCE(t.ignored, false) = false
		),
		agrupado AS (
			SELECT card_id, name, color, icon, competencia, due_day,
			       SUM(amount) AS total,
			       COUNT(*)    AS cnt,
			       -- Mês em que a fatura vence: o próprio, se o dia de
			       -- vencimento for depois do fechamento; senão, o seguinte.
			       CASE WHEN due_day > COALESCE(NULLIF(closing_day,0), 31)
			            THEN competencia
			            ELSE competencia + interval '1 month'
			       END AS venc_mes
			  FROM ciclo
			 GROUP BY card_id, name, color, icon, competencia, closing_day, due_day
		),
		com_vencimento AS (
			SELECT card_id, name, color, icon, competencia, total, cnt,
			       -- Dia do vencimento, limitado ao último dia do mês (dia 31
			       -- em mês de 30 vira o dia 30, não estoura para o seguinte).
			       (venc_mes + (LEAST(
			          due_day,
			          EXTRACT(DAY FROM (venc_mes + interval '1 month - 1 day'))::int
			        ) - 1) * interval '1 day')::date AS due_date
			  FROM agrupado
			 WHERE total > 0 AND due_day > 0
		)
		SELECT card_id, name, color, icon,
		       TO_CHAR(competencia, 'YYYY-MM') AS month,
		       -- Alias diferente de due_date de propósito: o WHERE e o ORDER BY
		       -- abaixo precisam da coluna date, não deste texto formatado.
		       TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date_txt,
		       total, cnt
		  FROM com_vencimento`

	args := []interface{}{workspaceID}
	i := 2
	var where []string
	if from != "" {
		where = append(where, fmt.Sprintf("due_date >= $%d", i))
		args = append(args, from)
		i++
	}
	if to != "" {
		where = append(where, fmt.Sprintf("due_date <= $%d", i))
		args = append(args, to)
		i++
	}
	if len(where) > 0 {
		q += " WHERE " + joinStrings(where, " AND ")
	}
	q += " ORDER BY due_date"

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []InvoiceDue{}
	for rows.Next() {
		var d InvoiceDue
		if err := rows.Scan(&d.CardID, &d.CardName, &d.Color, &d.Icon,
			&d.Month, &d.DueDate, &d.Amount, &d.Count); err != nil {
			return nil, err
		}
		result = append(result, d)
	}
	return result, rows.Err()
}

func joinStrings(s []string, sep string) string {
	result := ""
	for i, v := range s {
		if i > 0 {
			result += sep
		}
		result += v
	}
	return result
}
