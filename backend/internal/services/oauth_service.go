package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type OAuthProviderConfig struct {
	ClientID     string
	ClientSecret string
}

type OAuthService struct {
	auth      *AuthService
	apiURL    string
	appURL    string
	google    OAuthProviderConfig
	facebook  OAuthProviderConfig
	client    *http.Client
	jwtSecret string
}

func NewOAuthService(auth *AuthService, apiURL, appURL, jwtSecret string,
	google, facebook OAuthProviderConfig) *OAuthService {
	return &OAuthService{
		auth:      auth,
		apiURL:    strings.TrimRight(apiURL, "/"),
		appURL:    strings.TrimRight(appURL, "/"),
		google:    google,
		facebook:  facebook,
		client:    &http.Client{Timeout: 15 * time.Second},
		jwtSecret: jwtSecret,
	}
}

// Enabled reports whether a provider has credentials configured.
func (s *OAuthService) Enabled(provider string) bool {
	switch provider {
	case "google":
		return s.google.ClientID != "" && s.google.ClientSecret != ""
	case "facebook":
		return s.facebook.ClientID != "" && s.facebook.ClientSecret != ""
	}
	return false
}

func (s *OAuthService) redirectURI(provider string) string {
	return fmt.Sprintf("%s/api/v1/auth/oauth/%s/callback", s.apiURL, provider)
}

// ── State (CSRF) — stateless, signed with the JWT secret ────────────────────

func (s *OAuthService) makeState() string {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(s.jwtSecret))
	mac.Write([]byte(ts))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return ts + "." + sig
}

func (s *OAuthService) validState(state string) bool {
	parts := strings.SplitN(state, ".", 2)
	if len(parts) != 2 {
		return false
	}
	ts, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || time.Now().Unix()-ts > 600 { // 10-minute window
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.jwtSecret))
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(parts[1]))
}

// AuthURL builds the provider consent-screen URL to redirect the browser to.
func (s *OAuthService) AuthURL(provider string) (string, error) {
	state := s.makeState()
	switch provider {
	case "google":
		q := url.Values{}
		q.Set("client_id", s.google.ClientID)
		q.Set("redirect_uri", s.redirectURI("google"))
		q.Set("response_type", "code")
		q.Set("scope", "openid email profile")
		q.Set("state", state)
		q.Set("access_type", "online")
		q.Set("prompt", "select_account")
		return "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode(), nil
	case "facebook":
		q := url.Values{}
		q.Set("client_id", s.facebook.ClientID)
		q.Set("redirect_uri", s.redirectURI("facebook"))
		q.Set("response_type", "code")
		q.Set("scope", "email public_profile")
		q.Set("state", state)
		return "https://www.facebook.com/v19.0/dialog/oauth?" + q.Encode(), nil
	}
	return "", fmt.Errorf("provider não suportado")
}

type oauthUserInfo struct {
	ID     string
	Email  string
	Name   string
	Avatar string
}

// HandleCallback exchanges the code, fetches the profile, finds-or-creates the
// user and returns a signed JWT ready to hand to the frontend.
func (s *OAuthService) HandleCallback(provider, code, state string) (string, error) {
	if !s.validState(state) {
		return "", fmt.Errorf("state inválido ou expirado")
	}

	var info *oauthUserInfo
	var err error
	switch provider {
	case "google":
		info, err = s.googleUser(code)
	case "facebook":
		info, err = s.facebookUser(code)
	default:
		return "", fmt.Errorf("provider não suportado")
	}
	if err != nil {
		return "", err
	}
	if info.Email == "" {
		return "", fmt.Errorf("o provedor não retornou um e-mail; verifique as permissões concedidas")
	}

	userID, wsID, err := s.findOrCreateUser(provider, info)
	if err != nil {
		return "", err
	}
	return s.auth.generateToken(userID, wsID)
}

// ── Google ──────────────────────────────────────────────────────────────────

func (s *OAuthService) googleUser(code string) (*oauthUserInfo, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", s.google.ClientID)
	form.Set("client_secret", s.google.ClientSecret)
	form.Set("redirect_uri", s.redirectURI("google"))
	form.Set("grant_type", "authorization_code")

	resp, err := s.client.PostForm("https://oauth2.googleapis.com/token", form)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google token error: %s", string(b))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, err
	}

	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	uResp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer uResp.Body.Close()
	var u struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(uResp.Body).Decode(&u); err != nil {
		return nil, err
	}
	return &oauthUserInfo{ID: u.ID, Email: u.Email, Name: u.Name, Avatar: u.Picture}, nil
}

