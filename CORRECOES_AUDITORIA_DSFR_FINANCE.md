# Correções da Auditoria — DSFR Finance

Registro das correções aplicadas a partir de `AUDITORIA_COMPLETA_DSFR_FINANCE.md`.
Um achado por entrada.

---

## AUD-001 — Isolamento de referências por workspace

**Severidade original:** CRITICAL
**Prioridade:** P0

### Status

⚠️ **PARCIAL**

O código está completo e todos os pontos exigidos foram cobertos, mas
**os testes não puderam ser executados** — o ambiente de execução esteve
indisponível durante toda a correção (detalhes em *Resultado dos testes*).
Pelo critério do §30, isso impede marcar como resolvido.

### Problema original

O backend aceitava IDs de chave estrangeira vindos do corpo da requisição sem
conferir se pertenciam ao `workspace_id` do token. Combinado com um ajuste de
saldo que localizava a conta apenas pelo `id`, um usuário conseguia alterar o
saldo da conta bancária de outro usuário com uma única chamada HTTP.

### Causa raiz confirmada

Validação de propriedade das FKs delegada implicitamente ao frontend. Nenhuma
camada do backend reforçava a regra, e o banco também não podia impedir: em
`migrations/001_initial.sql:113-115`, `transactions.account_id` referencia
`accounts(id)` globalmente, sem restrição de workspace — então a FK era
satisfeita por uma conta de qualquer workspace.

**Cenários confirmados no código antes da correção:**

| Cenário | Confirmado | Evidência |
|---|---|---|
| A — `account_id` de outro workspace | **Sim** | `transaction_handler.go:110` passa `req` direto; `transaction_service.go:257-262` (`resolveAccountID`) devolve o id sem checar; `transaction_repo.go:293` atualiza `accounts` só por `id` |
| B — `credit_card_id` de outro workspace | **Sim** | gravado em `transaction_repo.go:183-187` sem validação |
| C — `category_id` de outro workspace | **Sim** | idem |
| D — `transfer_account_id` de outro workspace | **Sim** | idem |
| E — `tag_ids` de outro workspace | **Sim** | `SetTags` (`:336-354`) insere qualquer `tag_id`; e `GetTags` (`:357-361`) devolve nome e cor da tag externa — era leitura de dado alheio, não só associação |

### Alterações realizadas

**1. Validação de propriedade no serviço, antes de qualquer escrita**

`validateReferences(workspaceID, req)` confere `account_id`,
`credit_card_id`, `category_id`, `transfer_account_id` e `tag_ids` contra o
workspace do token. Chamada na primeira linha de `Create` e logo após o
`GetByID` em `Update`. Se qualquer referência for inválida, nenhuma escrita
acontece.

Campo `nil` ou string vazia continua permitido — só o que vem preenchido
precisa pertencer ao workspace.

**2. Mensagens genéricas**

`conta inválida`, `cartão inválido`, `categoria inválida`,
`conta de destino inválida`, `tag inválida`. Um UUID inexistente e um UUID de
outro workspace produzem **exatamente a mesma resposta**, para não confirmar a
existência do recurso. Os handlers já devolviam `400` para erro de serviço
(`transaction_handler.go:112` e `:128`), então nenhuma mudança foi necessária
ali.

**3. Tags: tudo ou nada**

`CountTagsInWorkspace` conta quantos dos ids distintos informados existem no
workspace; se o número não bater, a requisição inteira é rejeitada. Salvar as
válidas e descartar a estranha esconderia a tentativa de acesso cruzado atrás
de um sucesso parcial.

**4. `AdjustAccountBalance` com workspace e verificação de linhas**

```go
func (r *TransactionRepository) AdjustAccountBalance(workspaceID, accountID string, delta float64) error {
	res, err := r.db.Exec(
		`UPDATE accounts SET balance = balance + $1, updated_at = NOW()
		  WHERE id = $2 AND workspace_id = $3`,
		delta, accountID, workspaceID,
	)
	if err != nil { return err }
	n, err := res.RowsAffected()
	if err != nil { return err }
	if n != 1 { return fmt.Errorf("conta inválida") }
	return nil
}
```

`RowsAffected() != 1` passa a ser erro, não silêncio.

**5. `resolveAccountID` deixou de confiar no id recebido**

