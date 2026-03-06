'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrders, approveSalesManager, rejectOrder } from '@/lib/endpoints';
import { Order } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';

export default function ManagerPage() {
    const { lang, t } = useLang();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [rejectModal, setRejectModal] = useState<Order | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [toast, setToast] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    const showToast = (type: 'error' | 'success', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 6000);
    };

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await getOrders({ status: 'PendingSalesApproval' });
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load pending orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    const handleApprove = async (id: number) => {
        setActionLoading(id);
        try {
            await approveSalesManager(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            showToast('success', t('Order approved successfully!', 'تم اعتماد الطلب بنجاح!'));
        } catch (err) {
            console.error('Approve error:', err);
            const msg = err instanceof Error ? err.message : t('Approval failed', 'فشل الاعتماد');
            showToast('error', msg);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.id);
        try {
            await rejectOrder(rejectModal.id, rejectReason || t('No reason provided', 'لم يتم تقديم سبب'));
            setOrders(prev => prev.filter(o => o.id !== rejectModal.id));
            setRejectModal(null);
            setRejectReason('');
            showToast('success', t('Order rejected.', 'تم رفض الطلب.'));
        } catch (err) {
            console.error('Reject error:', err);
            const msg = err instanceof Error ? err.message : t('Rejection failed', 'فشل الرفض');
            showToast('error', msg);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="animate-in">

            {/* Toast Banner */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    maxWidth: 420,
                    backdropFilter: 'blur(8px)',
                    animation: 'slideIn 200ms ease',
                }}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span style={{ flex: 1 }}>{toast.msg}</span>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
            )}

            <div className="page-header">
                <h1>{t('Pending Approvals', 'الموافقات المعلقة')}</h1>
                <p>{t('Orders waiting for Sales Manager approval', 'أوامر بانتظار موافقة مدير المبيعات')}</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>⏳</div>
                    <div>
                        <div className="stat-value">{orders.length}</div>
                        <div className="stat-label">{t('Pending', 'معلق')}</div>
                    </div>
                </div>
            </div>

            {
                loading ? (
                    <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
                        {t('Loading orders...', 'جارٍ تحميل الأوامر...')}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: '40vh' }}>
                        <div className="empty-state-icon">✅</div>
                        <h3>{t('No pending approvals', 'لا توجد موافقات معلقة')}</h3>
                        <p>{t('All orders have been processed', 'تمت معالجة جميع الأوامر')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {orders.map(order => (
                            <div key={order.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <Link href={`/orders/${order.id}`} style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary-hover)' }}>
                                                {order.orderNumber || `#${order.id}`}
                                            </Link>
                                            <StatusBadge status={order.status} lang={lang} />
                                            <PriorityBadge priority={order.priority} />
                                        </div>
                                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                            {t('Customer', 'العميل')}: <strong>{order.customerName || '—'}</strong> • {t('City', 'المدينة')}: {order.city || '—'}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {order.invoiceId ? `${t('Invoice', 'فاتورة')}: ${order.invoiceId}` : order.quotationId ? `${t('Quotation', 'عرض سعر')}: ${order.quotationId}` : t('No document ref', 'بدون مرجع')}
                                            {' • '}{order.departmentName || `Dept #${order.departmentId}`}
                                            {' • '}{t('Created', 'تاريخ الإنشاء')}: {new Date(order.createdAt).toLocaleDateString()}
                                        </div>
                                        {order.notes && (
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                                💬 {order.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div className="btn-group">
                                        <button
                                            className="btn btn-success btn-sm"
                                            disabled={actionLoading === order.id}
                                            onClick={() => handleApprove(order.id)}
                                        >
                                            {actionLoading === order.id ? '⏳' : '✅'} {t('Approve', 'اعتماد')}
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            disabled={actionLoading === order.id}
                                            onClick={() => { setRejectModal(order); setRejectReason(''); }}
                                        >
                                            ❌ {t('Reject', 'رفض')}
                                        </button>
                                        <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t('View Details', 'عرض التفاصيل')}</Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Reject Modal */}
            {
                rejectModal && (
                    <div className="modal-overlay" onClick={() => setRejectModal(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>❌ {t('Reject Order', 'رفض الطلب')}</h2>
                                <button className="modal-close" onClick={() => setRejectModal(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    {t('Rejecting order', 'رفض الطلب')} <strong>{rejectModal.orderNumber || `#${rejectModal.id}`}</strong>
                                </p>
                                <div className="form-group">
                                    <label className="form-label">{t('Rejection Reason', 'سبب الرفض')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('Enter reason for rejection...', 'أدخل سبب الرفض...')}
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{t('Cancel', 'إلغاء')}</button>
                                <button className="btn btn-danger" disabled={actionLoading !== null} onClick={handleReject}>
                                    {actionLoading ? `⏳ ${t('Rejecting...', 'جارٍ الرفض...')}` : `❌ ${t('Confirm Reject', 'تأكيد الرفض')}`}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
