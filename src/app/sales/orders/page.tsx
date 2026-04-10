'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrders, getDepartments, getBranches, deleteOrder, approveSalesManager, acceptFromOutside, rejectOrder } from '@/lib/endpoints';
import { Order, OrderStatus, Department, Branch, getOrderStatusLabel } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS, useAuth } from '@/context/RoleContext';
import Pagination from '@/components/Pagination';

const allStatuses: OrderStatus[] = [
    'Draft', 'PendingSalesApproval', 'PendingSupervisorApproval',
    'ReadyForInstallation', 'ReturnedToDraft', 'ReturnedToSales', 'Complete', 'Canceled',
];

export default function SalesOrdersPage() {
    const { lang, t } = useLang();
    const toast = useToast();
    const { hasPermission } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
    const [deptFilter, setDeptFilter] = useState<number | ''>('');
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [appliedFilters, setAppliedFilters] = useState<{ statusFilter: OrderStatus | ''; deptFilter: number | ''; branchFilter: number | ''; dateFrom: string; dateTo: string }>({ statusFilter: '', deptFilter: '', branchFilter: '', dateFrom: '', dateTo: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [returnModal, setReturnModal] = useState<Order | null>(null);
    const [returnReason, setReturnReason] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const [b, d] = await Promise.all([getBranches(), getDepartments()]);
                setBranches(b);
                setDepartments(d);
            } catch (err) {
                console.error('Failed to load filters:', err);
            }
        }
        load();
    }, []);

    useEffect(() => {
        async function loadOrders() {
            setLoading(true);
            try {
                const data = await getOrders({
                    branchId: appliedFilters.branchFilter || undefined,
                    departmentId: appliedFilters.deptFilter || undefined,
                    status: appliedFilters.statusFilter || undefined,
                    dateFrom: appliedFilters.dateFrom || undefined,
                    dateTo: appliedFilters.dateTo || undefined,
                });
                setOrders(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to load orders:', err);
                setOrders([]);
            } finally {
                setLoading(false);
            }
        }
        loadOrders();
    }, [appliedFilters]);

    const handleDeleteOrder = async (id: number, orderNum: string) => {
        if (!confirm(t(`Are you sure you want to delete order ${orderNum}?`, `هل أنت متأكد من حذف الطلب ${orderNum}؟`))) return;
        try {
            await deleteOrder(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            toast.success(t('Order deleted.', 'تم حذف الطلب.'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to delete order', 'فشل حذف الطلب'));
        }
    };

    const handleApprove = async (order: Order) => {
        if (!confirm(t('Approve this order?', 'هل تريد اعتماد هذا الطلب؟'))) return;
        setActionLoading(order.id);
        try {
            await approveSalesManager(order.id);
            setOrders(prev => prev.filter(o => o.id !== order.id));
            toast.success(t('Order approved successfully!', 'تم اعتماد الطلب بنجاح!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Approval failed', 'فشل الاعتماد'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleAcceptOutside = async (order: Order) => {
        if (!confirm(t('Accept this order from outside?', 'هل تريد قبول هذا الطلب من الخارج؟'))) return;
        setActionLoading(order.id);
        try {
            await acceptFromOutside(order.id);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Complete' as OrderStatus } : o));
            toast.success(t('Order accepted from outside', 'تم قبول الطلب من الخارج'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to accept from outside', 'فشل القبول من الخارج'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmReturn = async () => {
        if (!returnModal) return;
        setActionLoading(returnModal.id);
        try {
            await rejectOrder(returnModal.id, returnReason || t('No reason provided', 'لم يتم تقديم سبب'));
            setOrders(prev => prev.filter(o => o.id !== returnModal.id));
            setReturnModal(null);
            setReturnReason('');
            toast.success(t('Order returned.', 'تم إرجاع الطلب.'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Return failed', 'فشل الإرجاع'));
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = orders.filter(o => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (o.orderNumber || '').toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            (o.city || '').toLowerCase().includes(q) ||
            (o.invoiceId || '').toLowerCase().includes(q) ||
            (o.quotationId || '').toLowerCase().includes(q)
        );
    });

    return (
        <PermissionGuard requiredPerms={[PERMS.ORDERS_VIEW_BRANCH, PERMS.ORDERS_VIEW_ALL, PERMS.ORDERS_CREATE]}>
            <div className="animate-in">
                <div className="page-header">
                    <div>
                        <h1>{t('Installation Orders', 'أوامر التركيب')}</h1>
                        <p>{t('Manage all installation orders', 'إدارة جميع أوامر التركيب')}</p>
                    </div>
                    <Link href="/sales/orders/new" className="btn btn-primary">+ {t('New Order', 'طلب جديد')}</Link>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <input
                            className="form-input"
                            placeholder={`🔍 ${t('Search orders...', 'ابحث عن الأوامر...')}`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, minWidth: 200 }}
                        />
                        <select
                            className="form-select"
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')}
                            style={{ minWidth: 140 }}
                        >
                            <option value="">{t('All Branches', 'جميع الفروع')}</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <select
                            className="form-select"
                            value={deptFilter}
                            onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')}
                            style={{ minWidth: 160 }}
                        >
                            <option value="">{t('All Departments', 'جميع الأقسام')}</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as OrderStatus | '')}
                            style={{ minWidth: 180 }}
                        >
                            <option value="">{t('All Statuses', 'جميع الحالات')}</option>
                            {allStatuses.map(s => (
                                <option key={s} value={s}>{getOrderStatusLabel(s, lang)}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('From', 'من')}</label>
                            <input
                                type="date"
                                className="form-input"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                style={{ minWidth: 150 }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('To', 'إلى')}</label>
                            <input
                                type="date"
                                className="form-input"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                style={{ minWidth: 150 }}
                            />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => { setAppliedFilters({ statusFilter, deptFilter, branchFilter, dateFrom, dateTo }); setPage(1); }}>
                            {t('Apply', 'تطبيق')}
                        </button>
                        {(appliedFilters.statusFilter || appliedFilters.deptFilter || appliedFilters.branchFilter || appliedFilters.dateFrom || appliedFilters.dateTo || statusFilter || deptFilter || branchFilter || dateFrom || dateTo) && (
                            <button className="btn btn-secondary btn-sm" onClick={() => { setStatusFilter(''); setDeptFilter(''); setBranchFilter(''); setDateFrom(''); setDateTo(''); setAppliedFilters({ statusFilter: '', deptFilter: '', branchFilter: '', dateFrom: '', dateTo: '' }); setPage(1); }}>
                                {t('Clear', 'مسح')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Order', 'الطلب')}</th>
                                <th>{t('Customer', 'العميل')}</th>
                                <th>{t('Department', 'القسم')}</th>
                                <th>{t('Priority', 'الأولوية')}</th>
                                <th>{t('Status', 'الحالة')}</th>
                                <th>{t('Date', 'التاريخ')}</th>
                                <th>{t('Actions', 'الإجراءات')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                        {t('Loading orders...', 'جارٍ تحميل الأوامر...')}
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>
                                        <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('No orders found', 'لا توجد أوامر')}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {search || statusFilter || deptFilter
                                                ? t('Try adjusting your filters', 'حاول تعديل الفلاتر')
                                                : t('Create your first order to get started', 'أنشئ أول طلب للبدء')}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.slice((page - 1) * pageSize, page * pageSize).map(order => (
                                    <tr key={order.id}>
                                        <td>
                                            <Link href={`/orders/${order.id}`} className="table-cell-main" style={{ color: 'var(--accent-primary-hover)' }}>
                                                {order.orderNumber || `#${order.id}`}
                                            </Link>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {order.invoiceId ? `INV: ${order.invoiceId}` : order.quotationId ? `QT: ${order.quotationId}` : '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{order.customerName || '—'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.city || ''}</div>
                                        </td>
                                        <td>{order.departmentName || `#${order.departmentId}`}</td>
                                        <td><PriorityBadge priority={order.priority} /></td>
                                        <td><StatusBadge status={order.status} lang={lang} /></td>
                                        <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="btn-group">
                                                <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t('View', 'عرض')}</Link>
                                                {order.status === 'PendingSalesApproval' && (
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        disabled={actionLoading === order.id}
                                                        onClick={() => handleApprove(order)}
                                                    >
                                                        {actionLoading === order.id ? '⏳' : `✅ ${t('Approve', 'اعتماد')}`}
                                                    </button>
                                                )}
                                                {order.status === 'PendingSupervisorApproval' && (
                                                    <Link href={`/orders/${order.id}`} className="btn btn-success btn-sm">
                                                        ✅ {t('Approve & Assign', 'اعتماد وتعيين')}
                                                    </Link>
                                                )}
                                                {order.status === 'ReadyForInstallation' && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        disabled={actionLoading === order.id}
                                                        onClick={() => handleAcceptOutside(order)}
                                                    >
                                                        {actionLoading === order.id ? '⏳' : `🌐 ${t('Accept', 'قبول')}`}
                                                    </button>
                                                )}
                                                {hasPermission(PERMS.ORDERS_RETURN) && (
                                                    <button
                                                        className="btn btn-warning btn-sm"
                                                        disabled={actionLoading === order.id}
                                                        onClick={() => { setReturnModal(order); setReturnReason(''); }}
                                                    >
                                                        ↩️ {t('Return', 'إرجاع')}
                                                    </button>
                                                )}
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOrder(order.id, order.orderNumber || `#${order.id}`)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalItems={filtered.length}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                )}
            </div>

            {/* Return Modal */}
            {returnModal && (
                <div className="modal-overlay" onClick={() => setReturnModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>↩️ {t('Return Order', 'إرجاع الطلب')}</h2>
                            <button className="modal-close" onClick={() => setReturnModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                {t('Returning order', 'إرجاع الطلب')} <strong>{returnModal.orderNumber || `#${returnModal.id}`}</strong>
                            </p>
                            <div className="form-group">
                                <label className="form-label">{t('Return Reason', 'سبب الإرجاع')}</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder={t('Enter reason...', 'أدخل السبب...')}
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setReturnModal(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-warning" disabled={actionLoading !== null} onClick={handleConfirmReturn}>
                                {actionLoading ? `⏳ ${t('Returning...', 'جارٍ الإرجاع...')}` : `↩️ ${t('Confirm Return', 'تأكيد الإرجاع')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PermissionGuard>
    );
}
