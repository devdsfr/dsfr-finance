package models

import (
	"encoding/json"
	"time"
)

// ────────────────────────────────────────────────────────────────────────────
// USER
// ────────────────────────────────────────────────────────────────────────────

type User struct {
	ID           string     `json:"id" db:"id"`
	Name         string     `json:"name" db:"name"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	MFASecret    *string    `json:"-" db:"mfa_secret"`
	MFAEnabled   bool       `json:"mfa_enabled" db:"mfa_enabled"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// WORKSPACE
// ────────────────────────────────────────────────────────────────────────────

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"` // personal | business
	OwnerID   string    `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WorkspaceMember struct {
	WorkspaceID string     `json:"workspace_id"`
	UserID      string     `json:"user_id"`
	Role        string     `json:"role"` // owner | editor | viewer
	InvitedBy   *string    `json:"invited_by,omitempty"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	// expanded
	User *User `json:"user,omitempty"`
}

type WorkspaceInvite struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	Token       string     `json:"token,omitempty"`
	InvitedBy   string     `json:"invited_by"`
	ExpiresAt   time.Time  `json:"expires_at"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// ACCOUNT
// ────────────────────────────────────────────────────────────────────────────

type Account struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // checking | savings | investment | wallet
	Currency    string    `json:"currency"`
	Balance     float64   `json:"balance"`
	Color       *string   `json:"color,omitempty"`
	Icon        *string   `json:"icon,omitempty"`
	BankCode    *string   `json:"bank_code,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// CREDIT CARD
// ────────────────────────────────────────────────────────────────────────────

type CreditCard struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	AccountID   *string   `json:"account_id,omitempty"`
	Name        string    `json:"name"`
	Limit       float64   `json:"limit_amount"`
	ClosingDay  int       `json:"closing_day"`
	DueDay      int       `json:"due_day"`
	Color       *string   `json:"color,omitempty"`
	Icon        *string   `json:"icon,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// CATEGORY
// ────────────────────────────────────────────────────────────────────────────

type Category struct {
	ID          string      `json:"id"`
	WorkspaceID string      `json:"workspace_id"`
	ParentID    *string     `json:"parent_id,omitempty"`
	Name        string      `json:"name"`
	Type        string      `json:"type"` // expense | income | both
	Icon        *string     `json:"icon,omitempty"`
	Color       *string     `json:"color,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	Children    []*Category `json:"children,omitempty"`
}

// ────────────────────────────────────────────────────────────────────────────
// TAG
// ────────────────────────────────────────────────────────────────────────────

type Tag struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Color       *string   `json:"color,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// TRANSACTION
// ────────────────────────────────────────────────────────────────────────────

type Transaction struct {
	ID               string     `json:"id"`
	WorkspaceID      string     `json:"workspace_id"`
	AccountID        *string    `json:"account_id,omitempty"`
	CreditCardID     *string    `json:"credit_card_id,omitempty"`
	CategoryID       *string    `json:"category_id,omitempty"`
	Type             string     `json:"type"` // expense | income | transfer
	Amount           float64    `json:"amount"`
	Date             string     `json:"date"` // YYYY-MM-DD
	Description      string     `json:"description"`
	Notes            *string    `json:"notes,omitempty"`
	Paid             bool       `json:"paid"`
	PaidAt           *time.Time `json:"paid_at,omitempty"`
	Ignored          bool       `json:"ignored"`
	InstallmentGroup *string    `json:"installment_group_id,omitempty"`
	InstallmentNum   *int       `json:"installment_number,omitempty"`
	InstallmentTotal *int       `json:"installment_total,omitempty"`
	TransferAccount  *string    `json:"transfer_account_id,omitempty"`
	AttachmentURL    *string    `json:"attachment_url,omitempty"`
	AttachmentName   *string    `json:"attachment_name,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	// expanded
	Tags     []Tag     `json:"tags,omitempty"`
	Category *Category `json:"category,omitempty"`
	Account  *Account  `json:"account,omitempty"`
	Card     *CreditCard `json:"credit_card,omitempty"`
}

// ────────────────────────────────────────────────────────────────────────────
// SPENDING LIMIT
// ────────────────────────────────────────────────────────────────────────────

type SpendingLimit struct {
	ID           string    `json:"id"`
	WorkspaceID  string    `json:"workspace_id"`
	CategoryID   *string   `json:"category_id,omitempty"`
	AccountID    *string   `json:"account_id,omitempty"`
	CreditCardID *string   `json:"credit_card_id,omitempty"`
	Amount       float64   `json:"amount"`
	Period       string    `json:"period"` // monthly | yearly
	AlertPct     float64   `json:"alert_pct"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	// computed
	CurrentSpend float64  `json:"current_spend,omitempty"`
	UsagePct     float64  `json:"usage_pct,omitempty"`
}

// ────────────────────────────────────────────────────────────────────────────
// NOTIFICATION
// ────────────────────────────────────────────────────────────────────────────

type Notification struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	WorkspaceID string    `json:"workspace_id"`
	Type        string    `json:"type"` // spending_alert | limit_exceeded | system
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	Read        bool      `json:"read"`
	CreatedAt   time.Time `json:"created_at"`
}

type AlertConfig struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	WorkspaceID string    `json:"workspace_id"`
	Type        string    `json:"type"` // email_digest | spending_limit
	DayOfWeek   *int      `json:"day_of_week,omitempty"`
	Hour        int       `json:"hour"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ────────────────────────────────────────────────────────────────────────────

type ActivityLog struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	UserID      string          `json:"user_id"`
	Action      string          `json:"action"` // create | update | delete
	EntityType  string          `json:"entity_type"`
	EntityID    *string         `json:"entity_id,omitempty"`
	Payload     json.RawMessage `json:"payload,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	// expanded
	User *User `json:"user,omitempty"`
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT DTOs
// ────────────────────────────────────────────────────────────────────────────

type MonthlyBalance struct {
	Month   string  `json:"month"` // YYYY-MM
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

type AccountBalance struct {
	AccountID   string  `json:"account_id"`
	AccountName string  `json:"account_name"`
	Month       string  `json:"month"`
	Balance     float64 `json:"balance"`
}

type CategorySummary struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        *string `json:"color,omitempty"`
	Icon         *string `json:"icon,omitempty"`
	Total        float64 `json:"total"`
	Count        int     `json:"count"`
}

type PatrimonyPoint struct {
	Month     string  `json:"month"`
	NetWorth  float64 `json:"net_worth"`
}

type ActiveInstallment struct {
	TransactionID    string  `json:"transaction_id"`
	Description      string  `json:"description"`
	CardID           string  `json:"card_id"`
	CardName         string  `json:"card_name"`
	InstallmentNum   int     `json:"installment_number"`
	InstallmentTotal int     `json:"installment_total"`
	Remaining        int     `json:"remaining"`
	AmountPerPart    float64 `json:"amount_per_parcel"`
	TotalRemaining   float64 `json:"total_remaining"`
}