// ── Facebook ────────────────────────────────────────────────────────────────

func (s *OAuthService) facebookUser(code string) (*oauthUserInfo, error) {
	q := url.Values{}
	q.Set("client_id", s.facebook.ClientID)
	q.Set("client_secret", s.facebook.ClientSecret)
	q.Set("redirect_uri", s.redirectURI("facebook"))
	q.Set("code", code)

	resp, err := s.client.Get("https://graph.facebook.com/v19.0/oauth/access_token?" + q.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("facebook token error: %s", string(b))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, err
	}

	uq := url.Values{}
	uq.Set("fields", "id,name,email,picture")
	uq.Set("access_token", tok.AccessToken)
	uResp, err := s.client.Get("https://graph.facebook.com/me?" + uq.Encode())
	if err != nil {
		return nil, err
	}
	defer uResp.Body.Close()
	var u struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Email   string `json:"email"`
		Picture struct {
			Data struct {
				URL string `json:"url"`
			} `json:"data"`
		} `json:"picture"`
	}
	if err := json.NewDecoder(uResp.Body).Decode(&u); err != nil {
		return nil, err
	}
	return &oauthUserInfo{ID: u.ID, Email: u.Email, Name: u.Name, Avatar: u.Picture.Data.URL}, nil
}

// ── Persistence ─────────────────────────────────────────────────────────────

// findOrCreateUser links by provider id first, then by email (linking a social
// login to a pre-existing local account), otherwise creates a new user.
func (s *OAuthService) findOrCreateUser(provider string, info *oauthUserInfo) (string, string, error) {
	db := s.auth.db

	// 1) Already linked to this external identity.
	var userID, wsID string
	err := db.QueryRow(
		`SELECT u.id, w.id FROM users u
		 JOIN workspace_members wm ON wm.user_id = u.id
		 JOIN workspaces w ON w.id = wm.workspace_id
		 WHERE u.oauth_provider=$1 AND u.oauth_id=$2
		 ORDER BY w.created_at LIMIT 1`,
		provider, info.ID,
	).Scan(&userID, &wsID)
	if err == nil {
		return userID, wsID, nil
	}
	if err != sql.ErrNoRows {
		return "", "", err
	}

	// 2) An account with this email exists — link it.
	err = db.QueryRow(
		`SELECT u.id, w.id FROM users u
		 JOIN workspace_members wm ON wm.user_id = u.id
		 JOIN workspaces w ON w.id = wm.workspace_id
		 WHERE u.email=$1 ORDER BY w.created_at LIMIT 1`,
		info.Email,
	).Scan(&userID, &wsID)
	if err == nil {
		_, uErr := db.Exec(
			`UPDATE users SET oauth_provider=$1, oauth_id=$2,
			   avatar_url=COALESCE(NULLIF($3,''), avatar_url), updated_at=NOW()
			 WHERE id=$4`,
			provider, info.ID, info.Avatar, userID,
		)
		return userID, wsID, uErr
	}
	if err != sql.ErrNoRows {
		return "", "", err
	}

	// 3) Brand new user + default workspace.
	userID = uuid.New().String()
	// Random unusable password so the NOT-NULL-free column stays consistent.
	rand := uuid.New().String() + uuid.New().String()
	hash, _ := bcrypt.GenerateFromPassword([]byte(rand), bcrypt.DefaultCost)
	name := info.Name
	if name == "" {
		name = strings.Split(info.Email, "@")[0]
	}

	tx, err := db.Begin()
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`INSERT INTO users(id, name, email, password_hash, oauth_provider, oauth_id, avatar_url)
		 VALUES($1,$2,$3,$4,$5,$6,$7)`,
		userID, name, info.Email, string(hash), provider, info.ID, info.Avatar,
	); err != nil {
		return "", "", fmt.Errorf("não foi possível criar a conta: %w", err)
	}

	wsID = uuid.New().String()
	if _, err := tx.Exec(
		`INSERT INTO workspaces(id, name, type, owner_id) VALUES($1,$2,$3,$4)`,
		wsID, name+"'s workspace", "personal", userID,
	); err != nil {
		return "", "", err
	}
	if _, err := tx.Exec(
		`INSERT INTO workspace_members(workspace_id, user_id, role) VALUES($1,$2,'owner')`,
		wsID, userID,
	); err != nil {
		return "", "", err
	}
	if err := tx.Commit(); err != nil {
		return "", "", err
	}
	return userID, wsID, nil
}
