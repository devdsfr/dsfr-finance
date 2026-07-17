package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/dsfr/finance/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	"github.com/dsfr/finance/internal/middleware"
)

type AuthService struct {
	db        *sql.DB
	jwtSecret string
}

func NewAuthService(db *sql.DB, secret string) *AuthService {
	return &AuthService{db: db, jwtSecret: secret}
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func (s *AuthService) Register(req RegisterRequest) (*models.User, string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}

	userID := uuid.New().String()
	_, err = s.db.Exec(
		"INSERT INTO users(id, name, email, password_hash) VALUES($1,$2,$3,$4)",
		userID, req.Name, req.Email, string(hash),
	)
	if err != nil {
		return nil, "", fmt.Errorf("email already registered")
	}

	// create default workspace
	wsID := uuid.New().String()
	_, err = s.db.Exec(
		"INSERT INTO workspaces(id, name, type, owner_id) VALUES($1,$2,$3,$4)",
		wsID, req.Name+"'s workspace", "personal", userID,
	)
	if err != nil {
		return nil, "", err
	}
	_, err = s.db.Exec(
		"INSERT INTO workspace_members(workspace_id, user_id, role) VALUES($1,$2,'owner')",
		wsID, userID,
	)
	if err != nil {
		return nil, "", err
	}

	user := &models.User{ID: userID, Name: req.Name, Email: req.Email}
	token, err := s.generateToken(userID, wsID)
	return user, token, err
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totp_code"`
}

func (s *AuthService) Login(req LoginRequest) (*models.User, string, error) {
	user := &models.User{}
	var wsID string
	err := s.db.QueryRow(
		`SELECT u.id, u.name, u.email, u.password_hash, u.mfa_secret, u.mfa_enabled,
		        w.id
		 FROM users u
		 JOIN workspace_members wm ON wm.user_id = u.id
		 JOIN workspaces w ON w.id = wm.workspace_id
		 WHERE u.email=$1 ORDER BY w.created_at LIMIT 1`,
		req.Email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.MFASecret, &user.MFAEnabled, &wsID)
	if err != nil {
		return nil, "", fmt.Errorf("usuário não encontrado")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, "", fmt.Errorf("senha incorreta")
	}

	// MFA check (AC-MC-10)
	if user.MFAEnabled {
		if req.TOTPCode == "" {
			return nil, "mfa_required", nil
		}
		if user.MFASecret == nil || !totp.Validate(req.TOTPCode, *user.MFASecret) {
			return nil, "", fmt.Errorf("invalid MFA code")
		}
	}

	token, err := s.generateToken(user.ID, wsID)
	return user, token, err
}

// EnableMFA generates a TOTP secret and returns the provisioning URI (AC-MC-10)
func (s *AuthService) EnableMFA(userID string) (string, string, error) {
	user := &models.User{}
	err := s.db.QueryRow("SELECT id, email FROM users WHERE id=$1", userID).
		Scan(&user.ID, &user.Email)
	if err != nil {
		return "", "", fmt.Errorf("user not found")
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "dsfr-finance",
		AccountName: user.Email,
	})
	if err != nil {
		return "", "", err
	}

	_, err = s.db.Exec("UPDATE users SET mfa_secret=$1 WHERE id=$2", key.Secret(), userID)
	return key.Secret(), key.URL(), err
}

// ConfirmMFA validates the TOTP code and activates MFA
func (s *AuthService) ConfirmMFA(userID, code string) error {
	var secret *string
	err := s.db.QueryRow("SELECT mfa_secret FROM users WHERE id=$1", userID).Scan(&secret)
	if err != nil || secret == nil {
		return fmt.Errorf("MFA not initialized")
	}
	if !totp.Validate(code, *secret) {
		return fmt.Errorf("invalid code")
	}
	_, err = s.db.Exec("UPDATE users SET mfa_enabled=true WHERE id=$1", userID)
	return err
}

func (s *AuthService) DisableMFA(userID string) error {
	_, err := s.db.Exec("UPDATE users SET mfa_enabled=false, mfa_secret=NULL WHERE id=$1", userID)
	return err
}

func (s *AuthService) generateToken(userID, workspaceID string) (string, error) {
	claims := &middleware.Claims{
		UserID:      userID,
		WorkspaceID: workspaceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
