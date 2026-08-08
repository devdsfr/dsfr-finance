package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/dsfr/finance/internal/middleware"
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

// ── Normalização de descrição ───────────────────────────────────────────
// O objetivo é reduzir "COMPRA CARTAO 1234 IFOOD *IFOOD SAO PAULO" a "IFOOD",
// para que lançamentos do mesmo estabelecimento caiam na mesma chave.

var nonAlpha = regexp.MustCompile(`[^A-Z ]+`)
var spaces = regexp.MustCompile(` +`)

// Palavras que aparecem em quase todo extrato e não identificam o estabelecimento.
var noiseWords = map[string]bool{
	"COMPRA": true, "CARTAO": true, "CART": true, "DEBITO": true, "CREDITO": true,
	"PAGAMENTO": true, "PAGTO": true, "PAG": true, "PIX": true, "TED": true, "DOC": true,
	"TRANSFERENCIA": true, "TRANSF": true, "ENVIADO": true, "RECEBIDO": true,
	"SAQUE": true, "DEPOSITO": true, "TARIFA": true, "COMPRAS": true, "ELETRONICA": true,
	"PARCELA": true, "REF": true, "DE": true, "DA": true, "DO": true, "PARA": true,
	"LTDA": true, "ME": true, "SA": true, "EIRELI": true, "BR": true, "APP": true,
}

// foldAccents troca acentuadas por ASCII para que "CARTÃO" e "CARTAO"
// gerem a mesma chave — sem isso o regex quebraria a palavra ao meio.
var accentPairs = strings.NewReplacer(
	"Á", "A", "À", "A", "Ã", "A", "Â", "A", "Ä", "A",
	"É", "E", "Ê", "E", "È", "E", "Ë", "E",
	"Í", "I", "Î", "I", "Ì", "I", "Ï", "I",
	"Ó", "O", "Õ", "O", "Ô", "O", "Ò", "O", "Ö", "O",
	"Ú", "U", "Û", "U", "Ù", "U", "Ü", "U",
	"Ç", "C", "Ñ", "N",
)

// merchantKey extrai a assinatura do estabelecimento de uma descrição.
func merchantKey(desc string) string {
	s := accentPairs.Replace(strings.ToUpper(desc))
	s = nonAlpha.ReplaceAllString(s, " ")
	s = spaces.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)

	tokens := []string{}
	for _, t := range strings.Fields(s) {
		if len(t) < 3 || noiseWords[t] {
			continue
		}
		tokens = append(tokens, t)
		if len(tokens) == 2 { // duas palavras já identificam bem
			break
		}
	}
	if len(tokens) == 0 {
		return ""
	}
	return strings.Join(tokens, " ")
}

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
		key := merchantKey(desc)
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

		if hit, ok := memory[merchantKey(t.Description)]; ok {
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
