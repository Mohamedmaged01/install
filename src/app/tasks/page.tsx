'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyTasks, getBranches, getTaskStatistics } from '@/lib/endpoints';
import { Task, TaskStatus, Branch } from '@/types';
import { useLang } from '@/context/LanguageContext';

const TASK_LABELS: Record<TaskStatus, { en: string; ar: string }> = {
    Assigned: { en: 'Assigned', ar: 'مُعيَّن' },
    Accepted: { en: 'Accepted', ar: 'مقبول' },
    Enroute: { en: 'En Route', ar: 'في الطريق' },
    Onsite: { en: 'On Site', ar: 'في الموقع' },
    InProgress: { en: 'In Progress', ar: 'قيد التنفيذ' },
    Completed: { en: 'Completed', ar: 'مكتمل' },
    Returned: { en: 'Returned', ar: 'مُرتجع' },
    OnHold: { en: 'On Hold', ar: 'معلق' },
};

const STATUS_COLORS: Record<TaskStatus, string> = {
    Assigned: '#f59e0b', Accepted: '#3b82f6', Enroute: '#8b5cf6',
    Onsite: '#06b6d4', InProgress: '#3b82f6', Completed: '#10b981',
    Returned: '#ef4444', OnHold: '#64748b',
};

const allStatuses = Object.keys(TASK_LABELS) as TaskStatus[];

export default function TasksPage() {
    const { lang, t } = useLang();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stats, setStats] = useState<import('@/types').TaskStatistics | null>(null);

    useEffect(() => {
        getBranches().then(setBranches).catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        getMyTasks({ branchId: branchFilter || undefined }).then(data => {
            setTasks(Array.isArray(data) ? data : []);
        }).catch(() => setTasks([])).finally(() => setLoading(false));
    }, [branchFilter]);

    useEffect(() => {
        getTaskStatistics({
            branchId: branchFilter || undefined,
            from: dateFrom || undefined,
            to: dateTo || undefined,
        }).then(s => setStats(s)).catch(() => {});
    }, [branchFilter, dateFrom, dateTo]);

    const taskLabel = (s: TaskStatus) => lang === 'ar' ? TASK_LABELS[s].ar : TASK_LABELS[s].en;

    const filtered = tasks.filter(task => {
        if (statusFilter && task.status !== statusFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            const orderId = String(task.installationOrderId || task.orderId || '');
            if (!orderId.includes(q) && !(task.city || '').toLowerCase().includes(q) && !(task.address || '').toLowerCase().includes(q) && !(task.customerName || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>🔧 {t('Tasks', 'المهام')}</h1>
                    <p>{t('All installation tasks', 'جميع مهام التركيب')}</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>📋</div>
                    <div><div className="stat-value">{stats?.totalTasks ?? tasks.length}</div><div className="stat-label">{t('Total', 'المجموع')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>📌</div>
                    <div><div className="stat-value">{stats?.assigned ?? 0}</div><div className="stat-label">{t('Assigned', 'مُعيَّن')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>🚗</div>
                    <div><div className="stat-value">{stats?.enroute ?? 0}</div><div className="stat-label">{t('En Route', 'في الطريق')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#06b6d420', color: '#06b6d4' }}>📍</div>
                    <div><div className="stat-value">{stats?.onsite ?? 0}</div><div className="stat-label">{t('On Site', 'في الموقع')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>⚡</div>
                    <div><div className="stat-value">{stats?.inProgress ?? 0}</div><div className="stat-label">{t('In Progress', 'قيد التنفيذ')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}>✅</div>
                    <div><div className="stat-value">{stats?.completed ?? 0}</div><div className="stat-label">{t('Completed', 'مكتملة')}</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#64748b20', color: '#64748b' }}>⏸️</div>
                    <div><div className="stat-value">{stats?.hold ?? 0}</div><div className="stat-label">{t('On Hold', 'معلق')}</div></div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        placeholder={`🔍 ${t('Search by order, city, address...', 'ابحث بالطلب، المدينة، العنوان...')}`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, minWidth: 200 }}
                    />
                    <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 140 }}>
                        <option value="">{t('All Branches', 'جميع الفروع')}</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | '')} style={{ minWidth: 160 }}>
                        <option value="">{t('All Statuses', 'جميع الحالات')}</option>
                        {allStatuses.map(s => <option key={s} value={s}>{taskLabel(s)}</option>)}
                    </select>
                    <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: 150 }} title={t('From', 'من')} />
                    <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minWidth: 150 }} title={t('To', 'إلى')} />
                    {(branchFilter || statusFilter || search || dateFrom || dateTo) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter(''); setStatusFilter(''); setSearch(''); setDateFrom(''); setDateTo(''); }}>
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
                            <th>{t('Task', 'المهمة')}</th>
                            <th>{t('Order', 'الطلب')}</th>
                            <th>{t('Location', 'الموقع')}</th>
                            <th>{t('Priority', 'الأولوية')}</th>
                            <th>{t('Status', 'الحالة')}</th>
                            <th>{t('Notes', 'الملاحظات')}</th>
                            <th>{t('Actions', 'الإجراءات')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>{t('Loading tasks...', 'جارٍ تحميل المهام...')}</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>🔧</div>
                                    <div style={{ fontWeight: 600 }}>{t('No tasks found', 'لا توجد مهام')}</div>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(task => {
                                const orderId = task.installationOrderId || task.orderId;
                                const statusColor = STATUS_COLORS[task.status] || '#94a3b8';
                                return (
                                    <tr key={task.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>#{task.id}</div>
                                            {task.scheduledDate && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(task.scheduledDate).toLocaleDateString()}</div>}
                                        </td>
                                        <td>
                                            {orderId ? (
                                                <Link href={`/orders/${orderId}`} style={{ color: 'var(--accent-primary-hover)', fontWeight: 500 }}>
                                                    {t('Order', 'طلب')} #{orderId}
                                                </Link>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13 }}>{task.city || '—'}</div>
                                            {task.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.address}</div>}
                                        </td>
                                        <td>
                                            {task.priority ? (
                                                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, fontWeight: 600, color: task.priority === 'Urgent' ? '#ef4444' : '#10b981', background: task.priority === 'Urgent' ? '#ef444415' : '#10b98115' }}>
                                                    {task.priority === 'Urgent' ? `🔴 ${t('Urgent', 'عاجل')}` : `🟢 ${t('Normal', 'عادي')}`}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
                                                {taskLabel(task.status)}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 180 }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {task.notes || '—'}
                                            </div>
                                        </td>
                                        <td>
                                            <Link href={`/tasks/${task.id}`} className="btn btn-secondary btn-sm">{t('View', 'عرض')}</Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
