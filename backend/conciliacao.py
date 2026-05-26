import pandas as pd
from typing import Optional

def conciliar(
    df_principal: pd.DataFrame,
    df_erp: pd.DataFrame,
    periodo_mes: str = "",
    modo: str = "despesas",
    df_banco: Optional[pd.DataFrame] = None,
) -> dict:
    """
    Motor de conciliação financeira.

    Modos:
      - despesas: fatura cartão vs ERP contas a pagar (por número de fatura)
      - receitas: operadora vs ERP contas a receber vs banco (por valor+data)
    """
    if modo == "despesas":
        return _conciliar_despesas(df_principal, df_erp, periodo_mes)
    else:
        return _conciliar_receitas(df_principal, df_erp, df_banco, periodo_mes)


# ── DESPESAS ─────────────────────────────────────────────────────────────────

def _conciliar_despesas(df_fatura: pd.DataFrame, df_erp: pd.DataFrame, periodo_mes: str) -> dict:
    # Filtra ERP pelo período se informado
    df_erp_filtrado = df_erp.copy()
    if periodo_mes:
        try:
            ano, mes = int(periodo_mes[:4]), int(periodo_mes[5:7])
            df_erp_filtrado = df_erp_filtrado[
                df_erp_filtrado['data'].apply(
                    lambda x: pd.notna(x) and x.year == ano and x.month == mes
                )
            ]
        except Exception:
            pass

    # Totais por número de fatura no ERP
    if 'numero_fatura' in df_erp_filtrado.columns and not df_erp_filtrado.empty:
        erp_por_fatura = df_erp_filtrado.groupby('numero_fatura').agg(
            total_erp=('valor', 'sum'),
            qtd_itens=('valor', 'count'),
            vencimento=('data', 'min'),
            status=('status', lambda x: 'Pendente' if 'Pendente' in x.values else 'Paga')
        ).reset_index()
        erp_por_fatura['total_erp'] = erp_por_fatura['total_erp'].round(2)
        erp_por_fatura['vencimento'] = erp_por_fatura['vencimento'].apply(
            lambda x: x.strftime('%d/%m/%Y') if pd.notna(x) else '—'
        )
        resumo_faturas = erp_por_fatura.to_dict(orient='records')
    else:
        resumo_faturas = []

    # Total fatura cartão (excluindo encargos)
    compras = df_fatura[df_fatura['tipo'] == 'compra'] if 'tipo' in df_fatura.columns else df_fatura
    encargos = df_fatura[df_fatura['tipo'] == 'encargo'] if 'tipo' in df_fatura.columns else pd.DataFrame()

    total_fatura = round(df_fatura['valor'].sum(), 2) if 'valor' in df_fatura.columns else 0
    total_encargos = round(encargos['valor'].sum(), 2) if not encargos.empty else 0
    total_erp = round(df_erp_filtrado['valor'].sum(), 2) if 'valor' in df_erp_filtrado.columns else 0
    diferenca = round(total_fatura - total_erp, 2)

    # Conciliação item a item por valor (dentro do período)
    itens_fatura = _serializar_df(df_fatura)
    itens_erp = _serializar_df(df_erp_filtrado)

    # Matching por valor exato
    resultado_items = _matching_por_valor(df_fatura, df_erp_filtrado)

    # Encargos
    lista_encargos = []
    if not encargos.empty:
        for _, row in encargos.iterrows():
            lista_encargos.append({
                'descricao': row.get('descricao', ''),
                'valor': row.get('valor', 0),
                'cartao': row.get('cartao', ''),
                'lançado_erp': False
            })

    # Contadores
    ok = sum(1 for r in resultado_items if r['status'] == 'ok')
    sem_erp = sum(1 for r in resultado_items if r['status'] == 'ausente_erp')
    sem_fatura = sum(1 for r in resultado_items if r['status'] == 'ausente_fatura')

    return {
        'modo': 'despesas',
        'periodo': periodo_mes,
        'resumo': {
            'total_itens': len(resultado_items),
            'conciliados': ok,
            'sem_erp': sem_erp,
            'sem_fatura': sem_fatura,
            'total_fatura': total_fatura,
            'total_erp': total_erp,
            'diferenca': diferenca,
            'total_encargos_pendentes': total_encargos,
        },
        'faturas_erp': resumo_faturas,
        'itens': resultado_items,
        'encargos_pendentes': lista_encargos,
    }


def _matching_por_valor(df_fatura: pd.DataFrame, df_erp: pd.DataFrame) -> list:
    """Cruza itens por valor exato. Retorna lista de resultados."""
    erp_usado = [False] * len(df_erp)
    erp_list = df_erp.reset_index(drop=True)
    resultado = []

    for _, c in df_fatura.iterrows():
        matched_idx = None
        for i, e in erp_list.iterrows():
            if not erp_usado[i] and abs(float(e.get('valor', 0)) - float(c.get('valor', 0))) < 0.01:
                matched_idx = i
                erp_usado[i] = True
                break

        data_f = c['data'].strftime('%d/%m/%Y') if pd.notna(c.get('data')) else '—'

        if matched_idx is not None:
            e = erp_list.loc[matched_idx]
            data_e = e['data'].strftime('%d/%m/%Y') if pd.notna(e.get('data')) else '—'
            resultado.append({
                'data_fatura': data_f,
                'descricao_fatura': c.get('descricao', ''),
                'valor_fatura': round(float(c.get('valor', 0)), 2),
                'cartao': c.get('cartao', ''),
                'data_erp': data_e,
                'descricao_erp': e.get('descricao', ''),
                'valor_erp': round(float(e.get('valor', 0)), 2),
                'numero_fatura_erp': e.get('numero_fatura', ''),
                'status_erp': e.get('status', ''),
                'status': 'ok',
            })
        else:
            resultado.append({
                'data_fatura': data_f,
                'descricao_fatura': c.get('descricao', ''),
                'valor_fatura': round(float(c.get('valor', 0)), 2),
                'cartao': c.get('cartao', ''),
                'data_erp': '—',
                'descricao_erp': '—',
                'valor_erp': 0,
                'numero_fatura_erp': '—',
                'status_erp': '—',
                'status': 'ausente_erp',
            })

    # Itens do ERP sem correspondência na fatura
    for i, e in erp_list.iterrows():
        if not erp_usado[i]:
            data_e = e['data'].strftime('%d/%m/%Y') if pd.notna(e.get('data')) else '—'
            resultado.append({
                'data_fatura': '—',
                'descricao_fatura': '—',
                'valor_fatura': 0,
                'cartao': '—',
                'data_erp': data_e,
                'descricao_erp': e.get('descricao', ''),
                'valor_erp': round(float(e.get('valor', 0)), 2),
                'numero_fatura_erp': e.get('numero_fatura', ''),
                'status_erp': e.get('status', ''),
                'status': 'ausente_fatura',
            })

    return resultado


