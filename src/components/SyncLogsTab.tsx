import React from 'react';
import { Order, PartnerClient } from '../types';
import { List, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SyncLogsTabProps {
  orders: Order[];
  partnerClients: PartnerClient[];
  freightRules?: any[];
  onRecalculateOrdersFreight?: (...args: any[]) => void;
  onUpdateOrder?: (...args: any[]) => void;
  onNavigateToFreightConfig?: (...args: any[]) => void;
}

export const SyncLogsTab: React.FC<SyncLogsTabProps> = ({
  orders = [],
  partnerClients = [],
  freightRules = [],
  onRecalculateOrdersFreight,
  onUpdateOrder,
  onNavigateToFreightConfig
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
          <List size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Logs de Sincronização e Auditoria</h3>
          <p className="text-xs text-slate-500">Histórico de reajustes de frete e status de dados</p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
        <p>Total de Pedidos Auditados: <span className="font-bold text-slate-800">{orders.length}</span></p>
        <p>Total de Regras Aplicadas: <span className="font-bold text-slate-800">{freightRules.length}</span></p>
      </div>
    </div>
  );
};

export default SyncLogsTab;
