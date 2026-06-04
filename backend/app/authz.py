"""Object-level authorization helpers.

RBAC (role checks) lives in ``auth.py`` via ``require_role``. This module adds
*object-level* checks — verifying the authenticated user actually owns / may
access a specific resource — to prevent IDOR (OWASP API1: Broken Object Level
Authorization). Call these inside route handlers after the role dependency.
"""

from fastapi import HTTPException
from . import models


def assert_course_owner(db, course_id: str, user: dict) -> dict:
    """Ensure ``user`` owns ``course_id`` (or is admin). Returns the course dict.

    Raises 404 if the course is missing and 403 if the user is not its lecturer.
    Admins bypass the ownership check.
    """
    doc = db.collection(models.COURSES).document(course_id).get()
    course = models.doc_to_dict(doc)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user.get("role") == "admin":
        return course
    if course.get("lecturerId") != user.get("id"):
        raise HTTPException(status_code=403, detail="Not authorized for this course")
    return course


def assert_assignment_owner(db, assignment_id: str, user: dict) -> dict:
    """Ensure ``user`` owns the course that ``assignment_id`` belongs to.

    Returns the assignment dict. Raises 404 if the assignment is missing.
    """
    doc = db.collection(models.ASSIGNMENTS).document(assignment_id).get()
    assignment = models.doc_to_dict(doc)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    # Admins bypass; otherwise the requester must own the parent course.
    if user.get("role") != "admin":
        assert_course_owner(db, assignment.get("courseId", ""), user)
    return assignment
