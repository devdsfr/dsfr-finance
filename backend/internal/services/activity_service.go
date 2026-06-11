package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/dsfr/finance/internal/models"
	"github.com/google/uuid"
)

type ActivityService struct {
	db *sql.DB
}

func NewActivityService(db *sql.DB) *ActivityService {
	return &ActivityService{db: db}
}

func (s *ActivityService) Log(workspaceID, userID, action, entityType string, entityID *string, payload interface{}) error {
	var raw json.RawMessage
	if payload != nil {
		b, err := json.Marshal(payload)
		if err == nil {
			raw = b
		}
	}
	_, err := s.db.Exec(
		`INSERT INTO activity_logs(id, workspace_id, user_id, action, entity_type, entity_id, payload)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New().String(), workspaceID, userID, action, entityType, entityID, raw,
	)
	return err
}

type ActivityFilter struct {
	WorkspaceID string
	Action      string // create | update | delete  (AC-AT-05)
	EntityType  string
	Page        int
	Limit       int
}

func (s *ActivityService) List(f ActivityFilter) ([]*models.ActivityLog, int, error) {
	args := []interface{}{f.WorkspaceID}
	where := []string{"a.workspace_id = $1"}
	i := 2

	if f.Action != "" {
		where = append(where, fmt.Sprintf("a.action = $%d", i))
		args = append(args, f.Action)
		i++
	}
	if f.EntityType != "" {
		where = append(where, fmt.Sprintf("a.entity_type = $%d", i))
		args = append(args, f.EntityType)
		i++
	}

	whereClause := joinWhere(where)

	var total int
	_ = s.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM activity_logs a WHERE %s", whereClause), args...).Scan(&total)

	limit := f.Limit
	if limit <= 0 {
		limit = 30
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	args = append(args, limit, offset)

	q := fmt.Sprintf(`
		SELECT a.id, a.workspace_id, a.user_id, a.action, a.entity_type, a.entity_id, a.payload, a.created_at,
		       u.name, u.email
		FROM activity_logs a
		JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY a.created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, i, i+1)

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []*models.ActivityLog
	for rows.Next() {
		l := &models.ActivityLog{User: &models.User{}}
		if err := rows.Scan(&l.ID, &l.WorkspaceID, &l.UserID, &l.Action, &l.EntityType,
			&l.EntityID, &l.Payload, &l.CreatedAt, &l.User.Name, &l.User.Email); err != nil {
			return nil, 0, err
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

func joinWhere(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += " AND "
		}
		result += p
	}
	return result
}
