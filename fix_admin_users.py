import os

path = r"h:\install\src\app\admin\users\page.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix colSpan
old_col = '<td colSpan={4} style={{ textAlign: \'center\', padding: 32, color: \'var(--text-muted)\' }}>'
new_col = '<td colSpan={5} style={{ textAlign: \'center\', padding: 32, color: \'var(--text-muted)\' }}>'
content = content.replace(old_col, new_col)

# Fix user row
old_row = '<td style={{ color: \'var(--text-muted)\' }}>{u.phone || \'—\'}</td>\n                                            <td>{u.departmentName || `Dept #${u.departmentId}`}</td>'
new_row = '''<td style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                                            <td>{u.departmentName || `Dept #${u.departmentId}`}</td>
                                            <td>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
                                            </td>'''

# Try with a more flexible search for row
if old_row in content:
    content = content.replace(old_row, new_row)
else:
    # Use partial match
    marker = '<td style={{ color: \'var(--text-muted)\' }}>{u.phone || \'—\'}</td>'
    dept_marker = '<td>{u.departmentName || `Dept #${u.departmentId}`}</td>'
    
    lines = content.splitlines()
    new_lines = []
    for line in lines:
        new_lines.append(line)
        if marker in line:
            # Check next line for dept marker
            pass # we'll handle it in the next line loop or use a multi-line regex
            
    # Simple search and replace for the block
    import re
    pattern = r'(<td style={{ color: \'var\(--text-muted\)\' }}>{u\.phone \|\| \'—\'}</td>\s*<td>{u\.departmentName \|\| `Dept #\${u\.departmentId}`}<\/td>)'
    replacement = r'\1\n                                            <td>\n                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>\n                                            </td>'
    content = re.sub(pattern, replacement, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