Passou a retornar `(string, error)` e a reconferir a conta contra o workspace
antes de devolvê-la. Isso importa além do corpo da requisição: um lançamento
**gravado antes desta correção** pode carregar um `account_id` de outro
workspace, e `MarkPaid`/`MarkUnpaid`/`DeleteScoped` leem esse campo do banco.
`MarkPaid` e `MarkUnpaid`, que montavam o id inline, agora passam por aqui.

**6. Erros deixaram de ser descartados nos pontos alterados**

Os seis `_ = s.repo.AdjustAccountBalance(...)` e os quatro
`_ = s.repo.SetTags(...)` viraram erro propagado.

**Limite declarado:** propagar o erro não torna a operação atômica. Se o
ajuste de saldo falhar depois de o lançamento ter sido inserido, a linha
permanece. Isso é o **AUD-005** e está explicitamente fora deste escopo. A
correção reduz a janela ao eliminar a causa provável de falha (id inválido já
não chega até aqui), mas não a fecha.

**7. `SetTags` com filtro de workspace no próprio SQL**

```sql
INSERT INTO transaction_tags(transaction_id, tag_id)
SELECT $1, id FROM tags WHERE id=$2 AND workspace_id=$3
ON CONFLICT DO NOTHING
```

Defesa em profundidade: mesmo que um id escape da validação do serviço, a
linha não é criada.

### Busca global exigida pelo §14

Todos os pontos que alteram saldo de conta, depois da correção:

| # | Local | Filtra `workspace_id`? |
|---|---|---|
| 1 | `transaction_repo.go:348` `AdjustAccountBalance` | ✅ **corrigido nesta entrega** |
| 2 | `finance_agent_service.go:255` (WhatsApp, registra lançamento) | ✅ já filtrava |
| 3 | `finance_agent_service.go:345` (WhatsApp, desfazer) | ✅ **corrigido nesta entrega** — achado derivado |
| 4 | `statement_import_handler.go:231` (importação OFX) | ✅ já filtrava |
| 5 | `account_handler.go:90` (edição de conta, saldo absoluto) | ✅ já filtrava |

Todas as chamadas de `AdjustAccountBalance` (6), `SetTags` (4) e
`resolveAccountID` (6) foram atualizadas para as novas assinaturas. Nenhuma
chamada com a assinatura antiga permanece — verificado por busca em todo o
diretório `backend/`.

### Arquivos alterados

| Arquivo | Natureza |
|---|---|
| `backend/internal/repositories/transaction_repo.go` | `AccountExists`, `CreditCardExists`, `CategoryExists`, `CountTagsInWorkspace` (novos); `AdjustAccountBalance` e `SetTags` com workspace |
| `backend/internal/services/transaction_service.go` | `validateReferences` (novo) e erros genéricos; `Create`, `Update`, `MarkPaid`, `MarkUnpaid`, `DeleteScoped` e `resolveAccountID` ajustados |
| `backend/internal/services/finance_agent_service.go` | filtro de workspace no ajuste de saldo do "desfazer" (achado derivado) |
| `backend/internal/services/aud001_isolation_test.go` | **novo** — testes de integração |

Nenhuma migration foi criada. Conforme §27, o isolamento foi resolvido na
aplicação. Ver *Riscos restantes* para a constraint de banco que ficaria como
defesa adicional.

### Testes criados

`backend/internal/services/aud001_isolation_test.go` — 11 testes de
integração contra Postgres real.

| Teste | Cobre |
|---|---|
| `TestAUD001_CreateComAccountDeOutroWorkspace` | §16 — erro, saldo de B intacto, nenhum lançamento criado |
| `TestAUD001_CreateComCartaoDeOutroWorkspace` | §17 |
| `TestAUD001_CreateComCategoriaDeOutroWorkspace` | §18 |
| `TestAUD001_CreateComContaDestinoDeOutroWorkspace` | §19 — só isolamento, sem tocar na regra do AUD-003 |
| `TestAUD001_CreateComTagDeOutroWorkspaceRejeitaTudo` | §20 — inclui a checagem de que nenhuma tag foi aplicada parcialmente |
| `TestAUD001_UpdateTrocandoParaAccountDeOutroWorkspace` | §21 — erro e transação permanece na conta original |
| `TestAUD001_AdjustAccountBalanceRecusaContaDeOutroWorkspace` | §22 — repositório direto, mais o caminho válido |
| `TestAUD001_CaminhoFelizMesmoWorkspace` | §23 — conta + categoria + tag, saldo e vínculo conferidos |
| `TestAUD001_CaminhoFelizComCartao` | §23 |
| `TestAUD001_UUIDInexistenteNaoVazaExistencia` | §24 — compara as duas mensagens |
| `TestAUD001_CamposAusentesNaoGeramErro` + `TestAUD001_StringVaziaEquivaleAAusente` | §5 — opcional continua opcional |

