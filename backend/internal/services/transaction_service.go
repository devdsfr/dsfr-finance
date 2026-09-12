package services

import (
	"fmt"
	"time"

	"github.com/dsfr/finance/internal/models"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/google/uuid"
)

type TransactionService struct {
	repo         *repositories.TransactionRepository
	spendingRepo *repositories.SpendingRepository
	notifSvc     *NotificationService
	activitySvc  *ActivityService
}

func NewTransactionService(
	repo *repositories.TransactionRepository,
	spendingRepo *repositories.SpendingRepository,
	notifSvc *NotificationService,
	activitySvc *ActivityService,
) *TransactionService {
	return &TransactionService{repo, spendingRepo, notifSvc, activitySvc}
}

type CreateTransactionRequest struct {
	AccountID        *string  `json:"account_id"`
	CreditCardID     *string  `json:"credit_card_id"`
	CategoryID       *string  `json:"category_id"`
	Type             string   `json:"type" binding:"required,oneof=expense income transfer"`
	Amount           float64  `json:"amount" binding:"required,gt=0"`
	Date             string   `json:"date" binding:"required"`
	Description      string   `json:"description" binding:"required"`
	Notes            *string  `json:"notes"`
	Paid             bool     `json:"paid"`
	TransferAccount  *string  `json:"transfer_account_id"`
	TagIDs           []string `json:"tag_ids"`
	// installments (AC-UX-05)
	Installments     int      `json:"installments"`
	// repeat_months: creates N copies with the full amount (for income/expense recurrence)
	RepeatMonths     int      `json:"repeat_months"`
	// scope controls how an edit propagates across a recurrence group:
	// "one" (default), "future" (this and the following ones) or "all".
	Scope            string   `json:"scope"`
}

// ── Propriedade das referências (AUD-001) ───────────────────────────────
//
// Os IDs vêm do corpo da requisição e o workspace vem do token. Sem conferir
// um contra o outro, um lançamento criado no workspace A podia apontar para
// a conta do workspace B — e, ao ser marcado como pago, mexer no saldo dela.
//
// As mensagens são deliberadamente genéricas: dizer "esta conta pertence a
// outro usuário" confirmaria a existência do recurso. Id inexistente e id de
// outro workspace devolvem exatamente a mesma resposta.
var (
	errInvalidAccount         = fmt.Errorf("conta inválida")
	errInvalidCreditCard      = fmt.Errorf("cartão inválido")
	errInvalidCategory        = fmt.Errorf("categoria inválida")
	errInvalidTransferAccount = fmt.Errorf("conta de destino inválida")
	errInvalidTag             = fmt.Errorf("tag inválida")
)

// validateReferences confere toda FK informada contra o workspace do token.
// Campo ausente ou vazio continua permitido — só o que vem preenchido precisa
// pertencer ao workspace. Roda ANTES de qualquer escrita.
func (s *TransactionService) validateReferences(workspaceID string, req CreateTransactionRequest) error {
	check := func(id *string, exists func(string, string) (bool, error), invalid error) error {
		if id == nil || *id == "" {
			return nil
		}
		ok, err := exists(workspaceID, *id)
		if err != nil {
			return err
		}
		if !ok {
			return invalid
		}
		return nil
	}

	if err := check(req.AccountID, s.repo.AccountExists, errInvalidAccount); err != nil {
		return err
	}
	if err := check(req.CreditCardID, s.repo.CreditCardExists, errInvalidCreditCard); err != nil {
		return err
	}
	if err := check(req.CategoryID, s.repo.CategoryExists, errInvalidCategory); err != nil {
		return err
	}
	// Isolamento apenas. A regra de saldo da transferência é o AUD-003.
	if err := check(req.TransferAccount, s.repo.AccountExists, errInvalidTransferAccount); err != nil {
		return err
	}

	// Tags: tudo ou nada. Salvar as válidas e descartar a estranha esconderia
	// a tentativa de acesso cruzado atrás de um sucesso parcial.
	if len(req.TagIDs) > 0 {
		seen := make(map[string]struct{}, len(req.TagIDs))
		unique := make([]string, 0, len(req.TagIDs))
		for _, id := range req.TagIDs {
			if id == "" {
				return errInvalidTag
			}
			if _, dup := seen[id]; dup {
				continue
			}
			seen[id] = struct{}{}
			unique = append(unique, id)
		}
		n, err := s.repo.CountTagsInWorkspace(workspaceID, unique)
		if err != nil {
			return err
		}
		if n != len(unique) {
			return errInvalidTag
		}
	}
	return nil
}

