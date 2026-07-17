package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ImportHandler struct{ db *sql.DB }

func NewImportHandler(db *sql.DB) *ImportHandler { return &ImportHandler{db: db} }

// ImportTransaction is the parsed row sent from the frontend PDF parser.
type ImportTransaction struct {
	Description  string  `json:"description"`
	Amount       float64 `json:"amount"`
	Type         string  `json:"type"`          // "income" | "expense"
	Date         string  `json:"date"`          // YYYY-MM-DD
	CategoryName string  `json:"category_name"` // raw name from PDF
	Paid         bool    `json:"paid"`
}

// POST /import/organizze
// Body: { "transactions": [...] }
func (h *ImportHandler) ImportOrganizze(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var body struct {
		Transactions []ImportTransaction `json:"transactions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build category name → id cache (fetch existing)
	catCache := map[string]string{}
	rows, _ := h.db.QueryContext(c,
		`SELECT id, name FROM categories WHERE workspace_id = $1`, wsID)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, name string
			rows.Scan(&id, &name)
			catCache[name] = id
		}
	}

	created, skipped, errs := 0, 0, []string{}

	for _, tx := range body.Transactions {
		// Validate date
		if _, err := time.Parse("2006-01-02", tx.Date); err != nil {
			skipped++
			errs = append(errs, "data inválida: "+tx.Description+" ("+tx.Date+")")
			continue
		}
		if tx.Amount <= 0 {
			skipped++
			continue
		}
		if tx.Type != "income" && tx.Type != "expense" {
			tx.Type = "expense"
		}

		// Get or create category
		var catID *string
		if tx.CategoryName != "" {
			if id, ok := catCache[tx.CategoryName]; ok {
				catID = &id
			} else {
				// Create category with a default color based on type
				color := "#ef4444"
				if tx.Type == "income" {
					color = "#22c55e"
				}
				newID := uuid.New().String()
				_, err := h.db.ExecContext(c,
					`INSERT INTO categories (id, workspace_id, name, color, icon, type, created_at, updated_at)
					 VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
					 ON CONFLICT DO NOTHING`,
					newID, wsID, tx.CategoryName, color, "📁", tx.Type)
				if err == nil {
					catCache[tx.CategoryName] = newID
					catID = &newID
				} else {
					// Try to fetch again (concurrent insert)
					var existID string
					h.db.QueryRowContext(c,
						`SELECT id FROM categories WHERE workspace_id=$1 AND name=$2`, wsID, tx.CategoryName).
						Scan(&existID)
					if existID != "" {
						catCache[tx.CategoryName] = existID
						catID = &existID
					}
				}
			}
		}

		// Insert transaction
		txID := uuid.New().String()
		var paidAt interface{}
		if tx.Paid {
			paidAt = time.Now()
		}

		_, err := h.db.ExecContext(c,
			`INSERT INTO transactions
			   (id, workspace_id, type, amount, date, description, paid, paid_at, category_id, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
			txID, wsID, tx.Type, tx.Amount, tx.Date, tx.Description,
			tx.Paid, paidAt, catID)
		if err != nil {
			skipped++
			errs = append(errs, tx.Description+": "+err.Error())
		} else {
			created++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"created": created,
		"skipped": skipped,
		"errors":  errs,
	})
}
