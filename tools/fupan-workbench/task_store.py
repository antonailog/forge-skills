"""JSON-backed task store for Fupan Workbench.

The store intentionally uses only the Python standard library. FastAPI is an
optional layer on top; task creation and polling must still work well enough to
support a conversational fallback when web dependencies are missing.
"""

import json
import os
from pathlib import Path
import time
from datetime import datetime, timezone
from uuid import uuid4

VALID_STATUSES = {"pending_selection", "submitted", "consumed", "failed"}
VALID_DEPTHS = {"了解", "表达", "复现"}


class TaskStateError(RuntimeError):
    """Raised when a task status transition is invalid."""


def default_root():
    return Path(os.environ.get("FUPAN_WORKBENCH_HOME", "~/.forge/fupan-workbench")).expanduser()


def tasks_dir(root=None):
    base = Path(root).expanduser() if root else default_root()
    return base / "tasks"


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def make_task_id():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return "fupan-{}-{}".format(stamp, uuid4().hex[:8])


def atomic_write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(str(tmp_path), str(path))


def task_path(task_id, root=None):
    if not task_id or "/" in task_id or "\\" in task_id or ".." in task_id:
        raise ValueError("Invalid task id: {}".format(task_id))
    return tasks_dir(root) / "{}.json".format(task_id)


def normalize_topic(topic):
    topic = dict(topic or {})
    if not topic.get("id"):
        title = topic.get("title") or "topic"
        topic["id"] = str(title).strip().lower().replace(" ", "-")
    topic.setdefault("title", topic["id"])
    topic.setdefault("plain_explanation", "")
    topic.setdefault("why_relevant", "")
    topic.setdefault("recommended_depth", "表达")
    topic.setdefault("selected", True)
    topic.setdefault("depth", topic.get("recommended_depth") if topic.get("recommended_depth") in VALID_DEPTHS else "表达")
    return topic


def normalize_expression_issue_quote(item):
    if isinstance(item, str):
        return {"quote": item, "issue": "", "suggestion": ""}
    item = dict(item or {})
    quote = item.get("quote") or item.get("text") or ""
    return {
        "quote": str(quote).strip(),
        "issue": str(item.get("issue") or item.get("reason") or "").strip(),
        "suggestion": str(item.get("suggestion") or item.get("better_prompt") or "").strip(),
    }


def create_task(payload, root=None):
    payload = dict(payload or {})
    now = utc_now()
    task_id = payload.get("id") or make_task_id()
    task = {
        "id": task_id,
        "status": "pending_selection",
        "created_at": payload.get("created_at") or now,
        "updated_at": now,
        "project": payload.get("project") or "unknown-project",
        "session": payload.get("session") or "",
        "source_thread": payload.get("source_thread") or "",
        "active": bool(payload.get("active", True)),
        "title": payload.get("title") or "",
        "summary": payload.get("summary") or "",
        "user_questions": list(payload.get("user_questions") or []),
        "expression_issue_quotes": [
            quote
            for quote in (normalize_expression_issue_quote(item) for item in payload.get("expression_issue_quotes") or [])
            if quote["quote"]
        ],
        "topics": [normalize_topic(topic) for topic in payload.get("topics") or []],
        "selection": payload.get("selection") or None,
    }
    atomic_write_json(task_path(task_id, root), task)
    return task


def read_task(task_id, root=None):
    path = task_path(task_id, root)
    if not path.exists():
        raise KeyError(task_id)
    data = json.loads(path.read_text(encoding="utf-8"))
    status = data.get("status")
    if status not in VALID_STATUSES:
        raise TaskStateError("Invalid status for task {}: {}".format(task_id, status))
    return data


def list_tasks(root=None, include_consumed=False):
    directory = tasks_dir(root)
    if not directory.exists():
        return []
    tasks = []
    for path in directory.glob("*.json"):
        try:
            task = read_task(path.stem, root)
            if task.get("status") == "consumed" and not include_consumed:
                continue
            tasks.append(task)
        except Exception:
            tasks.append(
                {
                    "id": path.stem,
                    "status": "failed",
                    "created_at": "",
                    "updated_at": "",
                    "project": "unknown-project",
                    "active": False,
                    "summary": "task JSON 无法读取",
                    "user_questions": [],
                    "expression_issue_quotes": [],
                    "topics": [],
                    "selection": None,
                    "error": "task_json_unreadable",
                }
            )
    status_rank = {"pending_selection": 0, "submitted": 1, "failed": 2, "consumed": 3}
    tasks.sort(key=lambda task: task.get("created_at") or "", reverse=True)
    tasks.sort(key=lambda task: (not task.get("active"), status_rank.get(task.get("status"), 9)))
    return tasks


def validate_selection(selection):
    selection = dict(selection or {})
    topics = list(selection.get("topics") or [])
    for topic in topics:
        depth = topic.get("depth")
        if depth and depth not in VALID_DEPTHS:
            raise ValueError("Invalid depth: {}".format(depth))
    selection["topics"] = topics
    selection.setdefault("feedback", "")
    selection.setdefault("submitted_at", utc_now())
    return selection


def submit_selection(task_id, selection, root=None):
    task = read_task(task_id, root)
    if task["status"] != "pending_selection":
        raise TaskStateError("Task {} is {}, not pending_selection".format(task_id, task["status"]))
    task["selection"] = validate_selection(selection)
    task["status"] = "submitted"
    task["updated_at"] = utc_now()
    atomic_write_json(task_path(task_id, root), task)
    return task


def mark_consumed(task_id, root=None, review_path=None):
    task = read_task(task_id, root)
    if task["status"] not in {"submitted", "consumed"}:
        raise TaskStateError("Task {} is {}, not submitted".format(task_id, task["status"]))
    task["status"] = "consumed"
    if review_path:
        task["review_path"] = str(Path(review_path).expanduser())
    task["updated_at"] = utc_now()
    atomic_write_json(task_path(task_id, root), task)
    return task


def mark_failed(task_id, message, root=None):
    task = read_task(task_id, root)
    task["status"] = "failed"
    task["error"] = message
    task["updated_at"] = utc_now()
    atomic_write_json(task_path(task_id, root), task)
    return task


def wait_for_submission(task_id, timeout_seconds=1800, interval_seconds=2, root=None):
    deadline = time.time() + float(timeout_seconds)
    while time.time() <= deadline:
        task = read_task(task_id, root)
        if task["status"] == "submitted":
            return task
        if task["status"] == "failed":
            raise TaskStateError("Task {} failed: {}".format(task_id, task.get("error", "")))
        time.sleep(float(interval_seconds))
    raise TimeoutError("Task {} was not submitted within {} seconds".format(task_id, timeout_seconds))