func (s *TransactionService) Create(workspaceID, userID string, req CreateTransactionRequest) ([]*models.Transaction, error) {
	// Antes de qualquer escrita: nenhuma linha deve nascer de uma referência
	// que não pertence a este workspace.
	if err := s.validateReferences(workspaceID, req); err != nil {
		return nil, err
	}

	// repeat_months takes priority over installments for income; installments splits amount
	repeatMonths := req.RepeatMonths
	if repeatMonths < 1 {
		repeatMonths = 1
	}

	installments := req.Installments
	if installments <= 1 || repeatMonths > 1 {
		installments = 1
	}

	var groupID *string
	if installments > 1 || repeatMonths > 1 {
		id := uuid.New().String()
		groupID = &id
	}

	// Parse base date
	baseDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, use YYYY-MM-DD")
	}

	var created []*models.Transaction
	amountPerInstallment := req.Amount / float64(installments)
	iterations := installments
	if repeatMonths > 1 {
		iterations = repeatMonths
	}

	for i := 1; i <= iterations; i++ {
		date := baseDate.AddDate(0, i-1, 0).Format("2006-01-02")

		// For installments: divide amount; for repeat: keep full amount
		txAmount := amountPerInstallment
		if repeatMonths > 1 {
			txAmount = req.Amount
		}

		num := i
		total := installments

		tx := &models.Transaction{
			ID:               uuid.New().String(),
			WorkspaceID:      workspaceID,
			AccountID:        req.AccountID,
			CreditCardID:     req.CreditCardID,
			CategoryID:       req.CategoryID,
			Type:             req.Type,
			Amount:           txAmount,
			Date:             date,
			Description:      req.Description,
			Notes:            req.Notes,
			Paid:             req.Paid,
			TransferAccount:  req.TransferAccount,
			InstallmentGroup: groupID,
		}
		if installments > 1 {
			tx.InstallmentNum = &num
			tx.InstallmentTotal = &total
		}
		if req.Paid {
			now := time.Now()
			tx.PaidAt = &now
		}

		if err := s.repo.Create(tx); err != nil {
			return nil, err
		}
		if len(req.TagIDs) > 0 {
			if err := s.repo.SetTags(workspaceID, tx.ID, req.TagIDs); err != nil {
				return nil, err
			}
		}
		// Lançamento já criado como pago impacta o saldo da conta na hora.
		if tx.Paid {
			accID, err := s.resolveAccountID(workspaceID, tx.AccountID)
			if err != nil {
				return nil, err
			}
			if accID != "" {
				// Erro aqui deixa de ser descartado: falha no ajuste de saldo
				// precisa chegar ao chamador (AUD-001 §12). A atomicidade
				// entre a inserção e o ajuste é o AUD-005, fora deste escopo.
				if err := s.repo.AdjustAccountBalance(workspaceID, accID, s.balanceImpact(tx.Type, tx.Amount)); err != nil {
					return nil, err
				}
			}
		}
		created = append(created, tx)
	}

	// log activity
	go s.activitySvc.Log(workspaceID, userID, "create", "transaction", &created[0].ID, nil)

	// check spending limits after creation
	go s.checkSpendingAlerts(workspaceID, userID, req.CategoryID, req.AccountID, req.CreditCardID)

	return created, nil
}

