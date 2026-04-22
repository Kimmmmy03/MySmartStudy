"""Audit logging utility — writes to Firestore auditLogs collection."""
from datetime import datetime, timezone
from . import models


def audit_log(
    db,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str = "",
    details: str = "",
) -> None:
    """Write an audit log entry to Firestore."""
    log_id = models.gen_id()
    db.collection(models.AUDIT_LOGS).document(log_id).set({
        "userId": user_id,
        "action": action,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "details": details,
        "createdAt": datetime.now(timezone.utc),
    })