**Por que integração e não unitário:** a vulnerabilidade vive na fronteira
entre o serviço e o SQL. Um mock de repositório responderia o que mandássemos
responder — inclusive num código vulnerável — e o teste passaria sem provar
nada.

**Por que não testcontainers:** adicionar a dependência exige alterar `go.mod`
e `go.sum`, e este ambiente não conseguiu executar `go mod`. Um `go.sum`
inconsistente quebraria o build de todos. Os testes usam apenas
`database/sql` + `lib/pq`, já presentes no projeto, e leem
`TEST_DATABASE_URL`. Sem a variável, `t.Skip` — pulam explicitamente, não
passam em silêncio.

Como rodar:

```bash
createdb dsfr_test
# aplicar as migrations em dsfr_test
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/dsfr_test?sslmode=disable" \
  go test ./internal/services/ -run AUD001 -v
```

### Resultado dos testes

```
NÃO EXECUTADO
```

**Motivo:** o ambiente Linux onde `go build`, `go test` e `gofmt` rodam ficou
indisponível durante toda a correção. Falha de montagem do workspace,
reproduzida cinco vezes seguidas:

```
failed to mount ... under Plan9 share "c" which is not mounted
```

Segundo a própria mensagem do ambiente, decorre de uma atualização do Windows
de 8 de setembro.

Portanto, **nenhum dos três comandos exigidos pelo §25 foi executado**:

| Comando | Resultado |
|---|---|
| `gofmt` | NÃO EXECUTADO |
| `go build ./...` | NÃO EXECUTADO |
| `go test ./...` | NÃO EXECUTADO |

O que foi feito no lugar: revisão manual das assinaturas e dos pontos de
chamada, e busca global confirmando que nenhuma chamada antiga permaneceu.
Isso **não substitui o compilador** — em especial quanto a sombreamento de
`err` e às assinaturas das funções passadas como valor em `validateReferences`.

**Antes de fazer merge, rode os três comandos.**

### Validação dos invariantes

Pelo código. Nenhuma linha desta tabela foi verificada em execução.

| Invariante | Esperado | Situação no código |
|---|---|---|
| Transaction de A pode usar account de B? | NÃO | `validateReferences` rejeita; `AdjustAccountBalance` filtra por workspace |
| Transaction de A pode usar card de B? | NÃO | `validateReferences` rejeita |
| Transaction de A pode usar category de B? | NÃO | `validateReferences` rejeita |
| Transaction de A pode usar tag de B? | NÃO | `validateReferences` rejeita; `SetTags` filtra no SQL |
| Transaction de A pode usar transfer account de B? | NÃO | `validateReferences` rejeita |
| `AdjustAccountBalance` altera conta apenas pelo UUID? | NÃO | exige `workspace_id` e `RowsAffected() == 1` |
| Caminho normal dentro do mesmo workspace funciona? | SIM | coberto por dois testes de caminho feliz e dois de campo opcional |

### Achados derivados

**ACHADO DERIVADO AUD-001 #1 — `UPDATE accounts` sem workspace no "desfazer" do WhatsApp** — *corrigido*

- **Arquivo:** `backend/internal/services/finance_agent_service.go`
- **Função:** `undoLast` (linha ~345)
- **ID vulnerável:** `account_id` lido da transação apagada
- **Impacto:** o `account_id` vinha de uma linha do workspace correto, mas essa
  linha podia apontar para conta de outro workspace se tivesse sido criada
  explorando o AUD-001. Caminho de propagação secundário.
- **Ação:** corrigido — mesmo padrão de isolamento, uma linha de SQL.

**ACHADO DERIVADO AUD-001 #2 — `GetTags` devolve tag de outro workspace** — *registrado, não corrigido*

- **Arquivo:** `backend/internal/repositories/transaction_repo.go`
- **Funções:** `GetTags` (linha ~413), `GetTagsForTransactions` (linha ~443)
- **ID vulnerável:** `transaction_tags.tag_id` já gravado
- **Impacto:** as duas consultas fazem `JOIN tags t ON tt.tag_id = t.id` sem
  filtrar workspace, e devolvem nome e cor. Um vínculo cruzado **criado antes
  desta correção** continua sendo exibido. O caminho de escrita está fechado;
  o de leitura de dado legado, não.