func (s *TransactionService) Update(workspaceID, userID, txID string, req CreateTransactionRequest) (*models.Transaction, error) {
	existing, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || existing == nil {
		return nil, fmt.Errorf("transaction not found")
	}

	// Mesma validação da criação: trocar o account_id por uma conta de outro
	// workspace numa edição é o mesmo ataque, por outra porta.
	if err := s.validateReferences(workspaceID, req); err != nil {
		return nil, err
	}

	// Snapshot do estado ANTES da edição, para reconciliar o saldo da conta.
	oldPaid := existing.Paid
	oldImpact := s.balanceImpact(existing.Type, existing.Amount)
	oldAccountID, err := s.resolveAccountID(workspaceID, existing.AccountID)
	if err != nil {
		return nil, err
	}

	existing.AccountID = req.AccountID
	existing.CreditCardID = req.CreditCardID
	existing.CategoryID = req.CategoryID
	existing.Type = req.Type
	existing.Amount = req.Amount
	existing.Date = req.Date
	existing.Description = req.Description
	existing.Notes = req.Notes
	if req.Paid && !existing.Paid {
		now := time.Now()
		existing.PaidAt = &now
	}
	if !req.Paid {
		existing.PaidAt = nil
	}
	existing.Paid = req.Paid

	if err := s.repo.Update(existing); err != nil {
		return nil, err
	}
	if req.TagIDs != nil {
		if err := s.repo.SetTags(workspaceID, txID, req.TagIDs); err != nil {
			return nil, err
		}
	}

	// Reconcilia o saldo: desfaz o impacto antigo (se estava pago) e aplica o
	// novo (se está pago). Assim, editar valor/tipo/conta ou alternar o "pago"
	// pelo modal mantém o Saldo Geral coerente — mesmo comportamento do toggle
	// da lista (MarkPaid/MarkUnpaid).
	if oldPaid && oldAccountID != "" {
		if err := s.repo.AdjustAccountBalance(workspaceID, oldAccountID, -oldImpact); err != nil {
			return nil, err
		}
	}
	if req.Paid {
		newAccountID, err := s.resolveAccountID(workspaceID, req.AccountID)
		if err != nil {
			return nil, err
		}
		if newAccountID != "" {
			if err := s.repo.AdjustAccountBalance(workspaceID, newAccountID, s.balanceImpact(req.Type, req.Amount)); err != nil {
				return nil, err
			}
		}
	}

	// Propagate to the rest of the recurrence group when requested.
	if existing.InstallmentGroup != nil && (req.Scope == "future" || req.Scope == "all") {
		fromDate := ""
		if req.Scope == "future" {
			// Only occurrences from the edited one onwards; past months stay untouched.
			fromDate = existing.Date
		}
		if _, err := s.repo.UpdateSeries(existing, *existing.InstallmentGroup, fromDate); err != nil {
			return nil, err
		}
		if req.TagIDs != nil {
			if siblings, err := s.repo.ListByGroup(workspaceID, *existing.InstallmentGroup, fromDate); err == nil {
				for _, sib := range siblings {
					if sib.ID != txID {
						if err := s.repo.SetTags(workspaceID, sib.ID, req.TagIDs); err != nil {
							return nil, err
						}
					}
				}
			}
		}
	}

	// repeat_months == 1 means "no repetition" (same semantics as Create), so only
	// values above 1 generate copies — and the edited transaction already counts as
	// the first occurrence, hence RepeatMonths-1 copies.
	if req.RepeatMonths > 1 {
		baseDate, err := time.Parse("2006-01-02", req.Date)
		if err == nil {
			groupID := uuid.New().String()
			for i := 1; i <= req.RepeatMonths-1; i++ {
				date := baseDate.AddDate(0, i, 0).Format("2006-01-02")
				tx := &models.Transaction{
					ID:               uuid.New().String(),
					WorkspaceID:      workspaceID,
					AccountID:        req.AccountID,
					CreditCardID:     req.CreditCardID,
					CategoryID:       req.CategoryID,
					Type:             req.Type,
					Amount:           req.Amount,
					Date:             date,
					Description:      req.Description,
					Notes:            req.Notes,
					Paid:             false,
					InstallmentGroup: &groupID,
				}
				if err := s.repo.Create(tx); err != nil {
					break
				}
				if len(req.TagIDs) > 0 {
					if err := s.repo.SetTags(workspaceID, tx.ID, req.TagIDs); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return existing, nil
}

// balanceImpact devolve quanto uma transação PAGA afeta o saldo da conta:
// receita/transferência somam, despesa subtrai.
func (s *TransactionService) balanceImpact(txType string, amount float64) float64 {
	if txType == "expense" {
		return -amount
	}
	return amount
}

// resolveAccountID usa a conta vinculada ou, na falta, a primeira do workspace.
//
// A conta vinculada é reconferida aqui mesmo já tendo passado por
// validateReferences: este é o último ponto antes do ajuste de saldo, e ele
// também é alcançado por caminhos que não vêm do corpo da requisição (um
// lançamento gravado antes desta correção pode carregar um account_id de
// outro workspace). Nenhum id chega ao saldo sem passar por aqui.
func (s *TransactionService) resolveAccountID(workspaceID string, accountID *string) (string, error) {
	if accountID != nil && *accountID != "" {
		ok, err := s.repo.AccountExists(workspaceID, *accountID)
		if err != nil {
			return "", err
		}
		if !ok {
			return "", errInvalidAccount
		}
		return *accountID, nil
	}
	return s.repo.GetFirstAccountID(workspaceID), nil
}

func (s *TransactionService) MarkPaid(workspaceID, userID, txID string) (*models.Transaction, error) {
	tx, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || tx == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	if tx.Paid {
		return tx, nil // already paid
	}
	now := time.Now()
	tx.Paid = true
	tx.PaidAt = &now
	if err := s.repo.Update(tx); err != nil {
		return nil, err
	}
	// Adjust account balance: use linked account or fall back to workspace's first account.
	// Passa por resolveAccountID para que a conta gravada no lançamento seja
	// reconferida contra o workspace antes de tocar em saldo (AUD-001).
	accountID, err := s.resolveAccountID(workspaceID, tx.AccountID)
	if err != nil {
		return nil, err
	}
	if accountID != "" {
		delta := tx.Amount
		if tx.Type == "expense" {
			delta = -tx.Amount
		}
		if err := s.repo.AdjustAccountBalance(workspaceID, accountID, delta); err != nil {
			return nil, err
		}
	}
	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return tx, nil
}

func (s *TransactionService) MarkUnpaid(workspaceID, userID, txID string) (*models.Transaction, error) {
	tx, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || tx == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	if !tx.Paid {
		return tx, nil // already unpaid
	}
	tx.Paid = false
	tx.PaidAt = nil
	if err := s.repo.Update(tx); err != nil {
		return nil, err
	}
	// Reverse the balance adjustment (mesma reconferência de workspace).
	accountID, err := s.resolveAccountID(workspaceID, tx.AccountID)
	if err != nil {
		return nil, err
	}
	if accountID != "" {
		delta := -tx.Amount
		if tx.Type == "expense" {
			delta = tx.Amount
		}
		if err := s.repo.AdjustAccountBalance(workspaceID, accountID, delta); err != nil {
			return nil, err
		}
	}
	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return tx, nil
}

// DeleteScoped removes a transaction and, for "future"/"all", the rest of its
// recurrence group. Returns the total number of deleted transactions.
func (s *TransactionService) DeleteScoped(workspaceID, userID, txID, scope string) (int, error) {
	existing, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || existing == nil {
		return 0, fmt.Errorf("transaction not found")
	}

	var siblings int64
	if existing.InstallmentGroup != nil && (scope == "future" || scope == "all") {
		fromDate := ""
		if scope == "future" {
			fromDate = existing.Date
		}
		siblings, err = s.repo.DeleteSeries(txID, workspaceID, *existing.InstallmentGroup, fromDate)
		if err != nil {
			return 0, err
		}
	}

	// Apagar um lançamento PAGO precisa reverter o impacto que ele teve no saldo.
	if existing.Paid {
		accID, err := s.resolveAccountID(workspaceID, existing.AccountID)
		if err != nil {
			return 0, err
		}
		if accID != "" {
			if err := s.repo.AdjustAccountBalance(workspaceID, accID, -s.balanceImpact(existing.Type, existing.Amount)); err != nil {
				return 0, err
			}
		}
	}

	if err := s.repo.Delete(txID, workspaceID); err != nil {
		return 0, err
	}

	go s.activitySvc.Log(workspaceID, userID, "delete", "transaction", &txID, nil)
	return int(siblings) + 1, nil
}

// Duplicate creates a copy of an existing transaction (AC-UX-06)
func (s *TransactionService) Duplicate(workspaceID, userID, txID string) (*models.Transaction, error) {
	src, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || src == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	tags, _ := s.repo.GetTags(workspaceID, txID)
	tagIDs := make([]string, len(tags))
	for i, t := range tags {
		tagIDs[i] = t.ID
	}

	today := time.Now().Format("2006-01-02")
	req := CreateTransactionRequest{
		AccountID:    src.AccountID,
		CreditCardID: src.CreditCardID,
		CategoryID:   src.CategoryID,
		Type:         src.Type,
		Amount:       src.Amount,
		Date:         today,
		Description:  src.Description,
		Notes:        src.Notes,
		Paid:         false,
		TagIDs:       tagIDs,
	}
	txs, err := s.Create(workspaceID, userID, req)
	if err != nil {
		return nil, err
	}
	return txs[0], nil
}

func (s *TransactionService) checkSpendingAlerts(workspaceID, userID string, categoryID, accountID, creditCardID *string) {
	limits, err := s.spendingRepo.List(workspaceID)
	if err != nil {
		return
	}
	for _, l := range limits {
		// only check limits relevant to this transaction
		relevant := false
		if l.CategoryID != nil && categoryID != nil && *l.CategoryID == *categoryID {
			relevant = true
		}
		if l.AccountID != nil && accountID != nil && *l.AccountID == *accountID {
			relevant = true
		}
		if l.CreditCardID != nil && creditCardID != nil && *l.CreditCardID == *creditCardID {
			relevant = true
		}
		if !relevant {
			continue
		}

		spend, err := s.spendingRepo.ComputeCurrentSpend(l, "")
		if err != nil {
			continue
		}
		pct := (spend / l.Amount) * 100

		// AC-LG-08: exceeded
		if pct >= 100 {
			_ = s.notifSvc.CreateForWorkspace(workspaceID, "limit_exceeded",
				"Limite ultrapassado",
				fmt.Sprintf("O gasto atingiu %.0f%% do limite de R$ %.2f", pct, l.Amount),
			)
		} else if pct >= l.AlertPct {
			// AC-LG-07: approaching
			_ = s.notifSvc.CreateForWorkspace(workspaceID, "spending_alert",
				"Alerta de limite",
				fmt.Sprintf("O gasto atingiu %.0f%% do limite de R$ %.2f", pct, l.Amount),
			)
		}
	}
}
