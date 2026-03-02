"""
Batch migrate remaining console.log/warn/error/info/debug calls to structured logger.
Adds `import * as logger from "@shared/logging/logger"` if missing.
"""
import re, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "src")

# Map of console method -> logger method
METHOD_MAP = {
    "console.error": "logger.error",
    "console.warn": "logger.warn",
    "console.info": "logger.info",
    "console.log": "logger.info",
    "console.debug": "logger.debug",
}

# Files to migrate (relative to src/)
FILES = [
    "backend/core/file/File.ts",
    "backend/core/query/SavedQueryStore.ts",
    "backend/core/reminders/content.ts",
    "frontend/modals/OptionsModal.ts",
    "frontend/mounts/dialogMounts.ts",
    "frontend/mounts/dockMounts.ts",
    "frontend/mounts/floatMounts.ts",
    "frontend/services/UIQueryService.ts",
    "frontend/stores/KeyboardShortcuts.store.ts",
    "frontend/stores/Settings.store.ts",
    "frontend/stores/Task.store.ts",
    "frontend/stores/TaskAnalytics.store.ts",
]

LOGGER_IMPORT = 'import * as logger from "@shared/logging/logger";'
# Pattern for console calls: console.xxx(args)
CONSOLE_RE = re.compile(r'\bconsole\.(log|warn|error|info|debug)\s*\(')
# Patterns to check if logger is already imported
LOGGER_IMPORT_RE = re.compile(r'import\s+\*\s+as\s+\w*[Ll]ogger\w*\s+from\s+["\']@(?:shared|backend)/(?:logging|utils/lib)/logger["\']')

total_replaced = 0
total_imports_added = 0

for rel in FILES:
    fpath = os.path.join(SRC, rel.replace("/", os.sep))
    if not os.path.exists(fpath):
        print(f"  SKIP (not found): {rel}")
        continue

    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")
    has_logger = bool(LOGGER_IMPORT_RE.search(content))
    changed = False
    file_replaced = 0

    new_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip comment-only lines
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
            new_lines.append(line)
            continue

        # Check for console calls
        m = CONSOLE_RE.search(line)
        if m:
            method = m.group(1)  # log, warn, error, info, debug
            logger_method = METHOD_MAP.get(f"console.{method}", "logger.info")

            # Extract the arguments after console.xxx(
            # We need to handle multi-arg calls like console.error("msg", error)
            # Strategy: Just do a simple regex replace of console.xxx( -> logger.xxx(
            # But we need to convert multi-arg console.error("msg:", err) to logger.error("msg", { error: err })

            # Simple case: single string arg -> direct replacement
            # Complex case: console.error("msg:", error) or console.warn("msg", data)

            old_call = f"console.{method}"
            # Check if there's a second argument (error object)
            # Match: console.error("...", error) or console.error("...", err)
            multi_arg = re.search(
                r'console\.' + method + r'\s*\(\s*([`"\'].*?[`"\'])\s*,\s*(\w+)\s*\)',
                line
            )
            template_multi = re.search(
                r'console\.' + method + r'\s*\(\s*(`[^`]*`)\s*,\s*(\w+(?:\.\w+)*)\s*\)',
                line
            )

            if multi_arg:
                msg_part = multi_arg.group(1)
                err_part = multi_arg.group(2)
                # Clean trailing colon/space from message
                clean_msg = msg_part
                if clean_msg.endswith(':"') or clean_msg.endswith(": '") or clean_msg.endswith(':\''):
                    clean_msg = clean_msg[:-2] + clean_msg[-1]
                elif clean_msg.endswith(':",'):
                    clean_msg = clean_msg[:-3] + '"'

                new_call = f'{logger_method}({clean_msg}, {{ error: {err_part} }})'
                line = line[:multi_arg.start()] + new_call + line[multi_arg.end():]
                changed = True
                file_replaced += 1
            elif template_multi:
                msg_part = template_multi.group(1)
                err_part = template_multi.group(2)
                new_call = f'{logger_method}({msg_part}, {{ error: {err_part} }})'
                line = line[:template_multi.start()] + new_call + line[template_multi.end():]
                changed = True
                file_replaced += 1
            else:
                # Single arg or complex expression — just replace console.xxx with logger.xxx
                line = line.replace(f"console.{method}(", f"{logger_method}(", 1)
                changed = True
                file_replaced += 1

        new_lines.append(line)

    if changed:
        # Add logger import if not present
        if not has_logger:
            # Find the last import line
            last_import_idx = -1
            for i, l in enumerate(new_lines):
                if l.strip().startswith("import ") or (l.strip().startswith("} from") and "import" in "\n".join(new_lines[max(0,i-5):i])):
                    last_import_idx = i
            # Also handle multi-line imports
            for i, l in enumerate(new_lines):
                if re.match(r'^} from ["\']', l.strip()):
                    last_import_idx = max(last_import_idx, i)

            if last_import_idx >= 0:
                new_lines.insert(last_import_idx + 1, LOGGER_IMPORT)
            else:
                # Fallback: insert after first line
                new_lines.insert(1, LOGGER_IMPORT)
            total_imports_added += 1

        with open(fpath, "w", encoding="utf-8") as f:
            f.write("\n".join(new_lines))

        total_replaced += file_replaced
        print(f"  {rel}: {file_replaced} calls replaced" + (" + import added" if not has_logger else ""))

print(f"\nDone: {total_replaced} calls replaced, {total_imports_added} imports added across {len(FILES)} files")