- **Recomendação:** adicionar `AND t.workspace_id = $N` às duas consultas, o
  que exige passar `workspaceID` (os dois chamadores em
  `transaction_handler.go` já o têm). E uma limpeza dos vínculos existentes:

```sql
DELETE FROM transaction_tags tt
 USING transactions tr, tags tg
 WHERE tt.transaction_id = tr.id
   AND tt.tag_id = tg.id
   AND tr.workspace_id <> tg.workspace_id;
```

Rodar primeiro como `SELECT COUNT(*)` com o mesmo `WHERE`: se o resultado for
maior que zero, a vulnerabilidade foi explorada em produção.

- **Por que não corrigi agora:** muda a assinatura de duas funções de leitura e
  os respectivos chamadores, o que amplia o diff além do necessário para fechar
  o vetor de escrita. Fica como item próprio.

**ACHADO DERIVADO AUD-001 #3 — outros handlers aceitam FK do corpo sem validar** — *registrado, não corrigido*

- **Arquivos:** `backend/internal/handlers/spending_handler.go` (`category_id`,
  `account_id`, `credit_card_id` de um limite de gastos),
  `backend/internal/handlers/goal_handler.go` (`category_id`, `account_id` de
  um objetivo)
- **Impacto:** **menor que o do AUD-001.** Esses registros não movem saldo;
  o efeito é um limite ou objetivo do workspace A apontando para uma categoria
  de B, o que produz cálculo silenciosamente vazio (as consultas de gasto
  filtram por workspace, então nunca casam). É corrupção de configuração, não
  de dinheiro, e não vaza dado de B.
- **Recomendação:** aplicar o mesmo `validateReferences` — os métodos
  `AccountExists`/`CategoryExists`/`CreditCardExists` criados aqui já servem.
- **Por que não corrigi agora:** pertence a outro domínio (limites e
  objetivos) e o escopo desta execução é o AUD-001. Merece entrada própria na
  auditoria.

### Riscos restantes

1. **Testes não executados.** O maior risco desta entrega. O código pode não
   compilar por um detalhe que a revisão manual não pegou.

2. **Atomicidade continua ausente (AUD-005).** Propagar o erro do ajuste de
   saldo não impede que uma falha entre a inserção e o ajuste deixe o
   lançamento gravado sem o saldo correspondente. Fora de escopo, por
   instrução explícita.

3. **Dados já corrompidos não foram tocados.** Se a vulnerabilidade foi
   explorada, existem lançamentos com `account_id` de outro workspace e saldos
   errados. Diagnóstico:

```sql
SELECT t.id, t.workspace_id AS ws_transacao, a.workspace_id AS ws_conta
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
 WHERE a.workspace_id <> t.workspace_id;
```

   Mesma verificação vale para `credit_card_id`, `category_id` e
   `transfer_account_id`. Resultado vazio = nunca foi explorado.

4. **Constraint de banco não foi criada.** O isolamento hoje depende da
   aplicação. Uma defesa estrutural seria chave composta
   `(id, workspace_id)` em `accounts`, `credit_cards`, `categories` e `tags`,
   com as FKs de `transactions` referenciando o par. Torna o vínculo cruzado
   impossível no nível do banco. Não implementei porque §27 pede para não criar
   migration sem necessidade, e a aplicação resolve o vetor. Fica como
   recomendação — é a única forma de garantir o invariante contra um caminho
   de escrita futuro que esqueça a validação.

5. **`validateReferences` só cobre `TransactionService`.** Os outros três
   caminhos de escrita em `transactions` (`asset_handler.go`,
   `import_handler.go`, `statement_import_handler.go`) não passam por ele.
   Revisados: `asset_handler` e `import_handler` não aceitam `account_id` do
   cliente; `statement_import_handler` aceita `body.AccountID` e **não o
   valida antes do INSERT** — mas o `UPDATE` de saldo dele já filtra por
   workspace (`:231-233`), então não move dinheiro alheio. Resta poder gravar
   lançamento apontando para conta de outro workspace. Anotado como item a
   tratar junto do AUD-016.

---

## Rodada AUD-001B — fechamento dos resíduos

