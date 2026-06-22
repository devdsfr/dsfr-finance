package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// gzipResponseWriter wraps gin's ResponseWriter so that everything written by
// downstream handlers is transparently piped through a gzip.Writer. Only the
// Write method needs overriding — every other method (Status, Size, Flush,
// Hijack, CloseNotify, Pusher, WriteHeaderNow) is inherited unchanged from
// the embedded gin.ResponseWriter.
type gzipResponseWriter struct {
	gin.ResponseWriter
	writer io.Writer
}

func (g *gzipResponseWriter) Write(data []byte) (int, error) {
	return g.writer.Write(data)
}

func (g *gzipResponseWriter) WriteString(s string) (int, error) {
	return g.writer.Write([]byte(s))
}

// Gzip compresses every response (JSON, CSV, XLSX) for clients that advertise
// gzip support, cutting transfer time/size for list-heavy endpoints like
// /transactions and /reports/*. Uses only the standard library — no new
// dependency, so it can't break the go.sum / module graph.
func Gzip() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		gz := gzip.NewWriter(c.Writer)
		defer gz.Close()

		c.Header("Content-Encoding", "gzip")
		c.Header("Vary", "Accept-Encoding")
		c.Writer.Header().Del("Content-Length") // length changes once compressed

		c.Writer = &gzipResponseWriter{ResponseWriter: c.Writer, writer: gz}
		c.Next()
	}
}

var _ http.ResponseWriter = (*gzipResponseWriter)(nil)
