import os
import hashlib
import base64
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models import Analista

SECRET_KEY   = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM    = "HS256"
EXPIRE_HOURS = 8

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _preparar_senha(senha: str) -> str:
    """
    Pré-hash com SHA-256 antes do bcrypt.
    O bcrypt tem limite de 72 bytes — senhas maiores seriam silenciosamente truncadas.
    SHA-256 converte a senha em 44 bytes base64, dentro do limite, sem perder segurança.
    """
    digest = hashlib.sha256(senha.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("utf-8")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(_preparar_senha(senha))


def verificar_senha(senha: str, h: str) -> bool:
    return pwd_context.verify(_preparar_senha(senha), h)


def criar_token(analista_id: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode({"sub": analista_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def get_analista_atual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Analista:
    exc = HTTPException(
        status_code=401,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        aid = payload.get("sub")
        if not aid:
            raise exc
    except JWTError:
        raise exc
    a = db.query(Analista).filter(Analista.id == aid).first()
    if not a:
        raise exc
    return a
