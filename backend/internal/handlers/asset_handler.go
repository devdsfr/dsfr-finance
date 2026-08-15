package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssetHandler struct{ db *sql.DB }

func NewAssetHandler(db *sql.DB) *AssetHandler { return &AssetHandler{db: db} }

type Asset struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	WalletName    string   `json:"wallet_name"`
	PurchaseValue float64  `json:"purchase_value"`
	MarketValue   float64  `json:"market_value"`
	PurchaseDate  *string  `json:"purchase_date"`
	City          *string  `json:"city"`
	State         *string  `json:"state"`
	Address       *string  `json:"address"`
	Area          *float64 `json:"area"`
	AreaUnit      string   `json:"area_unit"`

	IsFinanced       bool    `json:"is_financed"`
	DownPayment      float64 `json:"down_payment"`
	InstallmentCount int     `json:"installment_count"`
	InstallmentValue float64 `json:"installment_value"`
	FirstDueDate     *string `json:"first_due_date"`
	Seller           *string `json:"seller"`

	// Consórcio
	CreditLetterValue float64 `json:"credit_letter_value"`
	IsAwarded         bool    `json:"is_awarded"`
	AwardedDate       *string `json:"awarded_date"`

	Notes string `json:"notes"`

	// Calculados na listagem
	PaidCount     int     `json:"paid_count"`
	PaidValue     float64 `json:"paid_value"`
	RemainingValue float64 `json:"remaining_value"`
	ProgressPct   float64 `json:"progress_pct"`
	NextDueDate   *string `json:"next_due_date"`
	Appreciation  float64 `json:"appreciation"`     // market - purchase
	AppreciationPct float64 `json:"appreciation_pct"`
}

