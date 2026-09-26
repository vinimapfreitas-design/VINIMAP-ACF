import React from 'react';
import { Order, PartnerClient } from '../types';
import { Download, FileText, DollarSign } from 'lucide-react';
import { exportOrdersToCSV } from '../utils/exportUtils';

interface BillingExportPanelProps {
  orders: Order[];
  partnerClients: PartnerClient[];
}

export const BillingExportPanel: React.FC<BillingExportPanelProps> = ({ orders = [], partnerClients = [] }) => {
  const totalBilling = orders.reduce((acc, o) => acc + (o.value || 0), 0);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Faturamento & Relatórios de Exportação</h3>
          <p className="text-xs text-slate-500">Gere resumos consolidados para faturamento dos parceiros</p>
        </div>

        <button
          onClick={() => exportOrdersToCSV(orders, partnerClients)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors"
        >
          <Download size={16} />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-600 mb-1">Total Faturado</p>
          <p className="text-2xl font-black text-blue-900">R$ {totalBilling.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
          <p className="text-xs font-semibold text-emerald-600 mb-1">Parceiros Ativos</p>
          <p className="text-2xl font-black text-emerald-900">{partnerClients.length}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
          <p className="text-xs font-semibold text-purple-600 mb-1">Total de Pedidos</p>
          <p className="text-2xl font-black text-purple-900">{orders.length}</p>
        </div>
      </div>
    </div>
  );
};

export default BillingExportPanel;
