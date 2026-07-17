# dsfr-finance

Sistema de gestão financeira pessoal — backend em **Go** e frontend em **Angular**, com banco de dados **PostgreSQL**.

---

## Stack

| Camada     | Tecnologia           |
|------------|----------------------|
| Backend    | Go 1.22+ / Gin       |
| Frontend   | Angular 17+          |
| Banco      | PostgreSQL 16        |
| Container  | Docker / Compose     |
| Auth       | JWT + MFA (TOTP)     |
| Storage    | MinIO (comprovantes) |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- **Docker Desktop** instalado e rodando
- **Node.js** 20+ e npm
- **Go** 1.22+ (opcional, se quiser rodar o backend fora do Docker)

### Passo a passo

#### 1. Clone o repositório

```bash
git clone <repo>
cd dsfr-finance
```

#### 2. Configure o ambiente do backend

Crie o arquivo `.env` no diretório `backend/`:

```bash
# Windows PowerShell
New-Item -Path "backend\.env" -ItemType File -Force
```

Adicione o seguinte conteúdo ao `backend/.env`:

```env
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance?sslmode=disable
JWT_SECRET=local-dev-secret-key-change-in-production-min-32-chars
STORAGE_ENDPOINT=localhost:9000
STORAGE_BUCKET=finance
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@finance.local
SPENDING_ALERT_PCT=80
APP_ENV=development
CORS_ORIGINS=http://localhost:4200
```

#### 3. Suba os serviços com Docker

```bash
docker-compose up -d
```

Isso irá iniciar:
- PostgreSQL (banco de dados)
- Backend Go (API)
- MinIO (armazenamento de arquivos)
- MailHog (servidor SMTP para testes)
- PgAdmin (interface web para o banco)

#### 4. Instale as dependências do frontend

```bash
cd frontend
npm install --legacy-peer-deps
```

#### 5. Rode o frontend em modo desenvolvimento

```bash
npm start
```

O frontend estará disponível em **http://localhost:4200**

### 🌐 URLs dos serviços

| Serviço      | URL                          | Credenciais              |
|--------------|------------------------------|--------------------------|
| Frontend     | http://localhost:4200        | -                        |
| Backend API  | http://localhost:8080/api/v1 | -                        |
| PgAdmin      | http://localhost:5050        | admin@finance.local/admin |
| MinIO Console| http://localhost:9001        | minioadmin/minioadmin    |
| MailHog UI   | http://localhost:8025        | -                        |

### 📝 Primeiro acesso

1. Acesse http://localhost:4200
2. Clique em **"Cadastre-se"**
3. Crie uma nova conta
4. Faça login com as credenciais criadas

### 🛑 Parar os serviços

```bash
# Parar todos os containers
docker-compose down

# Parar e remover volumes (limpa o banco de dados)
docker-compose down -v
```

---

## Estrutura do projeto

