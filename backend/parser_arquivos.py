import pandas as pd
import re
import io
from openpyxl import load_workbook
from typing import Optional

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


# ── DETECÇÃO DE FORMATO ──────────────────────────────────────────────────────

def _ler_dataframe(conteudo: bytes, nome: str) -> pd.DataFrame:
    """Lê CSV ou Excel e retorna DataFrame."""
    ext = nome.lower().split(".")[-1]
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


# ── PARSER FATURA CARTÃO (formato Bradesco/padrão) ───────────────────────────

def parsear_fatura_cartao(conteudo: bytes, nome: str) -> pd.DataFrame:
    """
    Parseia fatura de cartão de crédito.
    Suporta CSV, Excel (.xlsx/.xls) e OFX/QFX.
    Retorna DataFrame com colunas: data, descricao, valor, cartao, tipo
    """
    ext = nome.lower().split(".")[-1]

    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            df["cartao"] = "OFX"
            df["tipo"] = "compra"
            return df[["data", "descricao", "valor", "cartao", "tipo"]]
        raise ValueError("Arquivo OFX não contém transações reconhecíveis.")

    if ext in ["xlsx", "xls"]:
        wb = load_workbook(io.BytesIO(conteudo), read_only=True)
        ws = wb.active
        return _parsear_fatura_xlsx(ws)
    else:
        # Tenta CSV com colunas padrão
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
    """Parseia fatura em CSV com colunas: Data, Descrição, Valor"""
    col_map = _mapear_colunas_automatico(df, {
        'data': ['data', 'date', 'dt'],
        'descricao': ['descrição', 'descricao', 'description', 'historico', 'histórico'],
        'valor': ['valor', 'value', 'amount', 'r$', 'vl']
    })
    rows = []
    for _, r in df.iterrows():
        try:
            valor = float(str(r.get(col_map.get('valor', ''), '0')).replace(',', '.').replace('R$', '').strip())
            if valor <= 0:
                continue
        except (ValueError, TypeError):
            continue
        dt = None
        try:
            dt = pd.to_datetime(str(r.get(col_map.get('data', ''), '')), dayfirst=True)
        except Exception:
            pass
        rows.append({'data': dt, 'descricao': str(r.get(col_map.get('descricao', ''), '')),
                     'valor': round(valor, 2), 'cartao': 'CSV', 'tipo': 'compra'})
    return pd.DataFrame(rows)


# ── PARSER ERP (genérico com mapeamento) ─────────────────────────────────────

DEFAULT_MAPEAMENTO_ERP = {
    'data': 'Data de Vencimento',
    'descricao': 'Descrição da Conta',
    'valor': 'Valor Liquidado',
    'valor_fallback': 'Valor da Conta',
    'numero_fatura': 'Numero da Conta',
    'status': 'Status da Conta',
    'observacao': 'Observação da Conta',
}


def parsear_erp(conteudo: bytes, nome: str, mapeamento: Optional[dict] = None) -> pd.DataFrame:
    """
    Parseia exportação do ERP de contas a pagar/receber.
    O mapeamento indica quais colunas do arquivo correspondem a cada campo.
    """
    df = _ler_dataframe(conteudo, nome)
    mapa = {**DEFAULT_MAPEAMENTO_ERP, **(mapeamento or {})}

    rows = []
    for _, r in df.iterrows():
        # Valor: tenta liquidado primeiro, depois valor da conta
        valor = 0.0
        for col_key in ['valor', 'valor_fallback']:
            col = mapa.get(col_key, '')
            if col and col in df.columns:
                try:
                    v = float(str(r[col]).replace(',', '.').replace('R$', '').strip())
                    if v > 0:
                        valor = round(v, 2)
                        break
                except (ValueError, TypeError):
                    continue

        if valor == 0:
            continue

        data = None
        col_data = mapa.get('data', '')
        if col_data and col_data in df.columns:
            try:
                data = pd.to_datetime(str(r[col_data]), dayfirst=True)
            except Exception:
                pass

        rows.append({
            'data': data,
            'descricao': str(r.get(mapa.get('descricao', ''), '')).strip(),
            'valor': valor,
            'numero_fatura': str(r.get(mapa.get('numero_fatura', ''), '')).strip(),
            'status': str(r.get(mapa.get('status', ''), '')).strip(),
            'observacao': str(r.get(mapa.get('observacao', ''), '')).strip(),
        })

    df_result = pd.DataFrame(rows)
    if 'data' in df_result.columns:
        df_result['data'] = pd.to_datetime(df_result['data'], errors='coerce')
    return df_result


# ── PARSERS RECEITAS ─────────────────────────────────────────────────────────

def parsear_operadora(conteudo: bytes, nome: str) -> pd.DataFrame:
    """Parseia extrato de operadora de cartão (Stone, Cielo, Rede etc.) — CSV, Excel ou OFX."""
    ext = nome.lower().split(".")[-1]
    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            return df[["data", "descricao", "valor", "nsu", "tipo"]]

    df = _ler_dataframe(conteudo, nome)
    col_map = _mapear_colunas_automatico(df, {
        'data': ['data', 'date', 'data venda', 'data transacao'],
        'descricao': ['descrição', 'descricao', 'tipo', 'bandeira'],
        'valor': ['valor bruto', 'valor', 'amount', 'vl bruto', 'bruto'],
        'nsu': ['nsu', 'tid', 'autorização', 'autorizacao'],
    })
    rows = []
    for _, r in df.iterrows():
        try:
            valor = float(str(r.get(col_map.get('valor', ''), '0')).replace(',', '.').replace('R$', '').strip())
            if valor <= 0:
                continue
        except (ValueError, TypeError):
            continue
        dt = None
        try:
            dt = pd.to_datetime(str(r.get(col_map.get('data', ''), '')), dayfirst=True)
        except Exception:
            pass
        rows.append({
            'data': dt,
            'descricao': str(r.get(col_map.get('descricao', ''), '')),
            'valor': round(valor, 2),
            'nsu': str(r.get(col_map.get('nsu', ''), '')),
            'tipo': 'venda'
        })
    return pd.DataFrame(rows)


def parsear_banco(conteudo: bytes, nome: str, mapeamento: Optional[dict] = None) -> pd.DataFrame:
    """Parseia extrato bancário de créditos recebidos — CSV, Excel ou OFX."""
    ext = nome.lower().split(".")[-1]
    if ext in ["ofx", "qfx"]:
        df = _parsear_ofx(conteudo)
        if not df.empty:
            return df[["data", "descricao", "valor"]].copy()

    df = _ler_dataframe(conteudo, nome)
    mapa = mapeamento or {}
    col_map = _mapear_colunas_automatico(df, {
        'data': ['data', 'date', 'data lançamento', 'lançamento'],
        'descricao': ['histórico', 'historico', 'descrição', 'descricao'],
        'valor': ['crédito', 'credito', 'valor', 'entrada'],
    })
    col_map.update(mapa)
    rows = []
    for _, r in df.iterrows():
        try:
            valor = float(str(r.get(col_map.get('valor', ''), '0')).replace(',', '.').replace('R$', '').strip())
            if valor <= 0:
                continue
        except (ValueError, TypeError):
            continue
        dt = None
        try:
            dt = pd.to_datetime(str(r.get(col_map.get('data', ''), '')), dayfirst=True)
        except Exception:
            pass
        rows.append({
            'data': dt,
            'descricao': str(r.get(col_map.get('descricao', ''), '')),
            'valor': round(valor, 2),
        })
    return pd.DataFrame(rows)


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