Segunda rodada sobre o mesmo achado, para estender o invariante de
`TransactionService` para **todo o backend**.

### Confirmação das correções da rodada anterior

Todas presentes e intactas antes de começar: `validateReferences`,
`AccountExists`, `CreditCardExists`, `CategoryExists`,
`CountTagsInWorkspace`, `AdjustAccountBalance(workspaceID, ...)` com
`RowsAffected`, `SetTags` filtrado, `resolveAccountID` validando e as
mensagens genéricas. Nada foi reescrito — a única mudança nelas foi passar a
delegar o `SELECT EXISTS` para `ownership.go`, descrito abaixo.

### Resíduos encontrados

A busca global (§9) varreu `backend/` atrás de handlers que recebem FK do
corpo, gravam e não conferem workspace. Resultado completo:

| # | Local | FK do cliente | Situação antes |
|---|---|---|---|
| 1 | `transaction_service.go` | todas as 5 | ✅ já protegido (rodada anterior) |
| 2 | `statement_import_handler.go` `Import` | `account_id` | ❌ gravava lançamento apontando para conta alheia |
| 3 | `statement_import_handler.go` `Import` | `category_id` **por linha** | ❌ **não constava do relatório** — cada linha do extrato traz sua categoria |
| 4 | `statement_import_handler.go` `Analyze` | `account_id` | ❌ analisava contra conta alheia |
| 5 | `spending_handler.go` `Create` | `category_id`, `account_id`, `credit_card_id` | ❌ bind do modelo inteiro |
| 6 | `goal_handler.go` `Create` e `Update` | `category_id`, `account_id` | ❌ **`Update` também**, além do `Create` |
| 7 | `transaction_repo.go` `GetTags` / `GetTagsForTransactions` | — | ❌ leitura de tag alheia por vínculo legado |

Verificados e **não vulneráveis**: `investment_handler` (usa só path param
sempre combinado com `wsID` no repositório), `asset_handler` e
`patrimony_snapshot_handler` (`wallet_name` é texto livre, não FK),
`import_handler` (Organizze — categoria por nome, criada no próprio
workspace), `spending_handler.Update` (copia só `Amount`, `Period` e
`AlertPct`; não toca nas FKs), e os DTOs `AccountBalance` e `CategorySummary`
em `models.go`, que são apenas resposta.

