from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import uvicorn
import io
import json
import os
import uuid as _uuid
from pydantic import BaseModel

from parser_arquivos import parsear_fatura_cartao, parsear_erp
from conciliacao import conciliar
from exportar import gerar_excel

# ---------------------------------------------------------------------------
# Banco de dados — opcional, só carrega se DATABASE_URL estiver configurado
# ---------------------------------------------------------------------------
try:
    from database import engine, Base, get_db, SessionLocal
    from models import Analista, Cliente, PerfilConfiguracao, Conciliacao, Arquivo
    from auth import hash_senha, verificar_senha, criar_token, get_analista_atual
    _DB_OK = True
except Exception:
    _DB_OK = False

# ---------------------------------------------------------------------------
# Diretório para perfis de clientes (legado — mantido para compatibilidade)
# ---------------------------------------------------------------------------
_PERFIS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'perfis_clientes')
os.makedirs(_PERFIS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Aplicação
# ---------------------------------------------------------------------------
app = FastAPI(title="Conciliador Financeiro API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Criar tabelas na inicialização (se DB configurado)
if _DB_OK and engine is not None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as _e:
        print(f"[WARN] Não foi possível criar tabelas: {_e}")

# ---------------------------------------------------------------------------
# OAuth2 opcional (auto_error=False não quebra quando não há token)
# ---------------------------------------------------------------------------
_oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ---------------------------------------------------------------------------
# Schemas Pydantic
# ---------------------------------------------------------------------------
class RegistroSchema(BaseModel):
    nome: str
    email: str
    senha: str

class LoginSchema(BaseModel):
    email: str
    senha: str

class ClienteSchema(BaseModel):
    razao_social: str
    cnpj: str = ""
    nome_fantasia: str = ""
    erp_utilizado: str = ""

class PerfilSchema(BaseModel):
    cenario_parcelamento: str = "B"
    campo_numero_fatura: str = ""
    campo_forma_pagamento: str = ""
    valor_forma_pagamento: str = ""
    tolerancia_dias: int = 5
    campo_parcelas_erp: str = ""
    mapeamento_colunas: dict = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _serial(obj):
    """Serializa ORM → dict simples."""
    if obj is None:
        return None
    from decimal import Decimal
    import datetime as _dt
    d = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.name)
        if isinstance(v, _dt.datetime):
            v = v.isoformat()
        elif isinstance(v, Decimal):
            v = float(v)
        d[c.name] = v
    return d


def _upload_cloudinary(conteudo: bytes, nome: str, pasta: str = "conciliador") -> str:
    """Faz upload para Cloudinary e retorna a URL segura. Retorna '' em caso de erro."""
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
            api_key=os.environ.get("CLOUDINARY_API_KEY"),
            api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
        )
        resultado = cloudinary.uploader.upload(
            conteudo,
            folder=pasta,
            public_id=f"{pasta}/{nome}_{_uuid.uuid4().hex[:8]}",
            resource_type="raw",
        )
        return resultado.get("secure_url", "")
    except Exception:
        return ""


def _get_analista_from_token(token: Optional[str], db) -> Optional[object]:
    """Tenta decodificar token e retornar analista. Retorna None em caso de erro."""
    if not token or not _DB_OK:
        return None
    try:
        from jose import jwt as _jwt, JWTError
        SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
        payload = _jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        aid = payload.get("sub")
        if not aid:
            return None
        return db.query(Analista).filter(Analista.id == aid).first()
    except Exception:
        return None


# ===========================================================================
# HEALTH
# ===========================================================================
@app.get("/")
def health():
    return {"status": "ok", "app": "Conciliador Financeiro"}


