package handlers_test

// Testes da rodada AUD-001B — resíduos de isolamento fora do TransactionService.
//
// Cobrem os caminhos que a primeira correção não alcançava:
//   - importação de extrato (Analyze e Import) com conta de outro workspace;
//   - leitura de tag por vínculo legado cruzado;
//   - limites de gastos e objetivos referenciando recursos de outro workspace.
//
// São testes de HANDLER, exercitando a rota HTTP de ponta a ponta, e não do
// repositório. O motivo importa: testar só `ValidateRefs` provaria que a
// função funciona, não que o handler a chama. Um handler que esquecesse a
// chamada passaria no teste de repositório e continuaria vulnerável.
//
// Execução (mesmo esquema do arquivo de testes do AUD-001):
//
//	TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/dsfr_test?sslmode=disable" \
//	  go test ./internal/handlers/ -run AUD001B -v

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/dsfr/finance/internal/handlers"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq" // registra o driver "postgres"
)

// ── Infraestrutura ──────────────────────────────────────────────────────

func openDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL não definida; pulando teste de integração")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("abrindo banco de teste: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("banco de teste inacessível: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

type ws struct {
	ID         string
	UserID     string
	AccountID  string
	CardID     string
	CategoryID string
	TagID      string
}

func newWorkspace(t *testing.T, db *sql.DB, nome string) ws {
	t.Helper()
	w := ws{
		ID:         uuid.New().String(),
		UserID:     uuid.New().String(),
		AccountID:  uuid.New().String(),
		CardID:     uuid.New().String(),
		CategoryID: uuid.New().String(),
		TagID:      uuid.New().String(),
	}
	exec := func(q string, args ...interface{}) {
		if _, err := db.Exec(q, args...); err != nil {
			t.Fatalf("preparando workspace %s: %v", nome, err)
		}
	}
	exec(`INSERT INTO users (id, name, email, password_hash) VALUES ($1,$2,$3,'x')`,
		w.UserID, "u"+nome, nome+"-"+w.UserID[:8]+"@teste.local")
	exec(`INSERT INTO workspaces (id, name, type, owner_id) VALUES ($1,$2,'personal',$3)`,
		w.ID, "ws"+nome, w.UserID)
	exec(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')`,
		w.ID, w.UserID)
	exec(`INSERT INTO accounts (id, workspace_id, name, type, balance)
	      VALUES ($1,$2,$3,'checking',10000)`, w.AccountID, w.ID, "conta"+nome)
	exec(`INSERT INTO credit_cards (id, workspace_id, name, limit_amount, closing_day, due_day)
	      VALUES ($1,$2,$3,5000,16,26)`, w.CardID, w.ID, "cartao"+nome)
	exec(`INSERT INTO categories (id, workspace_id, name, type)
	      VALUES ($1,$2,$3,'expense')`, w.CategoryID, w.ID, "cat"+nome)
	exec(`INSERT INTO tags (id, workspace_id, name) VALUES ($1,$2,$3)`,
		w.TagID, w.ID, "tag"+nome+"-"+w.TagID[:8])

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM workspaces WHERE id=$1`, w.ID)
		_, _ = db.Exec(`DELETE FROM users WHERE id=$1`, w.UserID)
	})
	return w
}

// router monta uma rota autenticada como o workspace informado, sem passar
// pelo JWT: o middleware real só popula estas duas chaves no contexto.
func router(w ws, method, path string, h gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("workspace_id", w.ID)
		c.Set("user_id", w.UserID)
		c.Next()
	})
	r.Handle(method, path, h)
	return r
}

func post(t *testing.T, r *gin.Engine, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("montando corpo: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func saldo(t *testing.T, db *sql.DB, accountID string) float64 {
	t.Helper()
	var v float64
	if err := db.QueryRow(`SELECT balance FROM accounts WHERE id=$1`, accountID).Scan(&v); err != nil {
		t.Fatalf("lendo saldo: %v", err)
	}
	return v
}

func contaTransacoes(t *testing.T, db *sql.DB, workspaceID string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE workspace_id=$1`, workspaceID).Scan(&n); err != nil {
		t.Fatalf("contando lançamentos: %v", err)
	}
	return n
}

// ── §11 — Importação de extrato ─────────────────────────────────────────

func TestAUD001B_ImportComContaDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewStatementImportHandler(db)
	r := router(a, http.MethodPost, "/import/statement", h.Import)

	saldoBAntes := saldo(t, db, b.AccountID)

	rec := post(t, r, "/import/statement", map[string]interface{}{
		"account_id": b.AccountID, // conta do workspace B
		"transactions": []map[string]interface{}{
			{"external_id": "FIT-1", "date": "2026-09-12", "description": "x",
				"amount": 250.0, "type": "expense"},
		},
	})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperava 400, veio %d: %s", rec.Code, rec.Body.String())
	}
	if n := contaTransacoes(t, db, a.ID); n != 0 {
		t.Errorf("nenhum lançamento deveria existir no workspace A, encontrei %d", n)
	}
	if n := contaTransacoes(t, db, b.ID); n != 0 {
		t.Errorf("nenhum lançamento deveria existir no workspace B, encontrei %d", n)
	}
	if got := saldo(t, db, b.AccountID); got != saldoBAntes {
		t.Errorf("saldo de B mudou: antes %.2f, depois %.2f", saldoBAntes, got)
	}
}

