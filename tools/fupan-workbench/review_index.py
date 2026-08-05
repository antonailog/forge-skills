"""Historical review index for Fupan Workbench."""

import hashlib
import os
import re
from pathlib import Path
from urllib.parse import quote

from markdown_reader import first_date_from_name, read_markdown


INDEX_ITEM_RE = re.compile(r"- \*\*\[(?P<title>.+?)\]\((?P<path>.+?)\)\*\*(?P<tags>(?:\s+`[^`]+`)*)\s*(?P<tail>.*)")
TAG_RE = re.compile(r"`([^`]+)`")
MARKDOWN_LINK_RE = re.compile(
    r"(?P<prefix>!?\[[^\]]*\]\()"
    r"(?P<target><[^>\n]+>|[^)\s]+)"
    r"(?P<suffix>(?:\s+\"[^\"]*\"|\s+'[^']*'|\s+\([^)]*\))?\))"
)
EXTERNAL_LINK_PREFIXES = ("http://", "https://", "data:", "mailto:", "#")


def default_review_root():
    return Path("~/claudecode_workspace/记录/复盘").expanduser()


def safe_id_for_path(path):
    return hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:16]


def is_relative_safe(path):
    candidate = Path(path)
    return not candidate.is_absolute() and ".." not in candidate.parts


class ReviewIndex:
    def __init__(self, review_root=None):
        self.review_root = Path(review_root).expanduser() if review_root else default_review_root()
        self._cache = None

    def list_reviews(self):
        indexed_reviews = self._read_global_index()
        scanned_reviews = self._scan_markdown_files()
        reviews_by_path = {review["path"]: review for review in scanned_reviews}
        reviews_by_path.update({review["path"]: review for review in indexed_reviews})
        reviews = list(reviews_by_path.values())
        self._cache = {review["id"]: review for review in reviews}
        return sorted(reviews, key=lambda review: review.get("created_at") or "", reverse=True)

    def read_review(self, review_id):
        if self._cache is None:
            self.list_reviews()
        if review_id not in self._cache:
            # 服务是常驻进程，缓存建立后新写入的复盘文档不在其中；
            # miss 时重扫一次目录再判定，避免"不重启服务就永远 review_not_found"。
            self.list_reviews()
        if review_id not in self._cache:
            raise KeyError(review_id)
        review = self._cache[review_id]
        path = Path(review["path"]).expanduser()
        self._assert_inside_root(path)
        detail = read_markdown(path)
        detail["content"] = self._rewrite_asset_links(detail["content"], review_id, path)
        detail.update(
            {
                "id": review["id"],
                "title": review["title"],
                "project": review["project"],
                "created_at": review["created_at"],
                "learned_topics": review["learned_topics"],
                "summary": review.get("summary", ""),
            }
        )
        return detail

    def resolve_asset_path(self, review_id, asset_path):
        if self._cache is None:
            self.list_reviews()
        if review_id not in self._cache:
            # 同 read_review：常驻进程下新复盘的配图也要能找到。
            self.list_reviews()
        if review_id not in self._cache:
            raise KeyError(review_id)
        candidate = Path(asset_path)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise KeyError(asset_path)
        review_path = Path(self._cache[review_id]["path"]).expanduser().resolve()
        base = review_path.parent.resolve()
        resolved = (base / candidate).resolve()
        try:
            resolved.relative_to(base)
        except ValueError:
            raise KeyError(asset_path)
        return resolved

    def _read_global_index(self):
        index_path = self.review_root / "INDEX.md"
        if not index_path.exists():
            return []

        reviews = []
        lines = index_path.read_text(encoding="utf-8").splitlines()
        current_date = ""
        pending = None
        for line in lines:
            if line.startswith("## "):
                current_date = line.replace("##", "", 1).strip()
                continue
            match = INDEX_ITEM_RE.match(line)
            if match:
                if pending:
                    reviews.append(pending)
                rel_path = match.group("path").strip()
                if not is_relative_safe(rel_path):
                    pending = None
                    continue
                tags = TAG_RE.findall(match.group("tags") or "")
                project = tags[0] if tags else Path(rel_path).parts[0]
                learned_topics = [tag for tag in tags[1:] if not tag.startswith("迭代")]
                abs_path = (self.review_root / rel_path).resolve()
                pending = {
                    "id": safe_id_for_path(rel_path),
                    "project": project,
                    "title": match.group("title").strip(),
                    "path": str(abs_path),
                    "created_at": first_date_from_name(abs_path) or current_date,
                    "learned_topics": learned_topics,
                    "summary": match.group("tail").strip(),
                }
                continue
            if pending and line.startswith("  ") and line.strip():
                pending["summary"] = (pending.get("summary", "") + " " + line.strip()).strip()
        if pending:
            reviews.append(pending)
        return [review for review in reviews if Path(review["path"]).exists()]

    def _scan_markdown_files(self):
        if not self.review_root.exists():
            return []
        reviews = []
        for path in self.review_root.glob("*/*.md"):
            if path.name == "INDEX.md":
                continue
            rel_path = path.relative_to(self.review_root)
            title = path.stem
            try:
                detail = read_markdown(path)
                if detail["headings"]:
                    title = detail["headings"][0]["title"]
            except Exception:
                detail = {"frontmatter": {}}
            reviews.append(
                {
                    "id": safe_id_for_path(rel_path),
                    "project": rel_path.parts[0],
                    "title": title,
                    "path": str(path.resolve()),
                    "created_at": first_date_from_name(path),
                    "learned_topics": [],
                    "summary": "",
                }
            )
        return reviews

    def _assert_inside_root(self, path):
        root = self.review_root.resolve()
        resolved = path.resolve()
        try:
            resolved.relative_to(root)
        except ValueError:
            raise KeyError(str(path))

    def _rewrite_asset_links(self, content, review_id, review_path):
        review_path = Path(review_path).expanduser().resolve()
        base = review_path.parent.resolve()

        def replacement(match):
            target = match.group("target")
            unwrapped = target[1:-1] if target.startswith("<") and target.endswith(">") else target
            if unwrapped.startswith(EXTERNAL_LINK_PREFIXES):
                return match.group(0)
            path = Path(unwrapped).expanduser()
            if path.is_absolute():
                try:
                    rel_path = path.resolve().relative_to(base)
                except ValueError:
                    return match.group(0)
            else:
                rel_path = path
            if ".." in rel_path.parts:
                return match.group(0)
            rel_url = quote(rel_path.as_posix(), safe="/-._~")
            review_url = quote(review_id, safe="")
            rewritten = f"/api/reviews/{review_url}/assets/{rel_url}"
            if target.startswith("<") and target.endswith(">"):
                rewritten = f"<{rewritten}>"
            return f"{match.group('prefix')}{rewritten}{match.group('suffix')}"

        return MARKDOWN_LINK_RE.sub(replacement, content.replace(os.sep, "/"))
