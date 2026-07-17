package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/dsfr/finance/internal/models"
	"github.com/google/uuid"
)

type NotificationService struct {
	db *sql.DB
}

func NewNotificationService(db *sql.DB) *NotificationService {
	return &NotificationService{db: db}
}

func (s *NotificationService) CreateForWorkspace(workspaceID, notifType, title, body string) error {
	// fetch all members of workspace
	rows, err := s.db.Query(
		"SELECT user_id FROM workspace_members WHERE workspace_id=$1",
		workspaceID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		_ = s.Create(userID, workspaceID, notifType, title, body)
	}
	return nil
}

func (s *NotificationService) Create(userID, workspaceID, notifType, title, body string) error {
	_, err := s.db.Exec(
		`INSERT INTO notifications(id, user_id, workspace_id, type, title, body)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		uuid.New().String(), userID, workspaceID, notifType, title, body,
	)
	return err
}

func (s *NotificationService) ListForUser(userID, workspaceID string) ([]*models.Notification, error) {
	q := `SELECT id, user_id, workspace_id, type, title, body, read, created_at
	      FROM notifications WHERE user_id=$1 AND workspace_id=$2
	      ORDER BY created_at DESC LIMIT 50`
	rows, err := s.db.Query(q, userID, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notifs []*models.Notification
	for rows.Next() {
		n := &models.Notification{}
		if err := rows.Scan(&n.ID, &n.UserID, &n.WorkspaceID, &n.Type, &n.Title, &n.Body, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		notifs = append(notifs, n)
	}
	return notifs, nil
}

func (s *NotificationService) MarkRead(id, userID string) error {
	_, err := s.db.Exec("UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2", id, userID)
	return err
}

func (s *NotificationService) MarkAllRead(userID, workspaceID string) error {
	_, err := s.db.Exec(
		"UPDATE notifications SET read=true WHERE user_id=$1 AND workspace_id=$2",
		userID, workspaceID,
	)
	return err
}

// GetAlertConfig returns alert configuration for a user
func (s *NotificationService) GetAlertConfigs(userID, workspaceID string) ([]*models.AlertConfig, error) {
	q := `SELECT id, user_id, workspace_id, type, day_of_week, hour, enabled, created_at, updated_at
	      FROM alert_configs WHERE user_id=$1 AND workspace_id=$2`
	rows, err := s.db.Query(q, userID, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var configs []*models.AlertConfig
	for rows.Next() {
		c := &models.AlertConfig{}
		if err := rows.Scan(&c.ID, &c.UserID, &c.WorkspaceID, &c.Type, &c.DayOfWeek, &c.Hour,
			&c.Enabled, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		configs = append(configs, c)
	}
	return configs, nil
}

func (s *NotificationService) UpsertAlertConfig(cfg *models.AlertConfig) error {
	if cfg.ID == "" {
		cfg.ID = uuid.New().String()
		_, err := s.db.Exec(
			`INSERT INTO alert_configs(id, user_id, workspace_id, type, day_of_week, hour, enabled)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			cfg.ID, cfg.UserID, cfg.WorkspaceID, cfg.Type, cfg.DayOfWeek, cfg.Hour, cfg.Enabled,
		)
		return err
	}
	_, err := s.db.Exec(
		`UPDATE alert_configs SET day_of_week=$1, hour=$2, enabled=$3, updated_at=NOW()
		 WHERE id=$4 AND user_id=$5`,
		cfg.DayOfWeek, cfg.Hour, cfg.Enabled, cfg.ID, cfg.UserID,
	)
	return err
}

// ShouldSendDigest checks if it's time to send digest to a user (AC-AL-05)
func (s *NotificationService) ShouldSendDigest(userID, workspaceID string) bool {
	configs, err := s.GetAlertConfigs(userID, workspaceID)
	if err != nil {
		return false
	}
	now := time.Now()
	for _, cfg := range configs {
		if cfg.Type != "email_digest" || !cfg.Enabled {
			continue
		}
		if cfg.DayOfWeek != nil && int(now.Weekday()) != *cfg.DayOfWeek {
			continue
		}
		if now.Hour() == cfg.Hour {
			return true
		}
	}
	return false
}

// Formatted helper
var _ = fmt.Sprintf
