-- ============================================================================
-- AUD-001 — Diagnóstico de referências cruzadas entre workspaces
-- ============================================================================
--
-- MODO: DRY RUN. Este arquivo SÓ LÊ. Nada é apagado nem alterado.
--
-- Serve para responder uma pergunta antes de qualquer limpeza:
--
--     a vulnerabilidade chegou a ser explorada em produção?
--
-- Se todas as contagens da Parte 1 vierem zero, nunca foi explorada e não há
-- nada a corrigir nos dados — a correção de código basta.
--
-- Se alguma vier diferente de zero, use a Parte 2 para ver as linhas
-- afetadas ANTES de decidir o que fazer. A Parte 3 traz a limpeza, comentada
-- de propósito: não execute sem antes conhecer o volume e ter backup.
--
-- Uso:
--     psql "$DATABASE_URL" -f scripts/aud001_diagnostico.sql
--
-- ============================================================================


-- ============================================================================
-- PARTE 1 — Contagens (comece por aqui)
-- ============================================================================

\echo '=== AUD-001 — contagem de referências cruzadas ==='

SELECT 'transactions.account_id' AS referencia, COUNT(*) AS cruzadas
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
 WHERE t.workspace_id <> a.workspace_id

UNION ALL

SELECT 'transactions.credit_card_id', COUNT(*)
  FROM transactions t
  JOIN credit_cards cc ON cc.id = t.credit_card_id
 WHERE t.workspace_id <> cc.workspace_id

UNION ALL

SELECT 'transactions.category_id', COUNT(*)
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
 WHERE t.workspace_id <> c.workspace_id

UNION ALL

SELECT 'transactions.transfer_account_id', COUNT(*)
  FROM transactions t
  JOIN accounts a ON a.id = t.transfer_account_id
 WHERE t.workspace_id <> a.workspace_id

UNION ALL

SELECT 'transaction_tags.tag_id', COUNT(*)
  FROM transaction_tags tt
  JOIN transactions tr ON tr.id = tt.transaction_id
  JOIN tags tg ON tg.id = tt.tag_id
 WHERE tr.workspace_id <> tg.workspace_id

UNION ALL

SELECT 'spending_limits.category_id', COUNT(*)
  FROM spending_limits s
  JOIN categories c ON c.id = s.category_id
 WHERE s.workspace_id <> c.workspace_id

UNION ALL

SELECT 'spending_limits.account_id', COUNT(*)
  FROM spending_limits s
  JOIN accounts a ON a.id = s.account_id
 WHERE s.workspace_id <> a.workspace_id

UNION ALL

SELECT 'spending_limits.credit_card_id', COUNT(*)
  FROM spending_limits s
  JOIN credit_cards cc ON cc.id = s.credit_card_id
 WHERE s.workspace_id <> cc.workspace_id

UNION ALL

SELECT 'goals.category_id', COUNT(*)
  FROM goals g
  JOIN categories c ON c.id = g.category_id
 WHERE g.workspace_id <> c.workspace_id

UNION ALL

SELECT 'goals.account_id', COUNT(*)
  FROM goals g
  JOIN accounts a ON a.id = g.account_id
 WHERE g.workspace_id <> a.workspace_id

ORDER BY cruzadas DESC, referencia;


-- ============================================================================
-- PARTE 2 — Detalhe (só se a Parte 1 encontrou algo)
-- ============================================================================
--
-- Cada consulta lista as linhas afetadas com os dois workspaces envolvidos.
-- O par (workspace de origem, workspace do recurso) é o que identifica quem
-- atacou quem.

\echo ''
\echo '=== Detalhe: transactions apontando para conta de outro workspace ==='

SELECT t.id            AS transaction_id,
       t.date,
       t.amount,
       t.paid,
       t.workspace_id  AS ws_transacao,
       a.workspace_id  AS ws_conta,
       a.id            AS conta_id,
       a.name          AS conta_nome
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
 WHERE t.workspace_id <> a.workspace_id
 ORDER BY t.created_at;

\echo ''
\echo '=== Impacto financeiro por conta invadida ==='
--
-- Soma o que os lançamentos PAGOS de outro workspace movimentaram em cada
-- conta. É a diferença que precisa ser devolvida ao saldo, caso exista.

SELECT a.id                AS conta_id,
       a.name              AS conta_nome,
       a.workspace_id      AS ws_dono,
       COUNT(*)            AS lancamentos_estranhos,
       SUM(CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END) AS impacto_no_saldo
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
 WHERE t.workspace_id <> a.workspace_id
   AND t.paid = true
 GROUP BY a.id, a.name, a.workspace_id
 ORDER BY ABS(SUM(CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END)) DESC;

