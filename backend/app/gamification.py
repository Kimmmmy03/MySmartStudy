"""Automatic badge trigger logic."""
from google.cloud.firestore_v1 import ArrayUnion
from . import models
from .routers.notifications import create_notification
from google.cloud.firestore_v1.base_query import FieldFilter


# Badge definitions: id → {name, description, check function name}
BADGE_TRIGGERS = {
    "first_map": {
        "name": "First Map",
        "description": "Created your first thinking map",
        "check": "check_first_map",
    },
    "map_master": {
        "name": "Map Master",
        "description": "Created 10 thinking maps",
        "check": "check_map_master",
    },
    "7_day_streak": {
        "name": "7 Day Streak",
        "description": "Logged in for 7 consecutive days",
        "check": "check_7_day_streak",
    },
    "collaborator": {
        "name": "Collaborator",
        "description": "Collaborated on 3 maps",
        "check": "check_collaborator",
    },
    "course_joiner": {
        "name": "Course Joiner",
        "description": "Joined your first course",
        "check": "check_course_joiner",
    },
}


def _has_badge(user: dict, badge_id: str) -> bool:
    return badge_id in user.get("badges", [])


def _award(db, user_id: str, badge_id: str) -> str | None:
    """Award badge and return badge_id if newly awarded, else None."""
    db.collection(models.USERS).document(user_id).update({
        "badges": ArrayUnion([badge_id]),
        "points": models.doc_to_dict(
            db.collection(models.USERS).document(user_id).get()
        ).get("points", 0) + 25,
    })
    create_notification(
        db, user_id,
        f"Badge Earned: {BADGE_TRIGGERS[badge_id]['name']}",
        BADGE_TRIGGERS[badge_id]["description"],
        "info",
    )
    return badge_id


def check_and_award_badges(db, user: dict, event: str = "") -> list[str]:
    """Check all badge conditions and award any newly earned ones.
    Returns list of newly awarded badge IDs.
    """
    user_id = user["id"]
    awarded: list[str] = []

    # first_map: user has at least 1 map
    if not _has_badge(user, "first_map") and event in ("map_created", ""):
        maps = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", user_id)).limit(1).get()
        if list(maps):
            result = _award(db, user_id, "first_map")
            if result:
                awarded.append(result)

    # map_master: user has 10+ maps
    if not _has_badge(user, "map_master") and event in ("map_created", ""):
        maps = db.collection(models.MAPS).where(filter=FieldFilter("ownerId", "==", user_id)).limit(10).get()
        if len(list(maps)) >= 10:
            result = _award(db, user_id, "map_master")
            if result:
                awarded.append(result)

    # 7_day_streak
    if not _has_badge(user, "7_day_streak") and event in ("login", ""):
        if user.get("streak", 0) >= 7:
            result = _award(db, user_id, "7_day_streak")
            if result:
                awarded.append(result)

    # course_joiner
    if not _has_badge(user, "course_joiner") and event in ("course_joined", ""):
        courses = db.collection(models.COURSES).where(filter=FieldFilter("enrolledStudents", "array_contains", user_id)).limit(1).get()
        if list(courses):
            result = _award(db, user_id, "course_joiner")
            if result:
                awarded.append(result)

    return awarded
