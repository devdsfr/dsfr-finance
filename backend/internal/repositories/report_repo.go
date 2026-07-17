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
	q := `
		SELECT TO_CHAR(date,'YYYY-MM') AS month,
		       COALESCE(SUM(amount),0) AS total,
		       COUNT(*) AS cnt
		FROM transactions
		WHERE workspace_id=$1 AND credit_card_id=$2 AND type='expense'
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
		if err := rows.Scan(&m.Month, &m.Expense, &cnt); err != nil {
			return nil, err
		}
		m.Net = float64(cnt)
		result = append(result, m)
	}
	return result, nil
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
