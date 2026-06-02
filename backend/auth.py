import os
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

# pbkdf2_sha256: sem limite de tamanho de senha, nativo do Python (hashlib),
# usado pelo Django por padrão — não depende do pacote bcrypt externo.
pwd_context   = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, h: str) -> bool:
    return pwd_context.verify(senha, h)


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
