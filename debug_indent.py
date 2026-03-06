import os

path = r"h:\install\src\app\admin\users\page.tsx"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(380, 410):
    if i < len(lines):
        print(f"{i+1}: {repr(lines[i])}")
