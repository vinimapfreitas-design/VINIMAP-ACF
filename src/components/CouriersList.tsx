import React, { useState, useMemo, useCallback } from 'react';
import { 
  Bike, 
  Car, 
  Truck, 
  Zap, 
  Star, 
  MapPin, 
  Phone,
  MessageSquare,
  Search,
  Users,
  X,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Navigation,
  Eye,
  Download,
  ClipboardCheck,
  Printer,
  Smartphone,
  QrCode
} from 'lucide-react';
import { Courier, OrderStatus } from '../types';
import { normalizeIncomingDateToBrasilia } from '../utils/dateUtils';

interface CouriersListProps {
  couriers: Courier[];
  selectedCourierId: string | null;
  setSelectedCourierId: (id: string | null) => void;
  searchTerm: string;
  orders: any[];
  freightRules?: any[];
  partnerClients?: any[];
  onOpenShareForCourier?: (courierId: string) => void;
  onUpdateCourier?: (id: string, courier: Partial<Courier>) => Promise<any>;
}

export default function CouriersList({ 
  couriers, 
  selectedCourierId, 
  setSelectedCourierId,
  searchTerm,
  orders,
  freightRules,
  partnerClients,
  onOpenShareForCourier,
  onUpdateCourier
}: CouriersListProps) {
  
  // Modal State for billing/faturamento report
  const [reportCourier, setReportCourier] = useState<Courier | null>(null);
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  
  // Date range presets initialization
  const todayObj = useMemo(() => new Date(), []);
  const initialStartDate = useMemo(() => {
    const start = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1);
    return start.toISOString().split('T')[0];
  }, [todayObj]);
  
  const initialEndDate = useMemo(() => {
    return todayObj.toISOString().split('T')[0];
  }, [todayObj]);

  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);

  // Filter couriers based on search term
  const filteredCouriers = couriers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'bicycle':
        return <Bike className="h-3.5 w-3.5" />;
      case 'car':
        return <Car className="h-3.5 w-3.5" />;
      case 'van':
        return <Truck className="h-3.5 w-3.5" />;
      default:
        return <Zap className="h-3.5 w-3.5" />; // Motorcycle as high speed / lightning bolt or similar
    }
  };

  const getVehicleLabel = (type: string) => {
    switch (type) {
      case 'bicycle': return 'Bicicleta';
      case 'car': return 'Carro de Apoio';
      case 'van': return 'Van Utilitário';
      default: return 'Motocicleta';
    }
  };

  const statusMap = {
    online: { label: 'Disponível', color: 'bg-emerald-500 text-white', ringColor: 'ring-emerald-500/20' },
    busy: { label: 'Entregando', color: 'bg-indigo-500 text-white', ringColor: 'ring-indigo-500/20' },
    offline: { label: 'Inativo', color: 'bg-slate-400 text-white', ringColor: 'ring-slate-500/10' }
  };

  // Robust date parser (handles DD/MM/YYYY and YYYY-MM-DD)
  const parseToDate = (str: string | undefined): Date | null => {
    if (!str) return null;
    const trimmed = str.trim();
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return new Date(trimmed.slice(0, 10));
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const year = parseInt(parts[2].length === 2 ? `20${parts[2]}` : parts[2], 10);
        return new Date(year, month, day);
      }
    }
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }
    }
    return null;
  };

  // Preset apply helper
  const applyPreset = (preset: 'today' | 'week' | 'month' | 'last30') => {
    const today = new Date();
    let start = new Date();
    const end = today;

    if (preset === 'today') {
      start = today;
    } else if (preset === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      start = new Date(today.setDate(diff));
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'last30') {
      start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Filter and compute report orders
  const reportOrders = useMemo(() => {
    if (!reportCourier) return [];
    return orders.filter(o => {
      if (o.courierId !== reportCourier.id) return false;
      
      let effectiveDateStr = o.dataSolicitacao;
      if (o.history && Array.isArray(o.history)) {
        const entry = [...o.history].reverse().find(h => h && h.status === o.status);
        if (entry && entry.time) {
          const parts = entry.time.split(' ');
          const datePart = parts[0];
          if (datePart) {
            effectiveDateStr = datePart;
          }
        }
      }

      const orderDate = parseToDate(effectiveDateStr);
      if (!orderDate) return true; // fallback if no date

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }
      if (end) {
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      return true;
    });
  }, [reportCourier, orders, startDate, endDate]);

  // Apply modal search input filtering on those report orders
  const filteredReportOrders = useMemo(() => {
    return reportOrders.filter(o => {
      const term = reportSearchTerm.toLowerCase();
      return (
        o.id.toLowerCase().includes(term) ||
        (o.customerName && o.customerName.toLowerCase().includes(term)) ||
        (o.address && o.address.toLowerCase().includes(term)) ||
        (o.pedido && o.pedido.toLowerCase().includes(term))
      );
    });
  }, [reportOrders, reportSearchTerm]);

  // Smart Repasse Calculation respecting courier format (tabela_cep, fixo, porcentagem) and CEP rules
  const getOrderRepasseInfo = useCallback((o: any, courier: Courier | null): { value: number; ruleDescription?: string; isCepRule: boolean } => {
    if (!courier) return { value: Number(o.valorCondutor) || 0, isCepRule: false };
    if (o.status === 'cancelled') return { value: 0, ruleDescription: 'Cancelado (Sem Repasse)', isCepRule: false };

    const formato = courier.repasseFormato || 'tabela_cep';

    if (formato === 'fixo') {
      const fixedRate = courier.repasseTaxa !== undefined && courier.repasseTaxa !== null ? Number(courier.repasseTaxa) : 9.50;
      return { value: fixedRate, ruleDescription: `Fixo (R$ ${fixedRate.toFixed(2).replace('.', ',')})`, isCepRule: false };
    }

    if (formato === 'porcentagem') {
      const pct = courier.repassePorcentagem !== undefined && courier.repassePorcentagem !== null ? Number(courier.repassePorcentagem) : 80;
      const freightVal = Number(o.valorEntrega) || Number(o.value) || 0;
      const calc = Math.round((freightVal * (pct / 100)) * 100) / 100;
      return { value: calc, ruleDescription: `Percentual (${pct}% do frete)`, isCepRule: false };
    }

    // Formato: Tabela de CEP
    if (freightRules && Array.isArray(freightRules) && freightRules.length > 0) {
      const orderCep = (o.cep || '').replace(/\D/g, '');
      const orderClientCode = (o.codigoCliente || '').trim().toLowerCase();
      
      if (orderCep) {
        const cepNum = parseInt(orderCep, 10);
        
        const matchedRule = freightRules.find((r: any) => {
          const rPartner = String(r.partnerId || '').trim().toLowerCase();
          const rCode = String(r.codigoCliente || '').trim().toLowerCase();
          
          let isPartnerMatch = false;
          if (orderClientCode && (rPartner === orderClientCode || rCode === orderClientCode)) {
            isPartnerMatch = true;
          } else if (partnerClients && Array.isArray(partnerClients)) {
            const matchedPartner = partnerClients.find(p => {
              const pId = String(p.id || '').trim().toLowerCase();
              const pName = String(p.name || '').trim().toLowerCase();
              return pId === orderClientCode || pName === orderClientCode || (orderClientCode && (pId.includes(orderClientCode) || pName.includes(orderClientCode)));
            });
            if (matchedPartner) {
              const pId = String(matchedPartner.id || '').trim().toLowerCase();
              const pCode = String(matchedPartner.codigoCliente || '').trim().toLowerCase();
              if (rPartner === pId || rCode === pId || rPartner === pCode || rCode === pCode) {
                isPartnerMatch = true;
              }
            }
          }

          if (!isPartnerMatch) return false;

          const minCep = parseInt((r.cepMin || '').replace(/\D/g, ''), 10);
          const maxCep = parseInt((r.cepMax || '').replace(/\D/g, ''), 10);
          if (isNaN(minCep) || isNaN(maxCep)) return false;

          return cepNum >= minCep && cepNum <= maxCep;
        });

        if (matchedRule) {
          const val = matchedRule.valorRepasse !== undefined && matchedRule.valorRepasse !== null && matchedRule.valorRepasse !== ''
            ? Number(matchedRule.valorRepasse)
            : (matchedRule.repasseRegra !== undefined ? Number(matchedRule.repasseRegra) : 0);

          if (val > 0) {
            return {
              value: val,
              ruleDescription: `Tabela CEP: ${matchedRule.regiao || 'Faixa'} (${matchedRule.cepMin}-${matchedRule.cepMax})`,
              isCepRule: true
            };
          }
        }
      }
    }

    // Fallback if rule not matched
    const fallbackRate = (o.valorCondutor !== undefined && o.valorCondutor !== null && Number(o.valorCondutor) > 0)
      ? Number(o.valorCondutor)
      : (courier.repasseTaxa !== undefined && courier.repasseTaxa !== null ? Number(courier.repasseTaxa) : 9.50);

    return { 
      value: fallbackRate, 
      ruleDescription: `Base (R$ ${fallbackRate.toFixed(2).replace('.', ',')})`, 
      isCepRule: false 
    };
  }, [freightRules, partnerClients]);

  // KPIs
  const metrics = useMemo(() => {
    const total = reportOrders.length;
    const completed = reportOrders.filter(o => o.status === 'delivered').length;
    const pending = reportOrders.filter(o => o.status === 'pending' || o.status === 'in_progress').length;
    const inRoute = reportOrders.filter(o => o.status === 'in_route').length;
    const occurrences = reportOrders.filter(o => o.status === 'cancelled' || o.status === 'failure').length;
    
    const totalFreight = reportOrders.reduce((sum, o) => sum + (o.value || 0), 0);
    const totalRepasse = reportOrders.reduce((sum, o) => {
      if (o.status === 'cancelled') return sum;
      const rep = getOrderRepasseInfo(o, reportCourier);
      return sum + rep.value;
    }, 0);
    const balance = totalFreight - totalRepasse;

    return { total, completed, pending, inRoute, occurrences, totalFreight, totalRepasse, balance };
  }, [reportOrders, reportCourier, getOrderRepasseInfo]);

  const getOrderStatusStyle = (status: string) => {
    switch (status) {
      case 'delivered':
        return { label: 'Concluído', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'pending':
        return { label: 'Pendente', bg: 'bg-amber-50 text-amber-700 border border-amber-200' };
      case 'in_progress':
        return { label: 'Em Progresso', bg: 'bg-blue-50 text-blue-700 border border-blue-200' };
      case 'in_route':
        return { label: 'Em Rota', bg: 'bg-indigo-50 text-indigo-700 border border-indigo-200' };
      case 'failure':
        return { label: 'Falha na Entrega', bg: 'bg-rose-50 text-rose-700 border border-rose-200' };
      case 'cancelled':
        return { label: 'Cancelado', bg: 'bg-slate-100 text-slate-700 border border-slate-200' };
      default:
        return { label: status, bg: 'bg-slate-50 text-slate-600' };
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const copyCSVToClipboard = () => {
    if (!reportCourier) return;
    const headers = 'ID Pedido;Data Solicitacao;Cliente;Endereço;Status;Valor Faturado (Frete);Valor Repasse Condutor;Regra de Repasse\n';
    const rows = reportOrders.map(o => {
      const statusStyle = getOrderStatusStyle(o.status);
      const rep = getOrderRepasseInfo(o, reportCourier);
      return `"${o.id}";"${o.dataSolicitacao || ''}";"${o.customerName || ''}";"${o.address || ''}";"${statusStyle.label}";"${(o.value || 0).toFixed(2)}";"${rep.value.toFixed(2)}";"${rep.ruleDescription || ''}"`;
    }).join('\n');
    
    const csvContent = headers + rows;
    navigator.clipboard.writeText(csvContent).then(() => {
      alert('Relatório copiado no formato CSV! Você já pode colá-lo em uma planilha Excel ou Google Sheets.');
    }).catch(err => {
      alert('Não foi possível copiar o relatório: ' + err.message);
    });
  };

  return (
    <div id="couriers-list-card" className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-[480px] flex flex-col">
      {/* Header title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-sm">Status da Frota ({filteredCouriers.length})</h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">Tempo real</span>
      </div>

      {/* Embedded Mini Search Feedback if search active */}
      {searchTerm && (
        <p className="text-[10px] text-slate-500 mb-3 italic">
          Filtrado por: "{searchTerm}"
        </p>
      )}

      {/* List wrapper scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-sans">
        {filteredCouriers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <span className="text-xl">🔍</span>
            <p className="text-xs text-slate-500 font-semibold mt-2">Nenhum entregador encontrado</p>
          </div>
        ) : (
          filteredCouriers.map((c) => {
            const isSelected = c.id === selectedCourierId;
            const statusStyle = c.isActive === false 
              ? { label: 'Inativo (Suspenso)', color: 'bg-rose-500 text-white', ringColor: 'ring-rose-500/20' }
              : statusMap[c.status];

            return (
              <div
                key={c.id}
                id={`courier-item-${c.id}`}
                onClick={() => setSelectedCourierId(isSelected ? null : c.id)}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                    : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50/80 hover:border-slate-200'
                } ${c.isActive === false ? 'opacity-60 bg-slate-100/40' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar wrapper with indicator */}
                  <div className="relative">
                    <img 
                      src={c.avatar} 
                      alt={c.name} 
                      className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                      c.isActive === false ? 'bg-rose-500' : c.status === 'online' ? 'bg-emerald-500' : c.status === 'busy' ? 'bg-indigo-500' : 'bg-slate-400'
                    }`}></span>
                  </div>

                  {/* Information block */}
                  <div>
                    <h4 
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportCourier(c);
                        setReportSearchTerm('');
                      }}
                      className="text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                      title="Clique para ver relatório de faturamento detalhado"
                    >
                      <span className="border-b border-dashed border-slate-300 hover:border-blue-600">{c.name}</span>
                      {c.isActive === false && (
                        <span className="text-[8px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-bold">
                          Bloqueado
                        </span>
                      )}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {/* Vehicle Indicator Tag */}
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium capitalize bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
                        {getVehicleIcon(c.vehicle)}
                        <span>{getVehicleLabel(c.vehicle)}</span>
                      </span>

                      {/* Rating */}
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{c.rating.toFixed(1)}</span>
                      </span>

                      {/* Repasse Rate Tag */}
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 font-bold bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                        {c.repasseFormato === 'porcentagem' ? (
                          <span>Repasse: {c.repassePorcentagem || 80}% do Frete</span>
                        ) : c.repasseFormato === 'fixo' ? (
                          <span>Fixo: R$ {(c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50).toFixed(2).replace('.', ',')}</span>
                        ) : (
                          <span>Tabela CEP (Base: R$ {(c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50).toFixed(2).replace('.', ',')})</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side status badge and actions */}
                <div className="flex flex-col items-end gap-1.5">
                  {onUpdateCourier ? (
                    <select
                      value={c.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        e.stopPropagation();
                        const newStatus = e.target.value as 'online' | 'busy' | 'offline';
                        await onUpdateCourier(c.id, { status: newStatus });
                      }}
                      title="Clique para alterar status operacional"
                      className={`text-[9.5px] font-black px-2 py-0.5 rounded-full cursor-pointer border-0 outline-none focus:ring-1 focus:ring-slate-900 ${statusStyle.color}`}
                    >
                      <option value="online" className="bg-slate-900 text-white font-bold">● Livre (Online)</option>
                      <option value="busy" className="bg-slate-900 text-white font-bold">● Entregando (Ocupado)</option>
                      <option value="offline" className="bg-slate-900 text-white font-bold">● Inativo (Pausa)</option>
                    </select>
                  ) : (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400 font-semibold">
                      {c.ordersCompleted} entregas
                    </span>
                    {onOpenShareForCourier && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenShareForCourier(c.id);
                        }}
                        className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ml-1"
                        title={`Gerar QR Code de Acesso para ${c.name} (${c.phone})`}
                      >
                        <QrCode className="h-3 w-3 text-emerald-600" />
                        <span>QR Code</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span>{couriers.filter(c => c.status === 'online').length} Livres</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
          <span>{couriers.filter(c => c.status === 'busy').length} Ocupados</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
          <span>{couriers.filter(c => c.status === 'offline').length} Off</span>
        </div>
      </div>

      {/* Detailed Delivery Report for Billing Modal */}
      {reportCourier && (
        <div 
          id="billing-report-modal"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
        >
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-150 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src={reportCourier.avatar} 
                    alt={reportCourier.name} 
                    className="h-11 w-11 rounded-full object-cover border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    reportCourier.isActive === false ? 'bg-rose-500' : reportCourier.status === 'online' ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}></span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <span>Relatório de Faturamento: {reportCourier.name}</span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                      {getVehicleLabel(reportCourier.vehicle)}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-[11px] text-slate-500 font-medium">Consolidação e repasses de frete por período</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <CheckCircle2 className="h-3 w-3 text-indigo-600" />
                      <span>Formato: {reportCourier.repasseFormato === 'porcentagem' ? `Percentual (${reportCourier.repassePorcentagem || 80}%)` : reportCourier.repasseFormato === 'fixo' ? `Fixo (R$ ${(reportCourier.repasseTaxa || 9.50).toFixed(2).replace('.', ',')})` : 'Tabela de CEP (Ativa)'}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setReportCourier(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Date Filters Row */}
              <div className="bg-slate-50/60 rounded-2xl border border-slate-150 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">Período:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400 font-bold">até</span>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Range Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button 
                    onClick={() => applyPreset('today')}
                    className="px-3 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button 
                    onClick={() => applyPreset('week')}
                    className="px-3 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    Semana
                  </button>
                  <button 
                    onClick={() => applyPreset('month')}
                    className="px-3 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    Mês
                  </button>
                  <button 
                    onClick={() => applyPreset('last30')}
                    className="px-3 py-1.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    30 Dias
                  </button>
                </div>
              </div>

              {/* Bento Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase">Concluídas</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-emerald-900">{metrics.completed}</span>
                    <span className="text-[9px] text-emerald-700 font-bold">pedidos</span>
                  </div>
                </div>
                
                <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-amber-800 font-bold uppercase">Pendentes</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-amber-900">{metrics.pending}</span>
                    <span className="text-[9px] text-amber-700 font-bold">pedidos</span>
                  </div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-800 font-bold uppercase">Em Rota</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-indigo-900">{metrics.inRoute}</span>
                    <span className="text-[9px] text-indigo-700 font-bold">pedidos</span>
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-rose-800 font-bold uppercase">Ocorrência</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-rose-900">{metrics.occurrences}</span>
                    <span className="text-[9px] text-rose-700 font-bold">pedidos</span>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-slate-50 border border-slate-150 rounded-2xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total Pedidos</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-slate-800">{metrics.total}</span>
                    <span className="text-[9px] text-slate-400 font-bold">total</span>
                  </div>
                </div>

                {/* Financial Summary card (Faturamento/Cobrado vs Repasse/Pago) */}
                <div className="col-span-2 sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 translate-y-2 translate-x-2">
                    <DollarSign className="h-20 w-20 text-white" />
                  </div>
                  <div>
                    <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider block">Faturamento / Repasse</span>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">Fat. Bruto:</span>
                        <span className="font-bold text-white">{formatBRL(metrics.totalFreight)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-indigo-900/50 pt-1">
                        <span className="text-emerald-300 font-semibold">Repasse Condutor:</span>
                        <span className="font-extrabold text-emerald-400">{formatBRL(metrics.totalRepasse)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] border-t border-indigo-900/50 pt-1">
                        <span className="text-indigo-200">Saldo Líquido Hub:</span>
                        <span className="font-bold text-indigo-200">{formatBRL(metrics.balance)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-header with search input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4.5 w-4.5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase">Detalhamento das Corridas ({filteredReportOrders.length})</h4>
                </div>
                
                {/* Search orders locally within report */}
                <div className="relative max-w-xs w-full group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Filtrar por ID, cliente, CEP..."
                    value={reportSearchTerm}
                    onChange={(e) => setReportSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {reportSearchTerm && (
                    <button 
                      onClick={() => setReportSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Orders Table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                        <th className="px-4 py-3">ID Pedido / Doc</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Procurar Por</th>
                        <th className="px-4 py-3">Destinatário</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Frete Cobrado</th>
                        <th className="px-4 py-3 text-right">Repasse Condutor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredReportOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                            Nenhum pedido encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredReportOrders.map((o) => {
                          const statusStyle = getOrderStatusStyle(o.status);
                          const rep = getOrderRepasseInfo(o, reportCourier);
                          return (
                            <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3.5">
                                <div className="font-mono font-bold text-slate-800 text-[11px]">{o.id}</div>
                                {o.pedido && <div className="text-[10px] text-slate-400 mt-0.5">Pedido: {o.pedido}</div>}
                              </td>
                              <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                                {o.dataSolicitacao ? normalizeIncomingDateToBrasilia(o.dataSolicitacao) : 'Sem data'}
                              </td>
                              <td className="px-4 py-3.5 max-w-[150px] truncate font-bold text-slate-800">
                                {o.procurarPor || '-'}
                              </td>
                              <td className="px-4 py-3.5 max-w-[200px] truncate">
                                <div className="font-semibold text-slate-700 truncate">{o.customerName || 'Não especificado'}</div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">{o.address}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black ${statusStyle.bg}`}>
                                  {statusStyle.label}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                                {formatBRL(o.value || 0)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                                <div>{formatBRL(rep.value)}</div>
                                {rep.ruleDescription && (
                                  <div className={`text-[9.5px] font-semibold mt-0.5 ${rep.isCepRule ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {rep.ruleDescription}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer / Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
              <button
                onClick={copyCSVToClipboard}
                disabled={reportOrders.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-blue-500/10"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Copiar Faturamento (CSV)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir</span>
                </button>
                <button 
                  onClick={() => setReportCourier(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