```
dsfr-finance/
├── backend/
│   ├── cmd/server/          # Entrypoint
│   ├── internal/
│   │   ├── config/          # Configurações e env
│   │   ├── database/        # Conexão e migrations
│   │   ├── middleware/       # Auth, CORS, logging
│   │   ├── models/          # Structs de domínio
│   │   ├── repositories/    # Acesso ao banco
│   │   ├── services/        # Lógica de negócio
│   │   └── handlers/        # HTTP handlers (Gin)
│   ├── migrations/          # SQL migrations
│   ├── Dockerfile
│   └── go.mod
├── frontend/
│   ├── src/app/
│   │   ├── core/            # Guards, interceptors, serviços singleton
│   │   ├── shared/          # Componentes, pipes e diretivas compartilhados
│   │   └── modules/
│   │       ├── transactions/ # Lançamentos
│   │       ├── cards/        # Cartões de crédito
│   │       ├── reports/      # Relatórios
│   │       ├── spending-limits/ # Limites de gastos
│   │       ├── categories/   # Categorias e tags
│   │       ├── notifications/ # Alertas
│   │       └── account/      # Conta, workspace, MFA
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

---

## Critérios de Aceite

### 1. Experiência do Usuário (UX)

**AC-UX-01** — O sistema deve exibir um botão **"Marcar todos como pago"** no banner de lançamentos passados não pagos, permitindo que o usuário quite todos de uma só vez sem precisar acessar cada lançamento individualmente.

**AC-UX-02** — O sistema deve exibir um botão **"Ignorar todos"** no banner de lançamentos passados não pagos, permitindo dispensar o alerta em lote.

**AC-UX-03** — O formulário de criação de lançamento (despesa, receita e transferência) deve disponibilizar um campo de **observações/notas livres**, permitindo ao usuário adicionar texto descritivo complementar.

**AC-UX-04** — O formulário de criação de lançamento deve permitir o **anexo de comprovantes** (imagem ou PDF) vinculados ao registro.

**AC-UX-05** — O formulário de criação de despesa deve suportar **parcelamento flexível**, permitindo ao usuário definir o número de parcelas e visualizar o impacto nas faturas futuras antes de salvar.

**AC-UX-06** — O sistema deve oferecer a opção de **duplicar um lançamento existente**, pré-preenchendo o formulário com os dados do lançamento original para edição rápida.

**AC-UX-07** — Ao marcar um lançamento como pago ou recebido diretamente na listagem, o sistema deve exibir um **feedback visual imediato** (ex.: mensagem toast ou animação de confirmação), sem recarregar a página completa.

---

### 2. Relatórios

**AC-RL-18** — O relatório de **Contas** deve oferecer uma visão **comparativa entre múltiplas contas** simultaneamente, sem exigir que o usuário selecione uma conta por vez.

**AC-RL-19** — O relatório de Contas deve exibir a **evolução do saldo consolidado** de todas as contas ao longo do tempo (mês a mês).

**AC-RL-20** — O sistema deve incentivar a adoção de **tags** dentro dos relatórios, exibindo uma call-to-action contextual quando não houver lançamentos com tag no período, explicando como e por que utilizá-las.

**AC-RL-21** — Todos os relatórios (Categorias, Entradas x Saídas, Contas e Tags) devem oferecer a opção de **exportação em CSV e/ou Excel**, além das opções já existentes de impressão e PDF.

**AC-RL-22** — O sistema deve disponibilizar um novo relatório de **Evolução Patrimonial**, exibindo o saldo líquido consolidado mês a mês ao longo do tempo, permitindo ao usuário acompanhar o crescimento ou queda do seu patrimônio.

---

### 3. Limite de Gastos

**AC-LG-07** — O sistema deve enviar um **alerta proativo** (notificação e/ou e-mail) quando o consumo de uma categoria atingir um percentual configurável do limite definido (ex.: padrão de 80%).

**AC-LG-08** — O sistema deve enviar um **alerta de limite ultrapassado** quando o gasto de uma categoria exceder o valor do limite configurado.

**AC-LG-09** — O sistema deve permitir definir limites de gasto por **subcategoria**, além das categorias principais.

**AC-LG-10** — O sistema deve permitir definir limites de gasto por **conta bancária específica**.

**AC-LG-11** — O sistema deve permitir definir limites de gasto por **cartão de crédito específico**, de forma independente da categoria genérica "Cartão de crédito".

---

### 4. Cartões de Crédito

**AC-FC-08** — A tela de faturas do cartão deve oferecer uma **visão histórica consolidada** de todas as faturas passadas (ex.: resumo anual), sem exigir navegação mês a mês.

**AC-FC-09** — O sistema deve disponibilizar uma tela de **parcelamentos ativos**, consolidando todos os parcelamentos em andamento em todos os cartões, exibindo: nome do lançamento, cartão, número de parcelas restantes, valor por parcela e impacto projetado nas faturas futuras.

---

### 5. Categorias e Tags

**AC-TG-04** — As **tags** devem ser apresentadas como campo de fácil acesso no formulário de criação e edição de lançamentos, e não apenas na seção de configurações.

**AC-TG-05** — O sistema deve oferecer **sugestão automática de tags** durante o preenchimento de um lançamento, com base no histórico do usuário e em padrões globais.

**AC-CC-07** — O sistema deve permitir que o usuário **customize o ícone e a cor** de cada categoria e subcategoria, substituindo as opções fixas atualmente disponíveis.

---

### 6. Conexão Bancária

**AC-CB-03** — A seção de **Conexão bancária** deve ser integrada ao domínio principal da aplicação, eliminando redirecionamentos para subdomínios diferentes que quebram a consistência da experiência e podem gerar desconfiança no usuário.

---

### 7. Alertas e Notificações

**AC-AL-05** — A configuração de alertas por e-mail deve permitir que o usuário defina, além do **dia da semana**, o **horário** de preferência para o recebimento dos alertas.

**AC-AL-06** — O sistema deve permitir configurar alertas específicos para **limite de gastos**, notificando o usuário quando uma categoria se aproximar (percentual configurável) ou ultrapassar o limite definido.

---

### 8. Conta e Gestão

**AC-MC-08** — A tela de "Minha Conta" deve apresentar com clareza os casos de uso dos **espaços (workspaces)**, diferenciando cenários como: uso pessoal isolado, pessoa física vs. jurídica, e compartilhamento com outro usuário.

**AC-MC-09** — O sistema deve oferecer a opção de **convidar outro usuário** para compartilhar um espaço, com definição de permissões de acesso.

**AC-MC-10** — O sistema deve disponibilizar a opção de **autenticação em dois fatores (MFA/2FA)** na tela de "Minha Conta", como camada adicional de segurança.

**AC-AT-05** — O registro de atividades deve permitir filtrar por **tipo de ação** (ex.: apenas criações, apenas atualizações, apenas exclusões), facilitando auditorias e rastreamento de mudanças.

---

## Variáveis de ambiente

Veja `backend/.env.example` para todas as variáveis disponíveis.

| Variável              | Descrição                        |
|-----------------------|----------------------------------|
| `DATABASE_URL`        | Connection string PostgreSQL     |
| `JWT_SECRET`          | Chave de assinatura JWT          |
| `STORAGE_ENDPOINT`    | Endpoint MinIO/S3 para arquivos  |
| `SMTP_HOST`           | Servidor SMTP para e-mails       |
| `SPENDING_ALERT_PCT`  | Percentual padrão de alerta (80) |

---

## Licença

MIT
