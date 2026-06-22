package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID      string `json:"user_id"`
	WorkspaceID string `json:"workspace_id"`
	jwt.RegisteredClaims
}

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("workspace_id", claims.WorkspaceID)
		c.Next()
	}
}

func GetUserID(c *gin.Context) string {
	v, _ := c.Get("user_id")
	s, _ := v.(string)
	return s
}

func GetWorkspaceID(c *gin.Context) string {
	v, _ := c.Get("workspace_id")
	s, _ := v.(string)
	return s
}

// RequirePremium blocks a route unless the logged-in user's plan is "premium".
// Must run after Auth(). Returns 403 with code "premium_required" so the
// frontend can show an upsell instead of a generic error.
func RequirePremium(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var plan string
		err := db.QueryRowContext(c, `SELECT plan FROM users WHERE id=$1`, GetUserID(c)).Scan(&plan)
		if err != nil || plan != "premium" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "este recurso está disponível apenas no plano Premium",
				"code":  "premium_required",
			})
			return
		}
		c.Next()
	}
}
