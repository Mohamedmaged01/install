'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    getOrderById, getOrderHistory, getOrderEvidence, uploadEvidence, deleteOrder, deleteTask,
    getDepartmentUsers, assignTask, getApexDocumentItems, getRoles, getMyTasks
} from '@/lib/endpoints';
import { API_BASE } from '@/lib/api';
import { Order, OrderHistoryEntry, Evidence, DepartmentUser, AssignTaskDto, ApexItem, Role } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';

type TabType = 'timeline' | 'items' | 'evidence' | 'audit';

export default function OrderDetailPage() {
    const { lang, t } = useLang();
    const params = useParams();
    const id = Number(params.id);
    const [order, setOrder] = useState<Order | null>(null);
    const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [apexItems, setApexItems] = useState<ApexItem[]>([]);
    const [apexLoading, setApexLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [loading, setLoading] = useState(true);

    // Evidence upload state
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadNote, setUploadNote] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Assign technician state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [technicians, setTechnicians] = useState<DepartmentUser[]>([]);
    const [selectedTechs, setSelectedTechs] = useState<Set<number>>(new Set());
    const [rolesMap, setRolesMap] = useState<Record<number, string>>({});
    const [assignNotes, setAssignNotes] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [techsLoading, setTechsLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    const showToast = (type: 'error' | 'success', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 6000);
    };

    const loadOrder = async () => {
        try {
            const [orderData, historyData, evidenceData, allTasks] = await Promise.all([
                getOrderById(id),
                getOrderHistory(id).catch(() => []),
                getOrderEvidence(id).catch(() => []),
                getMyTasks().catch(() => []),
            ]);

            if (orderData && Array.isArray(allTasks)) {
                orderData.tasks = allTasks.filter(t => t.orderId === id);
            }

            setOrder(orderData);
            setHistory(Array.isArray(historyData) ? historyData : []);
            setEvidence(Array.isArray(evidenceData) ? evidenceData : []);

            // Fetch APEX items if the order is linked to an APEX document
            if (orderData.invoiceId || orderData.quotationId) {
                setApexLoading(true);
                const type = orderData.invoiceId ? 'invoice' : 'offer';
                const code = orderData.invoiceId || orderData.quotationId || '';
                getApexDocumentItems(type, code)
                    .then(items => setApexItems(items))
                    .catch(() => setApexItems([]))
                    .finally(() => setApexLoading(false));
            }

        } catch (err) {
            console.error('Failed to load order:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) loadOrder();
    }, [id]);

    const handleUploadEvidence = async () => {
        if (uploadFiles.length === 0) return;
        setUploading(true);
        try {
            await uploadEvidence(id, uploadFiles, uploadNote || undefined);
            const ev = await getOrderEvidence(id).catch(() => []);
            setEvidence(Array.isArray(ev) ? ev : []);
            setUploadFiles([]);
            setUploadNote('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('success', t('Evidence uploaded!', 'تم رفع الدليل!'));
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : t('Upload failed', 'فشل الرفع'));
        } finally {
            setUploading(false);
        }
    };

    const openAssignModal = async () => {
        if (!order) return;
        setShowAssignModal(true);
        setSelectedTechs(new Set());
        setAssignNotes('');
        setTechsLoading(true);
        try {
            const [users, allRoles] = await Promise.all([
                getDepartmentUsers(undefined, order.departmentId),
                getRoles().catch(() => [])
            ]);
            setTechnicians(Array.isArray(users) ? users : []);

            const rMap: Record<number, string> = {};
            if (Array.isArray(allRoles)) {
                allRoles.forEach((r: Role) => { rMap[r.id] = r.name; });
            }
            setRolesMap(rMap);
        } catch {
            setTechnicians([]);
        } finally {
            setTechsLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!order || selectedTechs.size === 0) return;
        setAssignLoading(true);
        try {
            await Promise.all(
                Array.from(selectedTechs).map(techId => {
                    const dto: AssignTaskDto = {
                        orderId: order.id,
                        technicianId: techId,
                        notes: assignNotes || null,
                    };
                    return assignTask(dto);
                })
            );
            showToast('success', t(`${selectedTechs.size} technician(s) assigned!`, `تم تعيين ${selectedTechs.size} فني!`));
            setShowAssignModal(false);
            await loadOrder(); // refresh tasks list
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
    };

    if (loading) {
        return (
            <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>📋</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{t('Loading order...', 'جارٍ تحميل الطلب...')}</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="animate-in">
                <div className="empty-state" style={{ minHeight: '60vh' }}>
                    <div className="empty-state-icon">🔍</div>
                    <h3>{t('Order not found', 'الطلب غير موجود')}</h3>
                    <p>{t('The order you are looking for does not exist.', 'الطلب الذي تبحث عنه غير موجود.')}</p>
                    <Link href="/sales/orders" className="btn btn-primary" style={{ marginTop: 16 }}>{t('Back to Orders', 'العودة للطلبات')}</Link>
                </div>
            </div>
        );
    }

    const tabs: { key: TabType; label: string; icon: string }[] = [
        { key: 'timeline', label: t('Timeline', 'الجدول الزمني'), icon: '📅' },
        { key: 'items', label: t('Items', 'العناصر'), icon: '📦' },
        { key: 'evidence', label: t('Evidence', 'الأدلة'), icon: '📸' },
        { key: 'audit', label: t('Audit Log', 'سجل المراجعة'), icon: '📜' },
    ];

    // Statuses where technicians can be assigned
    const canAssignTech = ['PendingSupervisorApproval', 'ReadyForInstallation'].includes(order.status);

    return (
        <div className="animate-in">

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '14px 20px', borderRadius: 'var(--radius-md)',
                    background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
                    color: '#fff', fontWeight: 600, fontSize: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: 12, maxWidth: 420,
                    backdropFilter: 'blur(8px)',
                }}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span style={{ flex: 1 }}>{toast.msg}</span>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Link href="/sales/orders" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                    ← {t('Back to Orders', 'العودة للطلبات')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <h1 style={{ fontSize: 28, fontWeight: 700 }}>{order.orderNumber || `Order #${order.id}`}</h1>
                            <StatusBadge status={order.status} lang={lang} />
                            <PriorityBadge priority={order.priority} />
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            {order.invoiceId ? `${t('Invoice', 'فاتورة')}: ${order.invoiceId}` : order.quotationId ? `${t('Quotation', 'عرض سعر')}: ${order.quotationId}` : ''}
                            {' • '}{t('Created', 'تاريخ الإنشاء')} {new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="btn-group">
                        <button className="btn btn-danger btn-sm" onClick={handleDeleteOrder}>
                            🗑️ {t('Delete Order', 'حذف الطلب')}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={openAssignModal}>
                            👤 {t('Assign Technician', 'تعيين فني')}
                        </button>
                        {order.status === 'Complete' && (
                            <Link href="/qr/verify" className="btn btn-success">📱 {t('Verify QR', 'تحقق QR')}</Link>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                {/* Main Content */}
                <div>
                    <div className="tabs">
                        {tabs.map(tab => (
                            <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Timeline */}
                    {activeTab === 'timeline' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 24 }}>{t('Order Timeline', 'الجدول الزمني للطلب')}</div>
                            {history.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No timeline events yet. Events appear as the order progresses through statuses.', 'لا توجد أحداث بعد. ستظهر الأحداث عند تقدم الطلب عبر المراحل.')}</p>
                                </div>
                            ) : (
                                <div className="timeline">
                                    {history.map(event => (
                                        <div key={event.id} className="timeline-item">
                                            <div className="timeline-dot info" />
                                            <div className="timeline-content">
                                                <h4>{event.action}</h4>
                                                <p>{event.description || '—'}</p>
                                                <div className="timeline-meta">
                                                    <span>👤 {event.userName || `User #${event.userId}`}</span>
                                                    <span>{new Date(event.timestamp).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items */}
                    {activeTab === 'items' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>
                                {t('Installation Items', 'عناصر التركيب')}
                                {apexLoading && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12, fontWeight: 400 }}>⏳ {t('Loading from APEX...', 'جارٍ التحميل من أبكس...')}</span>}
                            </div>
                            {apexItems.length > 0 ? (
                                <div className="table-container" style={{ border: 'none' }}>
                                    <table>
                                        <thead><tr><th>{t('Item Code', 'رمز العنصر')}</th><th>{t('Name', 'الاسم')}</th><th>{t('Qty', 'الكمية')}</th><th>{t('Price', 'السعر')}</th><th>{t('Total', 'المجموع')}</th></tr></thead>
                                        <tbody>
                                            {apexItems.map((item, idx) => (
                                                <tr key={`${item.itemCode}-${idx}`}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{item.itemCode}</td>
                                                    <td className="table-cell-main">{lang === 'ar' ? item.arabicName : item.latinName || item.arabicName}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>SAR {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td style={{ fontWeight: 600 }}>SAR {((item.quantity * item.price) + item.vatValue - item.discountValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : apexLoading ? (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('Loading items...', 'جارٍ تحميل العناصر...')}</p>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No items found in APEX document.', 'لم يتم العثور على عناصر في مستند أبكس.')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Evidence */}
                    {activeTab === 'evidence' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>📸 {t('Evidence & Attachments', 'الأدلة والمرفقات')}</div>

                            {/* Upload Section */}
                            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>⬆️ {t('Upload Evidence', 'رفع دليل')}</div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                                    style={{ display: 'block', marginBottom: 10, color: 'var(--text-primary)' }}
                                />
                                {uploadFiles.length > 0 && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        {uploadFiles.length} {t('file(s) selected', 'ملف(ات) محدد')}
                                    </div>
                                )}
                                <input
                                    className="form-input"
                                    placeholder={t('Note (optional)', 'ملاحظة (اختيارية)')}
                                    value={uploadNote}
                                    onChange={e => setUploadNote(e.target.value)}
                                    style={{ marginBottom: 10 }}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    disabled={uploading || uploadFiles.length === 0}
                                    onClick={handleUploadEvidence}
                                >
                                    {uploading ? `⏳ ${t('Uploading...', 'جارٍ الرفع...')}` : `⬆️ ${t('Upload', 'رفع')}`}
                                </button>
                            </div>

                            {evidence.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                                    {evidence.map(ev => {
                                        let imgUrl = ev.imageUrl || ev.imagePath || '';
                                        if (imgUrl && !imgUrl.startsWith('http')) {
                                            imgUrl = `${API_BASE}/${imgUrl.replace(/^\//, '')}`;
                                        }

                                        return (
                                            <div key={ev.id} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                {imgUrl ? (
                                                    <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={imgUrl}
                                                            alt={ev.note || 'evidence'}
                                                            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </a>
                                                ) : (
                                                    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📸</div>
                                                )}
                                                <div style={{ padding: '10px 12px' }}>
                                                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{ev.note || t('Evidence', 'دليل')}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {ev.uploadedBy || '—'} • {new Date(ev.createdAt).toLocaleDateString()}
                                                    </div>
                                                    {imgUrl && (
                                                        <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
                                                            🔗 {t('Open', 'فتح')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No evidence uploaded yet.', 'لم يتم رفع أي دليل بعد.')}</p>
                            )}
                        </div>
                    )}

                    {/* Audit */}
                    {activeTab === 'audit' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>{t('Audit Log', 'سجل المراجعة')}</div>
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead><tr><th>{t('Action', 'الإجراء')}</th><th>{t('User', 'المستخدم')}</th><th>{t('Timestamp', 'الوقت')}</th><th>{t('Details', 'التفاصيل')}</th></tr></thead>
                                    <tbody>
                                        {history.length === 0 ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('No audit entries', 'لا توجد سجلات')}</td></tr>
                                        ) : history.map(event => (
                                            <tr key={event.id}>
                                                <td className="table-cell-main">{event.action}</td>
                                                <td>{event.userName || `#${event.userId}`}</td>
                                                <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(event.timestamp).toLocaleString()}</td>
                                                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{event.description || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Assign Technician Card */}
                    <div className="card" style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>👤 {t('Assign Technicians', 'تعيين فنيين')}</div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                            {t('Assign one or more technicians from the department to this order.', 'عيّن فنياً أو أكثر من القسم لهذا الطلب.')}
                        </p>
                        <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={openAssignModal}>
                            + {t('Assign Technician(s)', 'تعيين فني/فنيين')}
                        </button>
                    </div>

                    {/* Customer */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>👤 {t('Customer', 'العميل')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Name', 'الاسم')}:</span> <span style={{ fontWeight: 500 }}>{order.customerName || '—'}</span></div>
                            {order.customerEmail && <div><span style={{ color: 'var(--text-muted)' }}>{t('Email', 'البريد')}:</span> {order.customerEmail}</div>}
                            {order.customerPhone && <div><span style={{ color: 'var(--text-muted)' }}>{t('Phone', 'الهاتف')}:</span> {order.customerPhone}</div>}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Address', 'العنوان')}:</span> {order.address || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('City', 'المدينة')}:</span> {order.city || '—'}</div>
                        </div>
                    </div>

                    {/* Order Details */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📋 {t('Details', 'التفاصيل')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                            {(order.branchName || order.branchId) && (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Branch', 'الفرع')}:</span> {order.branchName || `#${order.branchId}`}</div>
                            )}
                            {(order.departmentName && order.departmentName !== 'string' || order.departmentId) && (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Department', 'القسم')}:</span> {order.departmentName && order.departmentName !== 'string' ? order.departmentName : `#${order.departmentId}`}</div>
                            )}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Scheduled', 'الموعد المحدد')}:</span> {order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Created by', 'أُنشئ بواسطة')}:</span> {order.createdByName || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Status', 'الحالة')}:</span> <StatusBadge status={order.status} lang={lang} /></div>
                        </div>
                    </div>

                    {/* Tasks (assigned technicians) */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>🔧 {t('Assigned Technicians', 'الفنيون المعيَّنون')}</div>
                        {order.tasks && order.tasks.length > 0 ? (
                            order.tasks.map(task => (
                                <div key={task.id} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 8, fontSize: 13 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>👷 {task.technicianName || `Tech #${task.technicianId}`}</span>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', background: 'rgba(99,102,241,0.12)', borderRadius: 12, color: '#818cf8' }}>{task.status}</span>
                                            <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => handleDeleteTask(task.id)}>🗑️</button>
                                        </div>
                                    </div>
                                    {task.notes && <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{task.notes}</div>}
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('No technicians assigned yet.', 'لم يتم تعيين أي فني بعد.')}</p>
                        )}
                    </div>

                    {/* QR */}
                    {order.qrToken && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 12 }}>📱 QR Code</div>
                            <div style={{ fontSize: 14 }}>
                                <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: 8 }}>{order.qrToken}</div>
                                {order.qrExpiry && (
                                    <div style={{ fontSize: 12, color: new Date(order.qrExpiry) < new Date() ? '#ef4444' : '#10b981' }}>
                                        {t('Expires', 'ينتهي')}: {new Date(order.qrExpiry).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {order.notes && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 12 }}>📝 {t('Notes', 'ملاحظات')}</div>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{order.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Assign Technician Modal ── */}
            {
                showAssignModal && (
                    <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                            <div className="modal-header">
                                <h2>👤 {t('Assign Technicians', 'تعيين فنيين')}</h2>
                                <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    {t('Order', 'الطلب')}: <strong>{order.orderNumber || `#${order.id}`}</strong>
                                    {' — '}{t('Department', 'القسم')}: <strong>{order.departmentName || `#${order.departmentId}`}</strong>
                                </p>

                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <label className="form-label" style={{ margin: 0 }}>
                                            {t('Technicians', 'الفنيون')} ({selectedTechs.size} {t('selected', 'محدد')})
                                        </label>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTechs(new Set(technicians.map(t => t.id)))}>
                                                {t('All', 'الكل')}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTechs(new Set())}>
                                                {t('None', 'لا شيء')}
                                            </button>
                                        </div>
                                    </div>

                                    {techsLoading ? (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                                            ⏳ {t('Loading technicians...', 'جارٍ تحميل الفنيين...')}
                                        </p>
                                    ) : technicians.length === 0 ? (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                                            {t('No users found in this department.', 'لا يوجد مستخدمون في هذا القسم.')}
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                                            {technicians.map(tech => {
                                                const checked = selectedTechs.has(tech.id);
                                                return (
                                                    <label key={tech.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '10px 14px',
                                                        background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)',
                                                        border: `1px solid ${checked ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer', transition: 'all 150ms',
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            style={{ accentColor: '#6366f1', width: 16, height: 16 }}
                                                            onChange={() => {
                                                                setSelectedTechs(prev => {
                                                                    const next = new Set(prev);
                                                                    if (checked) next.delete(tech.id);
                                                                    else next.add(tech.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: checked ? 600 : 400, fontSize: 14 }}>{tech.name}</div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rolesMap[tech.roleId] || tech.roleName || 'Technician'}</div>
                                                        </div>
                                                        {checked && <span style={{ fontSize: 16 }}>✅</span>}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('Notes (applies to all)', 'ملاحظات (لجميع الفنيين)')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('Optional notes...', 'ملاحظات اختيارية...')}
                                        value={assignNotes}
                                        onChange={e => setAssignNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>{t('Cancel', 'إلغاء')}</button>
                                <button
                                    className="btn btn-primary"
                                    disabled={selectedTechs.size === 0 || assignLoading}
                                    onClick={handleAssign}
                                >
                                    {assignLoading
                                        ? `⏳ ${t('Assigning...', 'جارٍ التعيين...')}`
                                        : `✅ ${t('Assign', 'تعيين')} (${selectedTechs.size})`
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