# ===========================================================================
# DIAGNÓSTICO OCR
# ===========================================================================
@app.get("/api/status")
def status_completo():
    """Diagnóstico completo: OCR + banco de dados."""
    import shutil
    resultado = {"db_ok": _DB_OK}

    # PostgreSQL
    try:
        if _DB_OK and engine is not None:
            with engine.connect() as conn:
                conn.execute(__import__('sqlalchemy').text("SELECT 1"))
            resultado["postgres"] = {"conectado": True}
        else:
            resultado["postgres"] = {"conectado": False, "motivo": "DATABASE_URL não configurada ou importação falhou"}
    except Exception as e:
        resultado["postgres"] = {"conectado": False, "erro": str(e)}

    # Tesseract
    tess_path = shutil.which("tesseract")
    resultado["tesseract_path"] = tess_path
    try:
        import pytesseract
        resultado["tesseract"] = {"instalado": True, "versao": str(pytesseract.get_tesseract_version())}
    except Exception as e:
        resultado["tesseract"] = {"instalado": False, "erro": str(e)}

    return resultado


@app.get("/api/status-ocr")
def status_ocr():
    """Diagnóstico: verifica se Tesseract, PyMuPDF e Pillow estão instalados."""
    import shutil
    resultado = {}

    tess_path = shutil.which("tesseract")
    resultado["tesseract_path"] = tess_path

    try:
        import pytesseract
        versao = str(pytesseract.get_tesseract_version())
        langs  = pytesseract.get_languages(config="")
        resultado["tesseract"] = {"instalado": True, "versao": versao, "idiomas": langs}
    except Exception as e:
        resultado["tesseract"] = {"instalado": False, "erro": str(e)}

    try:
        import fitz
        resultado["pymupdf"] = {"instalado": True, "versao": fitz.version[0]}
    except Exception as e:
        resultado["pymupdf"] = {"instalado": False, "erro": str(e)}

    try:
        from PIL import Image
        import PIL
        resultado["pillow"] = {"instalado": True, "versao": PIL.__version__}
    except Exception as e:
        resultado["pillow"] = {"instalado": False, "erro": str(e)}

    return resultado


@app.post("/api/diagnostico-pdf")
async def diagnostico_pdf(arquivo: UploadFile = File(...)):
    """Diagnóstico: extrai texto bruto do PDF sem conciliar."""
    conteudo = await arquivo.read()
    nome     = arquivo.filename or "fatura.pdf"
    resultado = {"arquivo": nome, "camadas": {}}

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

    try:
        import fitz, io as _io
        import pytesseract
        from PIL import Image as PILImage
        doc = fitz.open(stream=conteudo, filetype="pdf")
        linhas_ocr = []
        for i, pg in enumerate(doc):
            if i > 1:
                break
            mat = fitz.Matrix(2, 2)
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


