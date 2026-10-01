import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Navigation, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Layers,
  ChevronDown,
  X,
  AlertTriangle,
  Building2,
  Filter,
  RotateCcw
} from 'lucide-react';
import { Order, OrderStatus, Courier, PartnerClient } from '../types';
import { parseToISODate as parseToISODateUtil, formatToBrasiliaISODate, getBrasiliaDate, formatToBrasiliaDate } from '../utils/dateUtils';
import { isOrderMatchingPartner } from '../utils/partnerUtils';

interface KPIsProps {
  orders: Order[];
  couriers?: Courier[];
  partnerClients?: PartnerClient[];
  selectedCourierId?: string | null;
  onSelectCourier?: (courierId: string | null) => void;
  selectedPartnerId?: string;
  onSelectPartner?: (partnerId: string) => void;
  startDate?: string;
  endDate?: string;
  onDateChange?: (startDate: string, endDate: string) => void;
  activeStatus?: OrderStatus | 'all' | 'open';
  onCardClick?: (status: OrderStatus | 'all', startDate: string, endDate: string) => void;
}

export default function KPIs({ 
  orders, 
  couriers = [], 
  partnerClients = [],
  selectedCourierId, 
  onSelectCourier, 
  selectedPartnerId = 'all',
  onSelectPartner,
  startDate: startDateProp,
  endDate: endDateProp,
  onDateChange,
  activeStatus,
  onCardClick 
}: KPIsProps) {
  // Helpers to get today's date in Brasília ISO format (YYYY-MM-DD)
  const getTodayISO = (): string => {
    return formatToBrasiliaISODate(new Date());
  };

  const getYesterdayISO = (): string => {
    const d = getBrasiliaDate();
    d.setDate(d.getDate() - 1);
    return formatToBrasiliaISODate(d);
  };

  const getDaysAgoISO = (days: number): string => {
    const d = getBrasiliaDate();
    d.setDate(d.getDate() - days);
    return formatToBrasiliaISODate(d);
  };

  const getFirstDayOfMonthISO = (): string => {
    const d = getBrasiliaDate();
    d.setDate(1);
    return formatToBrasiliaISODate(d);
  };

  const todayISO = getTodayISO();

  // Date range state - Synced with parent props when provided, fallback to internal state
  const [internalStartDate, setInternalStartDate] = useState<string>(startDateProp || todayISO);
  const [internalEndDate, setInternalEndDate] = useState<string>(endDateProp || todayISO);

  useEffect(() => {
    if (startDateProp) {
      setInternalStartDate(startDateProp);
    }
  }, [startDateProp]);

  useEffect(() => {
    if (endDateProp) {
      setInternalEndDate(endDateProp);
    }
  }, [endDateProp]);

  const startDate = startDateProp || internalStartDate;
  const endDate = endDateProp || internalEndDate;

  const handleDateRangeUpdate = (newStart: string, newEnd: string) => {
    setInternalStartDate(newStart);
    setInternalEndDate(newEnd);
    if (onDateChange) {
      onDateChange(newStart, newEnd);
    }
  };

  const isCustomPeriod = (startDate !== todayISO || endDate !== todayISO);
  const isPartnerFiltered = Boolean(selectedPartnerId && selectedPartnerId !== 'all');
  const isCourierFiltered = Boolean(selectedCourierId && selectedCourierId !== 'all');

  // Dropdown toggle state
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState<boolean>(false);

  // Detect click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#kpi-presets-dropdown-container')) {
        setIsPresetDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const getActivePresetLabel = () => {
    if (startDate === todayISO && endDate === todayISO) return 'Hoje';
    if (startDate === getYesterdayISO() && endDate === getYesterdayISO()) return 'Ontem';
    if (startDate === getDaysAgoISO(6) && endDate === todayISO) return 'Últimos 7 Dias';
    if (startDate === getFirstDayOfMonthISO() && endDate === todayISO) return 'Este Mês';
    return 'Customizado';
  };

  // Detect selected courier object
  const selectedCourier = useMemo(() => {
    if (!selectedCourierId || selectedCourierId === 'all') return null;
    if (selectedCourierId === 'unallocated') {
      return { id: 'unallocated', name: 'Não Alocados' } as Courier;
    }
    return couriers.find(c => c.id === selectedCourierId) || null;
  }, [couriers, selectedCourierId]);

  // Detect selected partner object
  const selectedPartner = useMemo(() => {
    if (!selectedPartnerId || selectedPartnerId === 'all') return null;
    if (selectedPartnerId === 'avulsa') {
      return { id: 'avulsa', name: 'Avulsos / Sem Contrato' } as PartnerClient;
    }
    return partnerClients.find(p => p.id === selectedPartnerId || p.codigoCliente === selectedPartnerId) || null;
  }, [partnerClients, selectedPartnerId]);

  // Filter orders by selected Courier AND selected Partner in conjunction
  const baseOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Courier filtering
      if (selectedCourierId && selectedCourierId !== 'all') {
        if (selectedCourierId === 'unallocated') {
          if (order.courierId) return false;
        } else {
          if (order.courierId !== selectedCourierId) return false;
        }
      }
      // 2. Partner filtering
      if (selectedPartnerId && selectedPartnerId !== 'all') {
        if (!isOrderMatchingPartner(order, selectedPartnerId, partnerClients)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, selectedCourierId, selectedPartnerId, partnerClients]);

  // Parse order solicitation date string (e.g. DD/MM/YYYY) to ISO (YYYY-MM-DD)
  const parseToISODate = (str: string | undefined): string => {
    return parseToISODateUtil(str, '');
  };

  // Check if selected courier has pending orders from previous periods
  const priorPendingOrders = useMemo(() => {
    if (!selectedCourierId || selectedCourierId === 'all' || selectedCourierId === 'unallocated') return [];
    return orders.filter(o => {
      if (o.courierId !== selectedCourierId) return false;
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      const rawDateStr = o.dataSolicitacao || (typeof o.createdAt === 'string' ? o.createdAt : (typeof o.createdAt === 'number' ? formatToBrasiliaDate(new Date(o.createdAt)) : ''));
      const launchDateISO = parseToISODate(rawDateStr);
      const allocatedDateISO = o.allocatedDate ? parseToISODate(o.allocatedDate) : null;
      const effectiveDate = allocatedDateISO || launchDateISO;
      return effectiveDate && effectiveDate < startDate;
    });
  }, [orders, selectedCourierId, startDate]);

  // Alerta Global para o Administrador: pedidos em aberto (não entregues e não cancelados) de datas anteriores à data de início consultada
  const [isPriorOpenAlertDismissed, setIsPriorOpenAlertDismissed] = useState<boolean>(false);
  const globalPriorOpenOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      const rawDateStr = o.dataSolicitacao || (typeof o.createdAt === 'string' ? o.createdAt : (typeof o.createdAt === 'number' ? formatToBrasiliaDate(new Date(o.createdAt)) : ''));
      const launchDateISO = parseToISODate(rawDateStr);
      const allocatedDateISO = o.allocatedDate ? parseToISODate(o.allocatedDate) : null;
      const effectiveDate = allocatedDateISO || launchDateISO;
      return effectiveDate && effectiveDate < startDate;
    });
  }, [orders, startDate]);

  // Rule: On the current day ("Hoje"), only orders launched today are included.
  // Previous days' orders only enter the list if the date selector is changed to a range that includes them.
  // Responding in conjunction with partner and courier filters.
  const filteredOrders = useMemo(() => {
    return baseOrders.filter(order => {
      const rawDateStr = order.dataSolicitacao || (typeof order.createdAt === 'string' ? order.createdAt : (typeof order.createdAt === 'number' ? formatToBrasiliaDate(new Date(order.createdAt)) : ''));
      const launchDateISO = parseToISODate(rawDateStr);
      if (!launchDateISO) return false;
      return launchDateISO >= startDate && launchDateISO <= endDate;
    });
  }, [baseOrders, startDate, endDate]);

  const countForStatus = (status: OrderStatus) => {
    return filteredOrders.filter(order => order.status === status).length;
  };

  const totalCount = filteredOrders.length;
  const pendingCount = countForStatus('pending');
  const inProgressCount = countForStatus('in_progress');
  const inRouteCount = countForStatus('in_route');
  const failureCount = countForStatus('failure');
  const deliveredCount = countForStatus('delivered');
  const cancelledCount = countForStatus('cancelled');

  // Format percentage helper
  const getPercentage = (count: number) => {
    if (totalCount === 0) return '0%';
    return `${Math.round((count / totalCount) * 100)}%`;
  };

  // Clean, uncluttered market-standard KPI definitions
  const kpisList = [
    {
      statusKey: 'all' as const,
      title: 'Total Geral',
      value: totalCount,
      percentText: `${totalCount} ped.`,
      icon: Layers,
      iconBg: 'bg-slate-100 text-slate-700',
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
      activeBorder: 'border-slate-800 ring-2 ring-slate-800/20 bg-slate-50/50',
      description: 'Lançados no período'
    },
    {
      statusKey: 'pending' as const,
      title: 'Não Iniciado',
      value: pendingCount,
      percentText: getPercentage(pendingCount),
      icon: Clock,
      iconBg: 'bg-amber-100/80 text-amber-800',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40',
      description: 'Aguardando ação'
    },
    {
      statusKey: 'in_progress' as const,
      title: 'Em Andamento',
      value: inProgressCount,
      percentText: getPercentage(inProgressCount),
      icon: Navigation,
      iconBg: 'bg-blue-100/80 text-blue-800',
      badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40',
      description: 'Em processamento'
    },
    {
      statusKey: 'in_route' as const,
      title: 'Em Rota',
      value: inRouteCount,
      percentText: getPercentage(inRouteCount),
      icon: Truck,
      iconBg: 'bg-purple-100/80 text-purple-800',
      badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/40',
      description: 'Em trânsito'
    },
    {
      statusKey: 'failure' as const,
      title: 'Ocorrência',
      value: failureCount,
      percentText: getPercentage(failureCount),
      icon: AlertCircle,
      iconBg: 'bg-rose-100/80 text-rose-800',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40',
      description: 'Requer atenção'
    },
    {
      statusKey: 'delivered' as const,
      title: 'Concluído',
      value: deliveredCount,
      percentText: getPercentage(deliveredCount),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100/80 text-emerald-800',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40',
      description: 'Entregas finalizadas'
    },
    {
      statusKey: 'cancelled' as const,
      title: 'Cancelados',
      value: cancelledCount,
      percentText: getPercentage(cancelledCount),
      icon: XCircle,
      iconBg: 'bg-zinc-100 text-zinc-700',
      badgeBg: 'bg-zinc-50 text-zinc-700 border-zinc-200',
      activeBorder: 'border-zinc-500 ring-2 ring-zinc-500/20 bg-zinc-50/40',
      description: 'Cancelados / estornos'
    }
  ];

  const handleResetFilters = () => {
    handleDateRangeUpdate(todayISO, todayISO);
    onSelectPartner?.('all');
    onSelectCourier?.(null);
  };

  return (
    <div className="space-y-3">
      {/* Sleek, uncluttered Filter Toolbar */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left Section: Period Selector & Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Presets Dropdown */}
          <div className="relative shrink-0" id="kpi-presets-dropdown-container">
            <button
              type="button"
              onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border bg-white text-slate-700 hover:bg-slate-50 border-slate-200 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span>{getActivePresetLabel()}</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isPresetDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPresetDropdownOpen && (
              <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {[
                  { id: 'today', label: 'Hoje' },
                  { id: 'yesterday', label: 'Ontem' },
                  { id: 'seven_days', label: 'Últimos 7 Dias' },
                  { id: 'this_month', label: 'Este Mês' }
                ].map((preset) => {
                  let isActive = false;
                  if (preset.id === 'today') isActive = startDate === todayISO && endDate === todayISO;
                  else if (preset.id === 'yesterday') isActive = startDate === getYesterdayISO() && endDate === getYesterdayISO();
                  else if (preset.id === 'seven_days') isActive = startDate === getDaysAgoISO(6) && endDate === todayISO;
                  else if (preset.id === 'this_month') isActive = startDate === getFirstDayOfMonthISO() && endDate === todayISO;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        if (preset.id === 'today') {
                          handleDateRangeUpdate(todayISO, todayISO);
                        } else if (preset.id === 'yesterday') {
                          const yesterday = getYesterdayISO();
                          handleDateRangeUpdate(yesterday, yesterday);
                        } else if (preset.id === 'seven_days') {
                          const sevenDaysAgo = getDaysAgoISO(6);
                          handleDateRangeUpdate(sevenDaysAgo, todayISO);
                        } else if (preset.id === 'this_month') {
                          const firstDay = getFirstDayOfMonthISO();
                          handleDateRangeUpdate(firstDay, todayISO);
                        }
                        setIsPresetDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                        isActive 
                          ? 'bg-blue-50 text-blue-700 font-bold' 
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Buttons: Hoje & Ontem */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleDateRangeUpdate(todayISO, todayISO)}
              className={`px-2 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                startDate === todayISO && endDate === todayISO
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                const y = getYesterdayISO();
                handleDateRangeUpdate(y, y);
              }}
              className={`px-2 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                startDate === getYesterdayISO() && endDate === getYesterdayISO()
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              Ontem
            </button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-8">
            <span className="text-[10px] font-bold text-slate-400 uppercase">De</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => handleDateRangeUpdate(e.target.value, endDate)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            />
            <span className="text-slate-300">|</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Até</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => handleDateRangeUpdate(startDate, e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Right Section: Partner & Courier Filters + Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Partner Select Filter */}
          {partnerClients && partnerClients.length > 0 && (
            <div className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors ${
              isPartnerFiltered 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <Building2 className={`h-3.5 w-3.5 shrink-0 ${isPartnerFiltered ? 'text-indigo-600' : 'text-slate-400'}`} />
              <select
                id="kpi-partner-select"
                value={selectedPartnerId || 'all'}
                onChange={(e) => onSelectPartner?.(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate"
                title="Filtrar por Parceiro"
              >
                <option value="all">Todos Parceiros</option>
                <option value="avulsa">Avulsos / Sem Contrato</option>
                {partnerClients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Courier Select Filter */}
          {couriers && couriers.length > 0 && (
            <div className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors ${
              isCourierFiltered 
                ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold' 
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <Truck className={`h-3.5 w-3.5 shrink-0 ${isCourierFiltered ? 'text-blue-600' : 'text-slate-400'}`} />
              <select
                id="kpi-courier-select"
                value={selectedCourierId || 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  onSelectCourier?.(val === 'all' ? null : val);
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate"
                title="Filtrar por Condutor"
              >
                <option value="all">Todos Condutores</option>
                <option value="unallocated">Não Alocados</option>
                {couriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters Shortcut (if any filter is active) */}
          {(isCustomPeriod || isPartnerFiltered || isCourierFiltered) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              title="Restaurar data de hoje e limpar filtros de parceiro e condutor"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta Global de Pedidos Anteriores em Aberto */}
      {globalPriorOpenOrders.length > 0 && !isPriorOpenAlertDismissed && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded-md">
                  Alerta Operacional
                </span>
                <span className="font-bold text-amber-950">
                  {globalPriorOpenOrders.length} pedido(s) em aberto de dias anteriores
                </span>
              </div>
              <p className="text-amber-900 mt-1">
                Existem pedidos pendentes anteriores a {startDate}. Eles não afetam os totais de hoje até que o período seja consultado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                const earliestPriorDate = globalPriorOpenOrders.reduce((min, o) => {
                  const rawDateStr = o.dataSolicitacao || (typeof o.createdAt === 'string' ? o.createdAt : (typeof o.createdAt === 'number' ? formatToBrasiliaDate(new Date(o.createdAt)) : ''));
                  const d = parseToISODate(rawDateStr);
                  return d && d < min ? d : min;
                }, startDate);
                onDateChange?.(earliestPriorDate, endDate);
              }}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Consultar Período</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPriorOpenAlertDismissed(true)}
              className="p-1 text-amber-800/70 hover:text-amber-950 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
              title="Dispensar alerta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Condutor com Pedido Anterior Pendente */}
      {selectedCourier && selectedCourierId !== 'unallocated' && priorPendingOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 shadow-2xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold">Atenção: </span>
            <span>O condutor <strong>{selectedCourier.name}</strong> possui <strong>{priorPendingOrders.length}</strong> pedido(s) pendente(s) registrado(s) em data(s) anterior(es).</span>
          </div>
        </div>
      )}

      {/* Active Filter Indicators */}
      {(isPartnerFiltered || isCourierFiltered) && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5">
          <Filter className="h-3.5 w-3.5 text-blue-600" />
          <span className="font-semibold">Filtro aplicado:</span>
          {selectedPartner && (
            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800">
              {selectedPartner.name}
              <button
                type="button"
                onClick={() => onSelectPartner?.('all')}
                className="hover:text-rose-600 cursor-pointer"
                title="Remover filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedCourier && (
            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800">
              {selectedCourier.name}
              <button
                type="button"
                onClick={() => onSelectCourier?.(null)}
                className="hover:text-rose-600 cursor-pointer"
                title="Remover filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <span className="text-slate-400 ml-auto font-mono text-[11px] font-semibold">
            {totalCount} pedidos encontrados
          </span>
        </div>
      )}

      {/* Standard Market KPI Cards Grid - Clean, Uncluttered & High Contrast */}
      <div id="kpis-container" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {kpisList.map((kpi) => {
          const IconComp = kpi.icon;
          const isSelected = activeStatus === kpi.statusKey;

          return (
            <div
              key={kpi.statusKey}
              id={`kpi-card-${kpi.statusKey}`}
              onClick={() => onCardClick?.(kpi.statusKey, startDate, endDate)}
              className={`bg-white rounded-xl p-3 border transition-all duration-150 cursor-pointer select-none flex flex-col justify-between hover:shadow-sm ${
                isSelected
                  ? kpi.activeBorder
                  : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
              }`}
              title={`Clique para filtrar por status: ${kpi.title}`}
            >
              {/* Card Header: Title + Icon Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider truncate">
                  {kpi.title}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                  <IconComp className="h-4 w-4" />
                </div>
              </div>

              {/* Card Body: Metric Value + Percent Badge */}
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                  {kpi.value}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${kpi.badgeBg}`}>
                  {kpi.percentText}
                </span>
              </div>

              {/* Card Subtitle */}
              <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">
                {kpi.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
