package services_test

// Testes do AUD-001 — isolamento de referências por workspace.
//
// São testes de INTEGRAÇÃO: a vulnerabilidade vive na fronteira entre o
// serviço e o SQL, então mock de repositório não provaria nada. Um mock
// responderia o que mandássemos responder, inclusive num código vulnerável.
//
// Por que não testcontainers: adicionar a dependência exige alterar go.mod e
// go.sum, e o ambiente desta correção não conseguiu executar `go mod`. Um
// go.sum inconsistente quebraria o build de todo mundo. Estes testes usam
// apenas `database/sql` + lib/pq, que já são dependências do projeto.
//
// Como rodar:
//
//	createdb dsfr_test
//	TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/dsfr_test?sslmode=disable" \
//	  go test ./internal/services/ -run AUD001 -v
//
// As migrations precisam ter sido aplicadas nesse banco. Sem a variável
// definida, os testes são pulados (não passam silenciosamente: t.Skip).

import (
	"database/sql"
	"os"
	"testing"

	"github.com/dsfr/finance/internal/repositories"
	"github.com/dsfr/finance/internal/services"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ── Infraestrutura mínima ───────────────────────────────────────────────

func openTestDB(t *testing.T) *sql.DB {
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

func newService(db *sql.DB) *services.TransactionService {
	return services.NewTransactionService(
		repositories.NewTransactionRepository(db),
		repositories.NewSpendingRepository(db),
		services.NewNotificationService(db),
		services.NewActivityService(db),
	)
}

// fixture monta um workspace isolado e devolve os ids criados.
type fixture struct {
	WorkspaceID string
	UserID      string
	AccountID   string
	CardID      string
	CategoryID  string
	TagID       string
}

func newFixture(t *testing.T, db *sql.DB, nome string) fixture {
	t.Helper()
	f := fixture{
		WorkspaceID: uuid.New().String(),
		UserID:      uuid.New().String(),
		AccountID:   uuid.New().String(),
		CardID:      uuid.New().String(),
		CategoryID:  uuid.New().String(),
		TagID:       uuid.New().String(),
	}

	exec := func(q string, args ...interface{}) {
		if _, err := db.Exec(q, args...); err != nil {
			t.Fatalf("preparando fixture %s: %v", nome, err)
		}
	}

	// `plan` vem da migration 003 com default 'free'; não é informado aqui
	// para o fixture não depender da ordem de aplicação das migrations.
	exec(`INSERT INTO users (id, name, email, password_hash)
	      VALUES ($1,$2,$3,'x')`,
		f.UserID, "user "+nome, nome+"-"+f.UserID[:8]+"@teste.local")
	// owner_id é NOT NULL: o usuário precisa existir antes do workspace.
	exec(`INSERT INTO workspaces (id, name, type, owner_id) VALUES ($1,$2,'personal',$3)`,
		f.WorkspaceID, "ws "+nome, f.UserID)
	exec(`INSERT INTO workspace_members (workspace_id, user_id, role)
	      VALUES ($1,$2,'owner')`, f.WorkspaceID, f.UserID)
	exec(`INSERT INTO accounts (id, workspace_id, name, type, balance)
	      VALUES ($1,$2,$3,'checking',10000)`, f.AccountID, f.WorkspaceID, "conta "+nome)
	exec(`INSERT INTO credit_cards (id, workspace_id, name, limit_amount, closing_day, due_day)
	      VALUES ($1,$2,$3,5000,16,26)`, f.CardID, f.WorkspaceID, "cartao "+nome)
	exec(`INSERT INTO categories (id, workspace_id, name, type)
	      VALUES ($1,$2,$3,'expense')`, f.CategoryID, f.WorkspaceID, "cat "+nome)
	exec(`INSERT INTO tags (id, workspace_id, name)
	      VALUES ($1,$2,$3)`, f.TagID, f.WorkspaceID, "tag "+nome+"-"+f.TagID[:8])

	t.Cleanup(func() {
		// ON DELETE CASCADE a partir do workspace limpa o resto.
		_, _ = db.Exec(`DELETE FROM workspaces WHERE id=$1`, f.WorkspaceID)
		_, _ = db.Exec(`DELETE FROM users WHERE id=$1`, f.UserID)
	})
	return f
}

func balanceOf(t *testing.T, db *sql.DB, accountID string) float64 {
	t.Helper()
	var v float64
	if err := db.QueryRow(`SELECT balance FROM accounts WHERE id=$1`, accountID).Scan(&v); err != nil {
		t.Fatalf("lendo saldo: %v", err)
	}
	return v
}

func countTransactions(t *testing.T, db *sql.DB, workspaceID string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE workspace_id=$1`, workspaceID).Scan(&n); err != nil {
		t.Fatalf("contando lançamentos: %v", err)
	}
	return n
}

func str(s string) *string { return &s }

func baseReq() services.CreateTransactionRequest {
	return services.CreateTransactionRequest{
		Type:        "expense",
		Amount:      100,
		Date:        "2026-09-12",
		Description: "teste",
		Paid:        true,
	}
}

// ── §16 — account_id de outro workspace ─────────────────────────────────

func TestAUD001_CreateComAccountDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	saldoBAntes := balanceOf(t, db, b.AccountID)

	req := baseReq()
	req.AccountID = str(b.AccountID) // conta do workspace B

	_, err := svc.Create(a.WorkspaceID, a.UserID, req)
	if err == nil {
		t.Fatal("esperava erro ao usar conta de outro workspace; criação foi aceita")
	}
	if got := err.Error(); got != "conta inválida" {
		t.Errorf("mensagem deve ser genérica, veio %q", got)
	}
	if saldoDepois := balanceOf(t, db, b.AccountID); saldoDepois != saldoBAntes {
		t.Errorf("saldo do workspace B mudou: antes %.2f, depois %.2f", saldoBAntes, saldoDepois)
	}
	if n := countTransactions(t, db, a.WorkspaceID); n != 0 {
		t.Errorf("nenhum lançamento deveria ter sido criado, encontrei %d", n)
	}
}

// ── §17 — credit_card_id de outro workspace ─────────────────────────────

func TestAUD001_CreateComCartaoDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	req.CreditCardID = str(b.CardID)

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err == nil {
		t.Fatal("esperava erro ao usar cartão de outro workspace")
	} else if err.Error() != "cartão inválido" {
		t.Errorf("mensagem deve ser genérica, veio %q", err.Error())
	}
	if n := countTransactions(t, db, a.WorkspaceID); n != 0 {
		t.Errorf("nenhum lançamento deveria existir, encontrei %d", n)
	}
}

// ── §18 — category_id de outro workspace ────────────────────────────────

func TestAUD001_CreateComCategoriaDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	req.CategoryID = str(b.CategoryID)

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err == nil {
		t.Fatal("esperava erro ao usar categoria de outro workspace")
	} else if err.Error() != "categoria inválida" {
		t.Errorf("mensagem deve ser genérica, veio %q", err.Error())
	}
}

// ── §19 — transfer_account_id de outro workspace ────────────────────────
//
// Apenas isolamento. A regra de saldo da transferência é o AUD-003 e não é
// exercitada aqui de propósito.

func TestAUD001_CreateComContaDestinoDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	req.Type = "transfer"
	req.AccountID = str(a.AccountID)
	req.TransferAccount = str(b.AccountID)

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err == nil {
		t.Fatal("esperava erro ao usar conta de destino de outro workspace")
	} else if err.Error() != "conta de destino inválida" {
		t.Errorf("mensagem deve ser genérica, veio %q", err.Error())
	}
}

// ── §20 — tag de outro workspace, regra tudo-ou-nada ────────────────────

func TestAUD001_CreateComTagDeOutroWorkspaceRejeitaTudo(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	// Uma tag válida do próprio workspace + uma tag estranha.
	req.TagIDs = []string{a.TagID, b.TagID}

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err == nil {
		t.Fatal("esperava erro ao usar tag de outro workspace")
	} else if err.Error() != "tag inválida" {
		t.Errorf("mensagem deve ser genérica, veio %q", err.Error())
	}

	if n := countTransactions(t, db, a.WorkspaceID); n != 0 {
		t.Errorf("nenhum lançamento deveria existir, encontrei %d", n)
	}
	// E nenhuma tag pode ter sido aplicada parcialmente. A contagem é escopada
	// às tags destes dois workspaces para não depender do estado do banco.
	var vinculos int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM transaction_tags WHERE tag_id = ANY($1)`,
		pq.Array([]string{a.TagID, b.TagID}),
	).Scan(&vinculos); err != nil {
		t.Fatalf("contando vínculos de tag: %v", err)
	}
	if vinculos != 0 {
		t.Errorf("tag aplicada parcialmente: %d vínculos criados", vinculos)
	}
}

// ── §21 — Update trocando para conta de outro workspace ─────────────────

func TestAUD001_UpdateTrocandoParaAccountDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	// Lançamento legítimo no workspace A.
	req := baseReq()
	req.AccountID = str(a.AccountID)
	criados, err := svc.Create(a.WorkspaceID, a.UserID, req)
	if err != nil {
		t.Fatalf("criação legítima falhou: %v", err)
	}
	txID := criados[0].ID

	saldoBAntes := balanceOf(t, db, b.AccountID)
	saldoAAntes := balanceOf(t, db, a.AccountID)

	// Agora tenta apontar para a conta do workspace B.
	upd := baseReq()
	upd.AccountID = str(b.AccountID)

	if _, err := svc.Update(a.WorkspaceID, a.UserID, txID, upd); err == nil {
		t.Fatal("esperava erro ao migrar o lançamento para conta de outro workspace")
	} else if err.Error() != "conta inválida" {
		t.Errorf("mensagem deve ser genérica, veio %q", err.Error())
	}

	// A transação original permanece intacta.
	var accountID sql.NullString
	if err := db.QueryRow(`SELECT account_id FROM transactions WHERE id=$1`, txID).Scan(&accountID); err != nil {
		t.Fatalf("relendo o lançamento: %v", err)
	}
	if !accountID.Valid || accountID.String != a.AccountID {
		t.Errorf("lançamento deveria continuar na conta de A, está em %v", accountID)
	}
	if got := balanceOf(t, db, b.AccountID); got != saldoBAntes {
		t.Errorf("saldo de B mudou: antes %.2f, depois %.2f", saldoBAntes, got)
	}
	if got := balanceOf(t, db, a.AccountID); got != saldoAAntes {
		t.Errorf("saldo de A não deveria mudar numa edição rejeitada: antes %.2f, depois %.2f", saldoAAntes, got)
	}
}