# ===========================================================================
# PREVIEW COLUNAS
# ===========================================================================
@app.post("/api/preview-colunas")
async def preview_colunas(
    arquivo: UploadFile = File(...),
    tipo: str = Form(...)
):
    conteudo = await arquivo.read()
    nome = arquivo.filename or ""
    try:
        from parser_arquivos import detectar_colunas
        colunas = detectar_colunas(conteudo, nome)
        return {"colunas": colunas, "tipo": tipo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===========================================================================
# PERFIS DE CLIENTES — legado (mantido)
# ===========================================================================
@app.post("/api/perfil-cliente")
async def salvar_perfil_cliente(perfil: dict):
    nome = str(perfil.get('nome_cliente', '')).strip()
    if not nome:
        raise HTTPException(status_code=400, detail="nome_cliente é obrigatório")
    try:
        caminho = os.path.join(_PERFIS_DIR, f"{nome}.json")
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(perfil, f, ensure_ascii=False, indent=2)
        return {"ok": True, "nome": nome}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/perfil-cliente/{nome}")
async def carregar_perfil_cliente(nome: str):
    caminho = os.path.join(_PERFIS_DIR, f"{nome}.json")
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail=f"Perfil '{nome}' não encontrado")
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/perfis-clientes")
async def listar_perfis_clientes():
    try:
        nomes = [f[:-5] for f in os.listdir(_PERFIS_DIR) if f.endswith('.json')]
        nomes.sort()
        return {"perfis": nomes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# AUTENTICAÇÃO JWT
# ===========================================================================
@app.post("/api/auth/registro")
async def registro(body: RegistroSchema):
    if not _DB_OK:
        raise HTTPException(status_code=503, detail="Banco de dados não configurado")

    # Validação de força da senha
    import re as _re
    erros_senha = []
    if len(body.senha) < 8:
        erros_senha.append("mínimo 8 caracteres")
    if not _re.search(r'[A-Z]', body.senha):
        erros_senha.append("pelo menos uma letra maiúscula")
    if not _re.search(r'[0-9]', body.senha):
        erros_senha.append("pelo menos um número")
    if not _re.search(r'[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/\\~`]', body.senha):
        erros_senha.append("pelo menos um caractere especial (!@#$%...)")
    if erros_senha:
        raise HTTPException(status_code=400, detail="Senha inválida: " + ", ".join(erros_senha))

    # Garante que as tabelas existem (idempotente)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as _e:
        raise HTTPException(status_code=503, detail=f"Erro ao criar tabelas no banco: {_e}")

    # Cria o analista
    db = SessionLocal()
    try:
        existente = db.query(Analista).filter(Analista.email == body.email).first()
        if existente:
            raise HTTPException(status_code=409, detail="E-mail já cadastrado")
        analista = Analista(
            nome=body.nome,
            email=body.email,
            senha_hash=hash_senha(body.senha),
        )
        db.add(analista)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar conta: {str(e)}")
    finally:
        db.close()


@app.post("/api/auth/login")
async def login(body: LoginSchema):
    if not _DB_OK:
        raise HTTPException(status_code=503, detail="Banco de dados não configurado")
    db = SessionLocal()
    try:
        analista = db.query(Analista).filter(Analista.email == body.email).first()
        if not analista or not verificar_senha(body.senha, analista.senha_hash):
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
        token = criar_token(str(analista.id))
        return {
            "access_token": token,
            "token_type": "bearer",
            "analista": {"id": str(analista.id), "nome": analista.nome, "email": analista.email},
        }
    finally:
        db.close()


@app.get("/api/auth/me")
async def me(analista: Analista = Depends(get_analista_atual)):
    return {"id": str(analista.id), "nome": analista.nome, "email": analista.email}


# ===========================================================================
# CRUD CLIENTES
# ===========================================================================
@app.get("/api/clientes")
async def listar_clientes(analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        clientes = db.query(Cliente).filter(Cliente.analista_id == str(analista.id)).all()
        resultado = []
        for c in clientes:
            ultima = (
                db.query(Conciliacao)
                .filter(Conciliacao.cliente_id == str(c.id))
                .order_by(Conciliacao.criado_em.desc())
                .first()
            )
            d = _serial(c)
            d["ultima_conciliacao"] = None
            if ultima:
                d["ultima_conciliacao"] = {
                    "data": ultima.criado_em.isoformat() if ultima.criado_em else None,
                    "tipo": ultima.tipo,
                    "periodo": ultima.periodo,
                    "conciliados": ultima.conciliados,
                    "pendentes": ultima.pendentes,
                    "total_fatura": float(ultima.total_fatura or 0),
                }
            resultado.append(d)
        return resultado
    finally:
        db.close()


@app.post("/api/clientes")
async def criar_cliente(body: ClienteSchema, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = Cliente(
            id=str(_uuid.uuid4()),
            analista_id=str(analista.id),
            razao_social=body.razao_social,
            cnpj=body.cnpj,
            nome_fantasia=body.nome_fantasia,
            erp_utilizado=body.erp_utilizado,
        )
        db.add(c)
        db.commit()
        db.refresh(c)
        return _serial(c)
    finally:
        db.close()


@app.get("/api/clientes/{cliente_id}")
async def detalhe_cliente(cliente_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        return _serial(c)
    finally:
        db.close()


@app.put("/api/clientes/{cliente_id}")
async def atualizar_cliente(cliente_id: str, body: ClienteSchema, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        c.razao_social  = body.razao_social
        c.cnpj          = body.cnpj
        c.nome_fantasia = body.nome_fantasia
        c.erp_utilizado = body.erp_utilizado
        db.commit()
        db.refresh(c)
        return _serial(c)
    finally:
        db.close()


@app.delete("/api/clientes/{cliente_id}")
async def deletar_cliente(cliente_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        db.delete(c)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


# ===========================================================================
# PERFIL DE CONFIGURAÇÃO POR CLIENTE
# ===========================================================================
@app.get("/api/clientes/{cliente_id}/perfil")
async def get_perfil(cliente_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        perfil = db.query(PerfilConfiguracao).filter(PerfilConfiguracao.cliente_id == cliente_id).first()
        if not perfil:
            perfil = PerfilConfiguracao(id=str(_uuid.uuid4()), cliente_id=cliente_id)
            db.add(perfil)
            db.commit()
            db.refresh(perfil)
        return _serial(perfil)
    finally:
        db.close()


@app.put("/api/clientes/{cliente_id}/perfil")
async def upsert_perfil(cliente_id: str, body: PerfilSchema, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        perfil = db.query(PerfilConfiguracao).filter(PerfilConfiguracao.cliente_id == cliente_id).first()
        if not perfil:
            perfil = PerfilConfiguracao(id=str(_uuid.uuid4()), cliente_id=cliente_id)
            db.add(perfil)
        perfil.cenario_parcelamento  = body.cenario_parcelamento
        perfil.campo_numero_fatura   = body.campo_numero_fatura
        perfil.campo_forma_pagamento = body.campo_forma_pagamento
        perfil.valor_forma_pagamento = body.valor_forma_pagamento
        perfil.tolerancia_dias       = body.tolerancia_dias
        perfil.campo_parcelas_erp    = body.campo_parcelas_erp
        perfil.mapeamento_colunas    = body.mapeamento_colunas
        db.commit()
        db.refresh(perfil)
        return _serial(perfil)
    finally:
        db.close()


# ===========================================================================
# HISTÓRICO DE CONCILIAÇÕES
# ===========================================================================
@app.get("/api/clientes/{cliente_id}/conciliacoes")
async def listar_conciliacoes(cliente_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        c = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        conciliacoes = (
            db.query(Conciliacao)
            .filter(Conciliacao.cliente_id == cliente_id)
            .order_by(Conciliacao.criado_em.desc())
            .all()
        )
        lista = []
        for conc in conciliacoes:
            d = _serial(conc)
            d.pop("resultado_json", None)  # não retornar JSON pesado na lista
            lista.append(d)
        return lista
    finally:
        db.close()


@app.get("/api/conciliacoes/{conc_id}")
async def detalhar_conciliacao(conc_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        conc = db.query(Conciliacao).filter(Conciliacao.id == conc_id).first()
        if not conc:
            raise HTTPException(status_code=404, detail="Conciliação não encontrada")
        # verifica posse via cliente
        c = db.query(Cliente).filter(Cliente.id == str(conc.cliente_id), Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=403, detail="Acesso negado")
        d = _serial(conc)
        # resultado_json já vem como dict pelo JSONB
        d["resultado_json"] = conc.resultado_json
        return d
    finally:
        db.close()


@app.post("/api/conciliacoes/{conc_id}/exportar")
async def reexportar_conciliacao(conc_id: str, analista: Analista = Depends(get_analista_atual)):
    from database import get_db as _get_db
    db = next(_get_db())
    try:
        conc = db.query(Conciliacao).filter(Conciliacao.id == conc_id).first()
        if not conc:
            raise HTTPException(status_code=404, detail="Conciliação não encontrada")
        c = db.query(Cliente).filter(Cliente.id == str(conc.cliente_id), Cliente.analista_id == str(analista.id)).first()
        if not c:
            raise HTTPException(status_code=403, detail="Acesso negado")
        payload = conc.resultado_json or {}
        excel_bytes = gerar_excel(payload)
        nome_cliente = (c.nome_fantasia or c.razao_social).replace(" ", "_")
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="conciliacao_{nome_cliente}_{conc.periodo}.xlsx"'},
        )
    finally:
        db.close()


# ===========================================================================
# CONCILIAR DESPESAS
# ===========================================================================
@app.post("/api/conciliar-despesas")
async def conciliar_despesas(
    fatura: UploadFile = File(...),
    erp: UploadFile = File(...),
    mapeamento: str = Form("{}"),
    mapeamento_fatura: str = Form("{}"),
    periodo_mes: str = Form(""),
    modo_erp: str = Form("transacao"),
    perfil_cliente: str = Form("{}"),
    cliente_id: str = Form(""),
    token: Optional[str] = Depends(_oauth2_optional),
):
    """Concilia fatura do cartão corporativo com ERP contas a pagar."""
    try:
        fatura_bytes = await fatura.read()
        erp_bytes    = await erp.read()
        mapa         = json.loads(mapeamento)
        mapa_fatura  = json.loads(mapeamento_fatura)
        perfil       = json.loads(perfil_cliente) if perfil_cliente else {}

        df_fatura = parsear_fatura_cartao(fatura_bytes, fatura.filename or "", mapeamento=mapa_fatura or None)
        df_erp    = parsear_erp(erp_bytes, erp.filename or "", mapa)

        resultado = conciliar(df_fatura, df_erp, periodo_mes, modo="despesas", modo_erp=modo_erp, perfil=perfil)

        # Salvar no banco se cliente_id fornecido e banco configurado
        if cliente_id and _DB_OK and engine is not None:
            try:
                from database import get_db as _get_db
                db = next(_get_db())
                analista = _get_analista_from_token(token, db)
                if analista:
                    conc = Conciliacao(
                        id=str(_uuid.uuid4()),
                        cliente_id=cliente_id,
                        analista_id=str(analista.id),
                        tipo="despesas",
                        periodo=periodo_mes or "",
                        status="concluida",
                        total_itens=resultado.get("total_itens", 0),
                        conciliados=resultado.get("conciliados", 0),
                        pendentes=resultado.get("pendentes", 0),
                        total_fatura=float(resultado.get("total_fatura", 0) or 0),
                        total_erp=float(resultado.get("total_erp", 0) or 0),
                        diferenca=float(resultado.get("diferenca", 0) or 0),
                        resultado_json=resultado,
                    )
                    db.add(conc)
                    db.flush()

                    # Upload Cloudinary (se configurado)
                    if os.environ.get("CLOUDINARY_CLOUD_NAME"):
                        url_fatura = _upload_cloudinary(fatura_bytes, fatura.filename or "fatura", "conciliador/faturas")
                        url_erp    = _upload_cloudinary(erp_bytes, erp.filename or "erp", "conciliador/erp")
                    else:
                        url_fatura = url_erp = ""

                    db.add(Arquivo(id=str(_uuid.uuid4()), conciliacao_id=str(conc.id), tipo="fatura",
                                   nome_original=fatura.filename or "", url_storage=url_fatura))
                    db.add(Arquivo(id=str(_uuid.uuid4()), conciliacao_id=str(conc.id), tipo="erp",
                                   nome_original=erp.filename or "", url_storage=url_erp))
                    db.commit()
                    resultado["conciliacao_id"] = str(conc.id)
                db.close()
            except Exception as _e:
                print(f"[WARN] Falha ao salvar conciliação: {_e}")

        return resultado

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===========================================================================
# CONCILIAR RECEITAS
# ===========================================================================
@app.post("/api/conciliar-receitas")
async def conciliar_receitas(
    operadora: UploadFile = File(...),
    erp: UploadFile = File(...),
    banco: UploadFile = File(...),
    mapeamento_erp: str = Form("{}"),
    mapeamento_banco: str = Form("{}"),
    periodo_mes: str = Form(""),
    cliente_id: str = Form(""),
    token: Optional[str] = Depends(_oauth2_optional),
):
    """Concilia extrato da operadora com ERP contas a receber e extrato bancário."""
    try:
        op_bytes    = await operadora.read()
        erp_bytes   = await erp.read()
        banco_bytes = await banco.read()
        mapa_erp    = json.loads(mapeamento_erp)
        mapa_banco  = json.loads(mapeamento_banco)

        from parser_arquivos import parsear_operadora, parsear_banco
        df_op    = parsear_operadora(op_bytes, operadora.filename or "")
        df_erp   = parsear_erp(erp_bytes, erp.filename or "", mapa_erp)
        df_banco = parsear_banco(banco_bytes, banco.filename or "", mapa_banco)

        resultado = conciliar(df_op, df_erp, periodo_mes, modo="receitas", df_banco=df_banco)

        # Salvar no banco se cliente_id fornecido e banco configurado
        if cliente_id and _DB_OK and engine is not None:
            try:
                from database import get_db as _get_db
                db = next(_get_db())
                analista = _get_analista_from_token(token, db)
                if analista:
                    conc = Conciliacao(
                        id=str(_uuid.uuid4()),
                        cliente_id=cliente_id,
                        analista_id=str(analista.id),
                        tipo="receitas",
                        periodo=periodo_mes or "",
                        status="concluida",
                        total_itens=resultado.get("total_itens", 0),
                        conciliados=resultado.get("conciliados", 0),
                        pendentes=resultado.get("pendentes", 0),
                        total_fatura=float(resultado.get("total_fatura", 0) or 0),
                        total_erp=float(resultado.get("total_erp", 0) or 0),
                        diferenca=float(resultado.get("diferenca", 0) or 0),
                        resultado_json=resultado,
                    )
                    db.add(conc)
                    db.flush()

                    if os.environ.get("CLOUDINARY_CLOUD_NAME"):
                        url_op    = _upload_cloudinary(op_bytes, operadora.filename or "operadora", "conciliador/operadoras")
                        url_erp_f = _upload_cloudinary(erp_bytes, erp.filename or "erp", "conciliador/erp")
                        url_banco = _upload_cloudinary(banco_bytes, banco.filename or "banco", "conciliador/banco")
                    else:
                        url_op = url_erp_f = url_banco = ""

                    db.add(Arquivo(id=str(_uuid.uuid4()), conciliacao_id=str(conc.id), tipo="operadora",
                                   nome_original=operadora.filename or "", url_storage=url_op))
                    db.add(Arquivo(id=str(_uuid.uuid4()), conciliacao_id=str(conc.id), tipo="erp",
                                   nome_original=erp.filename or "", url_storage=url_erp_f))
                    db.add(Arquivo(id=str(_uuid.uuid4()), conciliacao_id=str(conc.id), tipo="banco",
                                   nome_original=banco.filename or "", url_storage=url_banco))
                    db.commit()
                    resultado["conciliacao_id"] = str(conc.id)
                db.close()
            except Exception as _e:
                print(f"[WARN] Falha ao salvar conciliação: {_e}")

        return resultado

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===========================================================================
# PDF → EXCEL
# ===========================================================================
@app.post("/api/pdf-para-excel")
async def pdf_para_excel(arquivo: UploadFile = File(...)):
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
            headers={"Content-Disposition": f'attachment; filename="{nome_base}_extraido.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===========================================================================
# EXPORTAR RELATÓRIO
# ===========================================================================
@app.post("/api/exportar")
async def exportar_relatorio(payload: dict):
    try:
        excel_bytes = gerar_excel(payload)
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=conciliacao.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
