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

// ── Portfolios (carteiras) ──────────────────────────────────────────────────

func (r *InvestmentRepository) ListPortfolios(workspaceID string) ([]*models.InvestmentPortfolio, error) {
	rows, err := r.db.Query(
		`SELECT id, workspace_id, name, icon, color, display_order, created_at, updated_at
		 FROM investment_portfolios WHERE workspace_id=$1 ORDER BY display_order, created_at`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.InvestmentPortfolio
	byID := map[string]*models.InvestmentPortfolio{}
	for rows.Next() {
		p := &models.InvestmentPortfolio{}
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Icon, &p.Color, &p.DisplayOrder, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
		byID[p.ID] = p
	}
	if len(list) == 0 {
		return list, nil
	}

	// Load target allocations for all portfolios in one pass.
	cRows, err := r.db.Query(
		`SELECT pc.portfolio_id, pc.class_name, pc.ideal_pct
		 FROM investment_portfolio_classes pc
		 JOIN investment_portfolios p ON p.id = pc.portfolio_id
		 WHERE p.workspace_id=$1`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer cRows.Close()

	existing := map[string]map[string]float64{}
	for cRows.Next() {
		var pid, class string
		var pct float64
		if err := cRows.Scan(&pid, &class, &pct); err != nil {
			return nil, err
		}
		if existing[pid] == nil {
			existing[pid] = map[string]float64{}
		}
		existing[pid][class] = pct
	}

	// Always return all 6 classes per portfolio.
	for _, p := range list {
		for _, name := range investmentClassNames {
			p.Classes = append(p.Classes, &models.PortfolioClass{
				ClassName: name,
				IdealPct:  existing[p.ID][name],
			})
		}
	}
	return list, nil
}

func (r *InvestmentRepository) CreatePortfolio(p *models.InvestmentPortfolio) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRow(
		`INSERT INTO investment_portfolios (workspace_id, name, icon, color, display_order)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at, updated_at`,
		p.WorkspaceID, p.Name, p.Icon, p.Color, p.DisplayOrder,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return err
	}

	if err := upsertPortfolioClasses(tx, p.ID, p.Classes); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *InvestmentRepository) UpdatePortfolio(p *models.InvestmentPortfolio) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`UPDATE investment_portfolios
		 SET name=$1, icon=$2, color=$3, display_order=$4, updated_at=NOW()
		 WHERE id=$5 AND workspace_id=$6`,
		p.Name, p.Icon, p.Color, p.DisplayOrder, p.ID, p.WorkspaceID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}

	if err := upsertPortfolioClasses(tx, p.ID, p.Classes); err != nil {
		return err
	}
	return tx.Commit()
}

func upsertPortfolioClasses(tx *sql.Tx, portfolioID string, classes []*models.PortfolioClass) error {
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
		if _, err := tx.Exec(
			`INSERT INTO investment_portfolio_classes (portfolio_id, class_name, ideal_pct)
			 VALUES ($1,$2,$3)
			 ON CONFLICT (portfolio_id, class_name) DO UPDATE SET ideal_pct=$3`,
			portfolioID, c.ClassName, c.IdealPct,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *InvestmentRepository) DeletePortfolio(id, workspaceID string) error {
	_, err := r.db.Exec("DELETE FROM investment_portfolios WHERE id=$1 AND workspace_id=$2", id, workspaceID)
	return err
}

func (r *InvestmentRepository) portfolioBelongsTo(portfolioID, workspaceID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM investment_portfolios WHERE id=$1 AND workspace_id=$2)",
		portfolioID, workspaceID,
	).Scan(&exists)
	return exists, err
}

// ── Monthly entries ─────────────────────────────────────────────────────────

