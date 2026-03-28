'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder, getBranches, getDepartments, getApexInvoices, getApexOffers } from '@/lib/endpoints';
import { Branch, Department, AddOrderDto, ApexInvoice, ApexOffer } from '@/types';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS } from '@/context/RoleContext';
import { useLang } from '@/context/LanguageContext';

export default function NewOrderPage() {
    const router = useRouter();
    const { t } = useLang();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [invoices, setInvoices] = useState<ApexInvoice[]>([]);
    const [offers, setOffers] = useState<ApexOffer[]>([]);
    const [apexError, setApexError] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [docType, setDocType] = useState<'invoice' | 'quotation'>('invoice');
    const [selectedDocId, setSelectedDocId] = useState('');
    const [apexSearch, setApexSearch] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [city, setCity] = useState('');
    const [address, setAddress] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
    const [branchId, setBranchId] = useState<number>(0);
    const [departmentId, setDepartmentId] = useState<number>(0);

    useEffect(() => {
        async function load() {
            try {
                const [b, d] = await Promise.all([getBranches(), getDepartments()]);
                setBranches(b);
                setDepartments(d);
                if (b.length > 0) setBranchId(b[0].id);
                if (d.length > 0) setDepartmentId(d[0].id);
            } catch (err) {
                console.error('Failed to load form data:', err);
            }
            // Load APEX docs separately so branch/dept failure doesn't block them
            try {
                const [inv, off] = await Promise.all([
                    getApexInvoices().catch((e) => { setApexError(String(e?.message || e)); return []; }),
                    getApexOffers().catch(() => []),
                ]);
                setInvoices(inv);
                setOffers(off);
            } catch {
                // APEX is optional — form still works with manual entry
            }
        }
        load();
    }, []);

    // Reload departments when branch changes
    useEffect(() => {
        if (branchId) {
            setDepartments([]);
            setDepartmentId(0);
            getDepartments(branchId)
                .then(d => {
                    const list = Array.isArray(d) ? d : [];
                    setDepartments(list);
                    if (list.length > 0) setDepartmentId(list[0].id);
                })
                .catch(() => { });
        }
    }, [branchId]);

    const handleSubmit = async (asDraft: boolean) => {
        if (!branchId || !departmentId) {
            setError(t('Please select branch and department', 'الرجاء اختيار الفرع والقسم'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const dto: AddOrderDto = {
                status: asDraft ? 'Draft' : 'PendingSalesApproval',
                city: city || null,
                address: address || null,
                location: location || null,
                scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
                quotationId: docType === 'quotation' ? selectedDocId || null : null,
                invoiceId: docType === 'invoice' ? selectedDocId || null : null,
                customerId: customerId || null,
                createdAt: new Date().toISOString(),
                priority,
                branchId,
                departmentId,
                notes: notes || null,
            };

            const newOrder = await createOrder(dto);
            router.push(`/orders/${newOrder.id}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('Failed to create order', 'فشل إنشاء الطلب'));
        } finally {
            setLoading(false);
        }
    };

    // When a document is selected, auto-fill customer
    const selectedInvoice = useMemo(() => invoices.find(i => i.code === selectedDocId), [invoices, selectedDocId]);
    const selectedOffer = useMemo(() => offers.find(o => o.code === selectedDocId), [offers, selectedDocId]);
    const selectedDoc = docType === 'invoice' ? selectedInvoice : selectedOffer;

    useEffect(() => {
        if (selectedDoc?.customer?.code) {
            setCustomerId(selectedDoc.customer.code);
        }
    }, [selectedDoc]);

    const filteredDepts = departments;

    return (
        <PermissionGuard requiredPerms={[PERMS.ORDERS_CREATE]}>
            <div className="animate-in">
                <div className="page-header">
                    <h1>{t('Create Installation Order', 'إنشاء أمر تركيب')}</h1>
                    <p>{t('Create a new installation order from a sales document', 'إنشاء أمر تركيب جديد من مستند مبيعات')}</p>
                </div>

                {error && (
                    <div style={{
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        color: '#ef4444',
                        fontSize: 13,
                        marginBottom: 20,
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                    {/* Form */}
                    <div>
                        {/* Sales Document */}
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-title" style={{ marginBottom: 16 }}>📄 {t('Sales Document', 'مستند المبيعات')}</div>

                            {apexError && (
                                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', color: '#f59e0b', fontSize: 12, marginBottom: 16 }}>
                                    ⚠️ {t('APEX connection issue', 'مشكلة اتصال APEX')} — {apexError}. {t('You can still enter document IDs manually.', 'لا يزال بإمكانك إدخال معرفات المستندات يدوياً.')}
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Document Type', 'نوع المستند')} *</label>
                                    <select className="form-select" value={docType} onChange={e => { setDocType(e.target.value as 'invoice' | 'quotation'); setSelectedDocId(''); setApexSearch(''); }}>
                                        <option value="invoice">{t('Invoice', 'فاتورة')}</option>
                                        <option value="quotation">{t('Quotation / Offer', 'عرض سعر')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Search APEX Code', 'البحث برمز APEX')}</label>
                                    <input
                                        className="form-input"
                                        placeholder={t('Search by code or customer...', 'ابحث بالرمز أو العميل...')}
                                        value={apexSearch}
                                        onChange={e => setApexSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            {(() => {
                                const q = apexSearch.toLowerCase();
                                const docs = docType === 'invoice'
                                    ? invoices.filter(inv => !q || inv.code.toLowerCase().includes(q) || (inv.customer?.latinName || inv.customer?.arabicName || '').toLowerCase().includes(q))
                                    : offers.filter(off => !q || off.code.toLowerCase().includes(q) || (off.customer?.latinName || off.customer?.arabicName || '').toLowerCase().includes(q));
                                if (invoices.length === 0 && offers.length === 0) return <span className="form-hint">{t('No APEX documents loaded — enter ID manually below', 'لم يتم تحميل مستندات APEX — أدخل المعرف يدوياً أدناه')}</span>;
                                return (
                                    <div className="form-group">
                                        <label className="form-label">{t('Select from APEX', 'اختر من APEX')} {docs.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({docs.length})</span>}</label>
                                        <select className="form-select" value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}>
                                            <option value="">— {t('Select', 'اختر')} —</option>
                                            {docType === 'invoice'
                                                ? (docs as typeof invoices).map(inv => (
                                                    <option key={inv.code} value={inv.code}>
                                                        {inv.code} — {inv.customer?.latinName || inv.customer?.arabicName || '—'} ({new Date(inv.invoiceDate).toLocaleDateString()})
                                                    </option>
                                                ))
                                                : (docs as typeof offers).map(off => (
                                                    <option key={off.code} value={off.code}>
                                                        {off.code} — {off.customer?.latinName || off.customer?.arabicName || '—'}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                );
                            })()}

                            {/* Selected doc preview */}
                            {selectedDoc && (
                                <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
                                    <div><span style={{ color: 'var(--text-muted)' }}>{t('Customer', 'العميل')}: </span><strong>{selectedDoc.customer?.latinName || selectedDoc.customer?.arabicName}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>{t('Net Total', 'الإجمالي الصافي')}: </span><strong>SAR {selectedDoc.net?.toLocaleString()}</strong></div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>{t('VAT', 'الضريبة')}: </span>SAR {selectedDoc.totalVat?.toLocaleString()}</div>
                                    <div><span style={{ color: 'var(--text-muted)' }}>{t('Items', 'العناصر')}: </span>{selectedDoc.items?.length ?? 0}</div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">{t('Document ID (manual override)', 'معرف المستند (إدخال يدوي)')}</label>
                                <input
                                    className="form-input"
                                    placeholder={docType === 'invoice' ? 'e.g. INV-2026-001' : 'e.g. OP-2026-001'}
                                    value={selectedDocId}
                                    onChange={e => setSelectedDocId(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Customer Code', 'رمز العميل')}</label>
                                <input
                                    className="form-input"
                                    placeholder={t('Auto-filled from selection or enter manually', 'يُملأ تلقائياً أو أدخل يدوياً')}
                                    value={customerId}
                                    onChange={e => setCustomerId(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Installation Details */}
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-title" style={{ marginBottom: 16 }}>🔧 {t('Installation Details', 'تفاصيل التركيب')}</div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Branch', 'الفرع')} *</label>
                                    <select className="form-select" value={branchId} onChange={e => setBranchId(Number(e.target.value))}>
                                        <option value={0}>— {t('Select Branch', 'اختر الفرع')} —</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Department', 'القسم')} *</label>
                                    <select className="form-select" value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))}>
                                        <option value={0}>— {t('Select Department', 'اختر القسم')} —</option>
                                        {filteredDepts.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('City', 'المدينة')}</label>
                                    <input className="form-input" placeholder={t('City', 'المدينة')} value={city} onChange={e => setCity(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Address', 'العنوان')}</label>
                                    <input className="form-input" placeholder={t('Full address', 'العنوان الكامل')} value={address} onChange={e => setAddress(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">📍 {t('Location Link', 'رابط الموقع')}</label>
                                <input className="form-input" placeholder="https://maps.google.com/..." value={location} onChange={e => setLocation(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📝 {t('Notes', 'ملاحظات')}</label>
                                <textarea className="form-textarea" rows={3} placeholder={t('Additional notes...', 'ملاحظات إضافية...')} value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Scheduled Date', 'التاريخ المجدول')}</label>
                                    <input className="form-input" type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Priority', 'الأولوية')}</label>
                                    <select className="form-select" value={priority} onChange={e => setPriority(e.target.value as 'Normal' | 'Urgent')}>
                                        <option value="Normal">{t('Normal', 'عادي')}</option>
                                        <option value="Urgent">{t('Urgent', 'عاجل')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Summary */}
                    <div style={{ position: 'sticky', top: 24 }}>
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 16 }}>📝 {t('Summary', 'الملخص')}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Type', 'النوع')}</span>
                                    <span>{docType === 'invoice' ? t('Invoice', 'فاتورة') : t('Quotation', 'عرض سعر')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Doc ID', 'معرف المستند')}</span>
                                    <span>{selectedDocId || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Branch', 'الفرع')}</span>
                                    <span>{branches.find(b => b.id === branchId)?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Department', 'القسم')}</span>
                                    <span>{filteredDepts.find(d => d.id === departmentId)?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('City', 'المدينة')}</span>
                                    <span>{city || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{t('Priority', 'الأولوية')}</span>
                                    <span style={{ color: priority === 'Urgent' ? '#ef4444' : '#10b981' }}>
                                        {priority === 'Urgent' ? t('Urgent', 'عاجل') : t('Normal', 'عادي')}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={() => handleSubmit(false)}
                                    style={{ width: '100%' }}
                                >
                                    {loading ? `⏳ ${t('Submitting...', 'جارٍ الإرسال...')}` : `📤 ${t('Submit for Approval', 'إرسال للموافقة')}`}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    disabled={loading}
                                    onClick={() => handleSubmit(true)}
                                    style={{ width: '100%' }}
                                >
                                    💾 {t('Save as Draft', 'حفظ كمسودة')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PermissionGuard>
    );
}
