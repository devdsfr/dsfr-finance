# DSFR Finance — Plano de Testes QA

**Versão:** 1.0 | **Data:** 28/06/2026

> **Como usar com a extensão Claude no Chrome:** Cole uma seção por vez no chat e peça ao Claude para registrar o status de cada caso (✅ PASSOU / ❌ FALHOU / ⚠️ PARCIAL / ⏳ PENDENTE).

---

## Resumo

| Total de Casos | Módulos | Status Inicial | Responsável QA |
|----------------|---------|----------------|----------------|
| 92 casos | 14 módulos | A executar | ___________________ |

**Legenda:** ✅ PASSOU · ❌ FALHOU · ⚠️ PARCIAL · 🔲 N/A · ⏳ PENDENTE

---

## 1. Autenticação

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-001 | Login com credenciais válidas | Usuário cadastrado no sistema | 1. Acessar /auth/login<br>2. Inserir e-mail e senha válidos<br>3. Clicar em Entrar | Redireciona para /dashboard. Skeleton de primeira visita é exibido durante o carregamento. | ⏳ |
| TC-002 | Login com senha inválida | Usuário cadastrado | 1. Inserir e-mail correto<br>2. Inserir senha errada<br>3. Clicar em Entrar | Mensagem de erro exibida. Usuário permanece na tela de login. | ⏳ |
| TC-003 | Login com e-mail não cadastrado | Nenhuma conta com o e-mail | 1. Inserir e-mail inexistente<br>2. Inserir qualquer senha<br>3. Clicar em Entrar | Mensagem de erro "usuário não encontrado". Permanece no login. | ⏳ |
| TC-004 | Cadastro de novo usuário | Nenhuma conta existente com o e-mail | 1. Acessar /auth/register<br>2. Preencher nome, e-mail, senha<br>3. Clicar em Cadastrar | Conta criada, redirecionado para /dashboard. | ⏳ |
| TC-005 | Logout do sistema | Usuário autenticado | 1. Clicar no avatar/menu de usuário<br>2. Clicar em Sair | Sessão encerrada. Redirecionado para tela de login. | ⏳ |
| TC-006 | Ativar autenticação 2FA (MFA) | Usuário autenticado, MFA desativado | 1. Acessar Conta > Perfil<br>2. Clicar em Ativar 2FA<br>3. Escanear QR Code<br>4. Inserir código do app autenticador<br>5. Confirmar | MFA ativado com sucesso. Status exibido como ativo. | ⏳ |
| TC-007 | Desativar autenticação 2FA | Usuário com MFA ativo | 1. Acessar Conta > Perfil<br>2. Clicar em Desativar 2FA<br>3. Confirmar no modal | Modal customizado exibido. Ao confirmar, 2FA é desativado. | ⏳ |

---

