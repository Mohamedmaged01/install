import os

path = r"h:\install\src\app\sales\orders\page.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix order row actions
old_actions = '<td>\n                                        <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t(\'View\', \'عرض\')}</Link>\n                                    </td>'
new_actions = '''<td>
                                        <div className="btn-group">
                                            <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t('View', 'عرض')}</Link>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOrder(order.id, order.orderNumber || `#${order.id}`)}>🗑️</button>
                                        </div>
                                    </td>'''

# Try regex for the actions cell swap
import re
pattern = r'(<td>\s*<Link href={`/orders/\${order\.id}`} className="btn btn-secondary btn-sm">{t\(\'View\', \'عرض\'\)}<\/Link>\s*<\/td>)'
replacement = r'<td>\n                                        <div className="btn-group">\n                                            <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t(\'View\', \'عرض\')}</Link>\n                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOrder(order.id, order.orderNumber || `#${order.id}`)}>🗑️</button>\n                                        </div>\n                                    </td>'

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
else:
    print("Action row pattern not found via regex!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