// ── §22 — repositório: defesa em profundidade ───────────────────────────

func TestAUD001_AdjustAccountBalanceRecusaContaDeOutroWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	repo := repositories.NewTransactionRepository(db)

	antes := balanceOf(t, db, b.AccountID)

	err := repo.AdjustAccountBalance(a.WorkspaceID, b.AccountID, 100)
	if err == nil {
		t.Fatal("AdjustAccountBalance aceitou conta de outro workspace")
	}
	if got := balanceOf(t, db, b.AccountID); got != antes {
		t.Errorf("saldo de B foi alterado: antes %.2f, depois %.2f", antes, got)
	}

	// Caminho válido continua funcionando e afeta exatamente uma linha.
	if err := repo.AdjustAccountBalance(a.WorkspaceID, a.AccountID, -250); err != nil {
		t.Fatalf("ajuste legítimo falhou: %v", err)
	}
	if got := balanceOf(t, db, a.AccountID); got != 9750 {
		t.Errorf("saldo de A: esperava 9750, veio %.2f", got)
	}
}

// ── §23 — caminho feliz ─────────────────────────────────────────────────

func TestAUD001_CaminhoFelizMesmoWorkspace(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	svc := newService(db)

	req := baseReq()
	req.AccountID = str(a.AccountID)
	req.CategoryID = str(a.CategoryID)
	req.TagIDs = []string{a.TagID}

	criados, err := svc.Create(a.WorkspaceID, a.UserID, req)
	if err != nil {
		t.Fatalf("criação legítima foi rejeitada: %v", err)
	}
	if len(criados) != 1 {
		t.Fatalf("esperava 1 lançamento, vieram %d", len(criados))
	}
	if got := balanceOf(t, db, a.AccountID); got != 9900 {
		t.Errorf("saldo após despesa paga de 100: esperava 9900, veio %.2f", got)
	}

	var vinculos int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM transaction_tags WHERE transaction_id=$1`, criados[0].ID,
	).Scan(&vinculos); err != nil {
		t.Fatalf("contando tags: %v", err)
	}
	if vinculos != 1 {
		t.Errorf("esperava 1 tag vinculada, vieram %d", vinculos)
	}
}

// Cartão do próprio workspace também precisa continuar funcionando.
func TestAUD001_CaminhoFelizComCartao(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	req.CreditCardID = str(a.CardID)
	req.CategoryID = str(a.CategoryID)

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err != nil {
		t.Fatalf("criação legítima com cartão foi rejeitada: %v", err)
	}
	if n := countTransactions(t, db, a.WorkspaceID); n != 1 {
		t.Errorf("esperava 1 lançamento, encontrei %d", n)
	}
}

// ── §24 — UUID inexistente é indistinguível de UUID externo ─────────────

func TestAUD001_UUIDInexistenteNaoVazaExistencia(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	b := newFixture(t, db, "B")
	svc := newService(db)

	inexistente := uuid.New().String()

	reqFantasma := baseReq()
	reqFantasma.AccountID = str(inexistente)
	_, errFantasma := svc.Create(a.WorkspaceID, a.UserID, reqFantasma)

	reqExterna := baseReq()
	reqExterna.AccountID = str(b.AccountID)
	_, errExterna := svc.Create(a.WorkspaceID, a.UserID, reqExterna)

	if errFantasma == nil || errExterna == nil {
		t.Fatal("ambos os casos deveriam falhar")
	}
	if errFantasma.Error() != errExterna.Error() {
		t.Errorf("respostas diferentes revelam existência do recurso: %q vs %q",
			errFantasma.Error(), errExterna.Error())
	}
}

// ── Campos opcionais continuam opcionais ────────────────────────────────

func TestAUD001_CamposAusentesNaoGeramErro(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	svc := newService(db)

	// Sem account_id, sem categoria, sem cartão, sem tags: o serviço deve
	// cair na primeira conta do workspace, como antes da correção.
	req := baseReq()

	criados, err := svc.Create(a.WorkspaceID, a.UserID, req)
	if err != nil {
		t.Fatalf("lançamento sem referências opcionais foi rejeitado: %v", err)
	}
	if len(criados) != 1 {
		t.Fatalf("esperava 1 lançamento, vieram %d", len(criados))
	}
	if got := balanceOf(t, db, a.AccountID); got != 9900 {
		t.Errorf("fallback para a primeira conta não aplicou o saldo: veio %.2f", got)
	}
}

// String vazia deve ser tratada como ausente, não como id inválido.
func TestAUD001_StringVaziaEquivaleAAusente(t *testing.T) {
	db := openTestDB(t)
	a := newFixture(t, db, "A")
	svc := newService(db)

	req := baseReq()
	req.Paid = false
	req.AccountID = str("")
	req.CategoryID = str("")

	if _, err := svc.Create(a.WorkspaceID, a.UserID, req); err != nil {
		t.Fatalf("string vazia deveria ser tratada como ausente, veio: %v", err)
	}
}