func TestAUD001B_AnalyzeComContaDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewStatementImportHandler(db)
	r := router(a, http.MethodPost, "/import/statement/analyze", h.Analyze)

	rec := post(t, r, "/import/statement/analyze", map[string]interface{}{
		"account_id": b.AccountID,
		"transactions": []map[string]interface{}{
			{"external_id": "FIT-1", "date": "2026-09-12", "description": "x",
				"amount": 250.0, "type": "expense"},
		},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperava 400 já no analyze, veio %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAUD001B_ImportComCategoriaDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewStatementImportHandler(db)
	r := router(a, http.MethodPost, "/import/statement", h.Import)

	rec := post(t, r, "/import/statement", map[string]interface{}{
		"account_id": a.AccountID, // conta própria, categoria alheia
		"transactions": []map[string]interface{}{
			{"external_id": "FIT-2", "date": "2026-09-12", "description": "x",
				"amount": 100.0, "type": "expense", "category_id": b.CategoryID},
		},
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperava 400, veio %d: %s", rec.Code, rec.Body.String())
	}
	if n := contaTransacoes(t, db, a.ID); n != 0 {
		t.Errorf("nenhuma linha deveria ser gravada, encontrei %d", n)
	}
}

func TestAUD001B_ImportCaminhoFeliz(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")

	h := handlers.NewStatementImportHandler(db)
	r := router(a, http.MethodPost, "/import/statement", h.Import)

	rec := post(t, r, "/import/statement", map[string]interface{}{
		"account_id": a.AccountID,
		"transactions": []map[string]interface{}{
			{"external_id": "FIT-3", "date": "2026-09-12", "description": "mercado",
				"amount": 100.0, "type": "expense", "category_id": a.CategoryID},
		},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("importação legítima foi recusada (%d): %s", rec.Code, rec.Body.String())
	}
	if n := contaTransacoes(t, db, a.ID); n != 1 {
		t.Errorf("esperava 1 lançamento, encontrei %d", n)
	}
	if got := saldo(t, db, a.AccountID); got != 9900 {
		t.Errorf("saldo após importar despesa de 100: esperava 9900, veio %.2f", got)
	}
}

// ── §11 — Leitura de tag por vínculo legado ─────────────────────────────
//
// Simula o estado deixado por uma exploração anterior à correção: um vínculo
// entre transação de A e tag de B já gravado em transaction_tags.

func criaVinculoLegado(t *testing.T, db *sql.DB, a, b ws) string {
	t.Helper()
	txID := uuid.New().String()
	if _, err := db.Exec(`
		INSERT INTO transactions (id, workspace_id, type, amount, date, description)
		VALUES ($1,$2,'expense',100,'2026-09-12','legado')`, txID, a.ID); err != nil {
		t.Fatalf("criando transação legada: %v", err)
	}
	// Vínculo cruzado gravado direto, contornando SetTags de propósito.
	if _, err := db.Exec(`
		INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1,$2)`,
		txID, b.TagID); err != nil {
		t.Fatalf("criando vínculo cruzado: %v", err)
	}
	// E um vínculo legítimo, para provar que o filtro não derruba o que é do
	// próprio workspace.
	if _, err := db.Exec(`
		INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1,$2)`,
		txID, a.TagID); err != nil {
		t.Fatalf("criando vínculo legítimo: %v", err)
	}
	return txID
}

func TestAUD001B_GetTagsNaoDevolveTagDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")
	txID := criaVinculoLegado(t, db, a, b)

	repo := repositories.NewTransactionRepository(db)
	tags, err := repo.GetTags(a.ID, txID)
	if err != nil {
		t.Fatalf("GetTags falhou: %v", err)
	}
	if len(tags) != 1 {
		t.Fatalf("esperava só a tag do próprio workspace, vieram %d", len(tags))
	}
	if tags[0].ID != a.TagID {
		t.Errorf("tag devolvida é de outro workspace: %s", tags[0].ID)
	}
	for _, tg := range tags {
		if tg.ID == b.TagID {
			t.Error("tag do workspace B vazou por vínculo legado")
		}
	}
}

func TestAUD001B_GetTagsForTransactionsNaoDevolveTagDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")
	txID := criaVinculoLegado(t, db, a, b)

	repo := repositories.NewTransactionRepository(db)
	porTx, err := repo.GetTagsForTransactions(a.ID, []string{txID})
	if err != nil {
		t.Fatalf("GetTagsForTransactions falhou: %v", err)
	}
	tags := porTx[txID]
	if len(tags) != 1 {
		t.Fatalf("esperava só a tag do próprio workspace, vieram %d", len(tags))
	}
	for _, tg := range tags {
		if tg.ID == b.TagID {
			t.Error("tag do workspace B vazou por vínculo legado")
		}
	}
}

// ── §11 — Limites de gastos ─────────────────────────────────────────────

func TestAUD001B_SpendingLimitComRecursosDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewSpendingHandler(repositories.NewSpendingRepository(db))
	r := router(a, http.MethodPost, "/spending-limits", h.Create)

	casos := []struct {
		nome  string
		corpo map[string]interface{}
	}{
		{"conta de B", map[string]interface{}{"amount": 500.0, "period": "monthly", "account_id": b.AccountID}},
		{"categoria de B", map[string]interface{}{"amount": 500.0, "period": "monthly", "category_id": b.CategoryID}},
		{"cartão de B", map[string]interface{}{"amount": 500.0, "period": "monthly", "credit_card_id": b.CardID}},
	}
	for _, caso := range casos {
		t.Run(caso.nome, func(t *testing.T) {
			rec := post(t, r, "/spending-limits", caso.corpo)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("esperava 400, veio %d: %s", rec.Code, rec.Body.String())
			}
		})
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM spending_limits WHERE workspace_id=$1`, a.ID).Scan(&n); err != nil {
		t.Fatalf("contando limites: %v", err)
	}
	if n != 0 {
		t.Errorf("nenhum limite deveria ter sido criado, encontrei %d", n)
	}
}

func TestAUD001B_SpendingLimitCaminhoFeliz(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")

	h := handlers.NewSpendingHandler(repositories.NewSpendingRepository(db))
	r := router(a, http.MethodPost, "/spending-limits", h.Create)

	rec := post(t, r, "/spending-limits", map[string]interface{}{
		"amount": 500.0, "period": "monthly", "category_id": a.CategoryID,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("limite legítimo foi recusado (%d): %s", rec.Code, rec.Body.String())
	}
}

// ── §11 — Objetivos ─────────────────────────────────────────────────────

func TestAUD001B_GoalComRecursosDeOutroWorkspace(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewGoalHandler(repositories.NewGoalRepository(db))
	r := router(a, http.MethodPost, "/goals", h.Create)

	casos := []struct {
		nome  string
		corpo map[string]interface{}
	}{
		{"conta de B", map[string]interface{}{"name": "meta", "type": "saving", "target_amount": 1000.0, "account_id": b.AccountID}},
		{"categoria de B", map[string]interface{}{"name": "meta", "type": "category", "target_amount": 1000.0, "category_id": b.CategoryID}},
	}
	for _, caso := range casos {
		t.Run(caso.nome, func(t *testing.T) {
			rec := post(t, r, "/goals", caso.corpo)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("esperava 400, veio %d: %s", rec.Code, rec.Body.String())
			}
		})
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM goals WHERE workspace_id=$1`, a.ID).Scan(&n); err != nil {
		t.Fatalf("contando objetivos: %v", err)
	}
	if n != 0 {
		t.Errorf("nenhum objetivo deveria ter sido criado, encontrei %d", n)
	}
}

