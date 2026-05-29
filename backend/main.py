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


@app.get("/api/status-ocr")
def status_ocr():
    """
    Diagnóstico: verifica se Tesseract, PyMuPDF e Pillow estão instalados.
    Acesse em: GET /api/status-ocr
    """
    import shutil
    resultado = {}

    # Tesseract binário
    tess_path = shutil.which("tesseract")
    resultado["tesseract_path"] = tess_path

    # pytesseract
    try:
        import pytesseract
        versao = str(pytesseract.get_tesseract_version())
        langs  = pytesseract.get_languages(config="")
        resultado["tesseract"] = {"instalado": True, "versao": versao, "idiomas": langs}
    except Exception as e:
        resultado["tesseract"] = {"instalado": False, "erro": str(e)}

    # PyMuPDF (fitz)
    try:
        import fitz
        resultado["pymupdf"] = {"instalado": True, "versao": fitz.version[0]}
    except Exception as e:
        resultado["pymupdf"] = {"instalado": False, "erro": str(e)}

    # Pillow
    try:
        from PIL import Image
        import PIL
        resultado["pillow"] = {"instalado": True, "versao": PIL.__version__}
    except Exception as e:
        resultado["pillow"] = {"instalado": False, "erro": str(e)}

    return resultado


@app.post("/api/diagnostico-pdf")
async def diagnostico_pdf(arquivo: UploadFile = File(...)):
    """
    Diagnóstico: extrai texto bruto do PDF (todas as camadas) sem conciliar.
    Retorna o que cada camada conseguiu ler — útil para debugar PDFs imagem.
    """
    conteudo = await arquivo.read()
    nome     = arquivo.filename or "fatura.pdf"
    resultado = {"arquivo": nome, "camadas": {}}

    # Camada 1: pdfplumber tabelas
    try:
        import pdfplumber, io as _io
        with pdfplumber.open(_io.BytesIO(conteudo)) as pdf:
            tabelas = []
            for pg in pdf.pages:
                for t in (pg.extract_tables() or []):
                    tabelas.append(t)
            resultado["camadas"]["pdfplumber_tabelas"] = {
                "total_tabelas": len(tabelas),
                "headers": [t[0] if t else [] for t in tabelas[:3]],
            }
    except Exception as e:
        resultado["camadas"]["pdfplumber_tabelas"] = {"erro": str(e)}

    # Camada 2: pdfplumber texto
    try:
        import pdfplumber, io as _io
        with pdfplumber.open(_io.BytesIO(conteudo)) as pdf:
            linhas = []
            for pg in pdf.pages:
                linhas.extend((pg.extract_text() or "").splitlines())
        resultado["camadas"]["pdfplumber_texto"] = {
            "total_linhas": len(linhas),
            "primeiras_20": linhas[:20],
        }
    except Exception as e:
        resultado["camadas"]["pdfplumber_texto"] = {"erro": str(e)}

    # Camada 3: PyMuPDF texto
    try:
        import fitz, io as _io
        doc = fitz.open(stream=conteudo, filetype="pdf")
        linhas = []
        for pg in doc:
            linhas.extend((pg.get_text("text") or "").splitlines())
        resultado["camadas"]["pymupdf_texto"] = {
            "total_paginas": len(doc),
            "total_linhas": len(linhas),
            "primeiras_20": linhas[:20],
        }
    except Exception as e:
        resultado["camadas"]["pymupdf_texto"] = {"erro": str(e)}

    # Camada 4: OCR (se Tesseract instalado)
    try:
        import fitz, io as _io
        import pytesseract
        from PIL import Image as PILImage
        doc = fitz.open(stream=conteudo, filetype="pdf")
        linhas_ocr = []
        for i, pg in enumerate(doc):
            if i > 1:  # só primeiras 2 páginas para diagnóstico rápido
                break
            mat = fitz.Matrix(2, 2)   # 144 DPI — mais rápido para diagnóstico
            pix = pg.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            img = PILImage.frombytes("RGB", (pix.width, pix.height), pix.samples).convert("L")
            texto = pytesseract.image_to_string(img, lang="por+eng", config="--psm 6")
            linhas_ocr.extend(texto.splitlines())
        resultado["camadas"]["ocr_tesseract"] = {
            "total_linhas": len(linhas_ocr),
            "primeiras_30": [l for l in linhas_ocr if l.strip()][:30],
        }
    except Exception as e:
        resultado["camadas"]["ocr_tesseract"] = {"erro": str(e)}

    return resultado

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
    mapeamento: str = Form("{}"),          # JSON mapeamento colunas ERP
    mapeamento_fatura: str = Form("{}"),   # JSON mapeamento colunas fatura
    periodo_mes: str = Form(""),           # ex: "2026-03"
    modo_erp: str = Form("transacao"),     # "transacao" | "categoria" | "misto"
):
    """Concilia fatura do cartão corporativo com ERP contas a pagar."""
    try:
        fatura_bytes = await fatura.read()
        erp_bytes    = await erp.read()
        mapa         = json.loads(mapeamento)
        mapa_fatura  = json.loads(mapeamento_fatura)

        df_fatura = parsear_fatura_cartao(fatura_bytes, fatura.filename or "",
                                          mapeamento=mapa_fatura or None)
        df_erp    = parsear_erp(erp_bytes, erp.filename or "", mapa)

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

@app.post("/api/pdf-para-excel")
async def pdf_para_excel(
    arquivo: UploadFile = File(...),
):
    """
    Extrai transações de um PDF de fatura (via pdfplumber ou OCR Tesseract)
    e retorna um arquivo Excel com as colunas: data, descricao, valor, cartao, tipo.
    Útil para inspecionar a extração ou reusar o Excel no mapeamento manual.
    """
    try:
        conteudo = await arquivo.read()
        nome = arquivo.filename or "fatura.pdf"

        df = parsear_fatura_cartao(conteudo, nome)

        if df.empty:
            raise ValueError("Nenhuma transação encontrada no PDF.")

        buf = io.BytesIO()
        df.to_excel(buf, index=False, engine="openpyxl")
        buf.seek(0)

        nome_base = nome.rsplit(".", 1)[0]
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{nome_base}_extraido.xlsx"'
            },
        )
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
