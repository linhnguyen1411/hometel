import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  PieChart,
  Plus,
  Receipt,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
  Check,
  Zap,
  Wrench,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';

interface ConsolidatedPnlViewProps {
  buildings: any[];
}

export const ConsolidatedPnlView: React.FC<ConsolidatedPnlViewProps> = ({ buildings }) => {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [data, setData] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // Form for adding expense
  const [expenseForm, setExpenseForm] = useState({
    buildingId: buildings.length > 0 ? buildings[0].id : 'bld_1',
    category: 'MAINTENANCE_REPAIR',
    description: '',
    amount: 1500000,
    vendorName: '',
    expenseDate: new Date().toISOString().substring(0, 10)
  });

  const fetchPnlData = async () => {
    setLoading(true);
    try {
      const [pnlRes, expRes] = await Promise.all([
        api.getConsolidatedPnL(selectedMonth),
        api.getExpenses(`periodMonth=${selectedMonth}`)
      ]);
      setData(pnlRes);
      setExpenses(expRes);
    } catch (err: any) {
      console.error('Failed to load P&L data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnlData();
  }, [selectedMonth]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createExpense({
        ...expenseForm,
        periodMonth: selectedMonth
      });
      setShowAddExpenseModal(false);
      setExpenseForm({
        buildingId: buildings.length > 0 ? buildings[0].id : 'bld_1',
        category: 'MAINTENANCE_REPAIR',
        description: '',
        amount: 1500000,
        vendorName: '',
        expenseDate: new Date().toISOString().substring(0, 10)
      });
      fetchPnlData();
    } catch (err: any) {
      alert(err.message || 'Lỗi thêm chi phí vận hành');
    }
  };

  const port = data?.portfolio || {
    totalBuildings: 0,
    totalRooms: 0,
    grossRevenue: 0,
    revenueCollected: 0,
    totalOperatingExpense: 0,
    netOperatingIncome: 0,
    operatingMargin: 0,
    collectionRate: 0,
    momRevenueGrowth: 0,
    momNoiGrowth: 0
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Period Selector */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
              CONSOLIDATED P&L
            </span>
            <span className="text-xs text-slate-400">Báo cáo tài chính hợp nhất đa tòa nhà</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600" />
            <span>Hiệu quả kinh doanh & Lợi nhuận ròng (NOI)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp doanh thu cho thuê, thu phí tiện ích và chi phí vận hành toàn bộ danh mục tòa nhà.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold outline-hidden focus:border-blue-500 font-mono"
            >
              <option value="2026-07">Kỳ 07/2026</option>
              <option value="2026-08">Kỳ 08/2026</option>
              <option value="2026-09">Kỳ 09/2026 (Hiện tại)</option>
              <option value="2026-10">Kỳ 10/2026</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddExpenseModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm chi phí vận hành</span>
          </button>
        </div>
      </div>

      {/* Portfolio Financial Executive Bento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Gross Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Tổng doanh thu phát sinh</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {(port.grossRevenue / 1000000).toFixed(1)}M
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              {port.grossRevenue.toLocaleString()} đ
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {port.momRevenueGrowth >= 0 ? (
              <span className="text-emerald-600 font-bold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{port.momRevenueGrowth}% MoM
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded">
                <ArrowDownRight className="w-3.5 h-3.5" /> {port.momRevenueGrowth}% MoM
              </span>
            )}
            <span className="text-[11px] text-slate-400">so với tháng trước</span>
          </div>
        </div>

        {/* Card 2: Cash Collected */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Dòng tiền thực thu (Cash)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 font-mono">
              {(port.revenueCollected / 1000000).toFixed(1)}M
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Thu đạt {port.collectionRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(port.collectionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Operating Expenses */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Tổng chi phí vận hành (OpEx)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 font-mono">
              {(port.totalOperatingExpense / 1000000).toFixed(1)}M
            </span>
            <span className="text-xs font-mono text-slate-500">
              {port.totalOperatingExpense.toLocaleString()} đ
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-3 block">
            {expenses.length} khoản chi phí được ghi nhận
          </span>
        </div>

        {/* Card 4: Net Operating Income (NOI) */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-slate-500 text-xs font-bold block">Lợi nhuận ròng vận hành (NOI)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {(port.netOperatingIncome / 1000000).toFixed(1)}M
            </span>
            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              Biên {port.operatingMargin}%
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {port.momNoiGrowth >= 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-0.5 bg-emerald-100 px-1.5 py-0.5 rounded">
                <ArrowUpRight className="w-3.5 h-3.5" /> +{port.momNoiGrowth}% MoM
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded">
                <ArrowDownRight className="w-3.5 h-3.5" /> {port.momNoiGrowth}% MoM
              </span>
            )}
            <span className="text-[11px] text-slate-500">tăng trưởng lợi nhuận</span>
          </div>
        </div>
      </div>

      {/* Multi-Building Performance Comparison Matrix */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Ma trận hiệu quả kinh doanh từng tòa nhà</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              So sánh tỷ suất sinh lời, dòng tiền thu và chi phí vận hành giữa các cơ sở trong danh mục.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tòa nhà</th>
                <th className="p-3 text-center">Quy mô</th>
                <th className="p-3 text-right">Doanh thu gộp</th>
                <th className="p-3 text-right">Thực thu (Cash)</th>
                <th className="p-3 text-right">Chi phí vận hành</th>
                <th className="p-3 text-right">Lợi nhuận ròng (NOI)</th>
                <th className="p-3 text-center">Biên lợi nhuận</th>
                <th className="p-3 text-center">Tỷ lệ thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.buildings?.map((b: any) => (
                <tr key={b.buildingId} className="hover:bg-slate-50">
                  <td className="p-3 font-sans">
                    <span className="font-bold text-slate-900 block">{b.buildingName}</span>
                    <span className="text-[11px] text-slate-400 block truncate">{b.address}</span>
                  </td>

                  <td className="p-3 text-center font-bold text-slate-700">
                    {b.totalRooms} căn
                  </td>

                  <td className="p-3 text-right font-bold text-slate-900">
                    {b.grossRevenue.toLocaleString()} đ
                  </td>

                  <td className="p-3 text-right font-bold text-emerald-600">
                    {b.revenueCollected.toLocaleString()} đ
                  </td>

                  <td className="p-3 text-right font-semibold text-amber-600">
                    {b.totalOperatingExpense.toLocaleString()} đ
                  </td>

                  <td className="p-3 text-right font-black text-emerald-700">
                    {b.netOperatingIncome.toLocaleString()} đ
                  </td>

                  <td className="p-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {b.operatingMargin}%
                    </span>
                  </td>

                  <td className="p-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      b.collectionRate >= 90 ? 'bg-emerald-100 text-emerald-800' :
                      b.collectionRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {b.collectionRate}%
                    </span>
                  </td>
                </tr>
              ))}

              {(!data?.buildings || data.buildings.length === 0) && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                    Đang tổng hợp dữ liệu tài chính...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses History Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-600" />
              <span>Nhật ký chi phí vận hành (Operating Expense Journal)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Các khoản chi tiền điện, nước công cộng, bảo dưỡng kỹ thuật, vệ sinh định kỳ trong kỳ {selectedMonth}.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Ngày chi</th>
                <th className="p-3">Tòa nhà</th>
                <th className="p-3">Danh mục</th>
                <th className="p-3">Mô tả chi tiết</th>
                <th className="p-3">Đơn vị cung cấp</th>
                <th className="p-3 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-700">
                    {exp.expense_date}
                  </td>
                  <td className="p-3 font-semibold text-slate-900">
                    {exp.building_name}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      {exp.category}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800">
                    {exp.description}
                  </td>
                  <td className="p-3 text-slate-500">
                    {exp.vendor_name || '—'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-amber-600">
                    {exp.amount.toLocaleString()} đ
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Chưa có khoản chi phí vận hành nào được ghi nhận trong kỳ {selectedMonth}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Thêm chi phí vận hành */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900">Ghi nhận chi phí vận hành</h4>
              <button onClick={() => setShowAddExpenseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tòa nhà phát sinh chi phí *</label>
                <select
                  required
                  value={expenseForm.buildingId}
                  onChange={e => setExpenseForm({ ...expenseForm, buildingId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold"
                >
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Danh mục chi phí *</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                  >
                    <option value="MAINTENANCE_REPAIR">Bảo trì & Sửa chữa</option>
                    <option value="UTILITY_MUNICIPAL">Điện nước công cộng</option>
                    <option value="CLEANING_JANITORIAL">Vệ sinh & Rác thải</option>
                    <option value="SECURITY">Bảo vệ & An ninh</option>
                    <option value="INTERNET_TELECOM">Internet & Viễn thông</option>
                    <option value="STAFF_SALARY">Lương nhân sự vận hành</option>
                    <option value="TAX_INSURANCE">Bảo hiểm & Thuế</option>
                    <option value="OTHER">Chi phí khác</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Số tiền (VND) *</label>
                  <input
                    type="number"
                    step="1000"
                    required
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mô tả nội dung chi *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Thay bơm tăng áp tầng thượng, bảo dưỡng thang máy..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Đơn vị cung cấp</label>
                  <input
                    type="text"
                    value={expenseForm.vendorName}
                    onChange={e => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                    placeholder="Công ty Thang máy..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ngày chi</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expenseDate}
                    onChange={e => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                >
                  Lưu khoản chi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
