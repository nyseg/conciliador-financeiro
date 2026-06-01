import pandas as pd
from typing import Optional
from collections import defaultdict
import re
from difflib import SequenceMatcher


# ══════════════════════════════════════════════════════════════════════════════
#  UTILITÁRIOS
# ══════════════════════════════════════════════════════════════════════════════

def _detectar_parcela(descricao: str) -> Optional[dict]:
    """
    Detecta padrão de parcelamento na descrição da fatura.
    Retorna {'numero': X, 'total': Y} ou None.

    Reconhece:
      "PARC 3/6"  "PARCELA 03 DE 12"  "02/06" standalone  "3X12"
    """
    if not descricao:
        return None
    s = str(descricao).upper()

    # Padrão 1 – keyword PARC/PARCELA seguida de X/Y ou X DE Y
    m = re.search(r'PARC(?:ELA(?:MENTO)?)?\s*(\d{1,2})\s*(?:DE\s+|[/\-])(\d{1,2})', s)
    if m:
        n, t = int(m.group(1)), int(m.group(2))
        if 1 <= n <= t <= 72:
            return {'numero': n, 'total': t}

    # Padrão 2 – número isolado X/Y ao final (sem confundir com datas DD/MM/AAAA)
    for m in re.finditer(r'(?<!\d)(\d{1,2})/(\d{1,2})(?!\d)', s):
        n, t = int(m.group(1)), int(m.group(2))
        if 1 <= n <= t <= 72 and t >= 2:
            return {'numero': n, 'total': t}

    return None


def _similaridade(a: str, b: str) -> float:
    """Similaridade (0–1) entre duas descrições, ignorando case e caracteres especiais."""
    if not a or not b or a == '—' or b == '—':
        return 0.0
    clean = lambda s: re.sub(r'[^A-Z0-9 ]', '', str(s).upper()).strip()
    ca, cb = clean(a)[:80], clean(b)[:80]
    if not ca or not cb:
        return 0.0
    return SequenceMatcher(None, ca, cb).ratio()


def _fmt_data(val) -> str:
    return val.strftime('%d/%m/%Y') if pd.notna(val) else '—'


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTRUTORES DE ITEM
# ══════════════════════════════════════════════════════════════════════════════

def _item_match(fat, erp, status: str, modo_match: str,
                parcela_info=None, agrupado_com=None) -> dict:
    item = {
        'data_fatura':          _fmt_data(fat.get('data')),
        'descricao_fatura':     str(fat.get('descricao', '')),
        'valor_fatura':         round(float(fat.get('valor') or 0), 2),
        'cartao':               str(fat.get('cartao', '')),
        'data_erp':             _fmt_data(erp.get('data')),
        'descricao_erp':        str(erp.get('descricao', '')),
        'valor_erp':            round(float(erp.get('valor') or 0), 2),
        'numero_fatura_erp':    str(erp.get('numero_fatura', '')),
        'status_erp':           str(erp.get('status', '')),
        'categoria_erp':        str(erp.get('categoria', '')),
        'status':               status,
        'modo_match':           modo_match,
        'parcela':              None,
        'valor_total_estimado': None,
        'agrupado_com':         agrupado_com,
    }
    if parcela_info:
        item['parcela'] = f"{parcela_info['numero']}/{parcela_info['total']}"
        item['valor_total_estimado'] = round(
            float(fat.get('valor') or 0) * parcela_info['total'], 2
        )
    return item


def _item_sem_erp(fat) -> dict:
    parcela_info = _detectar_parcela(str(fat.get('descricao', '')))
    return {
        'data_fatura':          _fmt_data(fat.get('data')),
        'descricao_fatura':     str(fat.get('descricao', '')),
        'valor_fatura':         round(float(fat.get('valor') or 0), 2),
        'cartao':               str(fat.get('cartao', '')),
        'data_erp':             '—',
        'descricao_erp':        '—',
        'valor_erp':            0,
        'numero_fatura_erp':    '—',
        'status_erp':           '—',
        'categoria_erp':        '',
        'status':               'ausente_erp',
        'modo_match':           None,
        'parcela':              f"{parcela_info['numero']}/{parcela_info['total']}" if parcela_info else None,
        'valor_total_estimado': round(float(fat.get('valor') or 0) * parcela_info['total'], 2) if parcela_info else None,
        'agrupado_com':         None,
    }


