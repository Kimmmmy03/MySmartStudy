import json
import os
from typing import Callable
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from . import models
from .firestore import get_db

# Initialize Firebase Admin SDK (guarded)
if not firebase_admin._apps:
    _json_env = os.getenv("FIREBASE_ADMIN_JSON")
    if _json_env:
        _cred = credentials.Certificate(json.loads(_json_env))
    else:
        _cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "serviceAccountKey.json"
        )
        _cred = credentials.Certificate(_cred_path)
    firebase_admin.initialize_app(_cred)

_bearer = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db=Depends(get_db),
) -> dict:
    """Verify Firebase ID token and return the matching Firestore user doc as dict.

    The returned dict uses camelCase keys matching the old system's Firestore schema,
    plus 'id' injected by doc_to_dict().
    """
    token = creds.credentials
    try:
        decoded = firebase_auth.verify_id_token(token, clock_skew_seconds=10)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Firebase token: {type(e).__name__}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid: str = decoded["uid"]

    doc = db.collection(models.USERS).document(firebase_uid).get()
    user = models.doc_to_dict(doc)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found. Please call /api/auth/sync first.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory that checks the authenticated user has one of the allowed roles."""
    def _checker(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "")
        if role not in allowed_roles:
            import logging
            logging.warning(
                f"[ROLE DENIED] uid={user.get('id')} email={user.get('email')} "
                f"role='{role}' required={allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' not permitted. Required: {', '.join(allowed_roles)}",
            )
        return user
    return _checker


# Convenience aliases
require_student = require_role("student")
require_lecturer = require_role("lecturer")
require_admin = require_role("admin")
require_lecturer_or_admin = require_role("lecturer", "admin")
