# Regras do DSFR Finance

Referência das regras de negócio: o que o sistema decide, com que fórmula, e
por quê. Cada seção aponta o arquivo onde a regra mora, porque o código é a
verdade e este documento é o mapa.

Escopo: regras de domínio. Não cobre estilo de UI nem infraestrutura —
para configuração de IA veja [`ia-setup.md`](ia-setup.md), para WhatsApp
veja [`whatsapp-setup.md`](whatsapp-setup.md).

---

## Índice

1. [Conceitos fundamentais](#1-conceitos-fundamentais)
2. [Acesso e sessão](#2-acesso-e-sessão)
3. [Planos e travas](#3-planos-e-travas)
4. [Lançamentos](#4-lançamentos)
5. [Contas e saldo](#5-contas-e-saldo)
6. [Cartão de crédito](#6-cartão-de-crédito)
7. [Contas a pagar, compromissos e previsão](#7-contas-a-pagar-compromissos-e-previsão)
8. [Limites de gastos](#8-limites-de-gastos)
9. [Termômetro Financeiro](#9-termômetro-financeiro)
10. [Dívidas](#10-dívidas)
11. [Patrimônio](#11-patrimônio)
12. [Bens físicos e consórcio](#12-bens-físicos-e-consórcio)
13. [Investimentos e rebalanceamento](#13-investimentos-e-rebalanceamento)
14. [Objetivos](#14-objetivos)
15. [Importação de extrato (OFX)](#15-importação-de-extrato-ofx)
16. [Agente de IA](#16-agente-de-ia)
17. [Invariantes do sistema](#17-invariantes-do-sistema)

---

## 1. Conceitos fundamentais

**Workspace é a unidade de isolamento.** Todo dado pertence a um
`workspace_id`, e toda consulta filtra por ele. Um usuário acessa dados
através de `workspace_members`. Não existe consulta sem esse filtro.

**Competência ≠ caixa.** O sistema distingue *quando o gasto aconteceu* de
*quando o dinheiro sai*. Essa distinção é a origem de várias regras adiante —
sobretudo as do cartão de crédito (seção 6) e das telas de caixa (seção 7).

**Dinheiro é sempre positivo no banco.** `transactions.amount` é sempre
positivo; o sinal vem do `type` (`expense` | `income` | `transfer`). Quem
exibe aplica o sinal; quem calcula aplica `balanceImpact`.

**Cálculo financeiro não passa por IA.** Toda aritmética acontece em Go ou
TypeScript. O modelo de linguagem apenas redige o texto a partir de números
já calculados — regra explícita em `finance_profile_service.go` e reforçada
no prompt do agente.

---

## 2. Acesso e sessão

`backend/internal/services/auth_service.go`, `middleware/auth.go`,
`frontend/src/app/core/interceptors/auth.interceptor.ts`

| Regra | Valor |
|---|---|
| Token | JWT HS256, claims `user_id` + `workspace_id` |
| Validade da sessão | **30 dias** |
| Senha | bcrypt (custo padrão), mínimo **8 caracteres** |
| Token de redefinição de senha | validade de **1 hora**, guardado como SHA-256 |
| MFA | TOTP opcional por usuário |
| Login social | Google e Facebook; conta sem senha tem `password_hash` nulo |

**Recuperação de senha não revela se o e-mail existe.** `RequestPasswordReset`
retorna sucesso mesmo para e-mail desconhecido. É proteção contra enumeração
de contas.

**401 encerra a sessão.** O interceptor trata `401` fora das rotas `/auth/`
como sessão expirada: limpa o storage e leva ao login com aviso. A exceção
das rotas `/auth/` existe porque ali `401` significa credencial errada, não
sessão vencida.

> **Por que essa regra existe:** o guard de rota só verifica se *existe* um
> token no `localStorage`, nunca se ele ainda vale. Sem tratar o 401, um token
> vencido deixava o app em estado enganoso — as telas abriam normalmente, mas
> toda chamada era recusada e cada `catchError` convertia o erro em lista
> vazia. O usuário via zero em tudo, como se os dados tivessem sumido.

---

## 3. Planos e travas

`backend/internal/middleware/auth.go` → `RequirePremium`

A trava é por rota, checando `users.plan == "premium"`. Recusa devolve
**403** com `code: "premium_required"`.

**Premium:**

- Dívidas (`/debts`) e toda a tela de Estratégia de Quitação
- Estratégia de Investimentos: carteiras, classes, ativos, meses, histórico
- Assinaturas Tech (`/ai-subscriptions`)
- Exportação CSV e Excel

Tudo o mais é livre. O frontend também esconde a tela via `PlanService`, mas
a trava que vale é a do backend — a do frontend é conveniência.

---

## 4. Lançamentos

`backend/internal/services/transaction_service.go`

### Tipos e validação

`type` ∈ {`expense`, `income`, `transfer`}, `amount > 0`, `date` e
`description` obrigatórios.

### Parcelamento × repetição

Duas coisas diferentes, e a distinção importa:

| | Parcelamento (`installments`) | Repetição (`repeat_months`) |
|---|---|---|
| O que faz | **divide** o valor em N | **repete** o valor cheio N vezes |
| Valor de cada um | `amount / N` | `amount` |
| Uso típico | compra em 12x | salário, aluguel, assinatura |
| Marcação | `installment_number` / `installment_total` | sem numeração |

**Repetição tem prioridade.** Se `repeat_months > 1`, o parcelamento é
ignorado (`installments = 1`). As duas juntas não fazem sentido.

Ambos geram um `installment_group_id` compartilhado, e as ocorrências caem
em meses consecutivos a partir da data base (`AddDate(0, i-1, 0)`).

### Escopo de edição e exclusão

Quando o lançamento pertence a um grupo, a alteração pode se propagar:

| Escopo | Alcance |
|---|---|
| `one` (padrão) | só a ocorrência editada |
| `future` | esta e as seguintes — meses passados ficam intactos |
| `all` | o grupo inteiro |

As tags acompanham o mesmo escopo.

### Pago, e o efeito no saldo

Marcar como pago **move o saldo da conta na hora**. Despesa subtrai, receita
e transferência somam (`balanceImpact`).

A reconciliação é o ponto delicado: ao editar um lançamento, o sistema desfaz
o impacto antigo e aplica o novo. Isso vale para mudança de valor, de tipo, de
conta, e para alternar o "pago". Apagar um lançamento pago também reverte.
Sem isso, o Saldo Geral derivaria em silêncio a cada edição.

**Sem conta vinculada, usa a primeira do workspace** (`resolveAccountID`).

### Ignorado

`ignored = true` tira o lançamento de relatórios, limites e metas sem apagá-lo.

---

## 5. Contas e saldo

`backend/internal/handlers/account_handler.go`

O saldo é **mantido incrementalmente**, não recalculado a cada leitura: quem
altera é sempre `AdjustAccountBalance`, chamado pelos fluxos de
pagar/despagar/editar/excluir descritos acima.

### Inconsistência conhecida: `is_active`

Contas têm `is_active`, mas nem todo lugar respeita:

| Onde | Filtra conta inativa? |
|---|---|
| `GET /accounts` → Saldo Geral da Visão Geral | **Não** |
| Perfil do agente (`SaldoContas`) | Sim |
| Objetivo do tipo `saving` sem conta específica | Sim |
| Relatório de saldo (`report_repo.go`) | Sim |

Ou seja: com uma conta inativa, o Saldo Geral da tela e o número que o agente
usa **divergem**. Vale unificar — o comportamento correto é filtrar, como faz
o resto do sistema.

---

## 6. Cartão de crédito

`backend/internal/repositories/report_repo.go`,
`frontend/.../reports/card-invoices/`

Esta é a área com mais regra própria, porque o cartão desacopla a compra do
pagamento.

### Ciclo de fatura

A fatura **não é o mês-calendário**. Ela é o ciclo definido por
`closing_day`:

```
compra com dia <= closing_day  →  fatura do próprio mês
compra com dia >  closing_day  →  fatura do mês seguinte
```

Sem `closing_day` definido (0 ou nulo), assume-se 31 — que equivale ao
mês-calendário.

O ciclo da competência M vai do dia `closing_day + 1` do mês M−1 até o dia
`closing_day` do mês M.

### Vencimento

```
due_day >  closing_day  →  vence no PRÓPRIO mês da competência
due_day <= closing_day  →  vence no mês SEGUINTE
```

O dia é limitado ao último dia do mês: `due_day = 31` em mês de 30 vira dia
30, não transborda.

Exemplos reais do sistema:

| Cartão | Fecha | Vence | Fatura de setembro vence em |
|---|---|---|---|
| Nubank | 16 | 26 | 26/09 — mesmo mês |
| Carrefour | 27 | 1 | 01/10 — mês seguinte |

### Valor da fatura

| Conceito | Definição |
|---|---|
| **Valor da fatura** | tudo que foi lançado no ciclo, pago ou não |
| **Em aberto** | apenas o não pago do ciclo |
| **Saldo mês anterior** | soma do não pago de ciclos anteriores, que rola |
| **Fatura atual (Visão Geral)** | em aberto do ciclo + rolado dos anteriores |

A Visão Geral mostra **o que ainda se deve**, não o que foi gasto. Usar o
total gasto fazia a fatura continuar aparecendo no mês depois de paga.

A fatura pode estar **parcialmente paga**: parte dos lançamentos do ciclo
quitada e parte em aberto. Nesse estado a tela separa os dois números, porque
o selo "EM ABERTO" ao lado do total do ciclo sugeria que nada tinha sido pago.

| Estado | Condição |
|---|---|
| `PAGA` | total do ciclo > 0 e nada em aberto |
| `PARCIALMENTE PAGA` | há quitado no ciclo **e** ainda há em aberto |
| `EM ABERTO` | há em aberto e nada quitado no ciclo |

### Pagar a fatura

Pagar marca como pagos **todos** os lançamentos em aberto daquele cartão até
o fim do ciclo selecionado — inclusive o que rolou de meses anteriores, não
só o mês corrente.

### Inconsistência conhecida: `ignored` na fatura

`CardInvoiceHistory` (tela de faturas) **não** filtra `ignored`, enquanto
`InvoicesDue` (contas a pagar) filtra. Um gasto de cartão marcado como
ignorado aparece no valor da fatura, mas não na lista de contas a pagar.
Os dois deveriam concordar — o comportamento coerente com o resto do sistema
é ignorar, já que `ignored` existe justamente para tirar o lançamento das
contas.

---

## 7. Contas a pagar, compromissos e previsão

`backend/internal/repositories/report_repo.go` → `InvoicesDue`,
`frontend/src/app/shared/utils/invoice-bills.ts`

**Regra central: compra no cartão não é conta a pagar.** O que vence é a
fatura.

As três telas de caixa — Visão Geral, Compromissos e Previsão Financeira —
consultam lançamentos com `no_card=true` (`credit_card_id IS NULL`) e somam
as faturas em aberto à parte, **uma linha por fatura, na data de vencimento**.

> **Por que:** antes, a compra entrava na lista de contas a pagar com a data
> da compra, enquanto a fatura também aparecia no bloco "Faturas do mês". O
> mesmo dinheiro contado duas vezes, e na data errada. Uma compra de 15/09 num
> cartão que vence dia 26 não sai do caixa no dia 15.

Detalhes que decorrem da regra:

- Fatura antiga ainda em aberto aparece com o vencimento **dela**, no passado.
  É assim que uma fatura atrasada aparece como atrasada, sem lógica extra.
- A linha de fatura não tem botão "marcar como paga" — ela leva à tela do
  cartão, porque a fatura se quita lá, lançamento a lançamento.
- O vencimento é calculado **uma vez, no backend**. Nenhuma das três telas
  recalcula.

**Calculadora de Caixa (Visão Geral):**
`saldo atual + a receber − a pagar = saldo projetado`

---

## 8. Limites de gastos

`backend/internal/repositories/spending_repo.go` → `ComputeCurrentSpend`

Um limite tem um **alvo** (categoria, conta ou cartão), um **período**
(`monthly` ou `yearly`), um **valor** e um **percentual de alerta**.

O gasto considerado soma `type='expense' AND ignored=false` dentro da janela
do período.

Duas notificações, disparadas na criação do lançamento:

| Condição | Notificação |
|---|---|
| `gasto ≥ alert_pct` do limite | `spending_alert` — "Alerta de limite" |
| `gasto ≥ 100%` do limite | `limit_exceeded` — "Limite ultrapassado" |

O alerta só é avaliado para limites **relevantes** ao lançamento — mesma
categoria, mesma conta ou mesmo cartão.

---

## 9. Termômetro Financeiro

`frontend/src/app/modules/dashboard/dashboard.component.ts` → `health`

Cinco pilares somando 100 pontos.

### 1. Sobra do mês — 25 pts

`taxa = (receita − despesa) / receita`

| Taxa | Pontos |
|---|---|
| ≥ 20% | 25 |
| ≥ 10% | 18 |
| > 0 | 11 |
| ≤ 0 | 0 |

Sem receita no mês: 0 pontos, status de alerta.

### 2. Reserva de emergência — 25 pts

`meses = (saldo em conta + reserva declarada) / gasto médio mensal`

| Meses | Pontos |
|---|---|
| ≥ 6 | 25 |
| ≥ 3 | 18 |
| ≥ 1 | 10 |
| < 1 | 0 |

A **reserva declarada** soma o campo "Reserva de Emergência" do último
registro **de cada carteira** do Patrimônio. Filtrar pelo último mês global
descartaria a reserva das carteiras não atualizadas naquele mês.

O **gasto médio** vem do histórico de fluxo quando existe; senão usa o mês
corrente.

### 3. Contas em atraso — 20 pts

| Contas vencidas | Pontos |
|---|---|
| 0 | 20 |
| 1 | 10 |
| 2 | 5 |
| 3+ | 0 |

### 4. Uso do cartão — 15 pts

`razão = fatura em aberto / receita`

| Razão | Pontos |
|---|---|
| ≤ 20% | 15 |
| ≤ 30% | 11 |
| ≤ 50% | 6 |
| > 50% | 0 |

### 5. Limites de gastos — 15 pts

| Situação | Pontos |
|---|---|
| Nenhum limite cadastrado | 8 |
| Todos sob controle | 15 |
| Algum ≥ 80% (nenhum estourado) | 10 |
| 1 estourado | 5 |
| 2+ estourados | 0 |

"Nenhum limite" vale 8 e não 0: não ter limite é falta de instrumento, não
descontrole comprovado.

### Faixas do score

| Score | Rótulo |
|---|---|
| 80–100 | Excelente |
| 60–79 | Saudável |
| 40–59 | Atenção |
| 20–39 | Risco |
| 0–19 | Crítico |

### Dicas

São geradas por pilar que perdeu ponto, ordenadas por **pontos perdidos**
(maior impacto primeiro), e cortadas em 3. Com tudo em ordem, entram dicas
de reforço (aportes automáticos, revisar assinaturas, definir objetivo).

O histórico mensal fica em `thermometer_snapshots`, salvo automaticamente
para o mês corrente.

---

## 10. Dívidas

`frontend/src/app/modules/debt-strategy/`,
`backend/internal/services/finance_profile_service.go` → `DebtDetail`

**`monthly_rate` é fração**, não percentual: `0.015` = 1,5% a.m. Erro fácil
de cometer e difícil de notar.

Tipos: financiamento imobiliário, veículo, consórcio, consignado, empréstimo
pessoal, outro.

### Amortização

```
juros do mês    = saldo × taxa
amortização     = parcela − juros
novo saldo      = saldo − amortização
```

**Se a parcela for menor ou igual aos juros, a projeção para.** A dívida
nunca amortizaria; projetar seria mentir. O mesmo motivo faz `calcMonths`
devolver 9999 (tratado como infinito) nesse caso.

Trava de segurança da tabela: 600 meses (50 anos).

### Valor presente (quitação antecipada)

```
pv da parcela n = parcela / (1 + taxa)^n
```

É quanto custa **hoje** eliminar aquela parcela, já descontados os juros que
ainda não correram — o desconto previsto no **art. 52 §2º do CDC**.
`pvToEnd` acumula do fim para o começo: quanto custa quitar daquele ponto até
a última.

A tela orienta a pedir **amortização com redução de prazo** e alerta que o
banco pode calcular diferente — confira o extrato de quitação antes de pagar.

### Estratégias de quitação

Calculadas em Go, prontas para o agente:

| Estratégia | Ordem | Vantagem |
|---|---|---|
| **Avalanche** | maior taxa primeiro | economiza mais juros |
| **Bola de neve** | menor saldo primeiro | quita uma antes, sustenta a disciplina |

Também é calculado o **custo mensal de juros** de cada dívida
(`saldo × taxa`) e o total — o número que torna a urgência concreta.

---

## 11. Patrimônio

`frontend/src/app/modules/patrimony-evolution/`

Registro **mensal por carteira**. A chave única é
`(workspace_id, month, wallet_name)`, então cada carteira tem sua própria
série e pode ser atualizada em meses diferentes das outras.

### Consolidado com carry-forward

Ao ver "Todas as carteiras", cada carteira é **levada adiante pelo seu
registro mais recente** até um novo aparecer.

> **Por que:** somar apenas o que foi registrado naquele mês fazia carteiras
> sumirem do total. Se só uma carteira foi atualizada em agosto, o total de
> agosto mostrava só ela — e o gráfico exibia uma queda que nunca aconteceu.

Regras derivadas do consolidado:

- **Rentabilidade** é média **ponderada pelo valor investido**. A média
  simples dava o mesmo peso a uma carteira de R$ 900 e a uma de R$ 11 mil.
- **Variação** sai da própria série consolidada
  (`(total − total anterior) / total anterior`), não da soma das variações
  individuais — assim ela bate com os totais do gráfico.
- **Reserva de emergência** soma todas as carteiras e alimenta o pilar 2 do
  Termômetro.

---

## 12. Bens físicos e consórcio

`backend/migrations/021_assets.sql`, `022_consorcio.sql`

Cobre o patrimônio que não é investimento financeiro: lote, terreno, casa,
apartamento, sítio, veículo, consórcio, outro.

- `purchase_value` e `market_value` separados, para acompanhar valorização.
- `asset_valuations` guarda o histórico de reavaliação.
- Compra parcelada gera lançamentos ligados por `installment_group_id`, e
  cada lançamento aponta o bem por `asset_id` — o progresso do parcelamento
  vem das parcelas **realmente pagas**.

### Consórcio

**Consórcio não é compra parcelada.** Até a contemplação você não tem o bem,
tem um direito. Daí a regra:

| Situação | Valor no patrimônio |
|---|---|
| Não contemplado | **o quanto já foi pago** — o que voltaria numa desistência |
| Contemplado | o valor da **carta de crédito** |

Campos: `credit_letter_value`, `is_awarded`, `awarded_date`.

---

## 13. Investimentos e rebalanceamento

`frontend/src/app/modules/investment-strategy/` → `computeAllocations`

Carteiras independentes (você, filhos, etc.), cada uma com classes e um
`ideal_pct` por classe. Registro mês a mês do valor de cada classe.

**A sugestão de aporte prioriza as classes abaixo do alvo**, sem mandar
vender nada:

```
totalFuturo = total atual + aporte
falta[i]    = ideal_pct[i] × totalFuturo − valor_atual[i]
```

| Situação | Distribuição do aporte |
|---|---|
| Nenhuma classe abaixo do alvo | proporcional ao `ideal_pct` |
| Falta total ≤ aporte | cobre a falta e distribui o resto pelo `ideal_pct` |
| Falta total > aporte | rateia o aporte proporcional à falta de cada uma |

Rebalanceamento por aporte, nunca por venda: é o que evita realizar imposto
e custo de corretagem só para ajustar percentual.

---

## 14. Objetivos

`backend/internal/repositories/goal_repo.go`

O progresso é **calculado a partir dos dados reais**, não digitado:

| Tipo | Valor atual | Progresso |
|---|---|---|
| `category` | gasto do mês naquela categoria | gasto / alvo |
| `saving` | saldo da conta (ou soma das ativas) | saldo / alvo |
| `patrimony` | total do último mês de snapshot | total / alvo |
| `debt` | `original − remaining` (o já pago) | pago / original |

Progresso é sempre limitado a 100%. Os tipos `category` e `patrimony` também
trazem os últimos 6 meses para gráfico.

---

## 15. Importação de extrato (OFX)

`backend/internal/handlers/statement_import_handler.go`,
`services/merchant_key.go`

- **Idempotência pelo `FITID`.** O identificador do OFX vira `external_id`.
  Antes de importar, o sistema consulta os `external_id` já existentes
  **naquela conta** e marca as linhas repetidas como duplicadas.
- **Encoding.** OFX brasileiro costuma vir em Latin-1; a leitura tem fallback
  para `windows-1252`.
- **Sugestão de categoria** usa `MerchantKey`, que normaliza a descrição
  (dobra acentos, remove ruído). A mesma função serve o agente do WhatsApp —
  os dois aprendem da mesma memória de categorização.

---

## 16. Agente de IA

`backend/internal/services/finance_agent_service.go`, `ai_client.go`

### Guardrail regulatório

A **Resolução CVM 19/2021** exige autorização para recomendação
individualizada de investimentos, e isso vale para robôs. O agente:

| Pode | Não pode |
|---|---|
| Orçamento: se cabe no mês, impacto na sobra, reserva | Recomendar comprar, vender ou rebalancear ativo |
| Dívidas e parcelamentos, comprometimento da renda | Opinar se um investimento específico é bom |
| Ler os números que o sistema entrega | Prever mercado, juros ou câmbio |

Citar a alocação como contexto é permitido ("boa parte do seu dinheiro está
travada"); sugerir mudança não é.

### O modelo não calcula

Todos os números chegam prontos no prompt. A instrução é explícita: "Use os
números fornecidos exatamente como vieram. Nunca calcule nada por conta."

### Contexto por tela (`focus`)

| `focus` | O que muda |
|---|---|
| vazio | perfil financeiro agregado |
| `debt` | anexa dívidas em detalhe + as duas ordens de quitação já calculadas |

O `focus` vem do cliente, então o handler **aceita apenas valores conhecidos**
— caso contrário seria uma porta para injeção no prompt.

### Simulação de compra

`SimulatePurchase` decide o veredito em Go:

```
valor_parcela        = valor / parcelas
sobra_após_compra    = sobra_média_mensal − valor_parcela
comprometimento_total = (valor_parcela + parcelas_já_assumidas) / sobra_média
```

| Veredito | Condição |
|---|---|
| `nao_cabe` | não sobra nada após a compra, **ou** comprometimento > 100% |
| `apertado` | comprometimento > 50% **ou** reserva < 3 meses |
| `confortavel` | o resto |

Sem sobra média positiva, o comprometimento é tratado como 100%: sem folga,
qualquer parcela compromete tudo.

### Privacidade no perfil

O bloco enviado ao modelo é **propositalmente agregado** — sem descrição de
lançamento e sem nome de estabelecimento, para não entregar hábitos de
consumo ao provedor do modelo.

### Failover

Dois provedores configuráveis (principal e reserva). Falha do principal
registra log e tenta o reserva; só falha de verdade quando os dois falham.
Detalhes de configuração em [`ia-setup.md`](ia-setup.md).

---

## 17. Invariantes do sistema

As regras que, se quebradas, corrompem dados em silêncio. Vale conferir
qualquer alteração contra esta lista.

1. **Toda consulta filtra por `workspace_id`.** Sem exceção.
2. **`amount` é sempre positivo.** O sinal vem do `type`.
3. **Mudou o estado "pago", ajuste o saldo.** Criar, editar, alternar,
   excluir — todos os caminhos passam por `AdjustAccountBalance`, e editar
   desfaz o impacto antigo antes de aplicar o novo.
4. **Cartão não entra em tela de caixa.** Quem entra é a fatura, no
   vencimento.
5. **Fatura é por ciclo, não por mês-calendário.** Sempre via `closing_day`.
6. **Cálculo financeiro é em Go ou TypeScript, nunca na IA.**
7. **`monthly_rate` é fração.** `0.015` = 1,5% a.m.
8. **Patrimônio consolidado carrega carteira adiante.** Somar só o mês
   registrado faz carteira sumir do total.
9. **O agente não recomenda investimento específico.** Restrição regulatória,
   não preferência de produto.

---

*Documento gerado a partir da leitura do código. Ao mudar uma regra, atualize
a seção correspondente — um mapa desatualizado é pior que mapa nenhum.*