## 2. Visão Geral (Dashboard)

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-008 | Skeleton na primeira visita pós-login | Usuário acabou de fazer login (sessionStorage sem dash_visited) | 1. Fazer login<br>2. Observar carregamento da Visão Geral | Overlay de skeleton com shimmer é exibido cobrindo toda a tela. Desaparece quando dados carregam. | ⏳ |
| TC-009 | Sem skeleton em visitas subsequentes | Usuário já visitou o dashboard (dash_visited no sessionStorage) | 1. Navegar para outra página<br>2. Retornar ao Dashboard | Overlay de skeleton NÃO é exibido. Apenas skeletons inline (valores individuais). | ⏳ |
| TC-010 | Exibição de receitas e despesas do mês | Existir ao menos 1 transação paga no mês corrente | 1. Acessar Visão Geral<br>2. Observar resumo no topo | Valores de Receitas e Despesas do mês são exibidos corretamente. | ⏳ |
| TC-011 | Mini gráfico de barras mensais (Resultado do Mês) | Existir histórico de transações em meses anteriores | 1. Acessar Visão Geral<br>2. Rolar até card "Resultado do Mês" | Gráfico de barras exibindo até 6 meses anteriores com barras verdes (receitas) e vermelhas (despesas). Legenda visível. | ⏳ |
| TC-012 | Saldo Geral exibido corretamente | Ao menos uma conta cadastrada com saldo | 1. Acessar Visão Geral<br>2. Observar card de Saldo Geral | Saldo total consolidado de todas as contas é exibido. | ⏳ |
| TC-013 | Contas a Pagar com ícone de categoria | Existir despesas não pagas com categoria atribuída | 1. Acessar Visão Geral<br>2. Observar seção "Contas a Pagar" | Ícone emoji da categoria é exibido (fundo neutro). Sem ícone: inicial do nome com cor de fundo. | ⏳ |
| TC-014 | Contas a Receber com ícone de categoria | Existir receitas não pagas com categoria atribuída | 1. Acessar Visão Geral<br>2. Observar seção "Contas a Receber" | Mesma lógica de ícone que Contas a Pagar. | ⏳ |
| TC-015 | Marcar conta como paga pelo Dashboard | Existir conta a pagar não paga | 1. Clicar no ícone de polegar (👍) ao lado da conta<br>2. Aguardar confirmação | Toast de sucesso exibido. Saldo da conta atualizado. Item marcado como pago. | ⏳ |
| TC-016 | Maiores gastos do mês (donut) | Existir despesas categorizadas no mês | 1. Acessar Visão Geral<br>2. Observar card "Maiores Gastos" | Gráfico donut exibindo categorias com percentuais. Máximo 5 categorias. | ⏳ |
| TC-017 | Limite de gastos no Dashboard | Existir limite de gastos cadastrado | 1. Acessar Visão Geral<br>2. Observar card de Limite de Gastos | Barra de progresso exibindo uso atual vs. meta. Percentual em vermelho se ultrapassado. | ⏳ |
| TC-018 | Ver detalhes de cartão de crédito | Existir cartão cadastrado | 1. Observar seção de Cartões no Dashboard<br>2. Clicar em "Ver fatura" | Redireciona para relatório da fatura do cartão. | ⏳ |

---

