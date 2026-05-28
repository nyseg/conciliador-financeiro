from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import io
import json
from parser_arquivos import parsear_fatura_cartao, parsear_erp
from conciliacao import conciliar
from exportar import gerar_excel

app = FastAPI(title="Conciliador Financeiro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok", "app": "Conciliador Financeiro"}

@app.post("/api/preview-colunas")
async def preview_colunas(
    arquivo: UploadFile = File(...),
    tipo: str = Form(...)  # "erp_pagar" | "erp_receber" | "banco"
):
    """Retorna as colunas detectadas no arquivo para mapeamento."""
    conteudo = await arquivo.read()
    nome = arquivo.filename or ""
    try:
        from parser_arquivos import detectar_colunas
        colunas = detectar_colunas(conteudo, nome)
        return {"colunas": colunas, "tipo": tipo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/conciliar-despesas")
async def conciliar_despesas(
    fatura: UploadFile = File(...),
    erp: UploadFile = File(...),
    mapeamento: str = Form("{}"),       # JSON com mapeamento de colunas do ERP
    periodo_mes: str = Form(""),        # ex: "2026-03"
    modo_erp: str = Form("transacao"),  # "transacao" | "categoria" | "misto"
):
    """Concilia fatura do cartão corporativo com ERP contas a pagar."""
    try:
        fatura_bytes = await fatura.read()
        erp_bytes = await erp.read()
        mapa = json.loads(mapeamento)

        df_fatura = parsear_fatura_cartao(fatura_bytes, fatura.filename or "")
        df_erp = parsear_erp(erp_bytes, erp.filename or "", mapa)

        resultado = conciliar(df_fatura, df_erp, periodo_mes, modo="despesas", modo_erp=modo_erp)
        return resultado

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/conciliar-receitas")
async def conciliar_receitas(
    operadora: UploadFile = File(...),
    erp: UploadFile = File(...),
    banco: UploadFile = File(...),
    mapeamento_erp: str = Form("{}"),
    mapeamento_banco: str = Form("{}"),
    periodo_mes: str = Form(""),
):
    """Concilia extrato da operadora com ERP contas a receber e extrato bancário."""
    try:
        op_bytes = await operadora.read()
        erp_bytes = await erp.read()
        banco_bytes = await banco.read()
        mapa_erp = json.loads(mapeamento_erp)
        mapa_banco = json.loads(mapeamento_banco)

        from parser_arquivos import parsear_operadora, parsear_banco
        df_op = parsear_operadora(op_bytes, operadora.filename or "")
        df_erp = parsear_erp(erp_bytes, erp.filename or "", mapa_erp)
        df_banco = parsear_banco(banco_bytes, banco.filename or "", mapa_banco)

        resultado = conciliar(df_op, df_erp, periodo_mes, modo="receitas", df_banco=df_banco)
        return resultado

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/exportar")
async def exportar_relatorio(payload: dict):
    """Gera e retorna arquivo Excel com o resultado da conciliação."""
    try:
        excel_bytes = gerar_excel(payload)
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=conciliacao.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
