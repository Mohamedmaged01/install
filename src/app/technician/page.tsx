'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyTasks, updateTaskStatus, getTaskHistory, getTaskStatistics, getBranches, getDepartments } from '@/lib/endpoints';
import { Task, TaskStatus, TaskHistoryEntry, Branch, Department } from '@/types';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/RoleContext';

const activeStatuses: TaskStatus[] = ['Assigned', 'Accepted', 'Enroute', 'Onsite', 'InProgress', 'OnHold'];
const doneStatuses: TaskStatus[] = ['Completed', 'Returned'];
const allStatuses: TaskStatus[] = ['Assigned', 'Accepted', 'Enroute', 'Onsite', 'InProgress', 'Completed', 'Returned', 'OnHold'];

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

type TaskTab = 'notes' | 'timeline';

export default function TechnicianPage() {
    const { lang, t } = useLang();
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTask, setExpandedTask] = useState<number | null>(null);
    const [activeTaskTab, setActiveTaskTab] = useState<Record<number, TaskTab>>({});
    const [taskHistories, setTaskHistories] = useState<Record<number, TaskHistoryEntry[]>>({});
    const [historyLoading, setHistoryLoading] = useState<Record<number, boolean>>({});

    // Filters
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branchFilter, setBranchFilter] = useState<number | ''>('');
    const [deptFilter, setDeptFilter] = useState<number | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statsLoading, setStatsLoading] = useState(false);
    const [filteredStats, setFilteredStats] = useState<{ total: number; active: number; completed: number } | null>(null);

    // Status modal
    const [statusModal, setStatusModal] = useState<Task | null>(null);
    const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
    const [statusNotes, setStatusNotes] = useState('');
    const [statusError, setStatusError] = useState('');
    const [completionImage, setCompletionImage] = useState<File | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await getMyTasks();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
        getBranches().then(setBranches).catch(() => {});
        getDepartments().then(setDepartments).catch(() => {});
    }, []);

    useEffect(() => {
        if (!branchFilter && !deptFilter && !dateFrom && !dateTo) {
            setFilteredStats(null);
            return;
        }
        setStatsLoading(true);
        getTaskStatistics({
            branchIds: branchFilter ? [Number(branchFilter)] : undefined,
            departmentIds: deptFilter ? [Number(deptFilter)] : undefined,
            from: dateFrom || undefined,
            to: dateTo || undefined,
        }).then(s => {
            setFilteredStats({
                total: s.total ?? s.totalTasks ?? 0,
                active: s.active ?? s.assigned ?? 0,
                completed: s.completed ?? 0,
            });
        }).catch(() => {}).finally(() => setStatsLoading(false));
    }, [branchFilter, deptFilter, dateFrom, dateTo]);

    const loadHistory = async (taskId: number) => {
        if (taskHistories[taskId]) return;
        setHistoryLoading(prev => ({ ...prev, [taskId]: true }));
        try {
            const h = await getTaskHistory(taskId);
            setTaskHistories(prev => ({ ...prev, [taskId]: h }));
        } catch {
            setTaskHistories(prev => ({ ...prev, [taskId]: [] }));
        } finally {
            setHistoryLoading(prev => ({ ...prev, [taskId]: false }));
        }
    };

    const setTaskTab = (taskId: number, tab: TaskTab) => {
        setActiveTaskTab(prev => ({ ...prev, [taskId]: tab }));
        if (tab === 'timeline') loadHistory(taskId);
    };

    const handleStatusUpdate = async () => {
        if (!statusModal || !pendingStatus) return;
        setActionLoading(true);
        setStatusError('');
        try {
            await updateTaskStatus(statusModal.id, {
                newStatus: pendingStatus,
                note: statusNotes || null,
                imageFiles: completionImage ? [completionImage] : undefined,
            });
            // Clear cached history so it reloads fresh
            setTaskHistories(prev => { const n = { ...prev }; delete n[statusModal.id]; return n; });
            await loadTasks();
            setStatusModal(null);
            setPendingStatus(null);
            setStatusNotes('');
            setCompletionImage(null);
        } catch (err) {
            setStatusError(err instanceof Error ? err.message : t('Failed to update status', 'فشل تحديث الحالة'));
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status: TaskStatus) => {
        const colors: Record<TaskStatus, string> = {
            Assigned: '#f59e0b', Accepted: '#3b82f6', Enroute: '#8b5cf6',
            Onsite: '#06b6d4', InProgress: '#3b82f6', Completed: '#10b981',
            Returned: '#ef4444', OnHold: '#64748b',
        };
        return colors[status] || '#94a3b8';
    };

    const taskLabel = (status: TaskStatus) => lang === 'ar' ? TASK_LABELS[status].ar : TASK_LABELS[status].en;

    const activeTasks = tasks.filter(t => activeStatuses.includes(t.status));
    const completedTasks = tasks.filter(t => doneStatuses.includes(t.status));

    const hasFilters = branchFilter || deptFilter || dateFrom || dateTo;

    if (loading) {
        return (
            <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>🔧</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{t('Loading tasks...', 'جارٍ تحميل المهام...')}</p>
                </div>
            </div>
        );
    }

    const renderTaskCard = (task: Task, isDone = false) => {
        const t_orderId = (task as any).installationOrderId || task.orderId || (task as any).OrderId || 0;
        const t_orderNumber = task.orderNumber || (task as any).OrderNumber || (task as any).orderCode;
        const t_customer = task.customerName || (task as any).CustomerName || (task as any).order?.customerName || '—';
        const currentTab = activeTaskTab[task.id] || 'notes';
        const history = taskHistories[task.id] || [];

        return (
            <div key={task.id} className="card" style={{
                marginBottom: isDone ? 12 : 16,
                padding: 20,
                opacity: isDone ? 0.85 : 1,
                transition: 'all 0.2s ease',
                border: expandedTask === task.id ? '2px solid var(--accent-primary)' : isDone ? '1px solid #10b98140' : '1px solid var(--border)',
                borderLeft: isDone ? '4px solid #10b981' : undefined,
                cursor: 'pointer',
            }} onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                {t_orderNumber || (t_orderId ? `${t('Order', 'طلب')} #${t_orderId}` : `${t('Task', 'مهمة')} #${task.id}`)}
                            </span>
                            {task.priority && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, color: task.priority === 'Urgent' ? '#ef4444' : '#10b981', background: task.priority === 'Urgent' ? '#ef444415' : '#10b98115' }}>
                                    {task.priority === 'Urgent' ? `🔴 ${t('Urgent', 'عاجل')}` : `🟢 ${t('Normal', 'عادي')}`}
                                </span>
                            )}
                            <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: getStatusColor(task.status), background: `${getStatusColor(task.status)}15`, border: `1px solid ${getStatusColor(task.status)}30` }}>
                                {taskLabel(task.status)}
                            </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t_customer !== '—' ? t_customer : ''}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {task.address && <div>📍 {task.address}</div>}
                            {task.city && <div>🏙️ {task.city}</div>}
                        </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', transform: expandedTask === task.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 8 }}>▼</div>
                </div>

                {/* Expanded */}
                {expandedTask === task.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
                            {(['notes', 'timeline'] as TaskTab[]).map(tab => (
                                <button key={tab} onClick={() => setTaskTab(task.id, tab)} style={{
                                    padding: '8px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                                    borderBottom: currentTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                    color: currentTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                                }}>
                                    {tab === 'notes' ? `📝 ${t('Notes', 'الملاحظات')}` : `📅 ${t('Timeline', 'السجل')}`}
                                </button>
                            ))}
                        </div>

                        {/* Notes Tab */}
                        {currentTab === 'notes' && (
                            <div>
                                {task.notes ? (
                                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: 14, background: 'var(--bg-tertiary)', borderLeft: '4px solid var(--accent-primary)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 16 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)', fontSize: 13 }}>{t('Assignment Notes', 'ملاحظات التعيين')}:</div>
                                        {task.notes}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{t('No notes for this task.', 'لا توجد ملاحظات لهذه المهمة.')}</p>
                                )}
                            </div>
                        )}

                        {/* Timeline Tab */}
                        {currentTab === 'timeline' && (
                            <div style={{ marginBottom: 16 }}>
                                {historyLoading[task.id] ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>⏳ {t('Loading...', 'جارٍ التحميل...')}</p>
                                ) : (
                                    <div className="timeline">
                                        {history.map((entry, i) => (
                                            <div key={i} className="timeline-item">
                                                <div className="timeline-dot info" />
                                                <div className="timeline-content">
                                                    <h4>
                                                        {entry.fromStatus ? (
                                                            <span><span style={{ color: '#94a3b8' }}>{entry.fromStatus}</span>{' → '}<strong>{entry.toStatus}</strong></span>
                                                        ) : (
                                                            <span>{t('Task Created', 'تم إنشاء المهمة')} → <strong>{entry.toStatus}</strong></span>
                                                        )}
                                                    </h4>
                                                    {entry.note && <p>{entry.note}</p>}
                                                    <div className="timeline-meta">
                                                        <span>👤 {entry.actionByUserName || '—'}</span>
                                                        <span>{entry.actionDate && !isNaN(new Date(entry.actionDate).getTime()) ? new Date(entry.actionDate).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {history.length === 0 && (
                                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('No history yet.', 'لا يوجد سجل بعد.')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStatusModal(task); setPendingStatus(null); setStatusNotes(''); setCompletionImage(null); setStatusError(''); }}>
                                🔄 {t('Update Status', 'تحديث الحالة')}
                            </button>
                            <Link href={t_orderId ? `/orders/${t_orderId}` : '#'} className={`btn btn-secondary ${!t_orderId ? 'disabled' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={e => { if (!t_orderId) e.preventDefault(); }}>
                                📄 {t('Full Details', 'التفاصيل الكاملة')}
                            </Link>
                            {user?.roleName?.toLowerCase() === 'technician' && (
                                <Link href="/qr/verify" className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }}>
                                    📱 {t('Scan QR', 'مسح QR')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-in" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center' }}>
                <h1>🔧 {t('My Tasks', 'مهامي')}</h1>
                <p>{t('Your assigned installation tasks', 'مهام التركيب الموكلة إليك')}</p>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 130 }}>
                        <option value="">{t('All Branches', 'جميع الفروع')}</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select className="form-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 140 }}>
                        <option value="">{t('All Departments', 'جميع الأقسام')}</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('From', 'من')}</label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: 140 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('To', 'إلى')}</label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minWidth: 140 }} />
                    </div>
                    {hasFilters && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter(''); setDeptFilter(''); setDateFrom(''); setDateTo(''); }}>
                            {t('Clear', 'مسح')}
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{statsLoading ? '…' : (filteredStats?.active ?? activeTasks.length)}</div>
                    <div className="stat-label">{t('Active', 'نشطة')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{statsLoading ? '…' : (filteredStats?.completed ?? completedTasks.length)}</div>
                    <div className="stat-label">{t('Done', 'منتهية')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{statsLoading ? '…' : (filteredStats?.total ?? tasks.length)}</div>
                    <div className="stat-label">{t('Total', 'المجموع')}</div>
                </div>
            </div>

            {/* Active Tasks */}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                📍 {t('Active Tasks', 'المهام النشطة')} ({activeTasks.length})
            </h2>
            {activeTasks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t('No active tasks', 'لا توجد مهام نشطة')}</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t("You're all caught up!", 'لقد أنجزت كل شيء!')}</p>
                </div>
            ) : (
                activeTasks.map(task => renderTaskCard(task, false))
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
                <>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16 }}>
                        ✅ {t('Completed', 'المنتهية')} ({completedTasks.length})
                    </h2>
                    {completedTasks.map(task => renderTaskCard(task, true))}
                </>
            )}

            {/* Status Modal */}
            {statusModal && (
                <div className="modal-overlay" onClick={() => { setStatusModal(null); setPendingStatus(null); setStatusError(''); setCompletionImage(null); }}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('Update Task Status', 'تحديث حالة المهمة')}</h2>
                            <button className="modal-close" onClick={() => { setStatusModal(null); setPendingStatus(null); setStatusError(''); setCompletionImage(null); }}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {allStatuses.map(status => (
                                    <button key={status} disabled={actionLoading} style={{
                                        padding: '12px 16px',
                                        background: pendingStatus === status ? `${getStatusColor(status)}20` : 'var(--bg-tertiary)',
                                        border: pendingStatus === status ? `2px solid ${getStatusColor(status)}` : '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer',
                                        color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14,
                                    }} onClick={() => { setPendingStatus(status); setStatusError(''); }}>
                                        <span style={{ color: getStatusColor(status), fontWeight: 600 }}>● {taskLabel(status)}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Image upload — always available when a status is selected */}
                            {pendingStatus && (
                                <div className="form-group" style={{ marginTop: 16, padding: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)' }}>
                                    <label className="form-label">📷 {t('Attach Photo', 'إرفاق صورة')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('optional', 'اختياري')})</span></label>
                                    <input type="file" accept="image/*" capture="environment" className="form-input" style={{ padding: 8 }} onChange={e => setCompletionImage(e.target.files?.[0] ?? null)} />
                                    {completionImage && <div style={{ fontSize: 12, color: '#10b981', marginTop: 6 }}>✓ {completionImage.name}</div>}
                                </div>
                            )}

                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label className="form-label">📝 {t('Notes', 'ملاحظات')}</label>
                                <textarea className="form-textarea" rows={3} placeholder={t('Optional notes...', 'ملاحظات اختيارية...')} value={statusNotes} onChange={e => setStatusNotes(e.target.value)} />
                            </div>

                            {statusError && (
                                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13, marginTop: 12 }}>
                                    {statusError}
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={!pendingStatus || actionLoading} onClick={handleStatusUpdate}>
                                {actionLoading ? t('Updating...', 'جارٍ التحديث...') : t('Confirm Update', 'تأكيد التحديث')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
