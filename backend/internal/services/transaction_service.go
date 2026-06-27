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
}

func (s *TransactionService) Create(workspaceID, userID string, req CreateTransactionRequest) ([]*models.Transaction, error) {
	installments := req.Installments
	if installments <= 1 {
		installments = 1
	}

	var groupID *string
	if installments > 1 {
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

	for i := 1; i <= installments; i++ {
		date := baseDate.AddDate(0, i-1, 0).Format("2006-01-02")
		num := i
		total := installments

		tx := &models.Transaction{
			ID:               uuid.New().String(),
			WorkspaceID:      workspaceID,
			AccountID:        req.AccountID,
			CreditCardID:     req.CreditCardID,
			CategoryID:       req.CategoryID,
			Type:             req.Type,
			Amount:           amountPerInstallment,
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
			_ = s.repo.SetTags(tx.ID, req.TagIDs)
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
	existing.Paid = req.Paid

	if err := s.repo.Update(existing); err != nil {
		return nil, err
	}
	if req.TagIDs != nil {
		_ = s.repo.SetTags(txID, req.TagIDs)
	}

	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return existing, nil
}

func (s *TransactionService) MarkPaid(workspaceID, userID, txID string) (*models.Transaction, error) {
	tx, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || tx == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	now := time.Now()
	tx.Paid = true
	tx.PaidAt = &now
	if err := s.repo.Update(tx); err != nil {
		return nil, err
	}
	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return tx, nil
}

func (s *TransactionService) MarkUnpaid(workspaceID, userID, txID string) (*models.Transaction, error) {
	tx, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || tx == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	tx.Paid = false
	tx.PaidAt = nil
	if err := s.repo.Update(tx); err != nil {
		return nil, err
	}
	go s.activitySvc.Log(workspaceID, userID, "update", "transaction", &txID, nil)
	return tx, nil
}

// Duplicate creates a copy of an existing transaction (AC-UX-06)
func (s *TransactionService) Duplicate(workspaceID, userID, txID string) (*models.Transaction, error) {
	src, err := s.repo.GetByID(txID, workspaceID)
	if err != nil || src == nil {
		return nil, fmt.Errorf("transaction not found")
	}
	tags, _ := s.repo.GetTags(txID)
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

		spend, err := s.spendingRepo.ComputeCurrentSpend(l)
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
