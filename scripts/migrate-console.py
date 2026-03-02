"""Replace console.log/warn/error with structured logger calls."""
import re
import sys

filepaths = [
    'src/frontend/mounts/MountService.ts',
    'src/plugin/events.ts',
]

for filepath in filepaths:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    has_logger = ('import * as logger' in content or
                  'from "@shared/logging/logger"' in content or
                  'from "@backend/logging/logger"' in content)

    lines = content.split('\n')
    result = []
    count = 0
    i = 0

    while i < len(lines):
        line = lines[i]
        m = re.match(r'^(\s*)console\.(log|warn|error)\((.*)$', line)
        if m:
            indent = m.group(1)
            method = m.group(2)
            rest = m.group(3)
            logger_method = 'info' if method == 'log' else method
            paren_depth = rest.count('(') - rest.count(')') + 1
            if paren_depth <= 0:
                result.append(f'{indent}logger.{logger_method}({rest}')
                count += 1
            else:
                collected = [f'{indent}logger.{logger_method}({rest}']
                i += 1
                while i < len(lines) and paren_depth > 0:
                    paren_depth += lines[i].count('(') - lines[i].count(')')
                    collected.append(lines[i])
                    i += 1
                result.extend(collected)
                count += 1
                continue
        else:
            result.append(line)
        i += 1

    # Add import if not present
    if not has_logger and count > 0:
        import_line = 'import * as logger from "@shared/logging/logger";'
        last_import = -1
        for j, line in enumerate(result):
            if line.startswith('import '):
                last_import = j
        if last_import >= 0:
            result.insert(last_import + 1, import_line)

    new_content = '\n'.join(result)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f'{filepath}: replaced {count} console calls, had_logger={has_logger}')
