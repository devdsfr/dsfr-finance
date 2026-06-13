package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WorkspaceHandler struct{ db *sql.DB }

func NewWorkspaceHandler(db *sql.DB) *WorkspaceHandler { return &WorkspaceHandler{db: db} }

func (h *WorkspaceHandler) GetMembers(c *gin.Context) {
	rows, err := h.db.QueryContext(c, `
		SELECT u.id, u.name, u.email, wm.role, wm.joined_at
		FROM workspace_members wm
		JOIN users u ON u.id = wm.user_id
		WHERE wm.workspace_id = $1
		ORDER BY wm.joined_at`, middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var data []gin.H
	for rows.Next() {
		var id, name, email, role string
		var joinedAt interface{}
		rows.Scan(&id, &name, &email, &role, &joinedAt)
		data = append(data, gin.H{"id": id, "name": name, "email": email, "role": role, "joined_at": joinedAt})
	}
	if data == nil {
		data = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *WorkspaceHandler) InviteMember(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id := uuid.New().String()
	token := uuid.New().String()
	_, err := h.db.ExecContext(c, `INSERT INTO workspace_invites (id, workspace_id, email, role, token, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
		id, middleware.GetWorkspaceID(c), body.Email, body.Role, token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true, "message": "Convite enviado"})
}

func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM workspace_members WHERE user_id=$1 AND workspace_id=$2`, c.Param("user_id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *WorkspaceHandler) GetInfo(c *gin.Context) {
	wid := middleware.GetWorkspaceID(c)
	var name, typ string
	err := h.db.QueryRowContext(c, `SELECT name, type FROM workspaces WHERE id=$1`, wid).Scan(&name, &typ)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": wid, "name": name, "type": typ})
}