def _item_sem_fatura(erp) -> dict:
    return {
        'data_fatura':          '—',
        'descricao_fatura':     '—',
        'valor_fatura':         0,
        'cartao':               '—',
        'data_erp':             _fmt_data(erp.get('data')),
        'descricao_erp':        str(erp.get('descricao', '')),
        'valor_erp':            round(float(erp.get('valor') or 0), 2),
        'numero_fatura_erp':    str(erp.get('numero_fatura', '')),
        'status_erp':           str(erp.get('status', '')),
        'categoria_erp':        str(erp.get('categoria', '')),
        'status':               'ausente_fatura',
        'modo_match':           None,
        'parcela':              None,
        'valor_total_estimado': None,
        'agrupado_com':         None,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ALGORITMO PRINCIPAL DE MATCHING — DESPESAS
# ══════════════════════════════════════════════════════════════════════════════

def _encontrar_grupo_greedy(candidatos: list, target_cents: int,
                             tolerancia: int = 5) -> list:
    """
    Tenta encontrar um subconjunto de itens da fatura (lista de (fi, row))
    cuja soma se aproxime de target_cents (valor ERP em centavos).
    Usa abordagem greedy ordenada por valor decrescente.
    """
    if not candidatos or target_cents <= 0:
        return []
    ordenados = sorted(candidatos, key=lambda x: float(x[1].get('valor') or 0), reverse=True)
    soma = 0
    selecionados = []
    for fi, row in ordenados:
        v = round(float(row.get('valor') or 0) * 100)
        if soma + v <= target_cents + tolerancia:
            soma += v
            selecionados.append(fi)
            if abs(soma - target_cents) <= tolerancia:
                return selecionados
    return []


def _matching_despesas(df_fatura: pd.DataFrame, df_erp: pd.DataFrame,
                       modo_erp: str = 'transacao', perfil: dict = None) -> list:
    """
    Conciliação em múltiplas camadas:
      1. Match exato  — valor == valor  AND  data ± tolerancia_dias
      2. Match aproximado — valor == valor  AND  data ± janela  + similaridade
         2b. Data divergente — valor exato, data > tolerancia mas <= 45, sim > 0.6
      3. Parcelamento Cenário A — usa campo de parcela no ERP
         Parcelamento Cenário B — busca valor da parcela com tolerância de data
         Parcelamento Cenário C — busca soma do total parcelado no ERP
      4. Match por categoria — modo 'categoria' ou 'misto'
      5. Encargos — busca encargos da fatura em descrições do ERP
      6. Sem correspondência
    """
    perfil = perfil or {}
    tolerancia_dias = int(perfil.get('tolerancia_dias', 5))

    fat = df_fatura.reset_index(drop=True).copy()
    erp = df_erp.reset_index(drop=True).copy()

    fat_usado: set = set()
    erp_usado: set = set()
    resultado: dict = {}

    # ── Índice ERP por valor (cents) para lookup O(1) ─────────────────────────
    erp_idx: dict = defaultdict(list)
    for ei, e in erp.iterrows():
        v = round(float(e.get('valor') or 0) * 100)
        erp_idx[v].append(ei)

    # ══ CAMADA 1 — Match exato (valor + data ± tolerancia_dias) ══════════════
    for fi, f in fat.iterrows():
        v_c  = round(float(f.get('valor') or 0) * 100)
        d_f  = f.get('data')

        best_ei, best_dias = None, float('inf')
        for ei in erp_idx.get(v_c, []):
            if ei in erp_usado:
                continue
            d_e  = erp.loc[ei, 'data']
            dias = abs((d_f - d_e).days) if (pd.notna(d_f) and pd.notna(d_e)) else 0
            if dias <= tolerancia_dias and dias < best_dias:
                best_dias = dias
                best_ei   = ei

        if best_ei is not None:
            parcela_info = _detectar_parcela(str(f.get('descricao', '')))
            status = 'ok_parcela' if parcela_info else 'ok'
            resultado[fi] = _item_match(f, erp.loc[best_ei], status, 'exato', parcela_info)
            erp_usado.add(best_ei)
            fat_usado.add(fi)

    # ══ CAMADA 2 — Match aproximado (valor + janela de data + similaridade) ═══
    for fi, f in fat.iterrows():
        if fi in fat_usado:
            continue
        v_c        = round(float(f.get('valor') or 0) * 100)
        d_f        = f.get('data')
        desc_f     = str(f.get('descricao', ''))
        parcela_info = _detectar_parcela(desc_f)
        # Parcelas podem chegar com até 45 dias de diferença de data de lançamento
        janela = 45 if parcela_info else 15

        best_ei, best_score, best_dias_ei = None, -1.0, 0
        for ei in erp_idx.get(v_c, []):
            if ei in erp_usado:
                continue
            d_e  = erp.loc[ei, 'data']
            dias = abs((d_f - d_e).days) if (pd.notna(d_f) and pd.notna(d_e)) else 0
            if dias > 45:
                continue
            sim   = _similaridade(desc_f, str(erp.loc[ei, 'descricao']))
            if dias <= janela:
                score = 0.55 * (1 - dias / max(janela, 1)) + 0.45 * sim
            else:
                score = 0.3 * sim
            if score > best_score:
                best_score = score
                best_ei    = ei
                best_dias_ei = dias

        # Exige score mínimo para evitar falsos positivos
        if best_ei is not None and best_score >= 0.25:
            desc_erp  = str(erp.loc[best_ei, 'descricao'])
            sim_final = _similaridade(desc_f, desc_erp)
            # Data divergente: valor exato, data fora da tolerância normal, sim > 0.6
            if best_dias_ei > tolerancia_dias and best_dias_ei <= 45 and sim_final > 0.6:
                status    = 'ok_data_div'
                modo_m    = 'data_divergente'
                parc_info = None
            else:
                status = 'ok_parcela' if parcela_info else 'ok'
                modo_m = 'parcela' if parcela_info else 'aproximado'
                parc_info = parcela_info
            resultado[fi] = _item_match(f, erp.loc[best_ei], status, modo_m, parc_info)
            erp_usado.add(best_ei)
            fat_usado.add(fi)

    # ══ CAMADA 3 — Parcelamento (Cenários A, B, C) ═══════════════════════════
    campo_parcelas_erp = perfil.get('campo_parcelas_erp', '')
    cenario = str(perfil.get('cenario_parcelamento', 'B')).upper()

    fat_parcelados = [
        (fi, fat.loc[fi])
        for fi in fat.index
        if fi not in fat_usado and _detectar_parcela(str(fat.loc[fi].get('descricao', '')))
    ]

    # Cenário A — ERP tem campo de número de parcela
    if cenario == 'A' and campo_parcelas_erp:
        for fi, f in fat_parcelados:
            if fi in fat_usado:
                continue
            parcela_info = _detectar_parcela(str(f.get('descricao', '')))
            if not parcela_info:
                continue
            v_c = round(float(f.get('valor') or 0) * 100)
            num_parcela = parcela_info['numero']
            for ei in erp_idx.get(v_c, []):
                if ei in erp_usado:
                    continue
                erp_row = erp.loc[ei]
                erp_parc_val = str(erp_row.get(campo_parcelas_erp, '') or '').strip()
                try:
                    if int(float(erp_parc_val)) == num_parcela:
                        resultado[fi] = _item_match(f, erp_row, 'ok_parcela', 'parcela_a', parcela_info)
                        erp_usado.add(ei)
                        fat_usado.add(fi)
                        break
                except (ValueError, TypeError):
                    pass

    # Cenário B — ERP só tem valor da competência (parcela individual)
    # Também usado como fallback do cenário A
    if cenario in ('B', 'A'):
        for fi, f in fat_parcelados:
            if fi in fat_usado:
                continue
            parcela_info = _detectar_parcela(str(f.get('descricao', '')))
            if not parcela_info:
                continue
            v_c = round(float(f.get('valor') or 0) * 100)
            d_f = f.get('data')
            best_ei, best_dias = None, float('inf')
            for ei in erp_idx.get(v_c, []):
                if ei in erp_usado:
                    continue
                d_e  = erp.loc[ei, 'data']
                dias = abs((d_f - d_e).days) if (pd.notna(d_f) and pd.notna(d_e)) else 0
                if dias <= 45 and dias < best_dias:
                    best_dias = dias
                    best_ei   = ei
            if best_ei is not None:
                resultado[fi] = _item_match(f, erp.loc[best_ei], 'ok_parcela', 'parcela_b', parcela_info)
                erp_usado.add(best_ei)
                fat_usado.add(fi)

    # Cenário C — ERP lançou o total das parcelas
    if cenario == 'C':
        def _desc_base(desc: str) -> str:
            s = re.sub(r'\s*\d{1,2}[/\-]\d{1,2}\s*', ' ', str(desc).upper()).strip()
            s = re.sub(r'PARC(?:ELA)?\s*\d+', '', s).strip()
            return s[:40]

        grupos_c: dict = defaultdict(list)
        for fi, f in fat_parcelados:
            if fi in fat_usado:
                continue
            base = _desc_base(str(f.get('descricao', '')))
            grupos_c[base].append(fi)

        for base, fis in grupos_c.items():
            pending = [fi for fi in fis if fi not in fat_usado]
            if not pending:
                continue
            soma_cents = sum(round(float(fat.loc[fi].get('valor') or 0) * 100) for fi in pending)
            best_ei = None
            best_diff = float('inf')
            for ei in erp.index:
                if ei in erp_usado:
                    continue
                erp_cents = round(float(erp.loc[ei].get('valor') or 0) * 100)
                diff = abs(erp_cents - soma_cents)
                if diff <= soma_cents * 0.01 and diff < best_diff:
                    best_diff = diff
                    best_ei   = ei
            if best_ei is not None:
                for fi in pending:
                    parcela_info = _detectar_parcela(str(fat.loc[fi].get('descricao', '')))
                    resultado[fi] = _item_match(fat.loc[fi], erp.loc[best_ei], 'ok_parcela', 'parcela_c', parcela_info)
                    fat_usado.add(fi)
                erp_usado.add(best_ei)

    # ══ CAMADA 4 — Match por categoria (agrupamento) ═════════════════════════
    if modo_erp in ('categoria', 'misto'):
        fat_rest = [(fi, fat.loc[fi]) for fi in fat.index if fi not in fat_usado]
        erp_rest = [(ei, erp.loc[ei]) for ei in erp.index if ei not in erp_usado]

        for ei, e_row in erp_rest:
            erp_val_c = round(float(e_row.get('valor') or 0) * 100)
            grupo = _encontrar_grupo_greedy(fat_rest, erp_val_c)
            if grupo:
                for fi in grupo:
                    resultado[fi] = _item_match(
                        fat.loc[fi], e_row, 'ok_categoria', 'categoria',
                        agrupado_com=len(grupo)
                    )
                    fat_usado.add(fi)
                erp_usado.add(ei)
                fat_rest = [(fi, fat.loc[fi]) for fi in fat.index if fi not in fat_usado]

    # ══ CAMADA 5 — Encargos ══════════════════════════════════════════════════
    _KW_ENCARGO_ERP = (
        'JUROS CARTÃO', 'JUROS CARTAO', 'JUROS CRÉDITO', 'JUROS CREDITO',
        'JUROS FATURA', 'MULTA', 'ENCARGO', 'IOF', 'MORA',
    )
    for fi, f in fat.iterrows():
        if fi in fat_usado:
            continue
        tipo_fat = str(f.get('tipo', '')).lower()
        if tipo_fat != 'encargo':
            continue
        v_enc = float(f.get('valor') or 0)
        if v_enc <= 0:
            continue
        best_ei = None
        best_diff = float('inf')
        for ei in erp.index:
            if ei in erp_usado:
                continue
            desc_erp = str(erp.loc[ei, 'descricao'] or '').upper()
            if not any(kw in desc_erp for kw in _KW_ENCARGO_ERP):
                continue
            v_erp = float(erp.loc[ei, 'valor'] or 0)
            if v_erp <= 0:
                continue
            diff_pct = abs(v_erp - v_enc) / v_enc if v_enc > 0 else float('inf')
            if diff_pct <= 0.05 and diff_pct < best_diff:
                best_diff = diff_pct
                best_ei   = ei
        if best_ei is not None:
            resultado[fi] = _item_match(f, erp.loc[best_ei], 'ok_encargo', 'encargo_erp')
            erp_usado.add(best_ei)
            fat_usado.add(fi)

    # ══ CAMADA 6 — Sem correspondência ═══════════════════════════════════════
    final = []
    for fi in fat.index:
        final.append(resultado.get(fi) or _item_sem_erp(fat.loc[fi]))
    for ei in erp.index:
        if ei not in erp_usado:
            final.append(_item_sem_fatura(erp.loc[ei]))

    return final


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def conciliar(
    df_principal: pd.DataFrame,
    df_erp: pd.DataFrame,
    periodo_mes: str = "",
    modo: str = "despesas",
    df_banco: Optional[pd.DataFrame] = None,
    modo_erp: str = "transacao",
    perfil: dict = None,
) -> dict:
    if modo == "despesas":
        return _conciliar_despesas(df_principal, df_erp, periodo_mes, modo_erp, perfil or {})
    else:
        return _conciliar_receitas(df_principal, df_erp, df_banco, periodo_mes)


# ══════════════════════════════════════════════════════════════════════════════
#  DESPESAS
# ══════════════════════════════════════════════════════════════════════════════

def _conciliar_despesas(df_fatura: pd.DataFrame, df_erp: pd.DataFrame,
                         periodo_mes: str, modo_erp: str = 'transacao',
                         perfil: dict = None) -> dict:
    perfil = perfil or {}

    # ── Filtra ERP pelo período ───────────────────────────────────────────────
    df_erp_f = df_erp.copy()
    if periodo_mes:
        try:
            ano, mes = int(periodo_mes[:4]), int(periodo_mes[5:7])
            df_erp_f = df_erp_f[
                df_erp_f['data'].apply(lambda x: pd.notna(x) and x.year == ano and x.month == mes)
            ]
        except Exception:
            pass

    # ── Separação de tipos (Etapa 7) ──────────────────────────────────────────
    if 'tipo' in df_fatura.columns:
        compras      = df_fatura[df_fatura['tipo'].isin(['compra', 'encargo'])]
        pagamentos   = df_fatura[df_fatura['tipo'] == 'pagamento']
        antecipacoes = df_fatura[df_fatura['tipo'] == 'antecipacao']
        encargos     = df_fatura[df_fatura['tipo'] == 'encargo']
    else:
        compras      = df_fatura
        pagamentos   = pd.DataFrame()
        antecipacoes = pd.DataFrame()
        encargos     = pd.DataFrame()

    total_compras_encargos = round(float(compras['valor'].sum()), 2) if not compras.empty else 0
    total_pagamentos       = round(float(pagamentos['valor'].sum()), 2) if not pagamentos.empty else 0
    total_antecipacoes     = round(float(antecipacoes['valor'].sum()), 2) if not antecipacoes.empty else 0
    valor_liquido          = round(total_compras_encargos - total_pagamentos - total_antecipacoes, 2)

    total_fatura   = round(float(df_fatura['valor'].sum()), 2) if 'valor' in df_fatura.columns else 0
    total_encargos = round(float(encargos['valor'].sum()), 2) if not encargos.empty else 0
    total_erp      = round(float(df_erp_f['valor'].sum()), 2) if 'valor' in df_erp_f.columns else 0
    diferenca      = round(total_fatura - total_erp, 2)

    # ── Validação do agrupamento (Etapa 7) ────────────────────────────────────
    total_erp_filtrado = round(float(df_erp_f['valor'].sum()), 2) if 'valor' in df_erp_f.columns else 0
    diff_agrupamento   = round(valor_liquido - total_erp_filtrado, 2)
    agrupamento_ok     = abs(diff_agrupamento) < 0.02

    # ── Resumo de faturas no ERP ──────────────────────────────────────────────
    resumo_faturas = []
    if 'numero_fatura' in df_erp_f.columns and not df_erp_f.empty:
        try:
            grp = df_erp_f.groupby('numero_fatura').agg(
                total_erp=('valor', 'sum'),
                qtd_itens=('valor', 'count'),
                vencimento=('data', 'min'),
                status=('status', lambda x: 'Pendente' if 'Pendente' in x.values else 'Paga'),
            ).reset_index()
            grp['total_erp']  = grp['total_erp'].round(2)
            grp['vencimento'] = grp['vencimento'].apply(
                lambda x: x.strftime('%d/%m/%Y') if pd.notna(x) else '—'
            )
            resumo_faturas = grp.to_dict(orient='records')
        except Exception:
            pass

    # ── Encargos pendentes ────────────────────────────────────────────────────
    lista_encargos = []
    if not encargos.empty:
        for _, row in encargos.iterrows():
            lista_encargos.append({
                'descricao': row.get('descricao', ''),
                'valor':     row.get('valor', 0),
                'cartao':    row.get('cartao', ''),
                'lancado_erp': False,
            })

    # ── Matching multicamadas ─────────────────────────────────────────────────
    itens = _matching_despesas(df_fatura, df_erp_f, modo_erp, perfil)

    # ── Contadores ────────────────────────────────────────────────────────────
    _ok_statuses = ('ok', 'ok_parcela', 'ok_categoria', 'ok_manual', 'ok_data_div', 'ok_encargo')
    ok          = sum(1 for r in itens if r['status'] in _ok_statuses)
    sem_erp     = sum(1 for r in itens if r['status'] == 'ausente_erp')
    sem_fatura  = sum(1 for r in itens if r['status'] == 'ausente_fatura')
    parcelas    = sum(1 for r in itens if r['status'] == 'ok_parcela')
    agrupados   = sum(1 for r in itens if r['status'] == 'ok_categoria')

    return {
        'modo':    'despesas',
        'modo_erp': modo_erp,
        'periodo': periodo_mes,
        'resumo': {
            'total_itens':             len(itens),
            'conciliados':             ok,
            'sem_erp':                 sem_erp,
            'sem_fatura':              sem_fatura,
            'parcelas_detectadas':     parcelas,
            'agrupados_categoria':     agrupados,
            'total_fatura':            total_fatura,
            'total_erp':               total_erp,
            'diferenca':               diferenca,
            'total_encargos_pendentes': total_encargos,
            'total_pagamentos':        total_pagamentos,
            'total_antecipacoes':      total_antecipacoes,
            'valor_liquido':           valor_liquido,
            'validacao_agrupamento': {
                'ok':               agrupamento_ok,
                'diferenca':        diff_agrupamento,
                'total_erp_agrupado': total_erp_filtrado,
            },
        },
        'faturas_erp':        resumo_faturas,
        'itens':              itens,
        'encargos_pendentes': lista_encargos,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  RECEITAS
# ══════════════════════════════════════════════════════════════════════════════

def _conciliar_receitas(
    df_operadora: pd.DataFrame,
    df_erp: pd.DataFrame,
    df_banco: Optional[pd.DataFrame],
    periodo_mes: str,
) -> dict:

    def filtrar_periodo(df):
        if not periodo_mes or df is None or df.empty:
            return df if df is not None else pd.DataFrame()
        try:
            ano, mes = int(periodo_mes[:4]), int(periodo_mes[5:7])
            return df[df['data'].apply(lambda x: pd.notna(x) and x.year == ano and x.month == mes)]
        except Exception:
            return df

    df_op     = filtrar_periodo(df_operadora)
    df_erp_f  = filtrar_periodo(df_erp)
    df_banco_f = filtrar_periodo(df_banco)

    total_op    = round(float(df_op['valor'].sum()), 2)    if 'valor' in df_op.columns    else 0
    total_erp   = round(float(df_erp_f['valor'].sum()), 2) if 'valor' in df_erp_f.columns else 0
    total_banco = round(float(df_banco_f['valor'].sum()), 2) \
                  if df_banco_f is not None and 'valor' in df_banco_f.columns else 0

    itens = _matching_triplo(df_op, df_erp_f, df_banco_f)

    ok          = sum(1 for r in itens if r['status'] == 'ok')
    divergencia = sum(1 for r in itens if r['status'] == 'divergencia')
    ausente     = sum(1 for r in itens if 'ausente' in r['status'])

    return {
        'modo':    'receitas',
        'periodo': periodo_mes,
        'resumo': {
            'total_itens':       len(itens),
            'conciliados':       ok,
            'divergencias':      divergencia,
            'ausentes':          ausente,
            'total_operadora':   total_op,
            'total_erp':         total_erp,
            'total_banco':       total_banco,
            'diferenca_op_erp':  round(total_op - total_erp, 2),
            'diferenca_op_banco': round(total_op - total_banco, 2),
        },
        'itens': itens,
    }


def _matching_triplo(df_op, df_erp, df_banco) -> list:
    """Matching por valor entre 3 fontes — O(n + m + k) via hash index."""
    erp_list   = df_erp.reset_index(drop=True)
    banco_list = df_banco.reset_index(drop=True) \
                 if df_banco is not None and not df_banco.empty else pd.DataFrame()

    erp_idx: dict = defaultdict(list)
    for i, e in erp_list.iterrows():
        erp_idx[round(float(e.get('valor') or 0) * 100)].append(i)

    erp_usado:   set = set()
    banco_usado: set = set()
    resultado = []

    for _, op in df_op.iterrows():
        val       = round(float(op.get('valor') or 0), 2)
        val_cents = round(val * 100)
        data_op   = _fmt_data(op.get('data'))

        # Busca ERP por valor exato
        erp_match = None
        for idx in erp_idx.get(val_cents, []):
            if idx not in erp_usado:
                erp_match = (idx, erp_list.loc[idx])
                erp_usado.add(idx)
                break

        # Busca banco com tolerância de 5% + R$ 1,00 (tarifas/taxas)
        banco_match = None
        tol = round((0.05 * val + 1) * 100)
        for idx in banco_list.index:
            if idx not in banco_usado:
                try:
                    bv = round(float(banco_list.loc[idx, 'valor']) * 100)
                except (ValueError, TypeError):
                    continue
                if abs(bv - val_cents) <= tol:
                    banco_match = (idx, banco_list.loc[idx])
                    banco_usado.add(idx)
                    break

        status = ('ok'          if (erp_match and banco_match) else
                  'divergencia' if (erp_match or banco_match) else
                  'ausente_ambos')

        resultado.append({
            'data_operadora':      data_op,
            'descricao_operadora': str(op.get('descricao', '')),
            'valor_operadora':     round(val, 2),
            'data_erp':    erp_match[1].get('data', pd.NaT) and
                           _fmt_data(erp_match[1].get('data')) if erp_match else '—',
            'descricao_erp': str(erp_match[1].get('descricao', '')) if erp_match else '—',
            'valor_erp':   round(float(erp_match[1].get('valor') or 0), 2) if erp_match else 0,
            'valor_banco': round(float(banco_match[1].get('valor') or 0), 2) if banco_match else 0,
            'status':      status,
        })

    return resultado


# ══════════════════════════════════════════════════════════════════════════════
#  SERIALIZAÇÃO (legado — ainda usado por exportar.py)
# ══════════════════════════════════════════════════════════════════════════════

def _serializar_df(df: pd.DataFrame) -> list:
    if df.empty:
        return []
    df2 = df.copy()
    for col in df2.select_dtypes(include=['datetime64[ns]', 'datetime']).columns:
        df2[col] = df2[col].apply(lambda x: x.strftime('%d/%m/%Y') if pd.notna(x) else '—')
    return df2.fillna('—').to_dict(orient='records')