// GET /assets
func (h *AssetHandler) List(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	rows, err := h.db.QueryContext(c, `
		SELECT a.id, a.name, a.type, a.wallet_name,
		       a.purchase_value, a.market_value, TO_CHAR(a.purchase_date,'YYYY-MM-DD'),
		       a.city, a.state, a.address, a.area, a.area_unit,
		       a.is_financed, a.down_payment, a.installment_count, a.installment_value,
		       TO_CHAR(a.first_due_date,'YYYY-MM-DD'), a.seller, a.notes,
		       a.credit_letter_value, a.is_awarded, TO_CHAR(a.awarded_date,'YYYY-MM-DD'),
		       -- progresso vem das parcelas efetivamente pagas
		       COALESCE(p.paid_count,0), COALESCE(p.paid_value,0),
		       TO_CHAR(p.next_due,'YYYY-MM-DD')
		FROM assets a
		LEFT JOIN LATERAL (
		  SELECT COUNT(*) FILTER (WHERE t.paid) AS paid_count,
		         COALESCE(SUM(t.amount) FILTER (WHERE t.paid),0) AS paid_value,
		         MIN(t.date) FILTER (WHERE NOT t.paid) AS next_due
		  FROM transactions t
		  WHERE t.asset_id = a.id
		) p ON TRUE
		WHERE a.workspace_id = $1 AND a.archived = FALSE
		ORDER BY a.created_at DESC`, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Asset{}
	for rows.Next() {
		var a Asset
		var purchaseDate, firstDue, nextDue, awardedDate sql.NullString
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.WalletName,
			&a.PurchaseValue, &a.MarketValue, &purchaseDate,
			&a.City, &a.State, &a.Address, &a.Area, &a.AreaUnit,
			&a.IsFinanced, &a.DownPayment, &a.InstallmentCount, &a.InstallmentValue,
			&firstDue, &a.Seller, &a.Notes,
			&a.CreditLetterValue, &a.IsAwarded, &awardedDate,
			&a.PaidCount, &a.PaidValue, &nextDue); err != nil {
			continue
		}
		if purchaseDate.Valid { a.PurchaseDate = &purchaseDate.String }
		if firstDue.Valid     { a.FirstDueDate = &firstDue.String }
		if nextDue.Valid      { a.NextDueDate = &nextDue.String }
		if awardedDate.Valid  { a.AwardedDate = &awardedDate.String }

		// Entrada também conta como pago no progresso financeiro.
		a.PaidValue += a.DownPayment

		if a.Type == "consorcio" {
			// Total do plano = tudo que será desembolsado até o fim.
			total := a.InstallmentValue * float64(a.InstallmentCount)
			if total <= 0 {
				total = a.CreditLetterValue
			}
			if total > 0 {
				a.RemainingValue = total - a.PaidValue
				if a.RemainingValue < 0 {
					a.RemainingValue = 0
				}
				a.ProgressPct = a.PaidValue / total
				if a.ProgressPct > 1 {
					a.ProgressPct = 1
				}
			}
			// Antes da contemplação você não tem o bem, tem um direito:
			// o patrimônio vale o que já foi pago (o resgatável na desistência).
			// Contemplado, passa a valer a carta de crédito.
			if a.IsAwarded {
				a.MarketValue = a.CreditLetterValue
			} else {
				a.MarketValue = a.PaidValue
			}
			// Valorização não faz sentido aqui: não há ativo se valorizando.
			a.Appreciation = 0
			a.AppreciationPct = 0
		} else {
			total := a.PurchaseValue
			if total > 0 {
				a.RemainingValue = total - a.PaidValue
				if a.RemainingValue < 0 {
					a.RemainingValue = 0
				}
				a.ProgressPct = a.PaidValue / total
				if a.ProgressPct > 1 {
					a.ProgressPct = 1
				}
			}
			a.Appreciation = a.MarketValue - a.PurchaseValue
			if a.PurchaseValue > 0 {
				a.AppreciationPct = a.Appreciation / a.PurchaseValue
			}
		}
		list = append(list, a)
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

type assetInput struct {
	Name          string   `json:"name" binding:"required"`
	Type          string   `json:"type"`
	WalletName    string   `json:"wallet_name"`
	PurchaseValue float64  `json:"purchase_value"`
	MarketValue   float64  `json:"market_value"`
	PurchaseDate  *string  `json:"purchase_date"`
	City          *string  `json:"city"`
	State         *string  `json:"state"`
	Address       *string  `json:"address"`
	Area          *float64 `json:"area"`
	AreaUnit      string   `json:"area_unit"`

	IsFinanced       bool    `json:"is_financed"`
	DownPayment      float64 `json:"down_payment"`
	InstallmentCount int     `json:"installment_count"`
	InstallmentValue float64 `json:"installment_value"`
	FirstDueDate     *string `json:"first_due_date"`
	Seller           *string `json:"seller"`

	// Consórcio
	CreditLetterValue float64 `json:"credit_letter_value"`
	IsAwarded         bool    `json:"is_awarded"`
	AwardedDate       *string `json:"awarded_date"`

	Notes string `json:"notes"`
	/** Quando true, gera as parcelas como contas a pagar. */
	GenerateInstallments bool `json:"generate_installments"`
}

// POST /assets
func (h *AssetHandler) Create(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)

	var in assetInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if in.Type == "" { in.Type = "lote" }
	if in.WalletName == "" { in.WalletName = "Principal" }
	if in.AreaUnit == "" { in.AreaUnit = "m2" }
	// Sem avaliação informada, o bem vale o que custou.
	if in.MarketValue == 0 { in.MarketValue = in.PurchaseValue }

	if in.Type == "consorcio" {
		// No consórcio o desembolso total é o custo; a carta é o que se recebe.
		in.IsFinanced = true
		if in.PurchaseValue == 0 {
			in.PurchaseValue = in.InstallmentValue * float64(in.InstallmentCount)
		}
		// Enquanto não contemplado, ainda não há bem: começa valendo a entrada.
		if in.IsAwarded {
			in.MarketValue = in.CreditLetterValue
		} else {
			in.MarketValue = in.DownPayment
		}
	}

	tx, err := h.db.BeginTx(c, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	assetID := uuid.New().String()
	var groupID interface{}
	if in.IsFinanced && in.GenerateInstallments && in.InstallmentCount > 0 {
		groupID = uuid.New().String()
	}

	_, err = tx.ExecContext(c, `
		INSERT INTO assets
		  (id, workspace_id, name, type, wallet_name, purchase_value, market_value,
		   purchase_date, city, state, address, area, area_unit,
		   is_financed, down_payment, installment_count, installment_value,
		   first_due_date, seller, installment_group_id, notes,
		   credit_letter_value, is_awarded, awarded_date, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
		        $22,$23,$24,NOW(),NOW())`,
		assetID, wsID, in.Name, in.Type, in.WalletName, in.PurchaseValue, in.MarketValue,
		nullDate(in.PurchaseDate), in.City, in.State, in.Address, in.Area, in.AreaUnit,
		in.IsFinanced, in.DownPayment, in.InstallmentCount, in.InstallmentValue,
		nullDate(in.FirstDueDate), in.Seller, groupID, in.Notes,
		in.CreditLetterValue, in.IsAwarded, nullDate(in.AwardedDate))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Registra a avaliação inicial para o histórico começar do dia 1.
	if in.MarketValue > 0 {
		_, _ = tx.ExecContext(c, `
			INSERT INTO asset_valuations (id, asset_id, date, value, note)
			VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,'Avaliação inicial')`,
			uuid.New().String(), assetID, nullDate(in.PurchaseDate), in.MarketValue)
	}

	created := 0
	if groupID != nil {
		created, err = h.generateInstallments(c, tx, wsID, assetID, groupID.(string), in)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": assetID, "installments_created": created})
}

// generateInstallments cria as parcelas como despesas futuras não pagas,
// para aparecerem em Compromissos, Previsão e no comprometimento de renda.
func (h *AssetHandler) generateInstallments(c *gin.Context, tx *sql.Tx, wsID, assetID, groupID string, in assetInput) (int, error) {
	if in.FirstDueDate == nil || *in.FirstDueDate == "" {
		return 0, nil
	}
	first, err := time.Parse("2006-01-02", (*in.FirstDueDate)[:10])
	if err != nil {
		return 0, nil
	}

	// Categoria dedicada, criada uma vez por workspace.
	// Consórcio ganha categoria própria: o gasto tem natureza diferente
	// de comprar um imóvel, e separar ajuda na leitura dos relatórios.
	catName, catIcon := "Imóveis e Terrenos", "🏞️"
	if in.Type == "consorcio" {
		catName, catIcon = "Consórcio", "🎟️"
	}

	var catID string
	_ = tx.QueryRowContext(c,
		`SELECT id FROM categories WHERE workspace_id=$1 AND name=$2 LIMIT 1`,
		wsID, catName).Scan(&catID)
	if catID == "" {
		catID = uuid.New().String()
		if _, err := tx.ExecContext(c, `
			INSERT INTO categories (id, workspace_id, name, color, icon, type, created_at, updated_at)
			VALUES ($1,$2,$3,'#8b5cf6',$4,'expense',NOW(),NOW())`,
			catID, wsID, catName, catIcon); err != nil {
			catID = ""
		}
	}

	count := 0
	for i := 0; i < in.InstallmentCount; i++ {
		due := first.AddDate(0, i, 0)
		desc := in.Name + " — parcela " + itoa(i+1) + "/" + itoa(in.InstallmentCount)

		var cat interface{}
		if catID != "" { cat = catID }

		if _, err := tx.ExecContext(c, `
			INSERT INTO transactions
			  (id, workspace_id, category_id, type, amount, date, description,
			   paid, installment_group_id, installment_number, installment_total,
			   asset_id, source, created_at, updated_at)
			VALUES ($1,$2,$3,'expense',$4,$5,$6,false,$7,$8,$9,$10,'asset',NOW(),NOW())`,
			uuid.New().String(), wsID, cat, in.InstallmentValue,
			due.Format("2006-01-02"), desc, groupID, i+1, in.InstallmentCount,
			assetID); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// PUT /assets/:id
func (h *AssetHandler) Update(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	id := c.Param("id")

	var in assetInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.db.ExecContext(c, `
		UPDATE assets SET
		  name=$1, type=$2, wallet_name=$3, purchase_value=$4, market_value=$5,
		  purchase_date=$6, city=$7, state=$8, address=$9, area=$10, area_unit=$11,
		  seller=$12, notes=$13,
		  credit_letter_value=$14, is_awarded=$15, awarded_date=$16, updated_at=NOW()
		WHERE id=$17 AND workspace_id=$18`,
		in.Name, in.Type, in.WalletName, in.PurchaseValue, in.MarketValue,
		nullDate(in.PurchaseDate), in.City, in.State, in.Address, in.Area, in.AreaUnit,
		in.Seller, in.Notes,
		in.CreditLetterValue, in.IsAwarded, nullDate(in.AwardedDate), id, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /assets/:id/valuation — registra reavaliação
func (h *AssetHandler) AddValuation(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	id := c.Param("id")

	var in struct {
		Date  string  `json:"date"`
		Value float64 `json:"value" binding:"required"`
		Note  string  `json:"note"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if in.Date == "" {
		in.Date = time.Now().Format("2006-01-02")
	}

	// Confere que o bem é do workspace antes de gravar.
	var exists bool
	_ = h.db.QueryRowContext(c,
		`SELECT EXISTS(SELECT 1 FROM assets WHERE id=$1 AND workspace_id=$2)`,
		id, wsID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "bem não encontrado"})
		return
	}

	if _, err := h.db.ExecContext(c, `
		INSERT INTO asset_valuations (id, asset_id, date, value, note)
		VALUES ($1,$2,$3,$4,$5)`,
		uuid.New().String(), id, in.Date, in.Value, in.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// A avaliação mais recente vira o valor de mercado corrente.
	_, _ = h.db.ExecContext(c,
		`UPDATE assets SET market_value=$1, updated_at=NOW() WHERE id=$2`, in.Value, id)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /assets/:id/valuations
func (h *AssetHandler) Valuations(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	id := c.Param("id")

	rows, err := h.db.QueryContext(c, `
		SELECT TO_CHAR(v.date,'YYYY-MM-DD'), v.value, v.note
		FROM asset_valuations v
		JOIN assets a ON a.id = v.asset_id AND a.workspace_id = $2
		WHERE v.asset_id = $1 ORDER BY v.date`, id, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type row struct {
		Date  string  `json:"date"`
		Value float64 `json:"value"`
		Note  string  `json:"note"`
	}
	out := []row{}
	for rows.Next() {
		var r row
		if rows.Scan(&r.Date, &r.Value, &r.Note) == nil {
			out = append(out, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// GET /assets/:id/installments
func (h *AssetHandler) Installments(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	id := c.Param("id")

	rows, err := h.db.QueryContext(c, `
		SELECT t.id, TO_CHAR(t.date,'YYYY-MM-DD'), t.amount, t.paid,
		       COALESCE(t.installment_number,0), COALESCE(t.installment_total,0)
		FROM transactions t
		WHERE t.asset_id=$1 AND t.workspace_id=$2
		ORDER BY t.date`, id, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type row struct {
		ID     string  `json:"id"`
		Date   string  `json:"date"`
		Amount float64 `json:"amount"`
		Paid   bool    `json:"paid"`
		Number int     `json:"number"`
		Total  int     `json:"total"`
	}
	out := []row{}
	for rows.Next() {
		var r row
		if rows.Scan(&r.ID, &r.Date, &r.Amount, &r.Paid, &r.Number, &r.Total) == nil {
			out = append(out, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// DELETE /assets/:id — arquiva o bem e remove as parcelas ainda não pagas.
// As pagas ficam, porque representam dinheiro que realmente saiu.
func (h *AssetHandler) Delete(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	id := c.Param("id")

	tx, err := h.db.BeginTx(c, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(c,
		`DELETE FROM transactions WHERE asset_id=$1 AND workspace_id=$2 AND paid=false`,
		id, wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if _, err := tx.ExecContext(c,
		`UPDATE assets SET archived=true, updated_at=NOW() WHERE id=$1 AND workspace_id=$2`,
		id, wsID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ── auxiliares ──

func nullDate(s *string) interface{} {
	if s == nil || *s == "" {
		return nil
	}
	return (*s)[:10]
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	if neg {
		return "-" + string(b)
	}
	return string(b)
}
