package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/dsfr/finance/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type StatementImportHandler struct{ db *sql.DB }

func NewStatementImportHandler(db *sql.DB) *StatementImportHandler {
	return &StatementImportHandler{db: db}
}

// StatementRow is one parsed OFX transaction coming from the frontend.
type StatementRow struct {
	ExternalID  string  `json:"external_id"` // FITID do OFX
	Date        string  `json:"date"`        // YYYY-MM-DD
	Description string  `json:"description"`
	Amount      float64 `json:"amount"` // sempre positivo
	Type        string  `json:"type"`   // "income" | "expense"
	CategoryID  *string `json:"category_id"`
}

// AnalyzedRow is a row enriched with duplicate detection and a category guess.
type AnalyzedRow struct {
	StatementRow
	Duplicate            bool    `json:"duplicate"`
	SuggestedCategoryID  *string `json:"suggested_category_id"`
	SuggestedCategoryName string `json:"suggested_category_name"`
}

// A normalização de descrição vive em services.MerchantKey, compartilhada
// com o agente do WhatsApp — os dois aprendem da mesma memória de categorias.

// buildCategoryMemory monta chave-de-estabelecimento → categoria mais usada,
// a partir dos lançamentos que o usuário já categorizou.
func (h *StatementImportHandler) buildCategoryMemory(c *gin.Context, wsID string) map[string][2]string {
	// chave → (categoryID, categoryName) com contagem
	type tally struct {
		counts map[string]int
		names  map[string]string
	}
	agg := map[string]*tally{}

	rows, err := h.db.QueryContext(c, `
		SELECT t.description, t.category_id, c.name
		FROM transactions t
		JOIN categories c ON c.id = t.category_id
		WHERE t.workspace_id = $1 AND t.category_id IS NOT NULL
		  AND t.description IS NOT NULL AND t.description <> ''
		ORDER BY t.date DESC
		LIMIT 3000`, wsID)
	if err != nil {
		return map[string][2]string{}
	}
	defer rows.Close()

	for rows.Next() {
		var desc, catID, catName string
		if rows.Scan(&desc, &catID, &catName) != nil {
			continue
		}
		key := services.MerchantKey(desc)
		if key == "" {
			continue
		}
		if agg[key] == nil {
			agg[key] = &tally{counts: map[string]int{}, names: map[string]string{}}
		}
		agg[key].counts[catID]++
		agg[key].names[catID] = catName
	}

	// Escolhe a categoria mais frequente de cada chave
	memory := map[string][2]string{}
	for key, t := range agg {
		bestID, bestN := "", 0
		for id, n := range t.counts {
			if n > bestN {
				bestID, bestN = id, n
			}
		}
		if bestID != "" {
			memory[key] = [2]string{bestID, t.names[bestID]}
		}
	}
	return memory
}