## 3. Lançamentos (Transações)

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-019 | Criar despesa simples | Usuário autenticado, ao menos 1 conta cadastrada | 1. Clicar em "+ Nova Despesa"<br>2. Preencher descrição, valor, data<br>3. Selecionar conta<br>4. Clicar em ✓ (salvar) | Despesa criada. Toast de sucesso exibido. Item aparece na lista. | ⏳ |
| TC-020 | Criar receita simples | Usuário autenticado | 1. Abrir formulário de lançamento<br>2. Selecionar aba "Receita"<br>3. Preencher campos<br>4. Salvar | Receita criada com sucesso. | ⏳ |
| TC-021 | Criar transferência entre contas | Ao menos 2 contas cadastradas | 1. Abrir formulário<br>2. Selecionar aba "Transferência"<br>3. Preencher valor e contas de origem/destino<br>4. Salvar | Transferência registrada. Saldos das contas atualizados corretamente. | ⏳ |
| TC-022 | Logo do banco exibido no seletor de conta | Conta com logo cadastrada (ex: Nubank, Inter) | 1. Abrir formulário de lançamento<br>2. Clicar em "+ Conta/Cartão" | Logo do banco exibido ao lado do nome da conta no dropdown e no chip após seleção. | ⏳ |
| TC-023 | Seletor de categoria sem fundo colorido | Ao menos 1 categoria cadastrada com ícone | 1. Abrir formulário de lançamento<br>2. Clicar em "Buscar a categoria..." | Ícone emoji da categoria exibido em fundo neutro cinza (#f3f4f6). Sem cor de fundo da categoria. | ⏳ |
| TC-024 | Criar categoria inline no formulário | Formulário de lançamento aberto | 1. Clicar em "Buscar a categoria..."<br>2. Clicar em "+ Nova categoria"<br>3. Preencher nome, escolher ícone e cor<br>4. Salvar | Nova categoria criada e automaticamente selecionada. | ⏳ |
| TC-025 | Editar lançamento existente | Ao menos 1 lançamento cadastrado | 1. Na lista, clicar no ícone de editar (✎)<br>2. Alterar campos<br>3. Salvar | Lançamento atualizado. Toast de sucesso. | ⏳ |
| TC-026 | Excluir lançamento com modal de confirmação | Ao menos 1 lançamento cadastrado | 1. Na lista, clicar no ícone ✕<br>2. Confirmar no modal customizado | Modal animado exibido com detalhes do lançamento. Ao confirmar: excluído com sucesso. | ⏳ |
| TC-027 | Marcar/desmarcar lançamento como pago | Lançamento não pago na lista | 1. Clicar no botão de pagar (👍) ao lado do lançamento | Status alterna entre pago/não pago. Saldo da conta atualizado. | ⏳ |
| TC-028 | Marcar todos como pagos | Múltiplos lançamentos não pagos | 1. Clicar em "✓ Marcar todos como pago" | Todos os lançamentos visíveis marcados como pagos. | ⏳ |
| TC-029 | Filtrar por tipo (Despesa/Receita/Transferência) | Lista com lançamentos de tipos diferentes | 1. Selecionar tipo no filtro "Tipo"<br>2. Observar lista | Lista filtrada exibindo apenas o tipo selecionado. | ⏳ |
| TC-030 | Filtrar por status (Pago/Não pago) | Lista com lançamentos pagos e não pagos | 1. Selecionar status no filtro<br>2. Observar lista | Lista filtrada pelo status selecionado. | ⏳ |
| TC-031 | Buscar lançamento por descrição | Lista com múltiplos lançamentos | 1. Digitar texto no campo de busca | Lista filtrada em tempo real exibindo apenas correspondências. | ⏳ |
| TC-032 | Duplicar lançamento | Ao menos 1 lançamento cadastrado | 1. Editar lançamento<br>2. Clicar em "Duplicar" | Lançamento duplicado criado com mesmos dados. | ⏳ |
| TC-033 | Adicionar tag a lançamento | Formulário de lançamento aberto | 1. Clicar em "Tags" na barra inferior do formulário<br>2. Digitar e confirmar tag | Tag adicionada ao lançamento e visível na lista. | ⏳ |
| TC-034 | Adicionar observação a lançamento | Formulário de lançamento aberto | 1. Clicar em "Observação"<br>2. Digitar texto | Observação salva com o lançamento. | ⏳ |
| TC-035 | Anexar arquivo a lançamento | Formulário de lançamento aberto | 1. Clicar em "Anexo"<br>2. Selecionar arquivo | Arquivo anexado ao lançamento. | ⏳ |
| TC-036 | Lançamento parcelado | Formulário de lançamento aberto | 1. Clicar em "Repetir"<br>2. Configurar parcelamento (número de parcelas)<br>3. Salvar | Parcelas criadas automaticamente com datas corretas. | ⏳ |
| TC-037 | Importar extrato Organizze (.xlsx) | Arquivo .xlsx exportado do Organizze | 1. Na lista de lançamentos, clicar em "Importar"<br>2. Selecionar arquivo .xlsx<br>3. Confirmar importação | Lançamentos importados corretamente. Toast de sucesso com quantidade importada. | ⏳ |

---

## 4. Contas & Cartões

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-038 | Cadastrar nova conta bancária | Usuário autenticado | 1. Acessar Contas & Cartões<br>2. Clicar em "+ Adicionar Conta"<br>3. Preencher nome, tipo, saldo inicial<br>4. Selecionar logo do banco<br>5. Salvar | Conta criada. Logo do banco exibida. Saldo atualizado no Dashboard. | ⏳ |
| TC-039 | Editar conta bancária | Ao menos 1 conta cadastrada | 1. Clicar em "✎ Editar" ao lado da conta<br>2. Alterar campos<br>3. Salvar | Conta atualizada com sucesso. | ⏳ |
| TC-040 | Excluir conta com modal de confirmação | Ao menos 1 conta cadastrada | 1. Clicar em "✕" ao lado da conta<br>2. Confirmar no modal customizado | Modal animado exibido. Ao confirmar: conta excluída. | ⏳ |
| TC-041 | Cadastrar cartão de crédito | Usuário autenticado | 1. Aba "Cartões de Crédito"<br>2. Clicar em "+ Adicionar Cartão"<br>3. Preencher nome, bandeira, limite, dia de fechamento/vencimento<br>4. Salvar | Cartão cadastrado com logo da bandeira exibida. | ⏳ |
| TC-042 | Editar cartão de crédito | Ao menos 1 cartão cadastrado | 1. Clicar em "✎ Editar" ao lado do cartão<br>2. Alterar campos<br>3. Salvar | Cartão atualizado com sucesso. | ⏳ |
| TC-043 | Excluir cartão com modal de confirmação | Ao menos 1 cartão cadastrado | 1. Clicar em "✕" ao lado do cartão<br>2. Confirmar no modal customizado | Modal animado exibido. Ao confirmar: cartão excluído. | ⏳ |

---

## 5. Categorias

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-044 | Visualizar categorias de despesa e receita | Categorias cadastradas em ambas as abas | 1. Acessar Categorias<br>2. Alternar entre abas Despesas e Receitas | Cada aba exibe suas respectivas categorias com ícone e nome. | ⏳ |
| TC-045 | Criar nova categoria de despesa | Usuário autenticado | 1. Clicar em "+ Categoria de Despesa"<br>2. Preencher nome, escolher ícone e cor<br>3. Salvar | Categoria criada e exibida na lista de Despesas. | ⏳ |
| TC-046 | Editar categoria existente | Ao menos 1 categoria cadastrada | 1. Clicar em "editar" ao lado da categoria<br>2. Alterar nome, ícone ou cor<br>3. Salvar | Categoria atualizada com novos dados. | ⏳ |
| TC-047 | Arquivar categoria | Ao menos 1 categoria cadastrada | 1. Clicar em "arquivar" ao lado da categoria (botão laranja)<br>2. Confirmar no modal | Modal de confirmação de arquivamento exibido. Ao confirmar: categoria arquivada e removida da lista. | ⏳ |
| TC-048 | Excluir categoria com lançamentos vinculados | Categoria com ao menos 1 lançamento vinculado | 1. Clicar em "excluir" ao lado da categoria (botão vermelho)<br>2. Confirmar no modal customizado | Modal exibe aviso que lançamentos perderão a categoria. Ao confirmar: categoria excluída sem erros. Lançamentos ficam sem categoria (null). | ⏳ |
| TC-049 | Excluir categoria sem lançamentos | Categoria sem lançamentos vinculados | 1. Clicar em "excluir"<br>2. Confirmar no modal | Categoria excluída com sucesso. Toast "Categoria excluída." exibido. | ⏳ |

---

## 6. Relatórios

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-050 | Acessar relatório unificado | Usuário autenticado | 1. Clicar em "Relatórios" no menu | Página de relatórios aberta com abas: Categorias, Entradas x Saídas, Contas, Tags. | ⏳ |
| TC-051 | Relatório de Categorias — modo Donut | Lançamentos categorizados no período | 1. Acessar Relatórios > Categorias<br>2. Selecionar modo donut | Gráfico donut exibindo distribuição por categoria com percentuais. | ⏳ |
| TC-052 | Relatório de Categorias — modo Linha | Lançamentos em múltiplos meses | 1. Acessar Relatórios > Categorias<br>2. Selecionar modo linha | Gráfico de linhas exibindo evolução por categoria ao longo do tempo. | ⏳ |
| TC-053 | Relatório de Categorias — modo Tabela | Lançamentos categorizados | 1. Acessar Relatórios > Categorias<br>2. Selecionar modo tabela | Tabela com categorias, valores e percentuais. | ⏳ |
| TC-054 | Relatório Entradas x Saídas | Lançamentos no período | 1. Acessar Relatórios > Entradas x Saídas<br>2. Navegar entre meses | Gráfico de barras comparando receitas e despesas. Saldo/déficit exibido. | ⏳ |
| TC-055 | Relatório de Contas | Ao menos 2 contas com movimentação | 1. Acessar Relatórios > Contas | Histórico de saldo por conta exibido com gráficos. | ⏳ |
| TC-056 | Relatório de Tags | Lançamentos com tags atribuídas | 1. Acessar Relatórios > Tags | Distribuição de gastos por tag exibida. | ⏳ |
| TC-057 | Navegar entre meses no relatório | Relatório aberto | 1. Clicar nas setas de navegação de mês | Dados atualizados para o mês selecionado. | ⏳ |

---

## 7. Evolução de Patrimônio

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-058 | Registrar snapshot de patrimônio | Usuário autenticado | 1. Acessar Patrimônio<br>2. Clicar em "+ Registrar mês"<br>3. Preencher mês, carteira e valores<br>4. Salvar | Snapshot salvo. Aparece no histórico. | ⏳ |
| TC-059 | Editar snapshot existente sem duplicar | Ao menos 1 snapshot cadastrado | 1. Clicar em ✏️ ao lado do snapshot<br>2. Alterar o mês ou valores<br>3. Salvar | Snapshot ATUALIZADO via PUT (não cria novo registro). Histórico correto. | ⏳ |
| TC-060 | Excluir snapshot com modal customizado | Ao menos 1 snapshot cadastrado | 1. Clicar em 🗑 ao lado do snapshot<br>2. Confirmar no modal animado | Modal exibe mês e carteira. Ao confirmar: snapshot excluído. | ⏳ |
| TC-061 | "Todas as carteiras" exibe total consolidado | Snapshots de múltiplas carteiras no mesmo mês | 1. Acessar Patrimônio<br>2. Clicar em "Todas as carteiras" | Patrimônio total = soma de todas as carteiras no mesmo mês. Não exibe valor de apenas uma carteira. | ⏳ |
| TC-062 | Visualizar carteira individual | Ao menos 2 carteiras cadastradas | 1. Clicar em uma carteira específica | Dados filtrados para a carteira selecionada. Gráfico e cards atualizados. | ⏳ |
| TC-063 | Gráfico de evolução exibe múltiplas carteiras | Ao menos 2 carteiras com 2+ meses de dados | 1. Acessar Patrimônio > Todas as carteiras<br>2. Observar gráfico | Uma linha por carteira com cores distintas. Legenda visível. | ⏳ |

---

## 8. Limite de Gastos

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-064 | Criar limite por categoria | Ao menos 1 categoria cadastrada | 1. Acessar Limite de Gastos<br>2. Clicar em "+ Novo Limite"<br>3. Selecionar tipo "Categoria"<br>4. Escolher categoria, valor, período<br>5. Salvar | Limite criado. Barra de progresso exibida com uso atual. | ⏳ |
| TC-065 | Criar limite geral (sem categoria) | Usuário autenticado | 1. Criar limite sem selecionar categoria | Limite geral criado. Exibido como "Limite geral" no Dashboard. | ⏳ |
| TC-066 | Editar limite existente | Ao menos 1 limite cadastrado | 1. Clicar em editar ao lado do limite<br>2. Alterar valor ou período<br>3. Salvar | Limite atualizado. | ⏳ |
| TC-067 | Excluir limite com modal de confirmação | Ao menos 1 limite cadastrado | 1. Clicar em excluir ao lado do limite<br>2. Confirmar no modal customizado | Modal animado exibido. Ao confirmar: limite excluído. | ⏳ |
| TC-068 | Alerta visual quando limite ultrapassado | Limite criado e gastos excedem o valor | 1. Cadastrar limite com valor menor que os gastos do mês<br>2. Acessar Limite de Gastos | Percentual exibido em vermelho. Barra vermelha indicando ultrapassagem. | ⏳ |

---

## 9. Estratégia de Dívidas

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-069 | Cadastrar nova dívida | Plano premium ativo | 1. Acessar Estratégia de Dívidas<br>2. Clicar em "+ Nova Dívida"<br>3. Preencher nome, tipo, saldo, taxa mensal, parcela<br>4. Salvar | Dívida cadastrada. Aparece na lista com detalhes de prazo e juros. | ⏳ |
| TC-070 | Visualizar estratégia Bola de Neve | Ao menos 2 dívidas cadastradas | 1. Selecionar estratégia "Bola de Neve"<br>2. Observar ordem de quitação | Dívidas ordenadas do menor para o maior saldo. Dicas de estratégia exibidas. | ⏳ |
| TC-071 | Visualizar estratégia Avalanche | Ao menos 2 dívidas cadastradas | 1. Selecionar estratégia "Avalanche"<br>2. Observar ordem de quitação | Dívidas ordenadas pela maior taxa de juros. Economia em juros calculada. | ⏳ |
| TC-072 | Editar dívida existente | Ao menos 1 dívida cadastrada | 1. Clicar em editar na dívida<br>2. Alterar valores<br>3. Salvar | Dívida atualizada. Cálculos de estratégia recalculados. | ⏳ |
| TC-073 | Excluir dívida com modal de confirmação | Ao menos 1 dívida cadastrada | 1. Clicar em excluir na dívida<br>2. Confirmar no modal customizado | Modal animado exibido. Ao confirmar: dívida excluída. | ⏳ |

---

## 10. Assinaturas de IA

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-074 | Cadastrar assinatura de IA | Plano premium ativo | 1. Acessar Assinaturas de IA<br>2. Clicar em "+ Nova Assinatura"<br>3. Selecionar preset (ex: ChatGPT Plus)<br>4. Preencher valor e chave API<br>5. Salvar | Assinatura cadastrada com logo do provedor exibida. | ⏳ |
| TC-075 | Sincronizar uso de API | Assinatura com chave API válida | 1. Clicar em "🔄 Sincronizar" na assinatura | Uso atual atualizado. Token e custo exibidos. | ⏳ |
| TC-076 | Inserir uso manualmente | Assinatura cadastrada | 1. Preencher uso manual no formulário<br>2. Salvar | Dados de uso registrados manualmente. | ⏳ |
| TC-077 | Editar assinatura de IA | Ao menos 1 assinatura cadastrada | 1. Clicar em editar na assinatura<br>2. Alterar campos (chave API pode ser deixada em branco para manter)<br>3. Salvar | Assinatura atualizada. Chave anterior mantida se campo em branco. | ⏳ |
| TC-078 | Excluir assinatura com modal de confirmação | Ao menos 1 assinatura cadastrada | 1. Clicar em excluir<br>2. Confirmar no modal customizado | Modal animado exibido. Ao confirmar: assinatura excluída. | ⏳ |

---

## 11. Perfil & Configurações

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-079 | Alterar moeda padrão | Usuário autenticado | 1. Acessar Conta > Perfil<br>2. Alterar moeda no seletor<br>3. Salvar | Moeda atualizada em todo o sistema. Valores exibidos na nova moeda. | ⏳ |
| TC-080 | Exportar dados da conta | Usuário autenticado | 1. Acessar Conta > Perfil<br>2. Clicar em "⬇ Exportar dados" | Arquivo JSON baixado com todos os dados do usuário. | ⏳ |
| TC-081 | Excluir conta com dupla confirmação | Usuário autenticado | 1. Acessar Conta > Perfil<br>2. Clicar em "🗑 Excluir conta"<br>3. Confirmar no modal customizado | Modal com aviso severo exibido. Ao confirmar: conta excluída, usuário deslogado. | ⏳ |
| TC-082 | Convidar membro para workspace | Usuário com permissão de owner | 1. Acessar Conta > Perfil<br>2. Inserir e-mail do convidado<br>3. Selecionar papel (viewer/editor)<br>4. Enviar convite | Convite enviado. Toast de confirmação exibido. | ⏳ |
| TC-083 | Visualizar log de atividades | Ações realizadas na conta | 1. Acessar Conta > Log de Atividades | Histórico de ações ordenado por data exibido. | ⏳ |

---

## 12. Modal de Confirmação Padronizado

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-084 | Modal exibido em todas as exclusões | Qualquer tela com opção de excluir | 1. Clicar em excluir em qualquer módulo (categorias, contas, cartões, dívidas, limites, assinaturas, patrimônio, lançamentos) | Modal customizado animado (pop-in .18s) exibido em todos os casos. Nunca dialog nativo do browser. | ⏳ |
| TC-085 | Cancelar exclusão não remove o registro | Modal de confirmação aberto | 1. Clicar em "Cancelar" ou clicar fora do modal | Modal fecha. Registro permanece intacto. | ⏳ |
| TC-086 | Confirmar exclusão remove o registro | Modal de confirmação aberto | 1. Clicar em "Excluir" (botão vermelho) | Registro excluído. Toast de sucesso exibido. Modal fecha. | ⏳ |
| TC-087 | Modal exibe nome/detalhes do item a ser excluído | Qualquer modal de exclusão | 1. Abrir modal de exclusão de qualquer item | Mensagem contém o nome/identificação do item (ex: "carteira Robert", "mês Junho 2026"). | ⏳ |

---

## 13. Notificações & Alertas

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-088 | Visualizar lista de notificações | Ao menos 1 notificação gerada | 1. Clicar no ícone de notificações ou acessar /notifications | Lista de notificações exibida com data e mensagem. | ⏳ |
| TC-089 | Marcar notificação como lida | Ao menos 1 notificação não lida | 1. Clicar em "Marcar como lida" na notificação | Notificação marcada como lida. Contador atualizado. | ⏳ |
| TC-090 | Marcar todas como lidas | Múltiplas notificações não lidas | 1. Clicar em "Marcar todas como lidas" | Todas notificações marcadas. Contador zerado. | ⏳ |
| TC-091 | Configurar alertas | Usuário autenticado | 1. Acessar /alert-config<br>2. Configurar tipo e limites de alerta | Configurações salvas. Alertas disparados conforme configurado. | ⏳ |

---

## 14. Open Finance

| ID | Caso de Teste | Pré-condição | Passos | Resultado Esperado | Status |
|----|--------------|--------------|--------|-------------------|--------|
| TC-092 | Acessar tela de Open Finance | Usuário autenticado | 1. Clicar em "Open Finance" no menu | Tela de Open Finance exibida com informações de conexão disponíveis. | ⏳ |

---

## Observações Gerais para o QA

1. **Modais de exclusão** — todos devem usar o componente customizado com animação pop-in. Nunca deve aparecer o `window.confirm` nativo do browser.
2. **Saldo após pagamento** — ao marcar lançamentos como pagos, verificar se o Saldo Geral na Visão Geral é atualizado.
3. **Skeleton de primeira visita** — deve aparecer apenas na primeira visita pós-login (por sessão). Nas visitas subsequentes na mesma aba, o overlay NÃO deve aparecer.
4. **Exclusão de categoria com FK** — confirmar que a exclusão ocorre sem erro mesmo com lançamentos vinculados, e que esses lançamentos ficam sem categoria.
5. **Edição de snapshot de patrimônio** — confirmar que ao trocar o mês na edição, o registro é ATUALIZADO (PUT) e não duplicado (POST).
6. **Todas as carteiras no Patrimônio** — o valor deve ser a SOMA de todas as carteiras para o mesmo mês, não o valor de uma carteira isolada.
