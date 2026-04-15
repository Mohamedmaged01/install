'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrders, approveSalesManager, rejectOrder, getBranches, getDepartments } from '@/lib/endpoints';
import { Order, Branch, Department } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS } from '@/context/RoleContext';
import Pagination from '@/components/Pagination';

export default function ManagerPage() {
    const { lang, t } = useLang();
    const toast = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [rejectModal, setRejectModal] = useState<Order | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [deptFilter, setDeptFilter] = useState<number | ''>('');
    const [codeFilter, setCodeFilter] = useState('');
    const [appliedFilters, setAppliedFilters] = useState<{ branchFilter: number | ''; deptFilter: number | ''; code: string }>({ branchFilter: '', deptFilter: '', code: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        Promise.all([getBranches(), getDepartments()])
            .then(([b, d]) => { setBranches(b); setDepartments(d); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        const params: Record<string, unknown> = { status: 'PendingSalesSupervisorApproval' };
        if (appliedFilters.branchFilter) params.branchId = appliedFilters.branchFilter;
        if (appliedFilters.deptFilter) params.departmentId = appliedFilters.deptFilter;
        if (appliedFilters.code) params.code = appliedFilters.code;
        getOrders(params as Parameters<typeof getOrders>[0])
            .then(data => setOrders(Array.isArray(data) ? data : []))
            .catch(err => console.error('Failed to load pending orders:', err))
            .finally(() => setLoading(false));
    }, [appliedFilters]);

    const handleApprove = async (id: number) => {
        setActionLoading(id);
        try {
            await approveSalesManager(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            toast.success( t('Order approved successfully!', 'تم اعتماد الطلب بنجاح!'));
        } catch (err) {
            console.error('Approve error:', err);
            const msg = err instanceof Error ? err.message : t('Approval failed', 'فشل الاعتماد');
            toast.error( msg);
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
            toast.success( t('Order rejected.', 'تم رفض الطلب.'));
        } catch (err) {
            console.error('Reject error:', err);
            const msg = err instanceof Error ? err.message : t('Rejection failed', 'فشل الرفض');
            toast.error( msg);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <PermissionGuard requiredPerms={[PERMS.ORDERS_APPROVE_SALES]}>
            <div className="animate-in">

                <div className="page-header">
                    <h1>{t('Sales Supervisor', 'مشرف مبيعات')}</h1>
                    <p>{t('Orders waiting for Sales Supervisor approval', 'أوامر بانتظار موافقة مشرف المبيعات')}</p>
                </div>

                {/* Stats */}
                <div className="dashboard-stat-grid">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>⏳</div>
                        <div>
                            <div className="stat-value">{orders.length}</div>
                            <div className="stat-label">{t('Pending', 'معلق')}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                    <div className="dashboard-filters">
                        <input
                            className="form-input dashboard-filter-item"
                            placeholder={`🔍 ${t('Search by code...', 'البحث بالكود...')}`}
                            value={codeFilter}
                            onChange={e => setCodeFilter(e.target.value)}
                        />
                        <select className="form-select dashboard-filter-item" value={branchFilter} onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')}>
                            <option value="">{t('All Branches', 'جميع الفروع')}</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select className="form-select dashboard-filter-item" value={deptFilter} onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')}>
                            <option value="">{t('All Departments', 'جميع الأقسام')}</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => { setAppliedFilters({ branchFilter, deptFilter, code: codeFilter }); setPage(1); }}>
                                {t('Apply', 'تطبيق')}
                            </button>
                            {(appliedFilters.branchFilter || appliedFilters.deptFilter || appliedFilters.code || branchFilter || deptFilter || codeFilter) && (
                                <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter(''); setDeptFilter(''); setCodeFilter(''); setAppliedFilters({ branchFilter: '', deptFilter: '', code: '' }); setPage(1); }}>
                                    {t('Clear', 'مسح')}
                                </button>
                            )}
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
                        <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {orders.slice((page - 1) * pageSize, page * pageSize).map(order => (
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
                                                {actionLoading === order.id ? '⏳' : '✅'} <span className="btn-label">{t('Approve', 'اعتماد')}</span>
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                disabled={actionLoading === order.id}
                                                onClick={() => { setRejectModal(order); setRejectReason(''); }}
                                            >
                                                ❌ <span className="btn-label">{t('Reject', 'رفض')}</span>
                                            </button>
                                            <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">👁️ <span className="btn-label">{t('View Details', 'عرض التفاصيل')}</span></Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {orders.length > 0 && (
                            <Pagination
                                currentPage={page}
                                totalItems={orders.length}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        )}
                        </>
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
        </PermissionGuard>
    );
}
