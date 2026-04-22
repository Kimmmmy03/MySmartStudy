import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK (guarded — auth.py may also init)
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

db = firestore.client()


def get_db():
    """FastAPI dependency — returns the Firestore client."""
    return db
