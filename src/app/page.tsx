'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStatistics, getBranches, getDepartments } from '@/lib/endpoints';
import { Statistics, Order, Branch, Department } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import MultiSelect from '@/components/MultiSelect';
import { useLang } from '@/context/LanguageContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

export default function DashboardPage() {
  const { lang, t } = useLang();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branchFilter, setBranchFilter] = useState<number[]>([]);
  const [deptFilter, setDeptFilter] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ branchFilter: number[]; deptFilter: number[]; dateFrom: string; dateTo: string }>({ branchFilter: [], deptFilter: [], dateFrom: '', dateTo: '' });

  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    getDepartments(branchFilter.length ? branchFilter : undefined)
      .then(setDepartments)
      .catch(() => setDepartments([]));
    setDeptFilter([]);
  }, [branchFilter]);

  const deptOptions = departments;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const statsData = await getStatistics({
          branchIds: appliedFilters.branchFilter.length ? appliedFilters.branchFilter : undefined,
          departmentIds: appliedFilters.deptFilter.length ? appliedFilters.deptFilter : undefined,
          from: appliedFilters.dateFrom || undefined,
          to: appliedFilters.dateTo || undefined,
        });
        setStats(statsData);
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
  }, [appliedFilters]);

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

  const totalOrders = stats?.total ?? stats?.totalOrders ?? 0;
  const pendingSales = stats?.pendingSalesApproval ?? stats?.pendingSalesManager ?? 0;
  const pendingSupervisor = stats?.pendingSupervisiorApproval ?? stats?.pendingSupervisorApproval ?? stats?.pendingSupervisor ?? 0;
  const readyForInst = stats?.readyForInstallation ?? stats?.inProgress ?? 0;
  const complete = stats?.completed ?? stats?.complete ?? 0;
  const urgent = stats?.urgent ?? 0;
  const draft = stats?.draft ?? 0;
  const canceled = stats?.canceled ?? stats?.cancelled ?? 0;
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

  // Chart data
  const pieData = [
    { name: t('Draft', 'مسودة'), value: draft, color: '#94a3b8' },
    { name: t('Pending Sales', 'بانتظار المبيعات'), value: pendingSales, color: '#f59e0b' },
    { name: t('Pending Supervisor', 'بانتظار المشرف'), value: pendingSupervisor, color: '#8b5cf6' },
    { name: t('In Progress', 'قيد التنفيذ'), value: readyForInst, color: '#06b6d4' },
    { name: t('Complete', 'مكتمل'), value: complete, color: '#10b981' },
    { name: t('Returned', 'مُرتجع'), value: returned, color: '#f97316' },
    { name: t('Canceled', 'ملغي'), value: canceled, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const barData = [
    { name: t('Draft', 'مسودة'), value: draft, fill: '#94a3b8' },
    { name: t('Pend. Sales', 'مبيعات'), value: pendingSales, fill: '#f59e0b' },
    { name: t('Pend. Sup.', 'مشرف'), value: pendingSupervisor, fill: '#8b5cf6' },
    { name: t('In Progress', 'تنفيذ'), value: readyForInst, fill: '#06b6d4' },
    { name: t('Complete', 'مكتمل'), value: complete, fill: '#10b981' },
    { name: t('Returned', 'مُرتجع'), value: returned, fill: '#f97316' },
    { name: t('Canceled', 'ملغي'), value: canceled, fill: '#ef4444' },
  ];

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>{t('Dashboard', 'لوحة التحكم')}</h1>
        <p>{t('Overview of installation orders', 'نظرة عامة على أوامر التركيب')}</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('Branch', 'الفرع')}</label>
            <MultiSelect
              options={branches}
              value={branchFilter}
              onChange={ids => { setBranchFilter(ids); setDeptFilter([]); }}
              placeholder={t('All Branches', 'جميع الفروع')}
              style={{ minWidth: 160 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('Department', 'القسم')}</label>
            <MultiSelect
              options={deptOptions}
              value={deptFilter}
              onChange={setDeptFilter}
              placeholder={t('All Departments', 'جميع الأقسام')}
              style={{ minWidth: 180 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('From', 'من')}</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: 150 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('To', 'إلى')}</label>
            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minWidth: 150 }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setAppliedFilters({ branchFilter, deptFilter, dateFrom, dateTo })}>
            {t('Apply', 'تطبيق')}
          </button>
          {(appliedFilters.branchFilter.length > 0 || appliedFilters.deptFilter.length > 0 || appliedFilters.dateFrom || appliedFilters.dateTo || branchFilter.length > 0 || deptFilter.length > 0 || dateFrom || dateTo) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setBranchFilter([]); setDeptFilter([]); setDateFrom(''); setDateTo(''); setAppliedFilters({ branchFilter: [], deptFilter: [], dateFrom: '', dateTo: '' }); }}>
              {t('Clear', 'مسح')}
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
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

      {/* Charts */}
      {totalOrders > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
          {/* Donut chart */}
          <div className="card" style={{ padding: '20px 16px' }}>
            <div className="card-title" style={{ marginBottom: 16 }}>{t('Order Status Breakdown', 'توزيع حالات الأوامر')}</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="card" style={{ padding: '20px 16px' }}>
            <div className="card-title" style={{ marginBottom: 16 }}>{t('Orders by Status', 'الأوامر حسب الحالة')}</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} formatter={(value) => [value, t('Orders', 'أوامر')]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                <th>{t('Actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
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
                    <td>
                      <Link href={`/orders/${order.id}`} className="btn btn-secondary btn-sm">{t('View', 'عرض')}</Link>
                    </td>
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