# ── RECEITAS ─────────────────────────────────────────────────────────────────

def _conciliar_receitas(
    df_operadora: pd.DataFrame,
    df_erp: pd.DataFrame,
    df_banco: Optional[pd.DataFrame],
    periodo_mes: str
) -> dict:
    # Filtra período
    def filtrar_periodo(df):
        if not periodo_mes or df.empty:
            return df
        try:
            ano, mes = int(periodo_mes[:4]), int(periodo_mes[5:7])
            return df[df['data'].apply(lambda x: pd.notna(x) and x.year == ano and x.month == mes)]
        except Exception:
            return df

    df_op = filtrar_periodo(df_operadora)
    df_erp_f = filtrar_periodo(df_erp)
    df_banco_f = filtrar_periodo(df_banco) if df_banco is not None else pd.DataFrame()

    total_op = round(df_op['valor'].sum(), 2) if 'valor' in df_op.columns else 0
    total_erp = round(df_erp_f['valor'].sum(), 2) if 'valor' in df_erp_f.columns else 0
    total_banco = round(df_banco_f['valor'].sum(), 2) if 'valor' in df_banco_f.columns else 0

    # Matching triplo por valor
    resultado_items = _matching_triplo(df_op, df_erp_f, df_banco_f)
    ok = sum(1 for r in resultado_items if r['status'] == 'ok')
    divergencia = sum(1 for r in resultado_items if r['status'] == 'divergencia')
    ausente = sum(1 for r in resultado_items if 'ausente' in r['status'])

    return {
        'modo': 'receitas',
        'periodo': periodo_mes,
        'resumo': {
            'total_itens': len(resultado_items),
            'conciliados': ok,
            'divergencias': divergencia,
            'ausentes': ausente,
            'total_operadora': total_op,
            'total_erp': total_erp,
            'total_banco': total_banco,
            'diferenca_op_erp': round(total_op - total_erp, 2),
            'diferenca_op_banco': round(total_op - total_banco, 2),
        },
        'itens': resultado_items,
    }


def _matching_triplo(df_op, df_erp, df_banco) -> list:
    """Matching por valor entre 3 fontes."""
    erp_usado = [False] * len(df_erp)
    banco_usado = [False] * len(df_banco)
    erp_list = df_erp.reset_index(drop=True)
    banco_list = df_banco.reset_index(drop=True) if not df_banco.empty else pd.DataFrame()
    resultado = []

    for _, op in df_op.iterrows():
        val = float(op.get('valor', 0))
        data_op = op['data'].strftime('%d/%m/%Y') if pd.notna(op.get('data')) else '—'

        # Busca no ERP
        erp_match = None
        for i, e in erp_list.iterrows():
            if not erp_usado[i] and abs(float(e.get('valor', 0)) - val) < 0.01:
                erp_match = (i, e)
                erp_usado[i] = True
                break

        # Busca no banco
        banco_match = None
        if not banco_list.empty:
            for i, b in banco_list.iterrows():
                if not banco_usado[i] and abs(float(b.get('valor', 0)) - val) < 0.05 * val + 1:
                    banco_match = (i, b)
                    banco_usado[i] = True
                    break

        status = 'ok' if (erp_match and banco_match) else \
                 'divergencia' if (erp_match or banco_match) else 'ausente_ambos'

        resultado.append({
            'data_operadora': data_op,
            'descricao_operadora': op.get('descricao', ''),
            'valor_operadora': round(val, 2),
            'data_erp': erp_match[1]['data'].strftime('%d/%m/%Y') if erp_match and pd.notna(erp_match[1].get('data')) else '—',
            'descricao_erp': erp_match[1].get('descricao', '') if erp_match else '—',
            'valor_erp': round(float(erp_match[1].get('valor', 0)), 2) if erp_match else 0,
            'valor_banco': round(float(banco_match[1].get('valor', 0)), 2) if banco_match else 0,
            'status': status,
        })

    return resultado


# ── UTILIDADE ────────────────────────────────────────────────────────────────

def _serializar_df(df: pd.DataFrame) -> list:
    """Converte DataFrame para lista de dicts serializável."""
    if df.empty:
        return []
    df2 = df.copy()
    for col in df2.select_dtypes(include=['datetime64[ns]', 'datetime']).columns:
        df2[col] = df2[col].apply(lambda x: x.strftime('%d/%m/%Y') if pd.notna(x) else '—')
    return df2.fillna('—').to_dict(orient='records')