// GetMonthEntry returns the saved entry for a portfolio/month. When none exists,
// it carries forward the previous month's values (value + allocation) so the
// user starts from where the last month ended.
func (r *InvestmentRepository) GetMonthEntry(workspaceID, portfolioID, month string) (*models.InvestmentMonthEntry, error) {
	ok, err := r.portfolioBelongsTo(portfolioID, workspaceID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrNoRows
	}

	entry := &models.InvestmentMonthEntry{PortfolioID: portfolioID, Month: month}

	err = r.db.QueryRow(
		`SELECT id, contribution FROM investment_month_entries
		 WHERE portfolio_id=$1 AND month=$2`,
		portfolioID, month,
	).Scan(&entry.ID, &entry.Contribution)

	if err == nil {
		values, err := r.loadMonthClasses(entry.ID)
		if err != nil {
			return nil, err
		}
		entry.Classes = fillAllClasses(values)
		return entry, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	// No saved entry — carry forward from the most recent previous month.
	var prevID string
	var prevContribution float64
	err = r.db.QueryRow(
		`SELECT id, contribution FROM investment_month_entries
		 WHERE portfolio_id=$1 AND month < $2 ORDER BY month DESC LIMIT 1`,
		portfolioID, month,
	).Scan(&prevID, &prevContribution)
	if err == sql.ErrNoRows {
		entry.Classes = fillAllClasses(nil)
		entry.Prefilled = true
		return entry, nil
	}
	if err != nil {
		return nil, err
	}

	prev, err := r.loadMonthClasses(prevID)
	if err != nil {
		return nil, err
	}
	carried := map[string]*models.MonthClass{}
	for name, mc := range prev {
		carried[name] = &models.MonthClass{
			ClassName:    name,
			CurrentValue: mc.CurrentValue + mc.Allocation,
		}
	}
	entry.Classes = fillAllClasses(carried)
	entry.Contribution = prevContribution
	entry.Prefilled = true
	return entry, nil
}

func (r *InvestmentRepository) loadMonthClasses(entryID string) (map[string]*models.MonthClass, error) {
	rows, err := r.db.Query(
		`SELECT class_name, current_value, allocation FROM investment_month_classes WHERE entry_id=$1`,
		entryID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]*models.MonthClass{}
	for rows.Next() {
		mc := &models.MonthClass{}
		if err := rows.Scan(&mc.ClassName, &mc.CurrentValue, &mc.Allocation); err != nil {
			return nil, err
		}
		out[mc.ClassName] = mc
	}
	return out, nil
}

// fillAllClasses guarantees all 6 classes are present, in canonical order.
func fillAllClasses(values map[string]*models.MonthClass) []*models.MonthClass {
	out := make([]*models.MonthClass, 0, len(investmentClassNames))
	for _, name := range investmentClassNames {
		if mc, ok := values[name]; ok {
			mc.ClassName = name
			out = append(out, mc)
		} else {
			out = append(out, &models.MonthClass{ClassName: name})
		}
	}
	return out
}

// UpsertMonthEntry saves (or replaces) a portfolio's entry for a month.
func (r *InvestmentRepository) UpsertMonthEntry(workspaceID string, e *models.InvestmentMonthEntry) error {
	ok, err := r.portfolioBelongsTo(e.PortfolioID, workspaceID)
	if err != nil {
		return err
	}
	if !ok {
		return sql.ErrNoRows
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var entryID string
	err = tx.QueryRow(
		`INSERT INTO investment_month_entries (workspace_id, portfolio_id, month, contribution)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (portfolio_id, month) DO UPDATE
		   SET contribution=$4, updated_at=NOW()
		 RETURNING id`,
		workspaceID, e.PortfolioID, e.Month, e.Contribution,
	).Scan(&entryID)
	if err != nil {
		return err
	}

	for _, c := range e.Classes {
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
		if _, err := tx.Exec(
			`INSERT INTO investment_month_classes (entry_id, class_name, current_value, allocation)
			 VALUES ($1,$2,$3,$4)
			 ON CONFLICT (entry_id, class_name) DO UPDATE
			   SET current_value=$3, allocation=$4`,
			entryID, c.ClassName, c.CurrentValue, c.Allocation,
		); err != nil {
			return err
		}
	}

	e.ID = entryID
	e.Prefilled = false
	return tx.Commit()
}

// History returns monthly totals per portfolio, oldest first.
func (r *InvestmentRepository) History(workspaceID string) ([]*models.InvestmentHistoryPoint, error) {
	rows, err := r.db.Query(
		`SELECT e.month, e.portfolio_id, e.contribution,
		        COALESCE(SUM(mc.current_value + mc.allocation), 0) AS total_value
		 FROM investment_month_entries e
		 LEFT JOIN investment_month_classes mc ON mc.entry_id = e.id
		 WHERE e.workspace_id = $1
		 GROUP BY e.month, e.portfolio_id, e.contribution
		 ORDER BY e.month`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.InvestmentHistoryPoint
	for rows.Next() {
		p := &models.InvestmentHistoryPoint{}
		if err := rows.Scan(&p.Month, &p.PortfolioID, &p.Contribution, &p.TotalValue); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}
	}
	return out, nil
}
