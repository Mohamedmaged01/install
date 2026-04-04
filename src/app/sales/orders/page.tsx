'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrders, getDepartments, getBranches, deleteOrder } from '@/lib/endpoints';
import { Order, OrderStatus, Department, Branch, getOrderStatusLabel } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS } from '@/context/RoleContext';
import Pagination from '@/components/Pagination';

const allStatuses: OrderStatus[] = [
    'Draft', 'PendingSalesApproval', 'PendingSupervisorApproval',
    'ReadyForInstallation', 'ReturnedToDraft', 'ReturnedToSales', 'Complete', 'Canceled',
];

export default function SalesOrdersPage() {
    const { lang, t } = useLang();
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

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
                    branchId: branchFilter || undefined,
                    departmentId: deptFilter || undefined,
                    status: statusFilter || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
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
    }, [statusFilter, deptFilter, branchFilter, dateFrom, dateTo]);

    const handleDeleteOrder = async (id: number, orderNum: string) => {
        if (!confirm(t(`Are you sure you want to delete order ${orderNum}?`, `هل أنت متأكد من حذف الطلب ${orderNum}؟`))) return;
        try {
            await deleteOrder(id);
            setOrders(prev => prev.filter(o => o.id !== id));
        } catch (err) {
            alert(err instanceof Error ? err.message : t('Failed to delete order', 'فشل حذف الطلب'));
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
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
        </PermissionGuard>
    );
}
