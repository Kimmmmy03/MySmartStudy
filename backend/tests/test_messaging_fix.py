"""Verify the list_conversations 500 fix.

Reproduces the bug: a Firestore conversation with lastMessageAt=None is
sorted alongside one whose lastMessageAt is a tz-aware datetime — the
naive datetime.min fallback raises TypeError, which previously bubbled
up as a 500 from /api/messages/conversations.
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock


class FakeDocSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = True

    def to_dict(self):
        return dict(self._data)


def _build_db(conv_docs, user_docs=None, message_docs=None):
    """Build a MagicMock that quacks like a Firestore client for this test."""
    user_docs = user_docs or {}
    message_docs = message_docs or []

    db = MagicMock()

    def collection(name):
        coll = MagicMock()
        if name == "conversations":
            query = MagicMock()
            query.where.return_value = query
            query.get.return_value = conv_docs
            coll.where.return_value = query
        elif name == "users":
            def document(uid):
                doc_ref = MagicMock()
                doc_ref.get.return_value = user_docs.get(
                    uid, FakeDocSnapshot(uid, {})
                )
                return doc_ref
            coll.document.side_effect = document
        elif name == "messages":
            query = MagicMock()
            query.where.return_value = query
            query.get.return_value = message_docs
            coll.where.return_value = query
        return coll

    db.collection.side_effect = collection
    return db


def test_list_conversations_handles_mixed_timestamps():
    from app.routers.messaging import list_conversations

    # Conversation A: has messages → tz-aware Firestore-style timestamp.
    # Conversation B: brand-new → lastMessageAt is None.
    # Pre-fix, the sort key "v or datetime.min" mixed naive+aware → TypeError.
    conv_a = FakeDocSnapshot("conv_a", {
        "participants": ["userA", "userB"],
        "lastMessage": "hi",
        "lastMessageAt": datetime(2026, 4, 29, 10, 0, tzinfo=timezone.utc),
    })
    conv_b = FakeDocSnapshot("conv_b", {
        "participants": ["userA", "userC"],
        "lastMessage": None,
        "lastMessageAt": None,
    })

    db = _build_db(
        conv_docs=[conv_a, conv_b],
        user_docs={
            "userB": FakeDocSnapshot("userB", {"displayName": "Bob", "photoURL": ""}),
            "userC": FakeDocSnapshot("userC", {"displayName": "Carol", "photoURL": ""}),
        },
        message_docs=[],
    )

    user = {"id": "userA"}

    result = list_conversations.__wrapped__(user=user, db=db) if hasattr(list_conversations, "__wrapped__") else list_conversations(user=user, db=db)

    assert len(result) == 2, f"expected 2 conversations, got {len(result)}"
    # conv_a has a real timestamp so it must sort first.
    assert result[0]["id"] == "conv_a", f"expected conv_a first, got {result[0]['id']}"
    assert result[1]["id"] == "conv_b"
    print("PASS: list_conversations sorts mixed None/tz-aware timestamps without 500")


def test_old_code_would_have_failed():
    """Sanity check: prove the original sort key raised TypeError."""
    naive_min = datetime.min
    aware = datetime.now(timezone.utc)
    keys = [aware, None or naive_min]
    raised = False
    try:
        sorted(keys, reverse=True)
    except TypeError:
        raised = True
    assert raised, "expected naive vs aware comparison to raise TypeError"
    print("PASS: confirmed original code raised TypeError on this input")


def test_send_message_links_to_role_inbox(monkeypatch_target=None):
    """Verify send_message builds /{role}/messages email links per recipient."""
    from app.routers import messaging
    from app import schemas

    captured_links = []

    def fake_create_notification(db, user_id, title, message, ntype, link, send_email=True):
        captured_links.append((user_id, link))

    # Patch the create_notification used inside messaging.py
    original = messaging.create_notification
    messaging.create_notification = fake_create_notification

    try:
        # Two recipients: a student and a lecturer.
        conv_doc = FakeDocSnapshot("conv1", {
            "participants": ["sender", "studentX", "lecturerY"],
            "lastMessage": None,
            "lastMessageAt": None,
        })

        users = {
            "studentX": FakeDocSnapshot("studentX", {"role": "student", "displayName": "Stu"}),
            "lecturerY": FakeDocSnapshot("lecturerY", {"role": "lecturer", "displayName": "Lec"}),
        }

        db = MagicMock()

        def collection(name):
            coll = MagicMock()
            if name == "conversations":
                doc_ref = MagicMock()
                doc_ref.get.return_value = conv_doc
                doc_ref.update.return_value = None
                coll.document.return_value = doc_ref
            elif name == "users":
                def document(uid):
                    ref = MagicMock()
                    ref.get.return_value = users.get(uid, FakeDocSnapshot(uid, {}))
                    return ref
                coll.document.side_effect = document
            elif name == "messages":
                msg_ref = MagicMock()
                msg_ref.set.return_value = None
                coll.document.return_value = msg_ref
            return coll

        db.collection.side_effect = collection

        user = {"id": "sender", "displayName": "Sender"}
        req = schemas.MessageCreate(text="hello there")

        messaging.send_message(conv_id="conv1", req=req, user=user, db=db)

        link_map = dict(captured_links)
        assert link_map.get("studentX") == "/student/messages", f"got {link_map.get('studentX')}"
        assert link_map.get("lecturerY") == "/lecturer/messages", f"got {link_map.get('lecturerY')}"
        print("PASS: send_message links student -> /student/messages, lecturer -> /lecturer/messages")
    finally:
        messaging.create_notification = original


if __name__ == "__main__":
    test_old_code_would_have_failed()
    test_list_conversations_handles_mixed_timestamps()
    test_send_message_links_to_role_inbox()
    print("\nAll tests passed.")
