package repositories

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/dsfr/finance/internal/models"
)

type GoalRepository struct {
	db *sql.DB
}

func NewGoalRepository(db *sql.DB) *GoalRepository {
	return &GoalRepository{db: db}
}

func (r *GoalRepository) List(workspaceID string) ([]*models.Goal, error) {
	q := `SELECT id, workspace_id, name, type, target_amount, target_date,
	             category_id, account_id, chart_style, color, icon, created_at, updated_at
	      FROM goals WHERE workspace_id=$1 ORDER BY created_at`
	rows, err := r.db.Query(q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var goals []*models.Goal
	for rows.Next() {
		g := &models.Goal{}
		if err := rows.Scan(
			&g.ID, &g.WorkspaceID, &g.Name, &g.Type, &g.TargetAmount,
			&g.TargetDate, &g.CategoryID, &g.AccountID,
			&g.ChartStyle, &g.Color, &g.Icon, &g.CreatedAt, &g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		goals = append(goals, g)
	}
	return goals, nil
}

func (r *GoalRepository) GetByID(id, workspaceID string) (*models.Goal, error) {
	q := `SELECT id, workspace_id, name, type, target_amount, target_date,
	             category_id, account_id, chart_style, color, icon, created_at, updated_at
	      FROM goals WHERE id=$1 AND workspace_id=$2`
	g := &models.Goal{}
	err := r.db.QueryRow(q, id, workspaceID).Scan(
		&g.ID, &g.WorkspaceID, &g.Name, &g.Type, &g.TargetAmount,
		&g.TargetDate, &g.CategoryID, &g.AccountID,
		&g.ChartStyle, &g.Color, &g.Icon, &g.CreatedAt, &g.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return g, err
}

func (r *GoalRepository) Create(g *models.Goal) error {
	q := `INSERT INTO goals
	        (id, workspace_id, name, type, target_amount, target_date,
	         category_id, account_id, chart_style, color, icon)
	      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
	_, err := r.db.Exec(q,
		g.ID, g.WorkspaceID, g.Name, g.Type, g.TargetAmount, g.TargetDate,
		g.CategoryID, g.AccountID, g.ChartStyle, g.Color, g.Icon,
	)
	return err
}

func (r *GoalRepository) Update(g *models.Goal) error {
	q := `UPDATE goals
	      SET name=$1, type=$2, target_amount=$3, target_date=$4,
	          category_id=$5, account_id=$6, chart_style=$7, color=$8, icon=$9,
	          updated_at=NOW()
	      WHERE id=$10 AND workspace_id=$11`
	_, err := r.db.Exec(q,
		g.Name, g.Type, g.TargetAmount, g.TargetDate,
		g.CategoryID, g.AccountID, g.ChartStyle, g.Color, g.Icon,
		g.ID, g.WorkspaceID,
	)
	return err
}

func (r *GoalRepository) Delete(id, workspaceID string) error {
	_, err := r.db.Exec("DELETE FROM goals WHERE id=$1 AND workspace_id=$2", id, workspaceID)
	return err
}

// goalLastDay returns the last calendar day of a given year/month.
func goalLastDay(y int, m time.Month) int {
	return time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// Enrich computes CurrentAmount, ProgressPct and MonthlyData for a goal.
func (r *GoalRepository) Enrich(g *models.Goal) {
	now := time.Now()
	y, m, _ := now.Date()

	switch g.Type {

	// ── Category: monthly spend in that category vs limit ──────────────────
	case "category":
		if g.CategoryID == nil {
			break
		}
		qMonth := `SELECT COALESCE(SUM(amount),0) FROM transactions
		           WHERE workspace_id=$1 AND type='expense' AND ignored=false
		           AND date BETWEEN $2 AND $3 AND category_id=$4`
		// Current month
		from := fmt.Sprintf("%d-%02d-01", y, m)
		to := fmt.Sprintf("%d-%02d-%02d", y, m, goalLastDay(y, m))
		_ = r.db.QueryRow(qMonth, g.WorkspaceID, from, to, *g.CategoryID).Scan(&g.CurrentAmount)
		// Last 6 months for bar/line charts
		for i := 5; i >= 0; i-- {
			ref := now.AddDate(0, -i, 0)
			ry, rm, _ := ref.Date()
			mFrom := fmt.Sprintf("%d-%02d-01", ry, rm)
			mTo := fmt.Sprintf("%d-%02d-%02d", ry, rm, goalLastDay(ry, rm))
			var total float64
			_ = r.db.QueryRow(qMonth, g.WorkspaceID, mFrom, mTo, *g.CategoryID).Scan(&total)
			g.MonthlyData = append(g.MonthlyData, models.GoalMonthly{
				Month:  fmt.Sprintf("%d-%02d", ry, rm),
				Amount: total,
			})
		}

	// ── Saving: current account balance toward a target ───────────────────
	case "saving":
		if g.AccountID != nil {
			_ = r.db.QueryRow(
				`SELECT COALESCE(balance,0) FROM accounts WHERE id=$1 AND workspace_id=$2`,
				*g.AccountID, g.WorkspaceID,
			).Scan(&g.CurrentAmount)
		} else {
			_ = r.db.QueryRow(
				`SELECT COALESCE(SUM(balance),0) FROM accounts WHERE workspace_id=$1 AND is_active=true`,
				g.WorkspaceID,
			).Scan(&g.CurrentAmount)
		}

	// ── Patrimony: net worth growth toward a target ────────────────────────
	case "patrimony":
		// Latest month total
		var latestMonth string
		_ = r.db.QueryRow(
			`SELECT COALESCE(month,'') FROM patrimony_snapshots WHERE workspace_id=$1 ORDER BY month DESC LIMIT 1`,
			g.WorkspaceID,
		).Scan(&latestMonth)
		if latestMonth != "" {
			_ = r.db.QueryRow(
				`SELECT COALESCE(SUM(total),0) FROM patrimony_snapshots WHERE workspace_id=$1 AND month=$2`,
				g.WorkspaceID, latestMonth,
			).Scan(&g.CurrentAmount)
		}
		// Last 6 monthly totals for charts
		rows, err := r.db.Query(
			`SELECT month, SUM(total) AS t FROM patrimony_snapshots
			 WHERE workspace_id=$1 GROUP BY month ORDER BY month DESC LIMIT 6`,
			g.WorkspaceID,
		)
		if err == nil {
			defer rows.Close()
			var months []models.GoalMonthly
			for rows.Next() {
				var gm models.GoalMonthly
				_ = rows.Scan(&gm.Month, &gm.Amount)
				months = append(months, gm)
			}
			// reverse to chronological order
			for i, j := 0, len(months)-1; i < j; i, j = i+1, j-1 {
				months[i], months[j] = months[j], months[i]
			}
			g.MonthlyData = months
		}

	// ── Debt: track total debt reduction toward zero ───────────────────────
	case "debt":
		var remaining, original float64
		_ = r.db.QueryRow(
			`SELECT COALESCE(SUM(remaining_balance),0) FROM debts WHERE workspace_id=$1`,
			g.WorkspaceID,
		).Scan(&remaining)
		_ = r.db.QueryRow(
			`SELECT COALESCE(SUM(original_amount),0) FROM debts WHERE workspace_id=$1`,
			g.WorkspaceID,
		).Scan(&original)
		g.CurrentAmount = original - remaining // amount already paid
		if original > 0 {
			g.ProgressPct = (g.CurrentAmount / original) * 100
			if g.ProgressPct > 100 {
				g.ProgressPct = 100
			}
		}
		return // skip generic calc
	}

	// Generic progress calculation
	if g.TargetAmount > 0 {
		g.ProgressPct = (g.CurrentAmount / g.TargetAmount) * 100
		if g.ProgressPct > 100 {
			g.ProgressPct = 100
		}
	}
}
