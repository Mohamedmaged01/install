'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyTasks, updateTaskStatus } from '@/lib/endpoints';
import { Task, TaskStatus } from '@/types';
import { useLang } from '@/context/LanguageContext';

const activeStatuses: TaskStatus[] = ['Assigned', 'Accepted', 'Enroute', 'Onsite', 'InProgress'];
const doneStatuses: TaskStatus[] = ['Completed', 'Returned', 'OnHold'];
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
            setTasks(Array.isArray(data) ? data : []);
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
                activeTasks.map(task => (
                    <div key={task.id} className="card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-primary-hover)' }}>
                                        {task.orderNumber || `Order #${task.orderId}`}
                                    </span>
                                    {task.priority && (
                                        <span style={{ fontSize: 12, color: task.priority === 'Urgent' ? '#ef4444' : '#10b981' }}>
                                            {task.priority === 'Urgent' ? `🔴 ${t('Urgent', 'عاجل')}` : `🟢 ${t('Normal', 'عادي')}`}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    {task.customerName || '—'}
                                </div>
                                {task.address && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                        📍 {task.address}{task.city ? `, ${task.city}` : ''}
                                    </div>
                                )}
                            </div>
                            <span style={{
                                padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
                                color: getStatusColor(task.status),
                                background: `${getStatusColor(task.status)}15`,
                                border: `1px solid ${getStatusColor(task.status)}30`,
                            }}>
                                {taskLabel(task.status)}
                            </span>
                        </div>

                        {expandedTask === task.id && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Department', 'القسم')}</div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{task.departmentName || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Scheduled', 'الموعد')}</div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : '—'}</div>
                                    </div>
                                </div>
                                {task.notes && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        💬 {task.notes}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setStatusModal(task); }}>
                                        {t('Update Status', 'تحديث الحالة')}
                                    </button>
                                    <Link href={`/orders/${task.orderId}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                                        {t('Full Details', 'التفاصيل الكاملة')}
                                    </Link>
                                    <Link href="/qr/verify" className="btn btn-success btn-sm" onClick={e => e.stopPropagation()}>
                                        📱 {t('Scan QR', 'مسح QR')}
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
                <>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: 'var(--text-primary)' }}>
                        ✅ {t('Completed', 'المنتهية')} ({completedTasks.length})
                    </h2>
                    {completedTasks.map(task => (
                        <div key={task.id} className="card" style={{ marginBottom: 12, opacity: 0.7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{task.orderNumber || `Order #${task.orderId}`}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{task.customerName}{task.city ? ` • ${task.city}` : ''}</div>
                                </div>
                                <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, color: getStatusColor(task.status), background: `${getStatusColor(task.status)}15` }}>
                                    {taskLabel(task.status)}
                                </span>
                            </div>
                        </div>
                    ))}
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
