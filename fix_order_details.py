import os
import re

# 1. Fix Sales Orders page syntax
sales_path = r"h:\install\src\app\sales\orders\page.tsx"
if os.path.exists(sales_path):
    with open(sales_path, 'r', encoding='utf-8') as f:
        cnt = f.read()
    cnt = cnt.replace(r"t(\'View\', \'عرض\')", "t('View', 'عرض')")
    cnt = cnt.replace(r"/orders/${order.id}", "/orders/${order.id}") # just in case
    with open(sales_path, 'w', encoding='utf-8') as f:
        f.write(cnt)

# 2. Update Order Detail page
detail_path = r"h:\install\src\app\orders\[id]\page.tsx"
with open(detail_path, 'r', encoding='utf-8') as f:
    cnt = f.read()

# Add imports
cnt = cnt.replace(
    "getOrderById, getOrderHistory, getOrderEvidence, uploadEvidence,",
    "getOrderById, getOrderHistory, getOrderEvidence, uploadEvidence, deleteOrder, deleteTask,"
)

# Add handlers after handleAssign
handler_insertion_point = "await loadOrder(); // refresh tasks list"
handlers = '''            await loadOrder(); // refresh tasks list
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : t('Failed to assign', 'فشل التعيين'));
        } finally {
            setAssignLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!confirm(t('Are you sure you want to delete this order? This action cannot be undone.', 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.'))) return;
        try {
            await deleteOrder(id);
            window.location.href = '/sales/orders';
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : t('Failed to delete order', 'فشل حذف الطلب'));
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm(t('Remove this technician from this order?', 'هل تريد إزالة هذا الفني من الطلب؟'))) return;
        try {
            await deleteTask(taskId);
            showToast('success', t('Technician removed', 'تمت إزالة الفني'));
            await loadOrder();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : t('Failed to remove', 'فشل الإزالة'));
        }
    };'''

# We need to be careful with the replacement to not duplicate the try/catch/finally block
# Let's search for the end of handleAssign
pattern_assign = r'await loadOrder\(\); // refresh tasks list\s*}\s*catch \(err\) {\s*showToast\(\'error\', err instanceof Error \? err\.message : t\(\'Failed to assign\', \'فشل التعيين\'\)\);\s*}\s*finally {\s*setAssignLoading\(false\);\s*}\s*};'
if re.search(pattern_assign, cnt):
    cnt = re.sub(pattern_assign, handlers, cnt)
else:
    print("handleAssign end pattern not found!")

# Add Delete Order button in header
header_btn_old = '<button className="btn btn-primary btn-sm" onClick={openAssignModal}>\n                            👤 {t(\'Assign Technician\', \'تعيين فني\')}\n                        </button>'
header_btn_new = '''<button className="btn btn-danger btn-sm" onClick={handleDeleteOrder}>
                            🗑️ {t('Delete Order', 'حذف الطلب')}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={openAssignModal}>
                            👤 {t('Assign Technician', 'تعيين فني')}
                        </button>'''

if header_btn_old in cnt:
    cnt = cnt.replace(header_btn_old, header_btn_new)
else:
    # try with regex for header button
    pattern_header = r'(<button className="btn btn-primary btn-sm" onClick={openAssignModal}>\s*👤 {t\(\'Assign Technician\', \'تعيين فني\'\)}\s*<\/button>)'
    replacement_header = r'<button className="btn btn-danger btn-sm" onClick={handleDeleteOrder}>\n                            🗑️ {t(\'Delete Order\', \'حذف الطلب\')}\n                        </button>\n                        \1'
    cnt = re.sub(pattern_header, replacement_header, cnt)

# Add Delete Task button in task list
pattern_task_badge = r'(<span style={{ fontSize: 12, fontWeight: 600, padding: \'2px 8px\', background: \'rgba\(99,102,241,0.12\)\', borderRadius: 12, color: \'#818cf8\' }}>{task\.status}<\/span>)'
replacement_task_badge = r'<div style={{ display: \'flex\', gap: 8, alignItems: \'center\' }}>\n                                            \1\n                                            <button className="btn btn-danger btn-sm" style={{ padding: \'2px 6px\', fontSize: 12 }} onClick={() => handleDeleteTask(task.id)}>🗑️</button>\n                                        </div>'

cnt = re.sub(pattern_task_badge, replacement_task_badge, cnt)

with open(detail_path, 'w', encoding='utf-8') as f:
    f.write(cnt)
