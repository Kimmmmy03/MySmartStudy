"""
Multi-agent orchestration framework for MySmartStudy AI features.

Provides a lightweight fan-out / fan-in pattern over asyncio.gather.
Each "agent" is an async function returning a dict. The orchestrator
dispatches them in parallel, collects results by name, and feeds
the merged context to a synthesizer (typically a single Gemini call).

Usage:

    results = await fan_out({
        "courses":    fetch_courses(user_id),
        "deadlines":  fetch_deadlines(user_id, course_ids),
        "quiz_scores": fetch_quiz_scores(user_id),
    })
    # results == {"courses": {...}, "deadlines": {...}, "quiz_scores": {...}}

Individual agent failures are caught — a failed agent returns
{"_error": "<message>"} so other agents' results are still usable.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Coroutine

logger = logging.getLogger(__name__)


async def fan_out(
    agents: dict[str, Coroutine[Any, Any, Any]],
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Run named agents in parallel, return results keyed by name.

    Each agent is an awaitable. Failures are isolated — a single agent
    crash does not cancel the others.

    Args:
        agents: mapping of agent_name → coroutine
        timeout: max seconds to wait for all agents (default 30s)

    Returns:
        dict of agent_name → result (or {"_error": str} on failure)
    """
    names = list(agents.keys())
    coros = list(agents.values())
    start = time.perf_counter()

    wrapped = [_safe_run(name, coro) for name, coro in zip(names, coros)]
    raw_results = await asyncio.wait_for(
        asyncio.gather(*wrapped),
        timeout=timeout,
    )

    elapsed = time.perf_counter() - start
    results = dict(zip(names, raw_results))

    ok = sum(1 for v in results.values() if not _is_error(v))
    logger.info(
        "fan_out: %d/%d agents succeeded in %.2fs",
        ok, len(names), elapsed,
    )
    return results


async def fan_out_synthesize(
    agents: dict[str, Coroutine[Any, Any, Any]],
    synthesizer,
    timeout: float = 30.0,
):
    """Fan-out agents, then pass merged results to a synthesizer function.

    The synthesizer receives the full results dict and can access any
    agent's output. It should be an async callable:
        async def synthesize(results: dict) -> Any
    """
    results = await fan_out(agents, timeout=timeout)
    return await synthesizer(results)


def _is_error(result: Any) -> bool:
    return isinstance(result, dict) and "_error" in result


def get_or_default(results: dict, key: str, default=None):
    """Safely get an agent result, returning default if the agent failed."""
    val = results.get(key, default)
    if _is_error(val):
        return default
    return val


async def _safe_run(name: str, coro: Coroutine) -> Any:
    """Execute a single agent coroutine, catching all exceptions."""
    try:
        return await coro
    except Exception as e:
        logger.warning("Agent '%s' failed: %s", name, e)
        return {"_error": str(e)}