// POST /import/statement/analyze
// Body: { account_id, transactions: [...] }
// Marca duplicados (FITID já importado) e sugere categoria pelo histórico.
func (h *StatementImportHandler) Analyze(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var body struct {
		AccountID    string         `json:"account_id" binding:"required"`
		Transactions []StatementRow `json:"transactions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// A conta chega do cliente e precisa ser do workspace do token (AUD-001).
	// Validar já aqui evita que a tela de conferência mostre uma análise feita
	// contra conta alheia e só falhe na confirmação.
	if ok, err := repositories.AccountBelongsTo(h.db, wsID, body.AccountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao validar a conta"})
		return
	} else if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conta inválida"})
		return
	}

	// FITIDs já existentes nessa conta
	existing := map[string]bool{}
	ids := make([]string, 0, len(body.Transactions))
	for _, t := range body.Transactions {
		if t.ExternalID != "" {
			ids = append(ids, t.ExternalID)
		}
	}
	if len(ids) > 0 {
		rows, err := h.db.QueryContext(c, `
			SELECT external_id FROM transactions
			WHERE workspace_id = $1 AND account_id = $2 AND external_id = ANY($3)`,
			wsID, body.AccountID, pq.Array(ids))
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id string
				if rows.Scan(&id) == nil {
					existing[id] = true
				}
			}
		}
	}

	memory := h.buildCategoryMemory(c, wsID)

	out := make([]AnalyzedRow, 0, len(body.Transactions))
	for _, t := range body.Transactions {
		row := AnalyzedRow{StatementRow: t}
		row.Duplicate = t.ExternalID != "" && existing[t.ExternalID]

		if hit, ok := memory[services.MerchantKey(t.Description)]; ok {
			id := hit[0]
			row.SuggestedCategoryID = &id
			row.SuggestedCategoryName = hit[1]
		}
		out = append(out, row)
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

// POST /import/statement
// Body: { account_id, transactions: [...] } — apenas as linhas confirmadas.
func (h *StatementImportHandler) Import(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var body struct {
		AccountID    string         `json:"account_id" binding:"required"`
		Transactions []StatementRow `json:"transactions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validação definitiva, imediatamente antes da escrita. A checagem feita
	// no Analyze não serve de garantia: nada obriga o cliente a passar por
	// aquela etapa, e o account_id pode ser outro nesta chamada (AUD-001).
	if ok, err := repositories.AccountBelongsTo(h.db, wsID, body.AccountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao validar a conta"})
		return
	} else if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conta inválida"})
		return
	}

	// As categorias vêm linha a linha do cliente e também são referências.
	// Conferidas antes de abrir a transação, para nenhuma linha ser gravada
	// quando uma única categoria for estranha ao workspace.
	categoriasVistas := map[string]bool{}
	for _, row := range body.Transactions {
		if row.CategoryID == nil || *row.CategoryID == "" || categoriasVistas[*row.CategoryID] {
			continue
		}
		ok, err := repositories.CategoryBelongsTo(h.db, wsID, *row.CategoryID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao validar a categoria"})
			return
		}
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "categoria inválida"})
			return
		}
		categoriasVistas[*row.CategoryID] = true
	}

	tx, err := h.db.BeginTx(c, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	created, skipped := 0, 0
	errs := []string{}
	var balanceDelta float64

	for _, row := range body.Transactions {
		if _, err := time.Parse("2006-01-02", row.Date); err != nil {
			skipped++
			errs = append(errs, "data inválida: "+row.Description)
			continue
		}
		if row.Amount <= 0 {
			skipped++
			continue
		}
		if row.Type != "income" && row.Type != "expense" {
			row.Type = "expense"
		}

		var extID interface{}
		if row.ExternalID != "" {
			extID = row.ExternalID
		}

		// ON CONFLICT usa o índice único parcial da migration 018:
		// se o FITID já existe nessa conta, a linha é ignorada.
		res, err := tx.ExecContext(c, `
			INSERT INTO transactions
			  (id, workspace_id, account_id, category_id, type, amount, date,
			   description, paid, paid_at, external_id, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW(),$9,NOW(),NOW())
			ON CONFLICT (workspace_id, account_id, external_id)
			  WHERE external_id IS NOT NULL AND account_id IS NOT NULL
			DO NOTHING`,
			uuid.New().String(), wsID, body.AccountID, row.CategoryID,
			row.Type, row.Amount, row.Date, row.Description, extID)
		if err != nil {
			skipped++
			errs = append(errs, row.Description+": "+err.Error())
			continue
		}
		if n, _ := res.RowsAffected(); n == 0 {
			skipped++ // duplicado barrado pelo índice
			continue
		}

		created++
		if row.Type == "expense" {
			balanceDelta -= row.Amount
		} else {
			balanceDelta += row.Amount
		}
	}

	// Extrato traz lançamentos já efetivados, então o saldo da conta acompanha.
	if balanceDelta != 0 {
		if _, err := tx.ExecContext(c,
			`UPDATE accounts SET balance = balance + $1, updated_at = NOW()
			 WHERE id = $2 AND workspace_id = $3`,
			balanceDelta, body.AccountID, wsID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"created":       created,
		"skipped":       skipped,
		"balance_delta": balanceDelta,
		"errors":        errs,
	})
}
