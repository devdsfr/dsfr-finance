package repositories

import (
	"database/sql"

	"github.com/dsfr/finance/internal/models"
)

var investmentClassNames = []string{"acoes", "exterior", "etfs", "fiis", "renda_fixa", "criptomoedas"}

type InvestmentRepository struct {
	db *sql.DB
}

func NewInvestmentRepository(db *sql.DB) *InvestmentRepository {
	return &InvestmentRepository{db: db}
}

// ── Config (settings + classes) ─────────────────────────────────────────────

func (r *InvestmentRepository) GetConfig(workspaceID string) (*models.InvestmentConfigResponse, error) {
	resp := &models.InvestmentConfigResponse{}

	var contribution float64
	err := r.db.QueryRow(
		`SELECT monthly_contribution FROM investment_settings WHERE workspace_id=$1`,
		workspaceID,
	).Scan(&contribution)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	resp.MonthlyContribution = contribution

	rows, err := r.db.Query(
		`SELECT id, workspace_id, class_name, ideal_pct, current_value, created_at, updated_at
		 FROM investment_classes WHERE workspace_id=$1`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	existing := map[string]*models.InvestmentClass{}
	for rows.Next() {
		ic := &models.InvestmentClass{}
		if err := rows.Scan(&ic.ID, &ic.WorkspaceID, &ic.ClassName, &ic.IdealPct, &ic.CurrentValue, &ic.CreatedAt, &ic.UpdatedAt); err != nil {
			return nil, err
		}
		existing[ic.ClassName] = ic
	}

	// Ensure all 6 classes are always present in the response, even if not yet created.
	for _, name := range investmentClassNames {
		if ic, ok := existing[name]; ok {
			resp.Classes = append(resp.Classes, ic)
		} else {
			resp.Classes = append(resp.Classes, &models.InvestmentClass{WorkspaceID: workspaceID, ClassName: name})
		}
	}
	return resp, nil
}

// UpsertConfig replaces monthly contribution + all class rows in one transaction.
func (r *InvestmentRepository) UpsertConfig(workspaceID string, contribution float64, classes []*models.InvestmentClass) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`INSERT INTO investment_settings (workspace_id, monthly_contribution, updated_at)
		 VALUES ($1,$2,NOW())
		 ON CONFLICT (workspace_id) DO UPDATE SET monthly_contribution=$2, updated_at=NOW()`,
		workspaceID, contribution,
	)
	if err != nil {
		return err
	}

	for _, c := range classes {
		valid := false
		for _, n := range investmentClassNames {
			if n == c.ClassName {
				valid = true
				break
			}
		}
		if !valid {
			continue
		}
		_, err = tx.Exec(
			`INSERT INTO investment_classes (workspace_id, class_name, ideal_pct, current_value)
			 VALUES ($1,$2,$3,$4)
			 ON CONFLICT (workspace_id, class_name) DO UPDATE
			   SET ideal_pct=$3, current_value=$4, updated_at=NOW()`,
			workspaceID, c.ClassName, c.IdealPct, c.CurrentValue,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ── Assets (sector mapping) ─────────────────────────────────────────────────

func (r *InvestmentRepository) ListAssets(workspaceID string) ([]*models.InvestmentAsset, error) {
	rows, err := r.db.Query(
		`SELECT id, workspace_id, class_name, sector, ticker, display_order, created_at, updated_at
		 FROM investment_assets WHERE workspace_id=$1 ORDER BY class_name, sector, display_order, ticker`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var assets []*models.InvestmentAsset
	for rows.Next() {
		a := &models.InvestmentAsset{}
		if err := rows.Scan(&a.ID, &a.WorkspaceID, &a.ClassName, &a.Sector, &a.Ticker, &a.DisplayOrder, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, nil
}

func (r *InvestmentRepository) CreateAsset(a *models.InvestmentAsset) error {
	return r.db.QueryRow(
		`INSERT INTO investment_assets (workspace_id, class_name, sector, ticker, display_order)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at, updated_at`,
		a.WorkspaceID, a.ClassName, a.Sector, a.Ticker, a.DisplayOrder,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *InvestmentRepository) GetAssetByID(id, workspaceID string) (*models.InvestmentAsset, error) {
	a := &models.InvestmentAsset{}
	err := r.db.QueryRow(
		`SELECT id, workspace_id, class_name, sector, ticker, display_order, created_at, updated_at
		 FROM investment_assets WHERE id=$1 AND workspace_id=$2`,
		id, workspaceID,
	).Scan(&a.ID, &a.WorkspaceID, &a.ClassName, &a.Sector, &a.Ticker, &a.DisplayOrder, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return a, err
}

func (r *InvestmentRepository) UpdateAsset(a *models.InvestmentAsset) error {
	_, err := r.db.Exec(
		`UPDATE investment_assets SET class_name=$1, sector=$2, ticker=$3, display_order=$4, updated_at=NOW()
		 WHERE id=$5 AND workspace_id=$6`,
		a.ClassName, a.Sector, a.Ticker, a.DisplayOrder, a.ID, a.WorkspaceID,
	)
	return err
}

func (r *InvestmentRepository) DeleteAsset(id, workspaceID string) error {
	_, err := r.db.Exec("DELETE FROM investment_assets WHERE id=$1 AND workspace_id=$2", id, workspaceID)
	return err
}
