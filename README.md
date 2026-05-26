# 💼 Conciliador Financeiro

Ferramenta web para conciliação automática de cartões de crédito corporativos e vendas.

## Módulos

- **Despesas**: Fatura cartão corporativo vs ERP (Contas a Pagar)
- **Receitas**: Operadora de cartão vs ERP (Contas a Receber) vs Extrato Bancário

---

## Estrutura do projeto

```
conciliador/
├── backend/
│   ├── main.py              # API FastAPI (rotas)
│   ├── parser_arquivos.py   # Leitura e normalização dos arquivos
│   ├── conciliacao.py       # Motor de conciliação
│   ├── exportar.py          # Geração do relatório Excel
│   ├── requirements.txt
│   └── render.yaml          # Config deploy Render
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── api.js            # Chamadas à API
    │   ├── components/
    │   │   ├── UploadCard.js
    │   │   ├── MapeadorColunas.js
    │   │   └── TabelaResultado.js
    │   └── pages/
    │       ├── DespesasPage.js
    │       └── ReceitasPage.js
    ├── public/index.html
    ├── .env.production       # URL do backend em produção
    └── package.json
```

---

## Deploy — Passo a Passo

### 1. Criar repositório no GitHub

1. Acesse https://github.com e crie um novo repositório chamado `conciliador-financeiro`
2. Faça upload de todos os arquivos desta pasta

### 2. Backend — Render.com (gratuito)

1. Acesse https://render.com e crie uma conta gratuita
2. Clique em **New > Web Service**
3. Conecte seu repositório GitHub
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python Version**: 3.11
5. Clique em **Create Web Service**
6. Anote a URL gerada (ex: `https://conciliador-financeiro-api.onrender.com`)

### 3. Frontend — Vercel (gratuito)

1. Acesse https://vercel.com e crie uma conta gratuita
2. Clique em **New Project** e importe o repositório
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Environment Variable**: `REACT_APP_API_URL` = URL do Render (passo 2)
4. Clique em **Deploy**
5. Sua URL ficará no formato: `https://conciliador-financeiro.vercel.app`

---

## Como usar

### Despesas (Cartão Corporativo)
1. Acesse a aba **Despesas**
2. Faça upload da **fatura do cartão** (CSV ou Excel)
3. Faça upload do **relatório de Contas a Pagar** do ERP
4. Configure o mapeamento de colunas do ERP (apenas na primeira vez por cliente)
5. Selecione o período (opcional) e clique em **Executar Conciliação**
6. Analise o resultado e exporte o Excel

### Receitas (Vendas com Cartão)
1. Acesse a aba **Receitas**
2. Faça upload dos 3 arquivos: operadora, ERP e banco
3. Configure os mapeamentos e execute

---

## Como modificar

### Adicionar suporte a nova operadora de cartão
Edite `backend/parser_arquivos.py` → função `parsear_operadora()`

### Alterar regras de conciliação
Edite `backend/conciliacao.py` → funções `_conciliar_despesas()` ou `_conciliar_receitas()`

### Alterar layout visual
Edite os arquivos em `frontend/src/pages/` ou `frontend/src/components/`

### Adicionar novo cliente com ERP diferente
O mapeamento de colunas é feito pelo próprio analista na interface — não precisa alterar código.

---

## Desenvolvimento local

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# API disponível em http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm start
# App disponível em http://localhost:3000
```
