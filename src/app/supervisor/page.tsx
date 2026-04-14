'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOrders, approveSupervisor, rejectOrder, getDepartmentUsers, assignTask, getRoles, getDepartments, getBranches, getBranchTechnicians, getOrderById } from '@/lib/endpoints';
import { Order, DepartmentUser, Department, Branch, AssignTaskDto, Role } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS } from '@/context/RoleContext';
import Pagination from '@/components/Pagination';

export default function SupervisorPage() {
    const { lang, t } = useLang();
    const toast = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [technicians, setTechnicians] = useState<DepartmentUser[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignModal, setAssignModal] = useState<Order | null>(null);
    const [selectedTechs, setSelectedTechs] = useState<Set<number>>(new Set());
    const [isApproveWorkflow, setIsApproveWorkflow] = useState(false);
    const [assignNotes, setAssignNotes] = useState('');
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [rolesMap, setRolesMap] = useState<Record<number, string>>({});
    const [statusFilter, setStatusFilter] = useState<string>('PendingInstallationSupervisorApproval');
    const [deptFilter, setDeptFilter] = useState<number | ''>('');
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [appliedFilters, setAppliedFilters] = useState<{ statusFilter: string; deptFilter: number | ''; branchFilter: number | '' }>({ statusFilter: 'PendingInstallationSupervisorApproval', deptFilter: '', branchFilter: '' });
    const [rejectModal, setRejectModal] = useState<Order | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        async function load() {
            try {
                const [b, d] = await Promise.all([getBranches(), getDepartments()]);
                setBranches(b);
                setDepartments(d);
            } catch (err) {
                console.error(err);
            }
        }
        load();
    }, []);

    useEffect(() => {
        async function loadOrders() {
            setLoading(true);
            try {
                const params: Record<string, unknown> = {};
                if (appliedFilters.statusFilter) params.status = appliedFilters.statusFilter;
                if (appliedFilters.deptFilter) params.departmentId = appliedFilters.deptFilter;
                if (appliedFilters.branchFilter) params.branchId = appliedFilters.branchFilter;
                const data = await getOrders(params as Parameters<typeof getOrders>[0]);
                setOrders(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadOrders();
    }, [appliedFilters]);

    const handleApprove = async (order: Order) => {
        openAssignModal(order, true);
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.id);
        try {
            await rejectOrder(rejectModal.id, rejectReason || t('No reason provided', 'لم يتم تقديم سبب'));
            setOrders(prev => prev.filter(o => o.id !== rejectModal.id));
            setRejectModal(null);
            setRejectReason('');
            toast.success( t('Order returned to Sales', 'تمت إعادة الطلب للمبيعات'));
        } catch (err) {
            console.error('Reject error:', err);
            toast.error( err instanceof Error ? err.message : t('Rejection failed', 'فشل الرفض'));
        } finally {
            setActionLoading(null);
        }
    };

    const openAssignModal = async (order: Order, isApprove: boolean = false) => {
        setAssignModal(order);
        setIsApproveWorkflow(isApprove);
        setAssignNotes('');
        setSelectedTechs(new Set());
        try {
            // Failsafe: if the list view payload doesn't include the branches,
            // fetch the full order details.
            let branchIds = order.branches?.map(b => b.id) || [];
            let dId = order.departmentId;

            if (isApprove && branchIds.length === 0) {
                const fullOrder = await getOrderById(order.id);
                branchIds = fullOrder.branches?.map(b => b.id) || [];
                dId = fullOrder.departmentId;
            }

            const branchTechsPromise = branchIds.length > 0 
                ? Promise.all(branchIds.map(id => getBranchTechnicians(id))).then(res => res.flat()) 
                : Promise.resolve([]);
            const deptTechsPromise = getDepartmentUsers(undefined, dId);

            const [users, allRoles] = await Promise.all([
                isApprove ? branchTechsPromise : deptTechsPromise,
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
        }
    };

    const handleAssign = async () => {
        if (!assignModal || selectedTechs.size === 0) return;
        setActionLoading(assignModal.id);
        try {
            if (isApproveWorkflow) {
                const techIds = Array.from(selectedTechs);
                const whatsappUrl = await approveSupervisor(assignModal.id, techIds, assignNotes || null);
                if (whatsappUrl) window.open(whatsappUrl, '_blank');
            } else {
                // Assign a task for each selected technician in parallel
                await Promise.all(
                    Array.from(selectedTechs).map(techId => {
                        const dto: AssignTaskDto = {
                            orderId: assignModal.id,
                            technicianId: techId,
                            notes: assignNotes || null,
                        };
                        return assignTask(dto);
                    })
                );
            }
            setAssignModal(null);
            toast.success( isApproveWorkflow
                ? t('Order approved and technicians assigned', 'تم الموافقة على الطلب وتعيين الفنيين')
                : t('Technicians assigned', 'تم تعيين الفنيين'));

            const data = await getOrders();
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Assign error:', err);
            toast.error( err instanceof Error ? err.message : t('Failed to assign', 'فشل التعيين'));
        } finally {
            setActionLoading(null);
        }
    };

    const pendingCount = orders.filter(o => o.status === 'PendingInstallationSupervisorApproval').length;
    const readyCount = orders.filter(o => o.status === 'ReadyForInstallation').length;

    return (
        <PermissionGuard requiredPerms={[PERMS.ORDERS_APPROVE_SUPERVISOR]}>
            <div className="animate-in">

                <div className="page-header">
                    <h1>{t('Installation Supervisor', 'مشرف تركيبات')}</h1>
                    <p>{t('Review orders, assign technicians, and manage installations', 'مراجعة الأوامر، تعيين الفنيين، وإدارة التركيبات')}</p>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>👷</div>
                        <div><div className="stat-value">{pendingCount}</div><div className="stat-label">{t('Pending Review', 'بانتظار المراجعة')}</div></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>🔧</div>
                        <div><div className="stat-value">{readyCount}</div><div className="stat-label">{t('Ready for Installation', 'جاهز للتركيب')}</div></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>📋</div>
                        <div><div className="stat-value">{orders.length}</div><div className="stat-label">{t('Total', 'المجموع')}</div></div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 160 }}>
                            <option value="">{t('All Branches', 'جميع الفروع')}</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select className="form-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 160 }}>
                            <option value="">{t('All Departments', 'جميع الأقسام')}</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 200 }}>
                            <option value="">{t('All Statuses', 'جميع الحالات')}</option>
                            <option value="PendingInstallationSupervisorApproval">{t('Pending Supervisor', 'بانتظار المشرف')}</option>
                            <option value="ReadyForInstallation">{t('Ready for Installation', 'جاهز للتركيب')}</option>
                            <option value="ReturnedToSales">{t('Returned to Sales', 'مُرتجع للمبيعات')}</option>
                            <option value="Completed">{t('Completed', 'مكتمل')}</option>
                            <option value="Canceled">{t('Canceled', 'ملغي')}</option>
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={() => { setAppliedFilters({ statusFilter, deptFilter, branchFilter }); setPage(1); }}>
                            {t('Apply', 'تطبيق')}
                        </button>
                        {(appliedFilters.branchFilter || appliedFilters.deptFilter || branchFilter || deptFilter) && (
                            <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter(''); setDeptFilter(''); setStatusFilter('PendingInstallationSupervisorApproval'); setAppliedFilters({ statusFilter: 'PendingInstallationSupervisorApproval', deptFilter: '', branchFilter: '' }); setPage(1); }}>
                                {t('Clear', 'مسح')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Orders Table */}
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Order', 'الطلب')}</th>
                                <th>{t('Customer', 'العميل')}</th>
                                <th>{t('Department', 'القسم')}</th>
                                <th>{t('Status', 'الحالة')}</th>
                                <th>{t('Date', 'التاريخ')}</th>
                                <th>{t('Actions', 'الإجراءات')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>{t('Loading...', 'جارٍ التحميل...')}</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48 }}>
                                    <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                                    <div style={{ fontWeight: 600 }}>{t('No orders found', 'لا توجد أوامر')}</div>
                                </td></tr>
                            ) : (
                                orders.slice((page - 1) * pageSize, page * pageSize).map(order => (
                                    <tr key={order.id}>
                                        <td>
                                            <Link href={`/orders/${order.id}`} className="table-cell-main" style={{ color: 'var(--accent-primary-hover)' }}>
                                                {order.orderNumber || `#${order.id}`}
                                            </Link>
                                        </td>
                                        <td>{order.customerName || '—'}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.city}</div></td>
                                        <td>{order.departmentName || `#${order.departmentId}`}</td>
                                        <td><StatusBadge status={order.status} lang={lang} /></td>
                                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="btn-group">
                                                {order.status === 'PendingInstallationSupervisorApproval' && (
                                                    <>
                                                        <button className="btn btn-success btn-sm" disabled={actionLoading === order.id} onClick={() => handleApprove(order)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {actionLoading === order.id ? '⏳' : '✅'} {t('Approve', 'اعتماد')}
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" disabled={actionLoading === order.id} onClick={() => { setRejectModal(order); setRejectReason(''); }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            ↩️ {t('Return', 'إرجاع')}
                                                        </button>
                                                    </>
                                                )}
                                                <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👁️ {t('View', 'عرض')}</Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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

                {/* Assign Modal */}
                {assignModal && (
                    <div className="modal-overlay" onClick={() => setAssignModal(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{t('Assign Technicians', 'تعيين فنيين')}</h2>
                                <button className="modal-close" onClick={() => setAssignModal(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    {t('Select one or more technicians for order', 'اختر فنياً أو أكثر للطلب')} <strong>{assignModal.orderNumber || `#${assignModal.id}`}</strong>
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
                                    {technicians.length === 0 ? (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                                            {t('No technicians found in this department.', 'لا يوجد فنيون في هذا القسم.')}
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                                            {technicians.map((tech, idx) => {
                                                const checked = selectedTechs.has(tech.id);
                                                return (
                                                    <label key={`${tech.id}-${idx}`} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '10px 14px',
                                                        background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)',
                                                        border: `1px solid ${checked ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer',
                                                        transition: 'all 150ms',
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
                                    <textarea className="form-textarea" placeholder={t('Optional assignment notes...', 'ملاحظات اختيارية...')} value={assignNotes} onChange={e => setAssignNotes(e.target.value)} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>{t('Cancel', 'إلغاء')}</button>
                                <button className="btn btn-primary" disabled={selectedTechs.size === 0 || actionLoading !== null} onClick={handleAssign}>
                                    {actionLoading
                                        ? `⏳ ${t('Assigning...', 'جارٍ التعيين...')}`
                                        : `👤 ${t('Assign', 'تعيين')} (${selectedTechs.size})`
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reject/Return Modal */}
                {rejectModal && (
                    <div className="modal-overlay" onClick={() => setRejectModal(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>↩ {t('Return / Reject Order', 'إرجاع / رفض الطلب')}</h2>
                                <button className="modal-close" onClick={() => setRejectModal(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    {t('Order', 'الطلب')} <strong>{rejectModal.orderNumber || `#${rejectModal.id}`}</strong>
                                </p>
                                <div className="form-group">
                                    <label className="form-label">{t('Reason', 'السبب')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('Enter reason...', 'أدخل السبب...')}
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{t('Cancel', 'إلغاء')}</button>
                                <button className="btn btn-danger" disabled={actionLoading !== null} onClick={handleReject}>
                                    {actionLoading ? '⏳' : '↩'} {t('Confirm Return', 'تأكيد الإرجاع')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGuard>
    );
}
