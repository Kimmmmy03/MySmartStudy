"""HTML/XSS sanitization helpers (defence against stored XSS).

User-supplied text — mind-map node labels, discussion messages, comments,
announcements, profile bios, titles — can contain `<script>` or event-handler
HTML that would execute in another user's browser. We strip dangerous markup
on write so the stored value is safe regardless of how it's later rendered.

Most fields are plain text → use ``clean_text`` (strips ALL tags). For the few
fields that may legitimately contain light formatting, ``clean_rich`` keeps a
small safe allowlist. Mind-map graph JSON is handled by ``clean_graph_data``,
which walks node labels/text and sanitizes them in place.
"""

from __future__ import annotations

import json

import bleach

# Light allowlist for "rich" fields (e.g. markdown-ish descriptions). No script,
# no event handlers, no styles, no iframes.
_RICH_TAGS = ["b", "i", "em", "strong", "u", "p", "br", "ul", "ol", "li", "code", "pre", "blockquote", "a"]
_RICH_ATTRS = {"a": ["href", "title"]}
_RICH_PROTOCOLS = ["http", "https", "mailto"]


def clean_text(value):
    """Strip ALL HTML tags from a plain-text field. Non-strings pass through."""
    if not isinstance(value, str):
        return value
    return bleach.clean(value, tags=[], attributes={}, strip=True)


def clean_rich(value):
    """Sanitize a light-formatting field, keeping only a safe tag allowlist."""
    if not isinstance(value, str):
        return value
    return bleach.clean(
        value,
        tags=_RICH_TAGS,
        attributes=_RICH_ATTRS,
        protocols=_RICH_PROTOCOLS,
        strip=True,
    )


# Keys inside a React Flow node's `data` (and top level) that hold user text.
_NODE_TEXT_KEYS = ("label", "text", "title", "content", "description")


def clean_graph_data(graph_json):
    """Sanitize user-visible text inside a React Flow graph JSON string.

    Accepts the stored JSON string (or a dict) and returns the same type with
    every node label/text field stripped of HTML. Best-effort: if the payload
    can't be parsed it is returned unchanged (schema validation guards shape).
    """
    if graph_json is None:
        return graph_json

    is_str = isinstance(graph_json, str)
    try:
        data = json.loads(graph_json) if is_str else graph_json
    except (ValueError, TypeError):
        return graph_json
    if not isinstance(data, dict):
        return graph_json

    for node in data.get("nodes", []) or []:
        if not isinstance(node, dict):
            continue
        for k in _NODE_TEXT_KEYS:
            if k in node:
                node[k] = clean_text(node[k])
        node_data = node.get("data")
        if isinstance(node_data, dict):
            for k in _NODE_TEXT_KEYS:
                if k in node_data:
                    node_data[k] = clean_text(node_data[k])

    # Edge labels can carry text too.
    for edge in data.get("edges", []) or []:
        if isinstance(edge, dict) and "label" in edge:
            edge["label"] = clean_text(edge["label"])

    return json.dumps(data) if is_str else data
