'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMyTasks, updateTaskStatus, getTaskHistory, getTaskNotes } from '@/lib/endpoints';
import { Task, TaskStatus, TaskHistoryEntry, TaskNote } from '@/types';
import { useLang } from '@/context/LanguageContext';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS, useAuth } from '@/context/RoleContext';

const API_BASE = 'https://apiorders.runasp.net';

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
type TabType = 'notes' | 'timeline' | 'update';

function formatDate(dateStr: string, lang: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskDetailPage() {
    const { lang, t } = useLang();
    const { hasPermission } = useAuth();
    const params = useParams();
    const id = Number(params.id);

    const [task, setTask] = useState<Task | null>(null);
    const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
    const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [notesLoading, setNotesLoading] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('notes');

    // Status update state
    const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
    const [note, setNote] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState('');

    const loadTask = async () => {
        try {
            const all = await getMyTasks();
            const found = all.find(t => t.id === id);
            setTask(found ?? null);
        } catch {
            setTask(null);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const h = await getTaskHistory(id);
            setHistory(Array.isArray(h) ? h : []);
            setHistoryLoaded(true);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadNotes = async () => {
        setNotesLoading(true);
        try {
            const n = await getTaskNotes(id);
            setTaskNotes(Array.isArray(n) ? n : []);
            setNotesLoaded(true);
        } catch {
            setTaskNotes([]);
        } finally {
            setNotesLoading(false);
        }
    };

    useEffect(() => { loadTask(); }, [id]);

    useEffect(() => {
        if (activeTab === 'timeline' && !historyLoaded && !historyLoading) loadHistory();
        if (activeTab === 'notes' && !notesLoaded && !notesLoading) loadNotes();
    }, [activeTab]);

    const handleStatusUpdate = async () => {
        if (!pendingStatus) return;
        setUpdateLoading(true);
        setUpdateError('');
        setUpdateSuccess('');
        try {
            await updateTaskStatus(id, { newStatus: pendingStatus, note: note || null, imageFiles: imageFiles.length > 0 ? imageFiles : undefined });
            setUpdateSuccess(t('Status updated successfully!', 'تم تحديث الحالة بنجاح!'));
            setNote('');
            setImageFiles([]);
            setPendingStatus(null);
            await loadTask();
            // Reset so they reload fresh next time
            setHistoryLoaded(false);
            setNotesLoaded(false);
        } catch (err) {
            setUpdateError(err instanceof Error ? err.message : t('Failed to update status', 'فشل تحديث الحالة'));
        } finally {
            setUpdateLoading(false);
        }
    };

    const taskLabel = (s: TaskStatus) => lang === 'ar' ? TASK_LABELS[s].ar : TASK_LABELS[s].en;

    if (loading) {
        return (
            <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>🔧</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{t('Loading task...', 'جارٍ تحميل المهمة...')}</p>
                </div>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <Link href="/tasks" className="btn btn-secondary">← {t('Back to Tasks', 'العودة للمهام')}</Link>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                    <h3>{t('Task not found', 'المهمة غير موجودة')}</h3>
                </div>
            </div>
        );
    }

    const orderId = task.installationOrderId || task.orderId;
    const statusColor = STATUS_COLORS[task.status] || '#94a3b8';

    return (
        <PermissionGuard requiredPerms={[PERMS.TASKS_VIEW, PERMS.TASKS_VIEW_BRANCH, PERMS.TASKS_VIEW_ALL, PERMS.TASKS_MANAGE]}>
        <div className="animate-in">
            {/* Header */}
            <div className="page-header">
                <div>
                    <Link href="/tasks" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8, textDecoration: 'none' }}>
                        ← {t('Back to Tasks', 'العودة للمهام')}
                    </Link>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        🔧 {t('Task', 'مهمة')} #{task.id}
                        {task.priority && (
                            <span style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12, fontWeight: 600, color: task.priority === 'Urgent' ? '#ef4444' : '#10b981', background: task.priority === 'Urgent' ? '#ef444415' : '#10b98115' }}>
                                {task.priority === 'Urgent' ? `🔴 ${t('Urgent', 'عاجل')}` : `🟢 ${t('Normal', 'عادي')}`}
                            </span>
                        )}
                        <span style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600, color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
                            {taskLabel(task.status)}
                        </span>
                    </h1>
                </div>
                {orderId && (
                    <Link href={`/orders/${orderId}`} className="btn btn-secondary">
                        📋 {t('View Order', 'عرض الطلب')} #{orderId}
                    </Link>
                )}
            </div>

            <div className="detail-grid-narrow">
                {/* Main - Tabs */}
                <div>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                        {([
                            { key: 'notes', label: `📝 ${t('Notes', 'الملاحظات')}` },
                            { key: 'timeline', label: `📅 ${t('Timeline', 'السجل')}` },
                            ...(hasPermission(PERMS.TASKS_MANAGE) ? [{ key: 'update', label: `🔄 ${t('Update Status', 'تحديث الحالة')}` }] : []),
                        ] as { key: TabType; label: string }[]).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                padding: '12px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                                borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                            }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Notes Tab — uses /api/Tasks/{id}/notes */}
                    {activeTab === 'notes' && (
                        <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                            {notesLoading ? (
                                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>⏳ {t('Loading notes...', 'جارٍ تحميل الملاحظات...')}</div>
                            ) : taskNotes.filter(n => n.note || n.imagePaths.length > 0).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                                    <p>{t('No notes for this task.', 'لا توجد ملاحظات لهذه المهمة.')}</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {taskNotes.filter(n => n.note || n.imagePaths.length > 0).map(n => (
                                        <div key={n.id} style={{ padding: '14px 16px', background: 'var(--bg-tertiary)', borderLeft: '4px solid var(--accent-primary)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{formatDate(n.createdAt, lang)}</div>
                                            {n.note && <div style={{ fontSize: 14, lineHeight: 1.6 }}>{n.note}</div>}
                                            {n.imagePaths.length > 0 && (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                                                    {n.imagePaths.map((path, i) => (
                                                        <a key={i} href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer">
                                                            <img src={`${API_BASE}${path}`} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timeline Tab — uses /api/Tasks/{id}/history */}
                    {activeTab === 'timeline' && (
                        <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>⏳ {t('Loading history...', 'جارٍ تحميل السجل...')}</div>
                            ) : (
                                <div className="timeline">
                                    {history.map((entry, i) => {
                                        const isCreate = !entry.fromStatus;
                                        const dotColor = entry.toStatus === 'Completed' ? '#10b981' : entry.toStatus === 'Returned' ? '#ef4444' : '#6366f1';
                                        return (
                                            <div key={i} className="timeline-item">
                                                <div className="timeline-dot" style={{ background: dotColor }} />
                                                <div className="timeline-content">
                                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {isCreate ? (
                                                            <span>{t('Task Created', 'تم إنشاء المهمة')} → <span style={{ color: STATUS_COLORS[entry.toStatus as TaskStatus] || '#94a3b8', fontWeight: 700 }}>{entry.toStatus}</span></span>
                                                        ) : (
                                                            <span>
                                                                <span style={{ color: '#94a3b8' }}>{entry.fromStatus}</span>
                                                                {' → '}
                                                                <span style={{ color: STATUS_COLORS[entry.toStatus as TaskStatus] || '#94a3b8', fontWeight: 700 }}>{entry.toStatus}</span>
                                                            </span>
                                                        )}
                                                    </h4>
                                                    {entry.note && <p style={{ marginTop: 4, fontSize: 13 }}>{entry.note}</p>}
                                                    <div className="timeline-meta">
                                                        <span>👤 {entry.actionByUserName || '—'}</span>
                                                        <span>{formatDate(entry.actionDate, lang)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {history.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>{t('No history events yet.', 'لا يوجد سجل بعد.')}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Update Status Tab */}
                    {activeTab === 'update' && (
                        <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                            {updateSuccess && (
                                <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: '#10b981', fontSize: 13, marginBottom: 16 }}>
                                    ✅ {updateSuccess}
                                </div>
                            )}

                            <div style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>{t('Select new status', 'اختر الحالة الجديدة')}</label>
                                <div className="status-btn-grid">
                                    {allStatuses.map(status => {
                                        const color = STATUS_COLORS[status];
                                        return (
                                            <button key={status} style={{
                                                padding: '12px 16px', background: pendingStatus === status ? `${color}20` : 'var(--bg-tertiary)',
                                                border: pendingStatus === status ? `2px solid ${color}` : '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer',
                                                color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13,
                                                opacity: task.status === status ? 0.5 : 1,
                                            }} onClick={() => { setPendingStatus(status); setUpdateError(''); setUpdateSuccess(''); }}>
                                                <span style={{ color, fontWeight: 600 }}>● {taskLabel(status)}</span>
                                                {task.status === status && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({t('current', 'الحالي')})</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {pendingStatus && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">📷 {t('Attach Photos', 'إرفاق صور')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('optional', 'اختياري')})</span></label>
                                        <input type="file" accept="image/*" multiple capture="environment" className="form-input" style={{ padding: 8 }}
                                            onChange={e => setImageFiles(Array.from(e.target.files || []))} />
                                        {imageFiles.length > 0 && (
                                            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>✓ {imageFiles.length} {t('file(s) selected', 'ملف محدد')}</div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">📝 {t('Note', 'ملاحظة')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('optional', 'اختياري')})</span></label>
                                        <textarea className="form-textarea" rows={3} placeholder={t('Add a note about this update...', 'أضف ملاحظة حول هذا التحديث...')} value={note} onChange={e => setNote(e.target.value)} />
                                    </div>
                                </>
                            )}

                            {updateError && (
                                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
                                    {updateError}
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={!pendingStatus || updateLoading} onClick={handleStatusUpdate}>
                                {updateLoading ? t('Updating...', 'جارٍ التحديث...') : `🔄 ${t('Confirm Update', 'تأكيد التحديث')}`}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right sidebar - task info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 14 }}>📋 {t('Task Info', 'معلومات المهمة')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Task ID', 'رقم المهمة')}:</span> <strong>#{task.id}</strong></div>
                            {orderId && (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Order', 'الطلب')}:</span>{' '}
                                    <Link href={`/orders/${orderId}`} style={{ color: 'var(--accent-primary-hover)', fontWeight: 500 }}>#{orderId}</Link>
                                </div>
                            )}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Status', 'الحالة')}:</span>{' '}
                                <span style={{ fontWeight: 600, color: statusColor }}>{taskLabel(task.status)}</span>
                            </div>
                            {task.priority && (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Priority', 'الأولوية')}:</span>{' '}
                                    <span style={{ fontWeight: 600, color: task.priority === 'Urgent' ? '#ef4444' : '#10b981' }}>{task.priority}</span>
                                </div>
                            )}
                            {task.city && <div><span style={{ color: 'var(--text-muted)' }}>🏙️ {t('City', 'المدينة')}:</span> {task.city}</div>}
                            {task.address && <div><span style={{ color: 'var(--text-muted)' }}>📍 {t('Address', 'العنوان')}:</span> {task.address}</div>}
                            {task.scheduledDate && (
                                <div><span style={{ color: 'var(--text-muted)' }}>📅 {t('Scheduled', 'الموعد')}:</span>{' '}
                                    {new Date(task.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                                </div>
                            )}
                            {task.departmentName && <div><span style={{ color: 'var(--text-muted)' }}>{t('Department', 'القسم')}:</span> {task.departmentName}</div>}
                            {task.technicianName && <div><span style={{ color: 'var(--text-muted)' }}>👷 {t('Technician', 'الفني')}:</span> {task.technicianName}</div>}
                        </div>
                    </div>

                    {task.customerName && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 14 }}>👤 {t('Customer', 'العميل')}</div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{task.customerName}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </PermissionGuard>
    );
}