func TestAUD001B_GoalCaminhoFeliz(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")

	h := handlers.NewGoalHandler(repositories.NewGoalRepository(db))
	r := router(a, http.MethodPost, "/goals", h.Create)

	rec := post(t, r, "/goals", map[string]interface{}{
		"name": "reserva", "type": "saving", "target_amount": 1000.0,
		"account_id": a.AccountID,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("objetivo legítimo foi recusado (%d): %s", rec.Code, rec.Body.String())
	}
}

// ── UUID inexistente é indistinguível de UUID externo ───────────────────

func TestAUD001B_UUIDInexistenteNaoVazaExistencia(t *testing.T) {
	db := openDB(t)
	a := newWorkspace(t, db, "A")
	b := newWorkspace(t, db, "B")

	h := handlers.NewGoalHandler(repositories.NewGoalRepository(db))
	r := router(a, http.MethodPost, "/goals", h.Create)

	fantasma := post(t, r, "/goals", map[string]interface{}{
		"name": "m", "type": "saving", "target_amount": 1.0,
		"account_id": uuid.New().String(),
	})
	externo := post(t, r, "/goals", map[string]interface{}{
		"name": "m", "type": "saving", "target_amount": 1.0,
		"account_id": b.AccountID,
	})

	if fantasma.Code != externo.Code {
		t.Errorf("códigos diferentes revelam existência: %d vs %d", fantasma.Code, externo.Code)
	}
	if fantasma.Body.String() != externo.Body.String() {
		t.Errorf("corpos diferentes revelam existência:\n%s\n%s",
			fantasma.Body.String(), externo.Body.String())
	}
}
