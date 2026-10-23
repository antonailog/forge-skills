#!/bin/bash
# forge-cookbook install script
# Creates symlinks for Claude Code and Codex-compatible skill directories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
CODEX_SKILLS_DIR="${CODEX_SKILLS_DIR:-$HOME/.agents/skills}"

TARGET="both"
ACTION="install"
DRY_RUN=0
FORCE=0

# All forge skills: auto-discovered under skills/ (must contain SKILL.md; _* dirs excluded)
SKILLS=()
for _d in "$SCRIPT_DIR"/skills/*/; do
  _name="$(basename "$_d")"
  case "$_name" in _*) continue ;; esac
  [ -f "$_d/SKILL.md" ] || continue
  SKILLS+=("$_name")
done

usage() {
  cat <<'USAGE'
Usage: ./install.sh [options]

Options:
  --target <claude|codex|both>  Install target. Default: both
                                claude -> ~/.claude/skills
                                codex  -> ~/.agents/skills
  --uninstall                   Remove forge symlinks from the selected target
  --status                      Show install status for the selected target
  --dry-run                     Print actions without changing files
  --force                       Replace non-symlink paths if they block install
  -h, --help                    Show this help

Environment overrides:
  CLAUDE_SKILLS_DIR             Default: ~/.claude/skills
  CODEX_SKILLS_DIR              Default: ~/.agents/skills
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --target)
        [ "$#" -ge 2 ] || die "--target requires a value"
        TARGET="$2"
        shift 2
        ;;
      --target=*)
        TARGET="${1#*=}"
        shift
        ;;
      --uninstall)
        ACTION="uninstall"
        shift
        ;;
      --status)
        ACTION="status"
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --force)
        FORCE=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done

  case "$TARGET" in
    claude|codex|both) ;;
    *) die "Unsupported target '$TARGET'. Use claude, codex, or both." ;;
  esac
}

target_dirs() {
  case "$TARGET" in
    claude) printf '%s\n' "$CLAUDE_SKILLS_DIR" ;;
    codex) printf '%s\n' "$CODEX_SKILLS_DIR" ;;
    both)
      printf '%s\n' "$CLAUDE_SKILLS_DIR"
      printf '%s\n' "$CODEX_SKILLS_DIR"
      ;;
  esac
}

validate_sources() {
  [ -f "$SCRIPT_DIR/SKILL.md" ] || die "Root SKILL.md not found: $SCRIPT_DIR/SKILL.md"
  [ "${#SKILLS[@]}" -gt 0 ] || die "No skills discovered under $SCRIPT_DIR/skills/"
}

link_one() {
  src="$1"
  dst="$2"

  if [ -L "$dst" ]; then
    current="$(readlink "$dst" || true)"
    if [ "$current" = "$src" ]; then
      echo "  ok  $(basename "$dst") -> $src"
      return
    fi
    run rm "$dst"
  elif [ -e "$dst" ]; then
    if [ "$FORCE" -ne 1 ]; then
      die "$dst exists and is not a symlink. Re-run with --force if you want to replace it."
    fi
    run rm -rf "$dst"
  fi

  run ln -s "$src" "$dst"
  echo "  add $(basename "$dst") -> $src"
}

install_to_dir() {
  skills_dir="$1"
  echo "Installing forge skills into: $skills_dir"
  run mkdir -p "$skills_dir"

  link_one "$SCRIPT_DIR" "$skills_dir/forge"
  link_one "$SCRIPT_DIR/skills/_shared" "$skills_dir/_shared"
  for skill in "${SKILLS[@]}"; do
    link_one "$SCRIPT_DIR/skills/$skill" "$skills_dir/$skill"
  done
}

remove_one() {
  dst="$1"
  if [ -L "$dst" ]; then
    run rm "$dst"
    echo "  remove $(basename "$dst")"
  elif [ -e "$dst" ]; then
    if [ "$FORCE" -eq 1 ]; then
      run rm -rf "$dst"
      echo "  remove $(basename "$dst") (forced)"
    else
      echo "  skip $(basename "$dst") (not a symlink)"
    fi
  else
    echo "  missing $(basename "$dst")"
  fi
}

uninstall_from_dir() {
  skills_dir="$1"
  echo "Uninstalling forge skills from: $skills_dir"
  remove_one "$skills_dir/forge"
  remove_one "$skills_dir/_shared"
  for skill in "${SKILLS[@]}"; do
    remove_one "$skills_dir/$skill"
  done
}

status_one() {
  src="$1"
  dst="$2"
  name="$(basename "$dst")"

  if [ -L "$dst" ]; then
    current="$(readlink "$dst" || true)"
    if [ ! -e "$dst" ]; then
      echo "  broken  $name -> $current (target missing)"
    elif [ "$current" = "$src" ]; then
      echo "  ok      $name -> $current"
    else
      echo "  drift   $name -> $current (expected $src)"
    fi
  elif [ -e "$dst" ]; then
    echo "  blocked $name exists but is not a symlink"
  else
    echo "  missing $name"
  fi
}

status_for_dir() {
  skills_dir="$1"
  echo "Status for: $skills_dir"
  status_one "$SCRIPT_DIR" "$skills_dir/forge"
  status_one "$SCRIPT_DIR/skills/_shared" "$skills_dir/_shared"
  for skill in "${SKILLS[@]}"; do
    status_one "$SCRIPT_DIR/skills/$skill" "$skills_dir/$skill"
  done
}

# forge-design-lab 的运行时在独立工具 design-studio：检测一下，没有就提示怎么装（不自动下载、不算安装失败）
check_design_studio() {
  local d
  for d in "${DESIGN_STUDIO_HOME:-}" "$HOME/.design-studio" "$HOME/design-studio" "$SCRIPT_DIR/../../工具/design-studio"; do
    if [ -n "$d" ] && [ -f "$d/design_studio.py" ]; then
      echo "design-studio: $d"
      return 0
    fi
  done
  echo "NOTE: forge-design-lab needs design-studio (its workbench server and token tools). Not found."
  echo "      Install: git clone https://github.com/antonailog/design-studio.git ~/.design-studio"
  echo "      Or point DESIGN_STUDIO_HOME to an existing checkout."
}

parse_args "$@"
validate_sources

case "$ACTION" in
  install)
    for dir in $(target_dirs); do
      install_to_dir "$dir"
    done
    echo ""
    echo "Installed $(( ${#SKILLS[@]} + 1 )) forge skills for target: $TARGET"
    echo "Restart Codex / Claude Code, or open a new session, to refresh skill discovery."
    check_design_studio
    ;;
  uninstall)
    for dir in $(target_dirs); do
      uninstall_from_dir "$dir"
    done
    ;;
  status)
    for dir in $(target_dirs); do
      status_for_dir "$dir"
    done
    check_design_studio
    ;;
esac
