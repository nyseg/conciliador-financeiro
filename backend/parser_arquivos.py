import pandas as pd
import re
import io
from openpyxl import load_workbook
from typing import Optional
import pdfplumber

# ── OFX / QFX PARSER ────────────────────────────────────────────────────────

def _parsear_ofx(conteudo: bytes) -> pd.DataFrame:
    """
    Parseia arquivo OFX/QFX (formato SGML 1.x ou XML 2.x).
    Extrai transações (STMTTRN) de extratos bancários e faturas de cartão.
    Retorna DataFrame com colunas: data, descricao, valor, nsu, tipo.
    """
    try:
        text = conteudo.decode("utf-8", errors="replace")
    except Exception:
        text = conteudo.decode("latin-1", errors="replace")

    def _get(tag: str, block: str) -> str:
        m = re.search(fr"<{tag}[^>]*>(.*?)(?=<|\Z)", block, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else ""

    rows = []
    for block in re.findall(r"<STMTTRN>(.*?)</STMTTRN>", text, re.DOTALL | re.IGNORECASE):
        trnamt  = _get("TRNAMT", block)
        dtpost  = _get("DTPOSTED", block)
        memo    = _get("MEMO", block) or _get("NAME", block) or ""
        fitid   = _get("FITID", block)
        trntype = _get("TRNTYPE", block)

        try:
            valor = float(trnamt.replace(",", "."))
        except (ValueError, TypeError):
            continue

        dt = None
        if dtpost:
            try:
                dt = pd.to_datetime(dtpost[:8], format="%Y%m%d")
            except Exception:
                pass

        rows.append({
            "data": dt,
            "descricao": memo.strip(),
            "valor": abs(round(valor, 2)),
            "nsu": fitid,
            "tipo": trntype.lower() if trntype else ("debito" if valor < 0 else "credito"),
        })

    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ── PDF PARSER ───────────────────────────────────────────────────────────────

def _parsear_pdf(conteudo: bytes) -> pd.DataFrame:
    """
    Parseia PDF financeiro usando pdfplumber.
    Estratégia 1: extrai tabelas estruturadas página a página.
    Estratégia 2 (fallback): lê texto linha a linha e infere colunas por padrão.
    Retorna DataFrame com as colunas encontradas.
    """
    all_rows: list = []
    headers: list | None = None

    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables(
                table_settings={
                    "vertical_strategy": "lines_strict",
                    "horizontal_strategy": "lines_strict",
                    "snap_tolerance": 4,
                }
            ) or []

            # fallback: tenta estratégia mais permissiva se não achou tabelas
            if not tables:
                tables = page.extract_tables() or []

            for table in tables:
                if not table or len(table) < 2:
                    continue

                # Normaliza header: usa primeira linha se ainda não temos headers
                raw_header = [str(c or "").strip() for c in table[0]]
                if headers is None:
                    headers = [h or f"col_{i}" for i, h in enumerate(raw_header)]
                    data_rows = table[1:]
                else:
                    # Verifica se é linha de header repetida (múltiplas páginas)
                    norm_raw    = [h.lower() for h in raw_header]
                    norm_header = [h.lower() for h in headers]
                    data_rows = table[1:] if norm_raw == norm_header else table

                for row in data_rows:
                    # Garante tamanho igual ao header
                    padded = [str(c or "").strip() for c in row]
                    if len(padded) < len(headers):
                        padded += [""] * (len(headers) - len(padded))
                    all_rows.append(padded[: len(headers)])

    if all_rows and headers:
        df = pd.DataFrame(all_rows, columns=headers)
        df = df.dropna(how="all").reset_index(drop=True)
        # Remove colunas totalmente vazias
        df = df.loc[:, (df != "").any()]
        return df

    # ── Fallback: texto linha a linha ─────────────────────────────────────────
    lines_data: list = []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                # Detecta linhas com data + valor (padrão extrato)
                m = re.match(
                    r"(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([\d.,]+)\s*$", line
                )
                if m:
                    lines_data.append({
                        "data":      m.group(1),
                        "descricao": m.group(2).strip(),
                        "valor":     m.group(3),
                    })

    if lines_data:
        return pd.DataFrame(lines_data)

    return pd.DataFrame()


# ── DETECÇÃO DE FORMATO ──────────────────────────────────────────────────────

def _ler_dataframe(conteudo: bytes, nome: str) -> pd.DataFrame:
    """Lê CSV, Excel ou PDF e retorna DataFrame."""
    ext = nome.lower().split(".")[-1]

    if ext == "pdf":
        return _parsear_pdf(conteudo)

    buf = io.BytesIO(conteudo)
    if ext == "csv":
        for sep in [";", ",", "\t"]:
            try:
                buf.seek(0)
                df = pd.read_csv(buf, sep=sep, encoding="utf-8", dtype=str)
                if len(df.columns) > 1:
                    return df
            except Exception:
                continue
        buf.seek(0)
        return pd.read_csv(buf, sep=";", encoding="latin-1", dtype=str)
    else:
        buf.seek(0)
        try:
            return pd.read_excel(buf, engine="openpyxl", dtype=str)
        except Exception:
            buf.seek(0)
            return pd.read_excel(buf, dtype=str)


def detectar_colunas(conteudo: bytes, nome: str) -> list:
    """Retorna lista de colunas detectadas no arquivo."""
    df = _ler_dataframe(conteudo, nome)
    return [str(c).strip() for c in df.columns if str(c).strip()]


# ── PARSER FATURA CARTÃO ─────────────────────────────────────────────────────

def parsear_fatura_cartao(conteudo: bytes, nome: str,
                          mapeamento: Optional[dict] = None) -> pd.DataFrame:
    """
    Parseia fatura de cartão de crédito.
    Suporta CSV, Excel (.xlsx/.xls), OFX/QFX e PDF.

    Estratégia:
      1. OFX/QFX  → parser SGML dedicado
      2. Com mapeamento explícito → usa colunas informadas pelo usuário
      3. XLSX/XLS → tenta formato Bradesco; se vazio, cai no parser genérico
      4. CSV/PDF  → parser genérico com detecção automática de colunas
    """
    ext = nome.lower().split(".")[-1]

    # ── OFX / QFX ─────────────────────────────────────────────────────────────
    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            df["cartao"] = "OFX"
            df["tipo"]   = "compra"
            return df[["data", "descricao", "valor", "cartao", "tipo"]]
        raise ValueError("Arquivo OFX não contém transações reconhecíveis.")

    # ── Mapeamento explícito (usuário mapeou as colunas) ──────────────────────
    if mapeamento:
        df = _ler_dataframe(conteudo, nome)
        return _parsear_fatura_generico(df, mapeamento)

    # ── XLSX/XLS: tenta Bradesco; se não encontrar, cai no genérico ───────────
    if ext in ["xlsx", "xls"]:
        try:
            wb = load_workbook(io.BytesIO(conteudo), read_only=True)
            ws = wb.active
            df_bd = _parsear_fatura_xlsx(ws)
            if not df_bd.empty:
                return df_bd
        except Exception:
            pass
        # Fallback genérico para qualquer Excel tabular
        df = _ler_dataframe(conteudo, nome)
        return _parsear_fatura_csv(df)

    # ── CSV / PDF ─────────────────────────────────────────────────────────────
    df = _ler_dataframe(conteudo, nome)
    return _parsear_fatura_csv(df)


def _parsear_fatura_xlsx(ws) -> pd.DataFrame:
    skip_kw = ['total', 'transações', 'demonstrativo', 'data', 'cotação', 'pagamento de fatura']
    rows = []
    current_cartao = None

    for row in ws.iter_rows(values_only=True):
        col0 = str(row[0]).strip() if row[0] else ''
        # Tenta localizar valor na coluna R$ (índice 7) ou última coluna numérica
        valor = None
        for cell in reversed(row):
            try:
                v = float(cell)
                if v > 0:
                    valor = v
                    break
            except (TypeError, ValueError):
                continue

        # Detecta titular do cartão
        if re.search(r'\d{4} XXXX XXXX \d{4}', col0) or col0.startswith('@ '):
            m = re.search(r'(\d{4})$', col0.replace(' ', ''))
            current_cartao = m.group(1) if m else col0[-4:]
            continue

        # Encargos: juros, multa, IOF
        if col0.startswith('(+)') and valor:
            desc = col0.replace('(+)', '').strip()
            rows.append({'data': None, 'descricao': desc, 'valor': round(valor, 2),
                         'cartao': current_cartao, 'tipo': 'encargo'})
            continue

        if any(k in col0.lower() for k in skip_kw):
            continue
        if not valor:
            continue

        # Transação: data + descrição na mesma célula
        m = re.match(r'(\d{2}-\d{2}-\d{4})\s+(.+)', col0)
        if m:
            try:
                dt = pd.to_datetime(m.group(1), format='%d-%m-%Y')
            except Exception:
                dt = None
            rows.append({'data': dt, 'descricao': m.group(2).strip(),
                         'valor': round(valor, 2), 'cartao': current_cartao, 'tipo': 'compra'})

    return pd.DataFrame(rows)


def _parsear_fatura_csv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parseia fatura em formato tabular (CSV / Excel genérico / PDF).
    Detecta automaticamente colunas de data, descrição e valor.
    Cobre nomenclaturas de diversos bancos e ERPs.
    """
    col_map = _mapear_colunas_automatico(df, {
        'data': [
            'data', 'date', 'dt', 'data lançamento', 'data transação',
            'data da transação', 'data compra', 'data de compra',
            'data pagamento', 'data de pagamento', 'vencimento',
            'data vencimento', 'data do lançamento', 'data movimento',
        ],
        'descricao': [
            'descrição', 'descricao', 'description', 'historico', 'histórico',
            'estabelecimento', 'fornecedor', 'lançamento', 'lancamento',
            'transação', 'transacao', 'detalhe', 'memo', 'nome',
            'portador', 'comercio', 'comércio', 'local', 'beneficiario',
        ],
        'valor': [
            'valor', 'value', 'amount', 'r$', 'vl', 'vlr',
            'valor r$', 'valor (r$)', 'valor brl', 'importe',
            'valor nacional', 'valor original', 'valor da compra',
            'valor transação', 'valor transacao', 'débito', 'debito',
        ],
        'cartao': [
            'cartão', 'cartao', 'card', 'final', 'últimos dígitos',
            'portador', 'titular',
        ],
    })

    col_v = col_map.get('valor', '')
    if not col_v or col_v not in df.columns:
        return pd.DataFrame()

    valor = _limpar_valor_col(df[col_v])
    mask  = valor > 0
    df_f  = df[mask].copy()

    if df_f.empty:
        return pd.DataFrame()

    result            = pd.DataFrame()
    result['valor']   = valor[mask].round(2).values
    result['tipo']    = 'compra'

    col_cartao = col_map.get('cartao', '')
    result['cartao'] = (
        df_f[col_cartao].astype(str).values
        if col_cartao and col_cartao in df_f.columns else 'Fatura'
    )

    col_d = col_map.get('data', '')
    result['data'] = (
        pd.to_datetime(df_f[col_d].astype(str), dayfirst=True, errors='coerce').values
        if col_d and col_d in df_f.columns else pd.NaT
    )

    col_desc = col_map.get('descricao', '')
    result['descricao'] = (
        df_f[col_desc].astype(str).values
        if col_desc and col_desc in df_f.columns else ''
    )
    return result


def _parsear_fatura_generico(df: pd.DataFrame, mapeamento: dict) -> pd.DataFrame:
    """
    Parseia fatura usando mapeamento explícito de colunas informado pelo usuário.
    Suporta qualquer banco/formato.
    """
    col_v = mapeamento.get('valor', '')
    if not col_v or col_v not in df.columns:
        return pd.DataFrame()

    valor = _limpar_valor_col(df[col_v])
    mask  = valor > 0
    df_f  = df[mask].copy()

    if df_f.empty:
        return pd.DataFrame()

    result          = pd.DataFrame()
    result['valor'] = valor[mask].round(2).values
    result['tipo']  = 'compra'

    col_cartao = mapeamento.get('cartao', '')
    result['cartao'] = (
        df_f[col_cartao].astype(str).values
        if col_cartao and col_cartao in df_f.columns else 'Fatura'
    )

    col_d = mapeamento.get('data', '')
    result['data'] = (
        pd.to_datetime(df_f[col_d].astype(str), dayfirst=True, errors='coerce').values
        if col_d and col_d in df_f.columns else pd.NaT
    )

    col_desc = mapeamento.get('descricao', '')
    result['descricao'] = (
        df_f[col_desc].astype(str).values
        if col_desc and col_desc in df_f.columns else ''
    )
    return result


# ── UTILITÁRIO DE LIMPEZA DE VALOR ──────────────────────────────────────────

def _limpar_valor_col(series: pd.Series) -> pd.Series:
    """Converte coluna de texto para float, removendo R$, vírgulas, espaços."""
    return pd.to_numeric(
        series.astype(str)
              .str.replace('R$', '', regex=False)
              .str.replace('\xa0', '', regex=False)   # non-breaking space
              .str.replace(',', '.', regex=False)
              .str.strip(),
        errors='coerce',
    ).fillna(0.0)


# ── PARSER ERP (genérico com mapeamento) ─────────────────────────────────────

DEFAULT_MAPEAMENTO_ERP = {
    'data':          'Data de Vencimento',
    'descricao':     'Descrição da Conta',
    'valor':         'Valor Liquidado',
    'valor_fallback':'Valor da Conta',
    'numero_fatura': 'Numero da Conta',
    'status':        'Status da Conta',
    'observacao':    'Observação da Conta',
}


def parsear_erp(conteudo: bytes, nome: str, mapeamento: Optional[dict] = None) -> pd.DataFrame:
    """
    Parseia exportação do ERP de contas a pagar/receber.
    Operações vetorizadas — sem iterrows, muito mais rápido para arquivos grandes.
    """
    df   = _ler_dataframe(conteudo, nome)
    mapa = {**DEFAULT_MAPEAMENTO_ERP, **(mapeamento or {})}

    # ── Valor: coluna principal, depois fallback ──────────────────────────────
    col_v  = mapa.get('valor', '')
    col_fb = mapa.get('valor_fallback', '')

    v1 = _limpar_valor_col(df[col_v])  if (col_v  and col_v  in df.columns) else pd.Series(0.0, index=df.index)
    v2 = _limpar_valor_col(df[col_fb]) if (col_fb and col_fb in df.columns) else pd.Series(0.0, index=df.index)

    # Usa v1 onde > 0, senão v2
    valor = v1.where(v1 > 0, v2)
    mask  = valor > 0
    df_f  = df[mask].copy()

    if df_f.empty:
        return pd.DataFrame(columns=['data', 'descricao', 'valor', 'numero_fatura', 'status', 'observacao'])

    result = pd.DataFrame(index=range(mask.sum()))
    result['valor'] = valor[mask].round(2).values

    # ── Data ─────────────────────────────────────────────────────────────────
    col_d = mapa.get('data', '')
    result['data'] = (
        pd.to_datetime(df_f[col_d].astype(str), dayfirst=True, errors='coerce').values
        if col_d and col_d in df_f.columns else pd.NaT
    )

    # ── Strings ──────────────────────────────────────────────────────────────
    for field in ['descricao', 'numero_fatura', 'status', 'observacao']:
        col = mapa.get(field, '')
        result[field] = (
            df_f[col].astype(str).str.strip().values
            if col and col in df_f.columns else ''
        )

    return result


# ── PARSERS RECEITAS ─────────────────────────────────────────────────────────

def parsear_operadora(conteudo: bytes, nome: str) -> pd.DataFrame:
    """Parseia extrato de operadora (Stone, Cielo, Rede…) — CSV, Excel ou OFX. Vetorizado."""
    ext = nome.lower().split(".")[-1]
    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            return df[["data", "descricao", "valor", "nsu", "tipo"]]

    df = _ler_dataframe(conteudo, nome)
    col_map = _mapear_colunas_automatico(df, {
        'data':    ['data', 'date', 'data venda', 'data transacao'],
        'descricao':['descrição', 'descricao', 'tipo', 'bandeira'],
        'valor':   ['valor bruto', 'valor', 'amount', 'vl bruto', 'bruto'],
        'nsu':     ['nsu', 'tid', 'autorização', 'autorizacao'],
    })

    col_v = col_map.get('valor', '')
    if not col_v or col_v not in df.columns:
        return pd.DataFrame()

    valor = _limpar_valor_col(df[col_v])
    mask  = valor > 0
    df_f  = df[mask].copy()

    result = pd.DataFrame()
    result['valor'] = valor[mask].round(2).values
    result['tipo']  = 'venda'

    col_d = col_map.get('data', '')
    result['data'] = (
        pd.to_datetime(df_f[col_d].astype(str), dayfirst=True, errors='coerce').values
        if col_d and col_d in df_f.columns else pd.NaT
    )

    col_desc = col_map.get('descricao', '')
    result['descricao'] = (
        df_f[col_desc].astype(str).values
        if col_desc and col_desc in df_f.columns else ''
    )

    col_nsu = col_map.get('nsu', '')
    result['nsu'] = (
        df_f[col_nsu].astype(str).values
        if col_nsu and col_nsu in df_f.columns else ''
    )
    return result


def parsear_banco(conteudo: bytes, nome: str, mapeamento: Optional[dict] = None) -> pd.DataFrame:
    """Parseia extrato bancário de créditos — CSV, Excel ou OFX. Vetorizado."""
    ext = nome.lower().split(".")[-1]
    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            return df[["data", "descricao", "valor"]].copy()

    df = _ler_dataframe(conteudo, nome)
    col_map = _mapear_colunas_automatico(df, {
        'data':    ['data', 'date', 'data lançamento', 'lançamento'],
        'descricao':['histórico', 'historico', 'descrição', 'descricao'],
        'valor':   ['crédito', 'credito', 'valor', 'entrada'],
    })
    col_map.update(mapeamento or {})

    col_v = col_map.get('valor', '')
    if not col_v or col_v not in df.columns:
        return pd.DataFrame()

    valor = _limpar_valor_col(df[col_v])
    mask  = valor > 0
    df_f  = df[mask].copy()

    result = pd.DataFrame()
    result['valor'] = valor[mask].round(2).values

    col_d = col_map.get('data', '')
    result['data'] = (
        pd.to_datetime(df_f[col_d].astype(str), dayfirst=True, errors='coerce').values
        if col_d and col_d in df_f.columns else pd.NaT
    )

    col_desc = col_map.get('descricao', '')
    result['descricao'] = (
        df_f[col_desc].astype(str).values
        if col_desc and col_desc in df_f.columns else ''
    )
    return result


# ── UTILIDADE ────────────────────────────────────────────────────────────────

def _mapear_colunas_automatico(df: pd.DataFrame, campos: dict) -> dict:
    """Tenta mapear automaticamente colunas do DataFrame para campos esperados."""
    colunas_lower = {c.lower().strip(): c for c in df.columns}
    resultado = {}
    for campo, candidatos in campos.items():
        for cand in candidatos:
            if cand.lower() in colunas_lower:
                resultado[campo] = colunas_lower[cand.lower()]
                break
    return resultado
