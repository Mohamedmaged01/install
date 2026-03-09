'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyTasks, updateTaskStatus } from '@/lib/endpoints';
import { Task, TaskStatus } from '@/types';
import { useLang } from '@/context/LanguageContext';

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

export default function TechnicianPage() {
    const { lang, t } = useLang();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTask, setExpandedTask] = useState<number | null>(null);
    const [statusModal, setStatusModal] = useState<Task | null>(null);
    const [statusNotes, setStatusNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await getMyTasks();
            const arr = Array.isArray(data) ? data : [];
            setTasks(arr);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTasks(); }, []);

    const activeTasks = tasks.filter(t => activeStatuses.includes(t.status));
    const completedTasks = tasks.filter(t => doneStatuses.includes(t.status));

    const handleStatusUpdate = async (taskId: number, newStatus: TaskStatus) => {
        setActionLoading(true);
        try {
            await updateTaskStatus(taskId, { newStatus, notes: statusNotes || null, imagePath: null });
            await loadTasks();
            setStatusModal(null);
            setStatusNotes('');
        } catch (err) {
            alert(err instanceof Error ? err.message : t('Failed to update status', 'فشل تحديث الحالة'));
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status: TaskStatus) => {
        const colors: Record<TaskStatus, string> = {
            Assigned: '#f59e0b',
            Accepted: '#3b82f6',
            Enroute: '#8b5cf6',
            Onsite: '#06b6d4',
            InProgress: '#3b82f6',
            Completed: '#10b981',
            Returned: '#ef4444',
            OnHold: '#64748b',
        };
        return colors[status] || '#94a3b8';
    };

    const taskLabel = (status: TaskStatus) => lang === 'ar' ? TASK_LABELS[status].ar : TASK_LABELS[status].en;

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

    return (
        <div className="animate-in" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center' }}>
                <h1>🔧 {t('My Tasks', 'مهامي')}</h1>
                <p>{t('Your assigned installation tasks', 'مهام التركيب الموكلة إليك')}</p>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{activeTasks.length}</div>
                    <div className="stat-label">{t('Active', 'نشطة')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{completedTasks.length}</div>
                    <div className="stat-label">{t('Done', 'منتهية')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 24 }}>{tasks.length}</div>
                    <div className="stat-label">{t('Total', 'المجموع')}</div>
                </div>
            </div>

            {/* Active Tasks */}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                📍 {t('Active Tasks', 'المهام النشطة')} ({activeTasks.length})
            </h2>

            {activeTasks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t('No active tasks', 'لا توجد مهام نشطة')}</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t("You're all caught up!", 'لقد أنجزت كل شيء!')}</p>
                </div>
            ) : (
                activeTasks.map(task => {
                    const t_orderId = (task as any).installationOrderId || task.orderId || (task as any).OrderId || (task as any).order?.id || (task as any).order?.Id || 0;
                    const t_orderNumber = task.orderNumber || (task as any).OrderNumber || (task as any).order?.orderNumber || (task as any).order?.OrderNumber || (task as any).orderCode || (task as any).OrderCode;
                    const t_customer = task.customerName || (task as any).CustomerName || (task as any).order?.customerName || (task as any).order?.CustomerName || (task as any).customer?.name || (task as any).customer?.Name || (task as any).clientName || (task as any).order?.clientName || '—';
                    const t_dept = task.departmentName || (task as any).DepartmentName || (task as any).order?.departmentName || (task as any).order?.DepartmentName || (task as any).department?.name || '—';
                    const t_date = task.scheduledDate || (task as any).ScheduledDate || (task as any).order?.scheduledDate || (task as any).order?.ScheduledDate;

                    return (
                        <div key={task.id} className="card" style={{ marginBottom: 16, cursor: 'pointer', padding: 20, transition: 'all 0.2s ease', border: expandedTask === task.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)' }} onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                                            {t_orderNumber || (t_orderId ? `${t('Order', 'طلب')} #${t_orderId}` : `${t('Task', 'مهمة')} #${task.id}`)}
                                        </span>
                                        {task.priority && (
                                            <span style={{
                                                fontSize: 12, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                                                color: task.priority === 'Urgent' ? '#ef4444' : '#10b981',
                                                background: task.priority === 'Urgent' ? '#ef444415' : '#10b98115'
                                            }}>
                                                {task.priority === 'Urgent' ? `🔴 ${t('Urgent', 'عاجل')}` : `🟢 ${t('Normal', 'عادي')}`}
                                            </span>
                                        )}
                                        <span style={{
                                            padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
                                            color: getStatusColor(task.status),
                                            background: `${getStatusColor(task.status)}15`,
                                            border: `1px solid ${getStatusColor(task.status)}30`,
                                        }}>
                                            {taskLabel(task.status)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        👤 {t_customer}
                                    </div>
                                    {task.address && (
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            📍 <span>{task.address}{task.city ? `, ${task.city}` : ''}</span>
                                        </div>
                                    )}
                                </div>
                                <div style={{ color: 'var(--text-muted)', transform: expandedTask === task.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                    ▼
                                </div>
                            </div>

                            {expandedTask === task.id && (
                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease-out' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 20 }}>
                                        <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>{t('Department', 'القسم')}</div>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>🏷️ {t_dept}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>{t('Scheduled', 'الموعد')}</div>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>📅 {t_date ? new Date(t_date).toLocaleDateString() : '—'}</div>
                                        </div>
                                    </div>
                                    {task.notes && (
                                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, padding: 16, background: '#f8fafc', borderLeft: '4px solid var(--accent-primary)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                                            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{t('Notes', 'ملاحظات')}:</div>
                                            {task.notes}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                                        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={e => { e.stopPropagation(); setStatusModal(task); }}>
                                            🔄 {t('Update Status', 'تحديث الحالة')}
                                        </button>
                                        <Link href={t_orderId ? `/orders/${t_orderId}` : '#'} className={`btn btn-secondary ${!t_orderId ? 'disabled' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={e => { if (!t_orderId) e.preventDefault(); e.stopPropagation(); }}>
                                            📄 {t('Full Details', 'التفاصيل الكاملة')}
                                        </Link>
                                        <Link href="/qr/verify" className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                                            📱 {t('Scan QR', 'مسح QR')}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
                <>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: 'var(--text-primary)' }}>
                        ✅ {t('Completed', 'المنتهية')} ({completedTasks.length})
                    </h2>
                    {completedTasks.map(task => {
                        const t_orderId = (task as any).installationOrderId || task.orderId || (task as any).OrderId || (task as any).order?.id || (task as any).order?.Id || 0;
                        const t_orderNumber = task.orderNumber || (task as any).OrderNumber || (task as any).order?.orderNumber || (task as any).order?.OrderNumber || (task as any).orderCode || (task as any).OrderCode;
                        const t_customer = task.customerName || (task as any).CustomerName || (task as any).order?.customerName || (task as any).order?.CustomerName || (task as any).customer?.name || (task as any).customer?.Name || (task as any).clientName || (task as any).order?.clientName || '—';

                        return (
                            <div key={task.id} className="card" style={{ marginBottom: 12, opacity: 0.8, padding: 16, borderLeft: '4px solid #10b981' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                                            {t_orderNumber || (t_orderId ? `${t('Order', 'طلب')} #${t_orderId}` : `${t('Task', 'مهمة')} #${task.id}`)}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>👤 {t_customer}{task.city ? ` • 📍 ${task.city}` : ''}</div>
                                    </div>
                                    <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: getStatusColor(task.status), background: `${getStatusColor(task.status)}15`, border: `1px solid ${getStatusColor(task.status)}30` }}>
                                        {taskLabel(task.status)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </>
            )}

            {/* Status Modal */}
            {statusModal && (
                <div className="modal-overlay" onClick={() => setStatusModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('Update Task Status', 'تحديث حالة المهمة')}</h2>
                            <button className="modal-close" onClick={() => setStatusModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {allStatuses.map(status => (
                                    <button
                                        key={status}
                                        disabled={actionLoading}
                                        style={{
                                            padding: '14px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer',
                                            color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14,
                                        }}
                                        onClick={() => handleStatusUpdate(statusModal.id, status)}
                                    >
                                        <span style={{ color: getStatusColor(status), fontWeight: 600 }}>● {taskLabel(status)}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="form-group" style={{ marginTop: 16 }}>
                                <label className="form-label">{t('Notes', 'ملاحظات')}</label>
                                <textarea className="form-textarea" placeholder={t('Optional notes...', 'ملاحظات اختيارية...')} value={statusNotes} onChange={e => setStatusNotes(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
