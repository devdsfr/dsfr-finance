package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CategoryHandler struct{ db *sql.DB }

func NewCategoryHandler(db *sql.DB) *CategoryHandler { return &CategoryHandler{db: db} }

func (h *CategoryHandler) List(c *gin.Context) {
	rows, err := h.db.QueryContext(c, `SELECT id, name, color, icon, type FROM categories WHERE workspace_id=$1 ORDER BY name`, middleware.GetWorkspaceID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var data []gin.H
	for rows.Next() {
		var id, name, color, icon, typ string
		rows.Scan(&id, &name, &color, &icon, &typ)
		data = append(data, gin.H{"id": id, "name": name, "color": color, "icon": icon, "type": typ})
	}
	if data == nil {
		data = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var body struct {
		Name  string `json:"name"`
		Color string `json:"color"`
		Icon  string `json:"icon"`
		Type  string `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Color == "" {
		body.Color = "#6366f1"
	}
	id := uuid.New().String()
	_, err := h.db.ExecContext(c, `INSERT INTO categories (id, workspace_id, name, color, icon, type, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
		id, middleware.GetWorkspaceID(c), body.Name, body.Color, body.Icon, body.Type)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "name": body.Name, "color": body.Color})
}

func (h *CategoryHandler) Update(c *gin.Context) {
	var body struct {
		Name  string `json:"name"`
		Color string `json:"color"`
		Icon  string `json:"icon"`
	}
	c.ShouldBindJSON(&body)
	h.db.ExecContext(c, `UPDATE categories SET name=$1, color=$2, icon=$3, updated_at=NOW() WHERE id=$4 AND workspace_id=$5`,
		body.Name, body.Color, body.Icon, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	h.db.ExecContext(c, `DELETE FROM categories WHERE id=$1 AND workspace_id=$2`, c.Param("id"), middleware.GetWorkspaceID(c))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
