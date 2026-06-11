package repositories

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/dsfr/finance/internal/models"
)

type SpendingRepository struct {
	db *sql.DB
}

func NewSpendingRepository(db *sql.DB) *SpendingRepository {
	return &SpendingRepository{db: db}
}

func (r *SpendingRepository) List(workspaceID string) ([]*models.SpendingLimit, error) {
	q := `SELECT id, workspace_id, category_id, account_id, credit_card_id,
	             amount, period, alert_pct, created_at, updated_at
	      FROM spending_limits WHERE workspace_id=$1 ORDER BY created_at`
	rows, err := r.db.Query(q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var limits []*models.SpendingLimit
	for rows.Next() {
		l := &models.SpendingLimit{}
		if err := rows.Scan(&l.ID, &l.WorkspaceID, &l.CategoryID, &l.AccountID, &l.CreditCardID,
			&l.Amount, &l.Period, &l.AlertPct, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		limits = append(limits, l)
	}
	return limits, nil
}

func (r *SpendingRepository) GetByID(id, workspaceID string) (*models.SpendingLimit, error) {
	q := `SELECT id, workspace_id, category_id, account_id, credit_card_id,
	             amount, period, alert_pct, created_at, updated_at
	      FROM spending_limits WHERE id=$1 AND workspace_id=$2`
	l := &models.SpendingLimit{}
	err := r.db.QueryRow(q, id, workspaceID).Scan(&l.ID, &l.WorkspaceID, &l.CategoryID, &l.AccountID,
		&l.CreditCardID, &l.Amount, &l.Period, &l.AlertPct, &l.CreatedAt, &l.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return l, err
}

func (r *SpendingRepository) Create(l *models.SpendingLimit) error {
	q := `INSERT INTO spending_limits
		(id, workspace_id, category_id, account_id, credit_card_id, amount, period, alert_pct)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	_, err := r.db.Exec(q, l.ID, l.WorkspaceID, l.CategoryID, l.AccountID, l.CreditCardID,
		l.Amount, l.Period, l.AlertPct)
	return err
}

func (r *SpendingRepository) Update(l *models.SpendingLimit) error {
	q := `UPDATE spending_limits SET amount=$1, period=$2, alert_pct=$3, updated_at=NOW()
	      WHERE id=$4 AND workspace_id=$5`
	_, err := r.db.Exec(q, l.Amount, l.Period, l.AlertPct, l.ID, l.WorkspaceID)
	return err
}

func (r *SpendingRepository) Delete(id, workspaceID string) error {
	_, err := r.db.Exec("DELETE FROM spending_limits WHERE id=$1 AND workspace_id=$2", id, workspaceID)
	return err
}

// ComputeCurrentSpend calculates current spend for a limit this period
func (r *SpendingRepository) ComputeCurrentSpend(l *models.SpendingLimit) (float64, error) {
	now := time.Now()
	var from, to string
	if l.Period == "yearly" {
		from = fmt.Sprintf("%d-01-01", now.Year())
		to = fmt.Sprintf("%d-12-31", now.Year())
	} else {
		from = fmt.Sprintf("%d-%02d-01", now.Year(), now.Month())
		last := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, time.UTC)
		to = last.Format("2006-01-02")
	}

	args := []interface{}{l.WorkspaceID, from, to}
	extra := ""
	if l.CategoryID != nil {
		args = append(args, *l.CategoryID)
		extra += fmt.Sprintf(" AND category_id=$%d", len(args))
	}
	if l.AccountID != nil {
		args = append(args, *l.AccountID)
		extra += fmt.Sprintf(" AND account_id=$%d", len(args))
	}
	if l.CreditCardID != nil {
		args = append(args, *l.CreditCardID)
		extra += fmt.Sprintf(" AND credit_card_id=$%d", len(args))
	}

	q := fmt.Sprintf(`SELECT COALESCE(SUM(amount),0) FROM transactions
		WHERE workspace_id=$1 AND type='expense' AND paid=true AND date BETWEEN $2 AND $3 %s`, extra)

	var spend float64
	err := r.db.QueryRow(q, args...).Scan(&spend)
	return spend, err
}
