package repositories

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/dsfr/finance/internal/models"
)

type TransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) *TransactionRepository {
	return &TransactionRepository{db: db}
}

type TransactionFilter struct {
	WorkspaceID  string
	AccountID    string
	CategoryID   string
	CreditCardID string
	Type         string
	Paid         *bool
	Ignored      *bool
	DateFrom     string
	DateTo       string
	Search       string
	Page         int
	Limit        int
}

func (r *TransactionRepository) List(f TransactionFilter) ([]*models.Transaction, int, error) {
	args := []interface{}{f.WorkspaceID}
	where := []string{"t.workspace_id = $1"}
	i := 2

	if f.AccountID != "" {
		where = append(where, fmt.Sprintf("t.account_id = $%d", i))
		args = append(args, f.AccountID)
		i++
	}
	if f.CategoryID != "" {
		where = append(where, fmt.Sprintf("t.category_id = $%d", i))
		args = append(args, f.CategoryID)
		i++
	}
	if f.CreditCardID != "" {
		where = append(where, fmt.Sprintf("t.credit_card_id = $%d", i))
		args = append(args, f.CreditCardID)
		i++
	}
	if f.Type != "" {
		where = append(where, fmt.Sprintf("t.type = $%d", i))
		args = append(args, f.Type)
		i++
	}
	if f.Paid != nil {
		where = append(where, fmt.Sprintf("t.paid = $%d", i))
		args = append(args, *f.Paid)
		i++
	}
	if f.Ignored != nil {
		where = append(where, fmt.Sprintf("t.ignored = $%d", i))
		args = append(args, *f.Ignored)
		i++
	}
	if f.DateFrom != "" {
		where = append(where, fmt.Sprintf("t.date >= $%d", i))
		args = append(args, f.DateFrom)
		i++
	}
	if f.DateTo != "" {
		where = append(where, fmt.Sprintf("t.date <= $%d", i))
		args = append(args, f.DateTo)
		i++
	}
	if f.Search != "" {
		where = append(where, fmt.Sprintf("t.description ILIKE $%d", i))
		args = append(args, "%"+f.Search+"%")
		i++
	}

	whereClause := strings.Join(where, " AND ")

	// count
	var total int
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM transactions t WHERE %s", whereClause)
	if err := r.db.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// paginate
	limit := f.Limit
	if limit <= 0 {
		limit = 20
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	args = append(args, limit, offset)

	q := fmt.Sprintf(`
		SELECT t.id, t.workspace_id, t.account_id, t.credit_card_id, t.category_id,
		       t.type, t.amount, t.date, t.description, t.notes,
		       t.paid, t.paid_at, t.ignored,
		       t.installment_group_id, t.installment_number, t.installment_total,
		       t.transfer_account_id, t.attachment_url, t.attachment_name,
		       t.created_at, t.updated_at
		FROM transactions t
		WHERE %s
		ORDER BY t.date DESC, t.created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, i, i+1)

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var txs []*models.Transaction
	for rows.Next() {
		tx := &models.Transaction{}
		err := rows.Scan(
			&tx.ID, &tx.WorkspaceID, &tx.AccountID, &tx.CreditCardID, &tx.CategoryID,
			&tx.Type, &tx.Amount, &tx.Date, &tx.Description, &tx.Notes,
			&tx.Paid, &tx.PaidAt, &tx.Ignored,
			&tx.InstallmentGroup, &tx.InstallmentNum, &tx.InstallmentTotal,
			&tx.TransferAccount, &tx.AttachmentURL, &tx.AttachmentName,
			&tx.CreatedAt, &tx.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		txs = append(txs, tx)
	}
	return txs, total, nil
}

func (r *TransactionRepository) GetByID(id, workspaceID string) (*models.Transaction, error) {
	q := `SELECT id, workspace_id, account_id, credit_card_id, category_id,
	             type, amount, date, description, notes,
	             paid, paid_at, ignored,
	             installment_group_id, installment_number, installment_total,
	             transfer_account_id, attachment_url, attachment_name,
	             created_at, updated_at
	      FROM transactions WHERE id=$1 AND workspace_id=$2`
	tx := &models.Transaction{}
	err := r.db.QueryRow(q, id, workspaceID).Scan(
		&tx.ID, &tx.WorkspaceID, &tx.AccountID, &tx.CreditCardID, &tx.CategoryID,
		&tx.Type, &tx.Amount, &tx.Date, &tx.Description, &tx.Notes,
		&tx.Paid, &tx.PaidAt, &tx.Ignored,
		&tx.InstallmentGroup, &tx.InstallmentNum, &tx.InstallmentTotal,
		&tx.TransferAccount, &tx.AttachmentURL, &tx.AttachmentName,
		&tx.CreatedAt, &tx.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return tx, err
}

func (r *TransactionRepository) Create(tx *models.Transaction) error {
	q := `INSERT INTO transactions
		(id, workspace_id, account_id, credit_card_id, category_id,
		 type, amount, date, description, notes,
		 paid, paid_at, ignored,
		 installment_group_id, installment_number, installment_total,
		 transfer_account_id, attachment_url, attachment_name)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`
	_, err := r.db.Exec(q,
		tx.ID, tx.WorkspaceID, tx.AccountID, tx.CreditCardID, tx.CategoryID,
		tx.Type, tx.Amount, tx.Date, tx.Description, tx.Notes,
		tx.Paid, tx.PaidAt, tx.Ignored,
		tx.InstallmentGroup, tx.InstallmentNum, tx.InstallmentTotal,
		tx.TransferAccount, tx.AttachmentURL, tx.AttachmentName,
	)
	return err
}

func (r *TransactionRepository) Update(tx *models.Transaction) error {
	q := `UPDATE transactions SET
		account_id=$1, credit_card_id=$2, category_id=$3,
		type=$4, amount=$5, date=$6, description=$7, notes=$8,
		paid=$9, paid_at=$10, ignored=$11,
		attachment_url=$12, attachment_name=$13,
		updated_at=NOW()
		WHERE id=$14 AND workspace_id=$15`
	_, err := r.db.Exec(q,
		tx.AccountID, tx.CreditCardID, tx.CategoryID,
		tx.Type, tx.Amount, tx.Date, tx.Description, tx.Notes,
		tx.Paid, tx.PaidAt, tx.Ignored,
		tx.AttachmentURL, tx.AttachmentName,
		tx.ID, tx.WorkspaceID,
	)
	return err
}

func (r *TransactionRepository) Delete(id, workspaceID string) error {
	_, err := r.db.Exec("DELETE FROM transactions WHERE id=$1 AND workspace_id=$2", id, workspaceID)
	return err
}

// MarkAllPaid marks all overdue unpaid transactions as paid (AC-UX-01)
func (r *TransactionRepository) MarkAllPaid(workspaceID string) (int64, error) {
	now := time.Now()
	today := now.Format("2006-01-02")
	res, err := r.db.Exec(`
		UPDATE transactions SET paid=true, paid_at=NOW(), updated_at=NOW()
		WHERE workspace_id=$1 AND paid=false AND ignored=false AND date < $2`,
		workspaceID, today,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// IgnoreAll ignores all overdue unpaid transactions (AC-UX-02)
func (r *TransactionRepository) IgnoreAll(workspaceID string) (int64, error) {
	today := time.Now().Format("2006-01-02")
	res, err := r.db.Exec(`
		UPDATE transactions SET ignored=true, updated_at=NOW()
		WHERE workspace_id=$1 AND paid=false AND ignored=false AND date < $2`,
		workspaceID, today,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SetTagsForTransaction replaces all tags on a transaction
func (r *TransactionRepository) SetTags(txID string, tagIDs []string) error {
	dbtx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer dbtx.Rollback()
	if _, err := dbtx.Exec("DELETE FROM transaction_tags WHERE transaction_id=$1", txID); err != nil {
		return err
	}
	for _, tid := range tagIDs {
		if _, err := dbtx.Exec(
			"INSERT INTO transaction_tags(transaction_id, tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
			txID, tid,
		); err != nil {
			return err
		}
	}
	return dbtx.Commit()
}

// GetTags returns tags for a transaction
func (r *TransactionRepository) GetTags(txID string) ([]models.Tag, error) {
	q := `SELECT t.id, t.workspace_id, t.name, t.color, t.created_at
	      FROM tags t
	      JOIN transaction_tags tt ON tt.tag_id = t.id
	      WHERE tt.transaction_id=$1`
	rows, err := r.db.Query(q, txID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.WorkspaceID, &tag.Name, &tag.Color, &tag.CreatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

// SuggestTags returns tag suggestions based on description (AC-TG-05)
func (r *TransactionRepository) SuggestTags(workspaceID, description string) ([]models.Tag, error) {
	q := `SELECT DISTINCT t.id, t.workspace_id, t.name, t.color, t.created_at
	      FROM tags t
	      JOIN transaction_tags tt ON tt.tag_id = t.id
	      JOIN transactions tr ON tr.id = tt.transaction_id
	      WHERE t.workspace_id=$1
	        AND tr.description ILIKE $2
	      LIMIT 5`
	rows, err := r.db.Query(q, workspaceID, "%"+description+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		if err := rows.Scan(&tag.ID, &tag.WorkspaceID, &tag.Name, &tag.Color, &tag.CreatedAt); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

// CountOverdue returns the count of overdue unpaid transactions (for banner)
func (r *TransactionRepository) CountOverdue(workspaceID string) (int, error) {
	today := time.Now().Format("2006-01-02")
	var count int
	err := r.db.QueryRow(
		"SELECT COUNT(*) FROM transactions WHERE workspace_id=$1 AND paid=false AND ignored=false AND date < $2",
		workspaceID, today,
	).Scan(&count)
	return count, err
}
