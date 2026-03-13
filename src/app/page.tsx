'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStatistics, getBranches } from '@/lib/endpoints';
import { Statistics, Order, Branch } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { useLang } from '@/context/LanguageContext';

export default function DashboardPage() {
  const { lang, t } = useLang();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const statsData = await getStatistics(
          branchFilter || undefined,
          dateFrom || undefined,
          dateTo || undefined,
        );
        setStats(statsData);
        // Use orders embedded in the statistics response
        const orders = Array.isArray(statsData?.orders) ? statsData.orders : [];
        const sorted = orders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentOrders(sorted);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branchFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>⚡</div>
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{t('Loading dashboard...', 'جارٍ تحميل لوحة التحكم...')}</p>
        </div>
      </div>
    );
  }

  // Normalize stats — handle the actual API field naming
  const totalOrders = stats?.total ?? stats?.totalOrders ?? 0;
  const pendingSales = stats?.pendingSalesApproval ?? stats?.pendingSalesManager ?? 0;
  const pendingSupervisor = stats?.pendingSupervisiorApproval ?? stats?.pendingSupervisorApproval ?? stats?.pendingSupervisor ?? 0;
  const readyForInst = stats?.readyForInstallation ?? stats?.inProgress ?? 0;
  const complete = stats?.completed ?? stats?.complete ?? 0;
  const urgent = stats?.urgent ?? 0;
  const draft = stats?.draft ?? 0;
  const returned = stats?.returnedToDraft ?? stats?.returnedToSales ?? stats?.returned ?? 0;

  const statCards = [
    { label: t('Total Orders', 'إجمالي الأوامر'), value: totalOrders, icon: '📋', color: '#3b82f6' },
    { label: t('Drafts', 'المسودات'), value: draft, icon: '📝', color: '#94a3b8' },
    { label: t('Pending Sales', 'بانتظار المبيعات'), value: pendingSales, icon: '⏳', color: '#f59e0b' },
    { label: t('Pending Supervisor', 'بانتظار المشرف'), value: pendingSupervisor, icon: '👷', color: '#8b5cf6' },
    { label: t('In Progress', 'قيد التنفيذ'), value: readyForInst, icon: '🔧', color: '#06b6d4' },
    { label: t('Complete', 'مكتمل'), value: complete, icon: '✅', color: '#10b981' },
    { label: t('Urgent', 'عاجل'), value: urgent, icon: '🚨', color: '#ef4444' },
  ];

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>{t('Dashboard', 'لوحة التحكم')}</h1>
        <p>{t('Overview of installation orders', 'نظرة عامة على أوامر التركيب')}</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
          {(branchFilter || dateFrom || dateTo) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter(''); setDateFrom(''); setDateTo(''); }}>
              {t('Clear', 'مسح')}
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(card => (
          <div key={card.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
              {card.icon}
            </div>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{t('Recent Orders', 'أحدث الأوامر')}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('Latest activity across all departments', 'أحدث النشاطات عبر جميع الأقسام')}</p>
          </div>
          <Link href="/sales/orders" className="btn btn-secondary btn-sm">{t('View All →', 'عرض الكل →')}</Link>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('Order', 'الطلب')}</th>
                <th>{t('Customer', 'العميل')}</th>
                <th>{t('Department', 'القسم')}</th>
                <th>{t('Status', 'الحالة')}</th>
                <th>{t('Date', 'التاريخ')}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    {t('No orders found', 'لا توجد أوامر')}
                  </td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`} className="table-cell-main" style={{ color: 'var(--accent-primary-hover)' }}>
                        {order.orderNumber || `#${order.id}`}
                      </Link>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {order.invoiceId || order.quotationId || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.customerName || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.city || ''}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>{order.departmentName || `Dept #${order.departmentId}`}</span>
                    </td>
                    <td><StatusBadge status={order.status} lang={lang} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
