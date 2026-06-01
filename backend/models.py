import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship
from database import Base


def _uuid():
    return str(uuid.uuid4())


class Analista(Base):
    __tablename__ = "analistas"

    id         = Column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    nome       = Column(String(200), nullable=False)
    email      = Column(String(200), unique=True, nullable=False, index=True)
    senha_hash = Column(String(300), nullable=False)
    criado_em  = Column(DateTime, default=datetime.utcnow)

    clientes     = relationship("Cliente", back_populates="analista", cascade="all, delete-orphan")
    conciliacoes = relationship("Conciliacao", back_populates="analista")


class Cliente(Base):
    __tablename__ = "clientes"

    id            = Column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    analista_id   = Column(PGUUID(as_uuid=False), ForeignKey("analistas.id"), nullable=False)
    razao_social  = Column(String(300), nullable=False)
    cnpj          = Column(String(20), default="")
    nome_fantasia = Column(String(300), default="")
    erp_utilizado = Column(String(100), default="")
    criado_em     = Column(DateTime, default=datetime.utcnow)

    analista     = relationship("Analista", back_populates="clientes")
    perfil       = relationship("PerfilConfiguracao", back_populates="cliente", uselist=False, cascade="all, delete-orphan")
    conciliacoes = relationship("Conciliacao", back_populates="cliente", cascade="all, delete-orphan")


class PerfilConfiguracao(Base):
    __tablename__ = "perfis_configuracao"

    id                    = Column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    cliente_id            = Column(PGUUID(as_uuid=False), ForeignKey("clientes.id"), unique=True, nullable=False)
    cenario_parcelamento  = Column(String(5), default="B")
    campo_numero_fatura   = Column(String(100), default="")
    campo_forma_pagamento = Column(String(100), default="")
    valor_forma_pagamento = Column(String(100), default="")
    tolerancia_dias       = Column(Integer, default=5)
    campo_parcelas_erp    = Column(String(100), default="")
    mapeamento_colunas    = Column(JSONB, default=dict)

    cliente = relationship("Cliente", back_populates="perfil")


class Conciliacao(Base):
    __tablename__ = "conciliacoes"

    id             = Column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    cliente_id     = Column(PGUUID(as_uuid=False), ForeignKey("clientes.id"), nullable=False)
    analista_id    = Column(PGUUID(as_uuid=False), ForeignKey("analistas.id"), nullable=False)
    tipo           = Column(String(20), default="despesas")   # "despesas" | "receitas"
    periodo        = Column(String(20), default="")           # ex: "2026-03"
    status         = Column(String(20), default="concluida")
    total_itens    = Column(Integer, default=0)
    conciliados    = Column(Integer, default=0)
    pendentes      = Column(Integer, default=0)
    total_fatura   = Column(Numeric(12, 2), default=0)
    total_erp      = Column(Numeric(12, 2), default=0)
    diferenca      = Column(Numeric(12, 2), default=0)
    resultado_json = Column(JSONB, default=dict)
    criado_em      = Column(DateTime, default=datetime.utcnow)

    cliente  = relationship("Cliente", back_populates="conciliacoes")
    analista = relationship("Analista", back_populates="conciliacoes")
    arquivos = relationship("Arquivo", back_populates="conciliacao", cascade="all, delete-orphan")


class Arquivo(Base):
    __tablename__ = "arquivos"

    id              = Column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    conciliacao_id  = Column(PGUUID(as_uuid=False), ForeignKey("conciliacoes.id"), nullable=False)
    tipo            = Column(String(50), default="")    # "fatura" | "erp" | "banco" | "operadora"
    nome_original   = Column(String(300), default="")
    url_storage     = Column(Text, default="")
    criado_em       = Column(DateTime, default=datetime.utcnow)

    conciliacao = relationship("Conciliacao", back_populates="arquivos")
