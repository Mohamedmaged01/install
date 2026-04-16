'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
    getOrderById, getOrderHistory, getOrderEvidence, uploadEvidence, updateEvidence, deleteEvidence,
    getOrderNotes, addOrderNote, updateOrderNote, deleteOrderNote,
    deleteOrder, deleteTask,
    getDepartmentUsers, assignTask, getApexDocumentItems, getRoles,
    getApexInvoices, getApexOffers, updateOrder, acceptFromOutside,
    approveSalesManager, approveSupervisor, getBranchTechnicians, rejectOrder, getBranches, getDepartments
} from '@/lib/endpoints';
import { API_BASE } from '@/lib/api';
import { Order, OrderHistoryEntry, OrderNote, Evidence, DepartmentUser, AssignTaskDto, ApexItem, Role, ApexCustomer, UpdateOrderDto, Branch, Department, OrderStatus, getOrderStatusLabel } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import PriorityBadge from '@/components/PriorityBadge';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useAuth, PERMS } from '@/context/RoleContext';

type TabType = 'timeline' | 'items' | 'evidence' | 'notes';

export default function OrderDetailPage() {
    const { lang, t } = useLang();
    const toast = useToast();
    const { hasPermission } = useAuth();
    const params = useParams();
    const id = Number(params.id);
    const [order, setOrder] = useState<Order | null>(null);
    const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [apexItems, setApexItems] = useState<ApexItem[]>([]);
    const [apexCustomer, setApexCustomer] = useState<any>(null);
    const [apexLoading, setApexLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [loading, setLoading] = useState(true);

    // Evidence upload state
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadNote, setUploadNote] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Evidence edit/delete state
    const [editingEvidenceId, setEditingEvidenceId] = useState<number | null>(null);
    const [editingEvidenceNote, setEditingEvidenceNote] = useState('');
    const [editingEvidenceImage, setEditingEvidenceImage] = useState<File | null>(null);
    const [evidenceActionLoading, setEvidenceActionLoading] = useState(false);

    // Order notes state
    const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);
    const [newNoteText, setNewNoteText] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editingNoteText, setEditingNoteText] = useState('');
    const [noteLoading, setNoteLoading] = useState(false);

    // Assign technician state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [technicians, setTechnicians] = useState<DepartmentUser[]>([]);
    const [selectedTechs, setSelectedTechs] = useState<Set<number>>(new Set());
    const [rolesMap, setRolesMap] = useState<Record<number, string>>({});
    const [assignNotes, setAssignNotes] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [techsLoading, setTechsLoading] = useState(false);
    const [isApproveWorkflow, setIsApproveWorkflow] = useState(false);
    const [origin, setOrigin] = useState('');
    const [itemsPage, setItemsPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Edit Order state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Omit<UpdateOrderDto, 'branchIds'> & { branchIds: number[], location: string; notes: string }>>({});

    const [branches, setBranches] = useState<Branch[]>([]);
    const [editDepts, setEditDepts] = useState<Department[]>([]);

    // Return Order state
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [returnLoading, setReturnLoading] = useState(false);
    const [returnToRep, setReturnToRep] = useState(false);

    const loadOrder = async () => {
        try {
            const [orderData, historyData, evidenceData, notesData] = await Promise.all([
                getOrderById(id),
                getOrderHistory(id).catch(() => []),
                getOrderEvidence(id).catch(() => []),
                getOrderNotes(id).catch(() => []),
            ]);

            if (orderData) {
                // The backend uses 'tech' for technicians and 'item' for items
                if (Array.isArray((orderData as any).tech)) {
                    (orderData as Record<string, any>).technicians = (orderData as any).tech;
                }
                if (Array.isArray((orderData as any).item) && !orderData.items) {
                    orderData.items = (orderData as any).item;
                }
            }

            setOrder(orderData);
            setHistory(Array.isArray(historyData) ? historyData : []);
            setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
            setOrderNotes(Array.isArray(notesData) ? notesData : []);

            // Fetch APEX items if the order is linked to an APEX document
            const apexCode = orderData.invoiceId || orderData.quotationId;
            if (apexCode && apexCode.toLowerCase() !== 'string') {
                setApexLoading(true);
                const type = orderData.invoiceId && orderData.invoiceId.toLowerCase() !== 'string' ? 'invoice' : 'offer';
                getApexDocumentItems(type, apexCode)
                    .then(items => setApexItems(items))
                    .catch(() => setApexItems([]));

                // Also try to grab the customer data directly from the document
                const apexFetcher = type === 'invoice' ? getApexInvoices : getApexOffers;
                apexFetcher({ page: 1, pageSize: 20 })
                    .then((docs: any[]) => {
                        const doc = docs.find((d: any) => d.code === apexCode);
                        if (doc && doc.customer) setApexCustomer(doc.customer);
                    })
                    .catch(console.error)
                    .finally(() => setApexLoading(false));
            }

        } catch (err) {
            console.error('Failed to load order:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) loadOrder();
        getBranches().then(setBranches).catch(() => {});
        getDepartments().then(setEditDepts).catch(() => {});
    }, [id]);

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const handleUploadEvidence = async () => {
        if (uploadFiles.length === 0) return;
        setUploading(true);
        try {
            const noteText = uploadNote;
            const existingIds = new Set(evidence.map(e => e.id));
            await uploadEvidence(id, uploadFiles, uploadNote || undefined);
            const ev = await getOrderEvidence(id).catch(() => []);
            // For newly added items, fill in the note from the user's input if the API didn't return it
            const merged = (Array.isArray(ev) ? ev : []).map(item =>
                !existingIds.has(item.id) && !item.note && noteText ? { ...item, note: noteText } : item
            );
            setEvidence(merged);
            setUploadFiles([]);
            setUploadNote('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            toast.success( t('Evidence uploaded!', 'تم رفع المرفق!'));
        } catch (err) {
            toast.error( err instanceof Error ? err.message : t('Upload failed', 'فشل الرفع'));
        } finally {
            setUploading(false);
        }
    };

    const handleEditEvidence = async (evidenceId: number) => {
        setEvidenceActionLoading(true);
        try {
            await updateEvidence(evidenceId, editingEvidenceNote, editingEvidenceImage);
            const ev = await getOrderEvidence(id).catch(() => []);
            setEvidence(Array.isArray(ev) ? ev : []);
            setEditingEvidenceId(null);
            setEditingEvidenceImage(null);
            toast.success(t('Evidence updated!', 'تم تحديث المرفق!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Update failed', 'فشل التحديث'));
        } finally {
            setEvidenceActionLoading(false);
        }
    };

    const handleDeleteEvidence = async (evidenceId: number) => {
        if (!confirm(t('Delete this evidence?', 'حذف هذا المرفق؟'))) return;
        setEvidenceActionLoading(true);
        try {
            await deleteEvidence(evidenceId);
            setEvidence(prev => prev.filter(e => e.id !== evidenceId));
            toast.success(t('Evidence deleted!', 'تم حذف المرفق!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Delete failed', 'فشل الحذف'));
        } finally {
            setEvidenceActionLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNoteText.trim()) return;
        setNoteLoading(true);
        try {
            const note = await addOrderNote(id, newNoteText.trim());
            setOrderNotes(prev => [{ ...note, note: note.note || newNoteText.trim(), createdAt: note.createdAt || new Date().toISOString() }, ...prev]);
            setNewNoteText('');
            toast.success(t('Note added!', 'تمت إضافة الملاحظة!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to add note', 'فشل إضافة الملاحظة'));
        } finally {
            setNoteLoading(false);
        }
    };

    const handleEditNote = async (noteId: number) => {
        if (!editingNoteText.trim()) return;
        setNoteLoading(true);
        try {
            await updateOrderNote(noteId, editingNoteText.trim());
            setOrderNotes(prev => prev.map(n => n.id === noteId ? { ...n, note: editingNoteText.trim() } : n));
            setEditingNoteId(null);
            toast.success(t('Note updated!', 'تم تحديث الملاحظة!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to update note', 'فشل تحديث الملاحظة'));
        } finally {
            setNoteLoading(false);
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (!confirm(t('Delete this note?', 'حذف هذه الملاحظة؟'))) return;
        setNoteLoading(true);
        try {
            await deleteOrderNote(noteId);
            setOrderNotes(prev => prev.filter(n => n.id !== noteId));
            toast.success(t('Note deleted!', 'تم حذف الملاحظة!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to delete note', 'فشل حذف الملاحظة'));
        } finally {
            setNoteLoading(false);
        }
    };

    const openAssignModal = async (forApprove = false) => {
        if (!order) return;
        setIsApproveWorkflow(forApprove);
        setShowAssignModal(true);
        setSelectedTechs(new Set());
        setAssignNotes('');
        setTechsLoading(true);
        try {
            const validBranches = (order.branches ?? []).filter(b => b.id != null && b.id !== 0);
            const techsPromise = validBranches.length > 0
                ? Promise.all(validBranches.map(b => getBranchTechnicians(b.id))).then(res => res.flat())
                : getDepartmentUsers(undefined, order.departmentId);
            const [users, allRoles] = await Promise.all([
                techsPromise,
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
        } finally {
            setTechsLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!order || selectedTechs.size === 0) return;
        setAssignLoading(true);
        try {
            if (isApproveWorkflow) {
                const techIds = Array.from(selectedTechs);
                const whatsappUrl = await approveSupervisor(order.id, techIds, assignNotes || null);
                if (whatsappUrl) window.open(whatsappUrl, '_blank');
                toast.success( t('Order approved and technicians assigned', 'تم الموافقة على الطلب وتعيين الفنيين'));
            } else {
                await Promise.all(
                    Array.from(selectedTechs).map(techId => {
                        const dto: AssignTaskDto = {
                            orderId: order.id,
                            technicianId: techId,
                            notes: assignNotes || null,
                        };
                        return assignTask(dto);
                    })
                );
                toast.success( t(`${selectedTechs.size} technician(s) assigned!`, `تم تعيين ${selectedTechs.size} فني!`));
            }
            setShowAssignModal(false);
            await loadOrder();
        } catch (err) {
            toast.error( err instanceof Error ? err.message : t('Failed to assign', 'فشل التعيين'));
        } finally {
            setAssignLoading(false);
        }
    };

    const handleUpdateOrder = async () => {
        if (!order || !editForm) return;
        setEditLoading(true);
        try {
            const dto: UpdateOrderDto = {
                status: editForm.status || order.status,
                city: editForm.city || order.city || null,
                address: editForm.address || order.address || null,
                location: editForm.location ?? order.location ?? null,
                scheduledDate: editForm.scheduledDate || order.scheduledDate || null,
                quotationId: editForm.quotationId || order.quotationId || null,
                invoiceId: editForm.invoiceId || order.invoiceId || null,
                customerId: editForm.customerId || order.customerId || null,
                createdAt: order.createdAt,
                salesApprovalDate: editForm.salesApprovalDate || null,
                priority: editForm.priority || order.priority,
                branchIds: editForm.branchIds ? editForm.branchIds.map(id => ({ id })) : (order.branches ? order.branches.map(b => ({ id: b.id })) : []),
                departmentId: editForm.departmentIds?.[0]?.idd || editForm.departmentId || order.departmentId,
                departmentIds: editForm.departmentIds?.length ? editForm.departmentIds : (order.departmentNotes?.map(dn => ({ idd: dn.departmentId, note: dn.note })) || []),
                notes: editForm.notes ?? order.notes ?? null,
            };

            await updateOrder(order.id, dto);
            toast.success( t('Order updated successfully', 'تم تحديث الطلب بنجاح'));
            setShowEditModal(false);
            await loadOrder(); // Refresh the order info
        } catch (err) {
            toast.error( err instanceof Error ? err.message : t('Failed to update order', 'فشل تحديث الطلب'));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!confirm(t('Are you sure you want to delete this order? This action cannot be undone.', 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.'))) return;
        try {
            await deleteOrder(id);
            window.location.href = '/sales/orders';
        } catch (err) {
            toast.error( err instanceof Error ? err.message : t('Failed to delete order', 'فشل حذف الطلب'));
        }
    };

    const handleReturn = async () => {
        if (!order) return;
        if (!returnReason.trim()) {
            toast.error(t('Return reason is required.', 'الملاحظة مطلوبة.'));
            return;
        }
        setReturnLoading(true);
        try {
            await rejectOrder(order.id, returnReason.trim(), returnToRep);
            toast.success(t('Order returned successfully.', 'تم إرجاع الطلب بنجاح.'));
            setShowReturnModal(false);
            setReturnReason('');
            await loadOrder();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to return order', 'فشل إرجاع الطلب'));
        } finally {
            setReturnLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!order) return;
        if (order.status === 'PendingSalesSupervisorApproval') {
            if (!confirm(t('Approve this order?', 'هل تريد اعتماد هذا الطلب؟'))) return;
            try {
                await approveSalesManager(id);
                toast.success( t('Order approved successfully!', 'تم اعتماد الطلب بنجاح!'));
                await loadOrder();
            } catch (err) {
                toast.error( err instanceof Error ? err.message : t('Approval failed', 'فشل الاعتماد'));
            }
        } else if (order.status === 'PendingInstallationSupervisorApproval') {
            await openAssignModal(true);
        } else {
            if (!confirm(t('Accept this order from outside? This will mark it as accepted by an external party.', 'هل تريد قبول هذا الطلب من الخارج؟ سيتم تسجيله كمقبول من جهة خارجية.'))) return;
            try {
                await acceptFromOutside(id);
                toast.success( t('Order accepted from outside', 'تم قبول الطلب من الخارج'));
                await loadOrder();
            } catch (err) {
                toast.error( err instanceof Error ? err.message : t('Failed to accept from outside', 'فشل القبول من الخارج'));
            }
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm(t('Remove this technician from this order?', 'هل تريد إزالة هذا الفني من الطلب؟'))) return;
        try {
            await deleteTask(taskId);
            toast.success( t('Technician removed', 'تمت إزالة الفني'));
            await loadOrder();
        } catch (err) {
            toast.error( err instanceof Error ? err.message : t('Failed to remove', 'فشل الإزالة'));
        }
    };

    if (loading) {
        return (
            <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>📋</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{t('Loading order...', 'جارٍ تحميل الطلب...')}</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="animate-in">
                <div className="empty-state" style={{ minHeight: '60vh' }}>
                    <div className="empty-state-icon">🔍</div>
                    <h3>{t('Order not found', 'الطلب غير موجود')}</h3>
                    <p>{t('The order you are looking for does not exist.', 'الطلب الذي تبحث عنه غير موجود.')}</p>
                    <Link href="/sales/orders" className="btn btn-primary" style={{ marginTop: 16 }}>{t('Back to Orders', 'العودة للطلبات')}</Link>
                </div>
            </div>
        );
    }

    const tabs: { key: TabType; label: string; icon: string }[] = [
        ...(hasPermission(PERMS.ORDERS_VIEW_HISTORY) ? [{ key: 'timeline' as TabType, label: t('Timeline', 'الجدول الزمني'), icon: '📅' }] : []),
        { key: 'items', label: t('Items', 'العناصر'), icon: '📦' },
        ...(hasPermission(PERMS.EVIDENCE_VIEW) ? [{ key: 'evidence' as TabType, label: t('Attachments', 'المرفقات'), icon: '📎' }] : []),
        { key: 'notes', label: t('Notes', 'الملاحظات'), icon: '📝' },
    ];

    return (
        <div className="animate-in">

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Link href="/sales/orders" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                    ← {t('Back to Orders', 'العودة للطلبات')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <h1 style={{ fontSize: 28, fontWeight: 700 }}>{order.orderNumber || `Order #${order.id}`}</h1>
                            <StatusBadge status={order.status} lang={lang} />
                            <PriorityBadge priority={order.priority} />
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            {(order.departmentName && order.departmentName !== 'string') && (
                                <><span style={{ fontWeight: 600 }}>🏢 {order.departmentName}</span>{' • '}</>
                            )}
                            {order.invoiceId ? `${t('Invoice', 'فاتورة')}: ${order.invoiceId}` : order.quotationId ? `${t('Quotation', 'عرض سعر')}: ${order.quotationId}` : ''}
                            {' • '}{t('Created', 'تاريخ الإنشاء')} {new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        {order.notes && (
                            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
                                📝 {order.notes}
                            </div>
                        )}
                    </div>
                    <div className="btn-group">
                        {order.status === 'PendingSalesSupervisorApproval' && hasPermission(PERMS.ORDERS_APPROVE_SALES) && (
                            <button className="btn btn-primary" onClick={handleAccept} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                ✅ {t('Approve', 'اعتماد')}
                            </button>
                        )}
                        {order.status === 'PendingInstallationSupervisorApproval' && hasPermission(PERMS.ORDERS_APPROVE_SUPERVISOR) && (
                            <button className="btn btn-primary" onClick={handleAccept} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                ✅ {t('Approve & Assign', 'اعتماد وتعيين')}
                            </button>
                        )}
                        {hasPermission(PERMS.ORDERS_EDIT) && <button className="btn btn-secondary" onClick={async () => {
                            const branchIds = order.branches ? order.branches.map(b => b.id).filter(id => id !== 0) : [];
                            setEditForm({
                                status: order.status,
                                city: order.city || '',
                                address: order.address || '',
                                scheduledDate: order.scheduledDate || '',
                                location: order.location || '',
                                notes: order.notes || '',
                                quotationId: order.quotationId || '',
                                invoiceId: order.invoiceId || '',
                                customerId: order.customerId || '',
                                salesApprovalDate: order.salesApprovalDate || '',
                                priority: order.priority,
                                branchIds,
                                departmentId: order.departmentId,
                                departmentIds: order.departmentNotes?.map(dn => ({ idd: dn.departmentId, note: dn.note || '' }))
                                    || (order.departmentId ? [{ idd: order.departmentId, note: '' }] : []),
                            });
                            // Pre-load departments filtered by branch
                            const depts = await getDepartments(branchIds.length ? branchIds : undefined).catch(() => [] as Department[]);
                            setEditDepts(depts);
                            setShowEditModal(true);
                        }}>
                            ✏️ {t('Edit Order', 'تعديل الطلب')}
                        </button>}
                        {hasPermission(PERMS.ORDERS_RETURN) && (
                            <button className="btn btn-warning" onClick={() => { setReturnReason(''); setReturnToRep(order?.status === 'PendingSalesSupervisorApproval'); setShowReturnModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                ↩️ {t('Return Order', 'إرجاع الطلب')}
                            </button>
                        )}
                        {hasPermission(PERMS.ORDERS_DELETE) && (
                            <button className="btn btn-danger" onClick={handleDeleteOrder} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                🗑️ {t('Delete Order', 'حذف الطلب')}
                            </button>
                        )}
                        {order.status === 'Completed' && (
                            <Link href="/qr/verify" className="btn btn-success">📱 {t('Verify QR', 'تحقق QR')}</Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="detail-grid">
                {/* Main Content */}
                <div>
                    <div className="tabs">
                        {tabs.map(tab => (
                            <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Timeline */}
                    {activeTab === 'timeline' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 24 }}>{t('Order Timeline', 'الجدول الزمني للطلب')}</div>
                            {(
                                <div className="timeline">
                                    {history.map((event, index) => {
                                        const dotColor = event.toStatus?.includes('Complet') || event.toStatus?.includes('Close') ? '#10b981' : event.toStatus?.includes('Return') || event.toStatus?.includes('Cancel') || event.toStatus?.includes('Reject') ? '#ef4444' : '#6366f1';
                                        return (
                                            <div key={index} className="timeline-item">
                                                <div className="timeline-dot" style={{ background: dotColor }} />
                                                <div className="timeline-content">
                                                    <h4>
                                                        {event.fromStatus ? (
                                                            <span><span style={{ color: '#94a3b8' }}>{event.fromStatus}</span>{' → '}<strong>{event.toStatus}</strong></span>
                                                        ) : (
                                                            <span>{t('Created', 'تم الإنشاء')} → <strong>{event.toStatus}</strong></span>
                                                        )}
                                                    </h4>
                                                    {event.note && <p style={{ marginTop: 4, fontSize: 13 }}>{event.note}</p>}
                                                    <div className="timeline-meta">
                                                        <span>👤 {event.actionByUserName || '—'}</span>
                                                        <span>{event.actionDate && !isNaN(new Date(event.actionDate).getTime()) ? new Date(event.actionDate).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div key="created" className="timeline-item">
                                        <div className="timeline-dot info" />
                                        <div className="timeline-content">
                                            <h4>تم الانشاء</h4>
                                            <p>—</p>
                                            <div className="timeline-meta">
                                                <span>👤 {order.salesRepresentative || order.createdByName || '—'}</span>
                                                <span>{order.createdAt && !isNaN(new Date(order.createdAt).getTime()) ? new Date(order.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items */}
                    {activeTab === 'items' && (() => {
                        const allItems = apexItems.length > 0 ? apexItems : (order.items || []);
                        const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
                        const pageItems = allItems.slice((itemsPage - 1) * ITEMS_PER_PAGE, itemsPage * ITEMS_PER_PAGE);
                        return (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>
                                {t('Installation Items', 'عناصر التركيب')}
                                {allItems.length > 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>({allItems.length})</span>}
                                {apexLoading && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12, fontWeight: 400 }}>⏳ {t('Loading from APEX...', 'جارٍ التحميل من أبكس...')}</span>}
                            </div>
                            {allItems.length > 0 ? (
                                <>
                                <div className="table-container" style={{ border: 'none' }}>
                                    <table>
                                        <thead><tr><th>{t('Item Code', 'رمز العنصر')}</th><th>{t('Name', 'الاسم')}</th><th>{t('Qty', 'الكمية')}</th><th>{t('Price', 'السعر')}</th><th>{t('Total', 'المجموع')}</th></tr></thead>
                                        <tbody>
                                            {apexItems.length > 0
                                                ? pageItems.map((item: any, idx: number) => (
                                                    <tr key={`${item.itemCode}-${idx}`}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{item.itemCode}</td>
                                                        <td className="table-cell-main">{lang === 'ar' ? item.arabicName : item.latinName || item.arabicName}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>SAR {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ fontWeight: 600 }}>SAR {((item.quantity * item.price) + item.vatValue - item.discountValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                                : pageItems.map((item: any, idx: number) => (
                                                    <tr key={`${item.id || idx}`}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>#{item.id || ((itemsPage - 1) * ITEMS_PER_PAGE + idx + 1)}</td>
                                                        <td className="table-cell-main">{item.name} {item.unit ? `(${item.unit})` : ''}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>SAR {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ fontWeight: 600 }}>SAR {item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {t('Page', 'صفحة')} {itemsPage} / {totalPages} &nbsp;·&nbsp; {allItems.length} {t('items', 'عناصر')}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-secondary btn-sm" disabled={itemsPage === 1} onClick={() => setItemsPage(1)}>«</button>
                                            <button className="btn btn-secondary btn-sm" disabled={itemsPage === 1} onClick={() => setItemsPage(p => p - 1)}>‹</button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(p => p === 1 || p === totalPages || Math.abs(p - itemsPage) <= 1)
                                                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                                                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((p, i) => p === '...'
                                                    ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>
                                                    : <button key={p} className={`btn btn-sm ${itemsPage === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setItemsPage(p as number)}>{p}</button>
                                                )
                                            }
                                            <button className="btn btn-secondary btn-sm" disabled={itemsPage === totalPages} onClick={() => setItemsPage(p => p + 1)}>›</button>
                                            <button className="btn btn-secondary btn-sm" disabled={itemsPage === totalPages} onClick={() => setItemsPage(totalPages)}>»</button>
                                        </div>
                                    </div>
                                )}
                                </>
                            ) : apexLoading ? (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('Loading items...', 'جارٍ تحميل العناصر...')}</p>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No items found for this order.', 'لم يتم العثور على عناصر لهذا الطلب.')}</p>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* Evidence */}
                    {activeTab === 'evidence' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>📎 {t('Attachments', 'المرفقات')}</div>

                            {/* Upload Section */}
                            {hasPermission(PERMS.EVIDENCE_UPLOAD) && (
                            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>⬆️ {t('Upload Evidence', 'رفع مرفق')}</div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                                    style={{ display: 'block', marginBottom: 10, color: 'var(--text-primary)' }}
                                />
                                {uploadFiles.length > 0 && (
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        {uploadFiles.length} {t('file(s) selected', 'ملف(ات) محدد')}
                                    </div>
                                )}
                                <input
                                    className="form-input"
                                    placeholder={t('Note (required)', 'ملاحظة (مطلوبة) *')}
                                    value={uploadNote}
                                    onChange={e => setUploadNote(e.target.value)}
                                    style={{ marginBottom: 10 }}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    disabled={uploading || uploadFiles.length === 0 || !uploadNote.trim()}
                                    onClick={handleUploadEvidence}
                                >
                                    {uploading ? `⏳ ${t('Uploading...', 'جارٍ الرفع...')}` : `⬆️ ${t('Upload', 'رفع')}`}
                                </button>
                            </div>
                            )}


                            {evidence.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>

                                    {evidence.map(ev => {
                                        let imgUrl = ev.imageUrl || ev.imagePath || '';
                                        if (imgUrl && !imgUrl.startsWith('http')) {
                                            imgUrl = `${API_BASE}/${imgUrl.replace(/^\//, '')}`;
                                        }

                                        const isEditing = editingEvidenceId === ev.id;
                                        return (
                                            <div key={ev.id} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                {imgUrl ? (
                                                    <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={imgUrl}
                                                            alt={ev.note || 'evidence'}
                                                            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </a>
                                                ) : (
                                                    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📸</div>
                                                )}
                                                <div style={{ padding: '10px 12px' }}>
                                                    {isEditing ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <input
                                                                className="form-input"
                                                                value={editingEvidenceNote}
                                                                onChange={e => setEditingEvidenceNote(e.target.value)}
                                                                placeholder={t('Note...', 'ملاحظة...')}
                                                                style={{ fontSize: 13 }}
                                                            />
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={e => setEditingEvidenceImage(e.target.files?.[0] ?? null)}
                                                                style={{ fontSize: 12, color: 'var(--text-primary)' }}
                                                            />
                                                            {editingEvidenceImage && (
                                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📎 {editingEvidenceImage.name}</span>
                                                            )}
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                <button className="btn btn-primary btn-sm" disabled={evidenceActionLoading} onClick={() => handleEditEvidence(ev.id)}>
                                                                    {evidenceActionLoading ? '⏳' : `💾 ${t('Save', 'حفظ')}`}
                                                                </button>
                                                                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingEvidenceId(null); setEditingEvidenceImage(null); }}>✕</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{ev.note || '—'}</div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                                                {ev.uploadedBy || '—'}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                {imgUrl && (
                                                                    <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                                        🔗 {t('Open', 'فتح')}
                                                                    </a>
                                                                )}
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => { setEditingEvidenceId(ev.id); setEditingEvidenceNote(ev.note || ''); }}
                                                                >✏️ {t('Edit', 'تعديل')}</button>
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    disabled={evidenceActionLoading}
                                                                    onClick={() => handleDeleteEvidence(ev.id)}
                                                                >🗑️</button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No evidence uploaded yet.', 'لم يتم رفع أي مرفق بعد.')}</p>
                            )}
                        </div>
                    )}

                    {/* Notes Tab */}
                    {activeTab === 'notes' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>📝 {t('Order Notes', 'ملاحظات الطلب')}</div>

                            {/* Add Note */}
                            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>➕ {t('Add Note', 'إضافة ملاحظة')}</div>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder={t('Write a note...', 'اكتب ملاحظة...')}
                                    value={newNoteText}
                                    onChange={e => setNewNoteText(e.target.value)}
                                    style={{ resize: 'vertical', marginBottom: 8 }}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    disabled={noteLoading || !newNoteText.trim()}
                                    onClick={handleAddNote}
                                >
                                    {noteLoading ? `⏳ ${t('Adding...', 'جارٍ الإضافة...')}` : `💾 ${t('Add Note', 'إضافة ملاحظة')}`}
                                </button>
                            </div>

                            {/* Notes List */}
                            {orderNotes.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {orderNotes.map(n => (
                                        <div key={n.id} style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                            {editingNoteId === n.id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <textarea
                                                        className="form-input"
                                                        rows={2}
                                                        value={editingNoteText}
                                                        onChange={e => setEditingNoteText(e.target.value)}
                                                        style={{ resize: 'vertical', fontSize: 13 }}
                                                    />
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-primary btn-sm" disabled={noteLoading} onClick={() => handleEditNote(n.id)}>
                                                            {noteLoading ? '⏳' : `💾 ${t('Save', 'حفظ')}`}
                                                        </button>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingNoteId(null)}>✕</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                            {n.createdByName && <span>{n.createdByName} · </span>}
                                                            {n.createdAt && !isNaN(new Date(n.createdAt).getTime()) ? new Date(n.createdAt).toLocaleString() : ''}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.note); }}>✏️</button>
                                                            <button className="btn btn-danger btn-sm" disabled={noteLoading} onClick={() => handleDeleteNote(n.id)}>🗑️</button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No notes yet.', 'لا توجد ملاحظات بعد.')}</p>
                            )}
                        </div>
                    )}

                </div>

                {/* Right Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>



                    {/* Customer */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>👤 {t('Customer', 'العميل')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Name', 'الاسم')}:</span> <span style={{ fontWeight: 500 }}>{apexCustomer ? (lang === 'ar' ? apexCustomer.arabicName : apexCustomer.latinName || apexCustomer.arabicName) : (order.customerName || '—')}</span></div>
                            {(apexCustomer?.email || order.customerEmail) && <div><span style={{ color: 'var(--text-muted)' }}>{t('Email', 'البريد')}:</span> {apexCustomer?.email || order.customerEmail}</div>}
                            {(apexCustomer?.phone || order.customerPhone) && <div><span style={{ color: 'var(--text-muted)' }}>{t('Phone', 'الهاتف')}:</span> {apexCustomer?.phone || order.customerPhone}</div>}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Address', 'العنوان')}:</span> {order.address || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('City', 'المدينة')}:</span> {order.city || '—'}</div>
                            {order.location && (
                                <div><span style={{ color: 'var(--text-muted)' }}>📍 {t('Location', 'الموقع')}:</span> <a href={order.location} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary-hover)' }}>{t('Open Map', 'فتح الخريطة')}</a></div>
                            )}
                        </div>
                    </div>

                    {/* Order Details */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>📋 {t('Details', 'التفاصيل')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                            {(order.branches && order.branches.length > 0) && (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Branches', 'الفروع')}:</span> {order.branches.map(b => b.name).join(', ')}</div>
                            )}
                            {order.departmentNotes && order.departmentNotes.length > 0 ? (
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Departments', 'الأقسام')}:</span>{' '}
                                    {order.departmentNotes.map(dn => dn.departmentName || `#${dn.departmentId}`).join(', ')}
                                </div>
                            ) : (order.departmentName && order.departmentName !== 'string' || order.departmentId) ? (
                                <div><span style={{ color: 'var(--text-muted)' }}>{t('Department', 'القسم')}:</span> {order.departmentName && order.departmentName !== 'string' ? order.departmentName : `#${order.departmentId}`}</div>
                            ) : null}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Scheduled', ' الموعد المناسب للعميل')}:</span> {order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Created by', 'أُنشئ بواسطة')}:</span> {order.salesRepresentative || order.createdByName || '—'}</div>
                            {order.salesManager && (
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Sales Supervisor Approval', 'موافقة مشرف المبيعات')}:</span>{' '}
                                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>✔ {order.salesManager}</span>
                                    {order.salesApprovalDate && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginInlineStart: 6 }}>{new Date(order.salesApprovalDate).toLocaleDateString()}</span>}
                                </div>
                            )}
                            {order.supervisor && (
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Installation Supervisor Approval', 'موافقة مشرف التركيبات')}:</span>{' '}
                                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>✔ {order.supervisor}</span>
                                    {order.installationApprovalDate && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginInlineStart: 6 }}>{new Date(order.installationApprovalDate).toLocaleDateString()}</span>}
                                </div>
                            )}
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('Status', 'الحالة')}:</span> <StatusBadge status={order.status} lang={lang} /></div>
                            {order.notes && (
                                <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>📝 {t('Notes', 'الملاحظات')}:</span>
                                    {order.notes}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Department Notes */}
                    {order.departmentNotes && order.departmentNotes.length > 0 && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 16 }}>🏢 {t('Department Notes', 'ملاحظات الأقسام')}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {order.departmentNotes.map(dn => (
                                    <div key={dn.departmentId}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>
                                            {dn.departmentName || `#${dn.departmentId}`}
                                        </div>
                                        {dn.comments && dn.comments.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {dn.comments.map((c, i) => (
                                                    <div key={c.id ?? i} style={{ fontSize: 13, padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                                                        <div style={{ color: 'var(--text-secondary)' }}>{c.comment}</div>
                                                        {(c.createdByName || c.createdAt) && (
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                                {c.createdByName}{c.createdByName && c.createdAt ? ' · ' : ''}{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : dn.note ? (
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>{dn.note}</div>
                                        ) : (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks (assigned technicians) */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: 16 }}>🔧 {t('Assigned Technicians', 'الفنيون المعيَّنون')}</div>
                        {(() => {
                            const techRows =
                                (order.tasks?.length ?? 0) > 0 ? order.tasks! :
                                (order.technicianAssignments?.length ?? 0) > 0 ? order.technicianAssignments!.map((t: any) => ({ id: t.id, technicianName: t.name, technicianId: t.id, status: null, notes: null })) :
                                (order.technicians?.length ?? 0) > 0 ? order.technicians!.map((t: any) => ({ id: t.id, technicianName: t.name, technicianId: t.id, status: null, notes: null })) :
                                null;
                            if (!techRows) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('No technicians assigned yet.', 'لم يتم تعيين أي فني بعد.')}</p>;
                            return techRows.map((task: any) => (
                                <div key={task.id} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 8, fontSize: 13 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>👷 {task.technicianName || `Tech #${task.technicianId}`}</span>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {task.status && <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', background: 'rgba(99,102,241,0.12)', borderRadius: 12, color: '#818cf8' }}>{task.status}</span>}
                                            {task.status && hasPermission(PERMS.TASKS_ASSIGN) && <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => handleDeleteTask(task.id)}>🗑️</button>}
                                        </div>
                                    </div>
                                    {task.notes && <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{task.notes}</div>}
                                </div>
                            ));
                        })()}
                    </div>

                    {/* QR */}
                    {order.qrToken && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 12 }}>📱 QR Code</div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                {origin && (
                                    <QRCodeSVG
                                        value={`${origin}/qr/verify?orderId=${order.id}&token=${encodeURIComponent(order.qrToken ?? '')}`}
                                        size={180}
                                        bgColor="#ffffff"
                                        fgColor="#1a1a2e"
                                        level="M"
                                    />
                                )}
                                {order.qrExpiry && (
                                    <div style={{ fontSize: 12, color: new Date(order.qrExpiry) < new Date() ? '#ef4444' : '#10b981' }}>
                                        {t('Expires', 'ينتهي')}: {new Date(order.qrExpiry).toLocaleString()}
                                    </div>
                                )}
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}>
                                    {order.qrToken}
                                </div>
                            </div>
                        </div>
                    )}

                    {order.notes && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 12 }}>📝 {t('Notes', 'ملاحظات')}</div>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{order.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Assign Technician Modal ── */}
            {
                showAssignModal && (
                    <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                            <div className="modal-header">
                                <h2>👤 {isApproveWorkflow ? t('Approve & Assign Technicians', 'اعتماد وتعيين فنيين') : t('Assign Technicians', 'تعيين فنيين')}</h2>
                                <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    {t('Order', 'الطلب')}: <strong>{order.orderNumber || `#${order.id}`}</strong>
                                    {' — '}{t('Department', 'القسم')}: <strong>{order.departmentName || `#${order.departmentId}`}</strong>
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

                                    {techsLoading ? (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                                            ⏳ {t('Loading technicians...', 'جارٍ تحميل الفنيين...')}
                                        </p>
                                    ) : technicians.length === 0 ? (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                                            {t('No technicians found in this branch.', 'لا يوجد فنيون في هذا الفرع.')}
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                                            {technicians.map(tech => {
                                                const checked = selectedTechs.has(tech.id);
                                                return (
                                                    <label key={tech.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '10px 14px',
                                                        background: checked ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)',
                                                        border: `1px solid ${checked ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer', transition: 'all 150ms',
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
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('Optional notes...', 'ملاحظات اختيارية...')}
                                        value={assignNotes}
                                        onChange={e => setAssignNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>{t('Cancel', 'إلغاء')}</button>
                                <button
                                    className="btn btn-primary"
                                    disabled={selectedTechs.size === 0 || assignLoading}
                                    onClick={handleAssign}
                                >
                                    {assignLoading
                                        ? `⏳ ${t('Assigning...', 'جارٍ التعيين...')}`
                                        : isApproveWorkflow
                                            ? `✅ ${t('Approve & Assign', 'اعتماد وتعيين')} (${selectedTechs.size})`
                                            : `✅ ${t('Assign', 'تعيين')} (${selectedTechs.size})`
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Return Order Modal */}
            {showReturnModal && (
                <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>↩️ {t('Return Order', 'إرجاع الطلب')}</h2>
                            <button className="modal-close" onClick={() => setShowReturnModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                {t('Returning order', 'إرجاع الطلب')} <strong>{order?.orderNumber || `#${order?.id}`}</strong>
                            </p>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label">{t('Return to', 'إرجاع إلى')}</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                                    {order?.status === 'PendingSalesSupervisorApproval' && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="radio" checked={returnToRep} onChange={() => setReturnToRep(true)} />
                                            {t('Return to Sales Rep', 'إرجاع إلى مندوب المبيعات')}
                                        </label>
                                    )}
                                    {order?.status === 'PendingInstallationSupervisorApproval' && (<>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="radio" checked={!returnToRep} onChange={() => setReturnToRep(false)} />
                                            {t('Return to Sales Supervisor', 'إرجاع إلى مشرف المبيعات')}
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="radio" checked={returnToRep} onChange={() => setReturnToRep(true)} />
                                            {t('Return to Sales Rep', 'إرجاع إلى مندوب المبيعات')}
                                        </label>
                                    </>)}
                                    {order?.status !== 'PendingSalesSupervisorApproval' && order?.status !== 'PendingInstallationSupervisorApproval' && (<>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="radio" checked={!returnToRep} onChange={() => setReturnToRep(false)} />
                                            {t('Return to Previous Step', 'إرجاع إلى الخطوة السابقة')}
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="radio" checked={returnToRep} onChange={() => setReturnToRep(true)} />
                                            {t('Return to Sales Rep', 'إرجاع إلى مندوب المبيعات')}
                                        </label>
                                    </>)}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Return Reason', 'سبب الإرجاع')}</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder={t('Enter reason for return...', 'أدخل سبب الإرجاع...')}
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-warning" disabled={returnLoading || !returnReason.trim()} onClick={handleReturn}>
                                {returnLoading ? `⏳ ${t('Returning...', 'جارٍ الإرجاع...')}` : `↩️ ${t('Confirm Return', 'تأكيد الإرجاع')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Order Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2>{t('Edit Order', 'تعديل الطلب')}</h2>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">{t('Status', 'الحالة')}</label>
                                <select className="form-input" value={editForm.status || 'Draft'} onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}>
                                    {(['Draft', 'PendingSalesSupervisorApproval', 'PendingInstallationSupervisorApproval', 'ReadyForInstallation', 'ReturnedToDraft', 'ReturnedToSales', 'Completed', 'Canceled'] as OrderStatus[]).map(s => (
                                        <option key={s} value={s}>{getOrderStatusLabel(s, lang)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="two-col-form">
                                <div className="form-group">
                                    <label className="form-label">{t('Branch', 'الفرع')}</label>
                                    <select className="form-input" value={editForm.branchIds?.[0] || ''} onChange={async e => {
                                        const bid = e.target.value ? Number(e.target.value) : undefined;
                                        setEditForm(prev => ({ ...prev, branchIds: bid ? [bid] : [], departmentId: 0 }));
                                        const depts = await getDepartments(bid).catch(() => [] as Department[]);
                                        setEditDepts(depts);
                                    }}>
                                        <option value="">{t('Select branch', 'اختر الفرع')}</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{t('Departments', 'الأقسام')}</label>
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-secondary)' }}>
                                        {editDepts.length === 0 && (
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('Select a branch first', 'اختر الفرع أولاً')}</span>
                                        )}
                                        {editDepts.map(d => {
                                            const sel = (editForm.departmentIds || []).find(x => x.idd === d.id);
                                            return (
                                                <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: sel ? 600 : 400 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!sel}
                                                            onChange={e => {
                                                                const cur = editForm.departmentIds || [];
                                                                setEditForm(prev => ({
                                                                    ...prev,
                                                                    departmentIds: e.target.checked
                                                                        ? [...cur, { idd: d.id, note: '' }]
                                                                        : cur.filter(x => x.idd !== d.id),
                                                                }));
                                                            }}
                                                        />
                                                        {d.name}
                                                    </label>
                                                    {sel && (
                                                        <textarea
                                                            className="form-textarea"
                                                            placeholder={t('Note for this department (optional)', 'ملاحظة لهذا القسم (اختياري)')}
                                                            rows={2}
                                                            style={{ marginInlineStart: 24, fontSize: 13 }}
                                                            value={sel.note || ''}
                                                            onChange={e => setEditForm(prev => ({
                                                                ...prev,
                                                                departmentIds: (prev.departmentIds || []).map(x => x.idd === d.id ? { ...x, note: e.target.value } : x),
                                                            }))}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Priority', 'الأولوية')}</label>
                                <select className="form-input" value={editForm.priority || 'Normal'} onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value as any }))}>
                                    <option value="Normal">Normal</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Scheduled Date', 'تاريخ الموعد')}</label>
                                <input type="datetime-local" className="form-input" value={editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString().slice(0, 16) : ''} onChange={e => setEditForm(prev => ({ ...prev, scheduledDate: new Date(e.target.value).toISOString() }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('City', 'المدينة')}</label>
                                <input type="text" className="form-input" value={editForm.city || ''} onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Address', 'العنوان')}</label>
                                <textarea className="form-textarea" rows={2} value={editForm.address || ''} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📍 {t('Location Link', 'رابط الموقع')}</label>
                                <input type="text" className="form-input" placeholder="https://maps.google.com/..." value={editForm.location || ''} onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📝 {t('Notes', 'الملاحظات')}</label>
                                <textarea className="form-textarea" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} />
                            </div>
                            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={handleUpdateOrder} disabled={editLoading}>
                                {editLoading ? '✍️...' : t('Save Changes', 'حفظ التغييرات')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