Dois itens acima (#3 e o `Update` do #6) **não estavam no relatório de
auditoria** — apareceram só nesta varredura.

### Alterações realizadas

**1. `ownership.go` — ponto único da regra (novo arquivo)**

`AccountBelongsTo`, `CreditCardBelongsTo`, `CategoryBelongsTo`,
`TagBelongsTo` e `OptionalRefBelongsTo`, como funções livres sobre `*sql.DB`.

Precisavam ser chamadas de lugares que não têm o `TransactionRepository` — a
importação de extrato, os limites e os objetivos. Duplicar o `SELECT EXISTS`
em cada handler funcionaria, mas checagem de segurança duplicada é
exatamente o que diverge com o tempo. Os quatro métodos do
`TransactionRepository` passaram a delegar para cá; o comportamento é
idêntico.

**2. Importação de extrato**

`Analyze` e `Import` validam `account_id`. A validação do `Import` é a que
vale: nada obriga o cliente a passar pelo `Analyze`, e o `account_id` pode
ser outro na segunda chamada. A do `Analyze` existe para a tela de
conferência não exibir uma análise feita contra conta alheia.

As categorias por linha são conferidas **antes de abrir a transação de
banco**, com cache dos ids já vistos. Uma única categoria estranha recusa o
arquivo inteiro — nenhuma linha é gravada.

**3. `GetTags` e `GetTagsForTransactions` com `workspaceID`**

`AND t.workspace_id = $N` nas duas consultas. Não é redundante com `SetTags`:
um vínculo cruzado gravado **antes** da correção continuaria em
`transaction_tags`, e o JOIN devolvia nome e cor de tag alheia. Os três
chamadores foram atualizados.

**4. `SpendingRepository.ValidateRefs` e `GoalRepository.ValidateRefs`**

Nos repositórios, não nos handlers, porque os handlers só têm o repositório —
assim nenhum construtor mudou e `main.go` ficou intacto. Chamados em
`SpendingHandler.Create`, `GoalHandler.Create` e `GoalHandler.Update`.
Respondem `400` com mensagem genérica.

### Arquivos alterados nesta rodada

| Arquivo | Natureza |
|---|---|
| `backend/internal/repositories/ownership.go` | **novo** — ponto único da verificação |
| `backend/internal/repositories/transaction_repo.go` | `GetTags`/`GetTagsForTransactions` com workspace; métodos `*Exists` delegando |
| `backend/internal/repositories/spending_repo.go` | `ValidateRefs` |
| `backend/internal/repositories/goal_repo.go` | `ValidateRefs` |
| `backend/internal/handlers/statement_import_handler.go` | validação de conta em `Analyze` e `Import`; validação de categoria por linha |
| `backend/internal/handlers/spending_handler.go` | `ValidateRefs` no `Create` |
| `backend/internal/handlers/goal_handler.go` | `ValidateRefs` no `Create` e no `Update` |
| `backend/internal/handlers/transaction_handler.go` | chamadas de tag com `wsID` |
| `backend/internal/services/transaction_service.go` | chamada de `GetTags` com `workspaceID` |
| `backend/internal/handlers/aud001b_isolation_test.go` | **novo** — testes |
| `scripts/aud001_diagnostico.sql` | **novo** — diagnóstico DRY RUN |

### Testes adicionados

`backend/internal/handlers/aud001b_isolation_test.go` — 11 testes (com
subtestes, 15 casos).

| Teste | Cobre |
|---|---|
| `TestAUD001B_ImportComContaDeOutroWorkspace` | 400, zero lançamentos nos dois workspaces, saldo de B intacto |
| `TestAUD001B_AnalyzeComContaDeOutroWorkspace` | 400 já na etapa de análise |
| `TestAUD001B_ImportComCategoriaDeOutroWorkspace` | 400, nenhuma linha gravada |
| `TestAUD001B_ImportCaminhoFeliz` | importação legítima cria a linha e ajusta o saldo |
| `TestAUD001B_GetTagsNaoDevolveTagDeOutroWorkspace` | vínculo legado cruzado montado à mão; só a tag própria volta |
| `TestAUD001B_GetTagsForTransactionsNaoDevolveTagDeOutroWorkspace` | idem, no caminho em lote |
| `TestAUD001B_SpendingLimitComRecursosDeOutroWorkspace` | 3 subtestes (conta, categoria, cartão), nenhum limite criado |
| `TestAUD001B_SpendingLimitCaminhoFeliz` | limite legítimo é criado |
| `TestAUD001B_GoalComRecursosDeOutroWorkspace` | 2 subtestes (conta, categoria), nenhum objetivo criado |
| `TestAUD001B_GoalCaminhoFeliz` | objetivo legítimo é criado |
| `TestAUD001B_UUIDInexistenteNaoVazaExistencia` | código e corpo idênticos entre id fantasma e id externo |

**Por que testes de handler e não de repositório:** testar só `ValidateRefs`
provaria que a função funciona, não que o handler a chama. Um handler que
esquecesse a chamada passaria no teste de repositório e continuaria
vulnerável. Os testes sobem a rota com `httptest` e um middleware que apenas
popula `workspace_id` e `user_id` — as duas únicas chaves que o middleware
real define.

O teste de vínculo legado grava o vínculo cruzado **direto no banco**,
contornando `SetTags` de propósito: é a única forma de reproduzir o estado
que uma exploração anterior teria deixado.

### Dados legados

`scripts/aud001_diagnostico.sql`, em três partes:

1. **Contagens** das dez referências cruzadas possíveis (conta, cartão,
   categoria, conta de destino, tags, limites e objetivos). Se tudo vier
   zero, a vulnerabilidade nunca foi explorada.
2. **Detalhe** das linhas afetadas, com os dois workspaces envolvidos, mais
   uma consulta de **impacto financeiro por conta invadida** — a soma que os
   lançamentos pagos de outro workspace movimentaram em cada conta.
3. **Limpeza comentada.** Não descomentei nada e recomendo não executar sem
   conhecer o volume. A decisão não é óbvia: para vínculo de tag, apagar é
   seguro; para FK em lançamento, anular a referência preserva o histórico
   enquanto apagar a linha destrói dado possivelmente legítimo. E **anular a
   FK não devolve o dinheiro** movimentado na conta invadida — esse acerto
   precisa ser feito conta a conta, conscientemente.

**Não executei o diagnóstico**: não tenho acesso ao banco de produção, e
executá-lo é decisão sua.

### Comandos executados

```
NÃO EXECUTADO
```

| Comando | Resultado |
|---|---|
| `gofmt` | NÃO EXECUTADO |
| `go build ./...` | NÃO EXECUTADO |
| `go test ./...` | NÃO EXECUTADO |
| `go test ./internal/services/ -run AUD001 -v` | NÃO EXECUTADO |
| `go test ./internal/handlers/ -run AUD001B -v` | NÃO EXECUTADO |

**Motivo:** o ambiente Linux onde esses comandos rodam continua indisponível.
Mesma falha de montagem da rodada anterior, agora acumulando seis tentativas
no total:

```
failed to mount ... under Plan9 share "c" which is not mounted
```

Conforme o §13, e reforçando o que já valia na rodada anterior:

```
Build:                        NÃO EXECUTADO
Unit tests:                   NÃO EXECUTADO
AUD-001 integration tests:    NÃO EXECUTADO
AUD-001B integration tests:   NÃO EXECUTADO
```

Nenhum deles é PASS. Nenhum é SKIPPED — *skipped* significaria que o Go rodou
e pulou por falta de `TEST_DATABASE_URL`; aqui o Go não chegou a rodar.

### Validação sistêmica (§14)

Pelo código, considerando todo o backend. **Nenhuma linha verificada em
execução.**

| Pergunta | Obrigatório | Situação no código |
|---|---|---|
| Transaction A pode usar account B via API normal? | NÃO | `validateReferences` + `AdjustAccountBalance` filtrado |
| Transaction A pode usar account B via OFX/importação? | NÃO | validado em `Analyze` e `Import` |
| Transaction A pode usar card B? | NÃO | `validateReferences` |
| Transaction A pode usar category B? | NÃO | `validateReferences`; e por linha na importação |
| Transaction A pode usar transfer account B? | NÃO | `validateReferences` |
| Transaction A pode vincular tag B? | NÃO | `validateReferences` + `SetTags` filtrado |
| Transaction A pode ler tag B por vínculo legado? | NÃO | `GetTags` e `GetTagsForTransactions` filtrados |
| Spending limit A pode referenciar recursos de B? | NÃO | `ValidateRefs` no `Create` |
| Goal A pode referenciar recursos de B? | NÃO | `ValidateRefs` no `Create` e `Update` |
| Saldo pode ser alterado apenas por UUID? | NÃO | exige `workspace_id` e `RowsAffected() == 1` |

### Status após a rodada AUD-001B

⚠️ **PARCIAL**

Dos dez critérios do §16, **sete estão cumpridos** (itens 1 a 7: serviço,
importação, GetTags, GetTagsForTransactions, limites, objetivos e busca
global sem outro caminho equivalente).

**Três não estão**, e todos pelo mesmo motivo:

- item 8 — build passar: **não executado**
- item 9 — testes executarem de verdade: **não executado**
- item 10 — testes de integração passarem: **não executado**

O critério que você definiu é explícito, e o respeito: sem execução, continua
`⚠️ PARCIAL`. Marcar resolvido aqui seria afirmar algo que não verifiquei —
em particular, 22 testes novos e cerca de dez assinaturas alteradas nunca
passaram por um compilador.

**Para fechar:** rode os cinco comandos da tabela acima num ambiente com Go e
um Postgres de teste com as migrations aplicadas. Se todos passarem, os dez
critérios estão cumpridos e o status pode virar ✅ RESOLVIDO. Se algum falhar,
o erro aponta direto o que corrigir.

### Riscos restantes após AUD-001B

Os riscos 2 a 5 da rodada anterior seguem válidos, com uma atualização:

- O **risco 5** (`validateReferences` só cobria `TransactionService`) foi
  **fechado**: a importação de extrato agora valida conta e categoria.
- O **risco 1** (testes não executados) continua sendo o maior, agora
  ampliado — há mais código novo sem compilação.
- O **risco 3** (dados já corrompidos) agora tem ferramenta:
  `scripts/aud001_diagnostico.sql`. Continua não executado.
- O **risco 4** (constraint de banco) permanece como recomendação. É a única
  defesa que sobreviveria a um caminho de escrita futuro que esquecesse a
  validação — e esta rodada encontrou dois caminhos que a rodada anterior não
  tinha visto, o que é argumento a favor dela.

---

*Próximo achado aguarda autorização explícita.*