\echo ''
\echo '=== Detalhe: vínculos de tag cruzados ==='

SELECT tt.transaction_id,
       tr.workspace_id AS ws_transacao,
       tg.id           AS tag_id,
       tg.name         AS tag_nome,
       tg.workspace_id AS ws_tag
  FROM transaction_tags tt
  JOIN transactions tr ON tr.id = tt.transaction_id
  JOIN tags tg ON tg.id = tt.tag_id
 WHERE tr.workspace_id <> tg.workspace_id;

\echo ''
\echo '=== Detalhe: cartão, categoria e conta de destino ==='

SELECT 'credit_card' AS tipo, t.id AS transaction_id,
       t.workspace_id AS ws_transacao, cc.workspace_id AS ws_recurso
  FROM transactions t
  JOIN credit_cards cc ON cc.id = t.credit_card_id
 WHERE t.workspace_id <> cc.workspace_id

UNION ALL

SELECT 'category', t.id, t.workspace_id, c.workspace_id
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
 WHERE t.workspace_id <> c.workspace_id

UNION ALL

SELECT 'transfer_account', t.id, t.workspace_id, a.workspace_id
  FROM transactions t
  JOIN accounts a ON a.id = t.transfer_account_id
 WHERE t.workspace_id <> a.workspace_id;


-- ============================================================================
-- PARTE 3 — Limpeza (COMENTADA — não execute sem ler)
-- ============================================================================
--
-- Descomente apenas depois de:
--   1. rodar as Partes 1 e 2 e conhecer o volume exato;
--   2. ter backup do banco;
--   3. decidir o destino de cada categoria de dado.
--
-- A decisão não é óbvia e depende do caso:
--
--   • Vínculo de tag cruzado — apagar é seguro. A tag não pertence àquele
--     workspace e nada de financeiro depende dela.
--
--   • FK cruzada em transaction — apagar a REFERÊNCIA (deixar NULL) preserva
--     o lançamento e o histórico. Apagar o LANÇAMENTO destrói dado que pode
--     ser legítimo do ponto de vista de quem o criou. Prefira anular a FK.
--
--   • Saldo — anular a FK NÃO devolve o dinheiro movimentado na conta
--     invadida. Use a consulta "Impacto financeiro por conta invadida" da
--     Parte 2 e faça o acerto de saldo conscientemente, conta a conta.
--     Não automatize isso.

/*
BEGIN;

-- 3.1 — Vínculos de tag cruzados
DELETE FROM transaction_tags tt
 USING transactions tr, tags tg
 WHERE tt.transaction_id = tr.id
   AND tt.tag_id = tg.id
   AND tr.workspace_id <> tg.workspace_id;

-- 3.2 — FKs cruzadas em transactions (anula a referência, mantém a linha)
UPDATE transactions t
   SET account_id = NULL
  FROM accounts a
 WHERE a.id = t.account_id
   AND t.workspace_id <> a.workspace_id;

UPDATE transactions t
   SET credit_card_id = NULL
  FROM credit_cards cc
 WHERE cc.id = t.credit_card_id
   AND t.workspace_id <> cc.workspace_id;

UPDATE transactions t
   SET category_id = NULL
  FROM categories c
 WHERE c.id = t.category_id
   AND t.workspace_id <> c.workspace_id;

UPDATE transactions t
   SET transfer_account_id = NULL
  FROM accounts a
 WHERE a.id = t.transfer_account_id
   AND t.workspace_id <> a.workspace_id;

-- 3.3 — Limites e objetivos
UPDATE spending_limits s SET category_id = NULL
  FROM categories c WHERE c.id = s.category_id AND s.workspace_id <> c.workspace_id;
UPDATE spending_limits s SET account_id = NULL
  FROM accounts a WHERE a.id = s.account_id AND s.workspace_id <> a.workspace_id;
UPDATE spending_limits s SET credit_card_id = NULL
  FROM credit_cards cc WHERE cc.id = s.credit_card_id AND s.workspace_id <> cc.workspace_id;

UPDATE goals g SET category_id = NULL
  FROM categories c WHERE c.id = g.category_id AND g.workspace_id <> c.workspace_id;
UPDATE goals g SET account_id = NULL
  FROM accounts a WHERE a.id = g.account_id AND g.workspace_id <> a.workspace_id;

-- Confira o resultado ANTES de confirmar.
-- ROLLBACK;
-- COMMIT;
*/
