import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Search, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Play, 
  ArrowUpRight, 
  Filter, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  History, 
  User, 
  SlidersHorizontal 
} from 'lucide-react';
import { Order, PartnerClient, OrderStatus, matchClientCode } from '../types';
import { parseToISODate as parseToISODateUtil, normalizeIncomingDateToBrasilia, formatToBrasiliaISODate, getBrasiliaDate } from '../utils/dateUtils';
import { formatCep } from '../utils/cepUtils';
import { resolvePartnerName, resolveRecipientName } from '../utils/partnerUtils';

interface PartnerDashboardTabProps {
  orders: Order[];
  partnerClients: PartnerClient[];
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => void;
}

export default function PartnerDashboardTab({ 
  orders, 
  partnerClients, 
  onUpdateStatus 
}: PartnerDashboardTabProps) {
  // 1. Selector for Partner Client
  // Default to first client if available, else 'CLI-001'
  const defaultPartnerId = partnerClients.length > 0 ? partnerClients[0].id : '';
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(defaultPartnerId);

  // 2. Mock Date & Filters matching the OrdersTable logic
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  const todayISO = useMemo(() => {
    return formatToBrasiliaISODate(new Date());
  }, []);

  const [startDateFil, setStartDateFil] = useState<string>(() => {
    return formatToBrasiliaISODate(new Date());
  });
  const [endDateFil, setEndDateFil] = useState<string>(() => {
    return formatToBrasiliaISODate(new Date());
  });
  const [enableDateFilter, setEnableDateFilter] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Find selected partner details
  const currentPartner = useMemo(() => {
    return partnerClients.find(p => p.id === selectedPartnerId);
  }, [partnerClients, selectedPartnerId]);

  const yesterdayISO = useMemo(() => {
    const d = getBrasiliaDate();
    d.setDate(d.getDate() - 1);
    return formatToBrasiliaISODate(d);
  }, []);

  // Helper date parsing identical to OrdersTable
  const parseToISODate = (str: string | undefined): string => {
    return parseToISODateUtil(str, yesterdayISO);
  };

  // 3. Filter orders matching:
  // - Selected Partner ID
  // - Search query
  // - Enabling / disabling custom Date ranges
  // - Custom active selected status
  const filteredOrdersForPartner = useMemo(() => {
    return orders.filter(order => {
      // Must equal selected partner ID
      if (!matchClientCode(selectedPartnerId, order.codigoCliente)) {
        return false;
      }

      // Check date filter matching OrdersTable
      if (enableDateFilter) {
        const dateISO = parseToISODate(order.dataSolicitacao);
        if (dateISO < startDateFil || dateISO > endDateFil) {
          return false;
        }
      }

      // Check status query
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // Search field query matching general table parameters
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchQuery = (
          order.id.toLowerCase().includes(q) ||
          (order.customerName && order.customerName.toLowerCase().includes(q)) ||
          (order.address && order.address.toLowerCase().includes(q)) ||
          (order.region && order.region.toLowerCase().includes(q)) ||
          (order.pedido && order.pedido.toLowerCase().includes(q)) ||
          (order.cep && order.cep.includes(q))
        );
        if (!matchQuery) return false;
      }

      return true;
    });
  }, [orders, selectedPartnerId, startDateFil, endDateFil, enableDateFilter, searchTerm, statusFilter]);

  // Total partner metrics calculation
  const metrics = useMemo(() => {
    const totalCount = filteredOrdersForPartner.length;
    const deliveredCount = filteredOrdersForPartner.filter(o => o.status === 'delivered').length;
    const inRouteCount = filteredOrdersForPartner.filter(o => o.status === 'in_route').length;
    const pendingCount = filteredOrdersForPartner.filter(o => o.status === 'pending').length;
    const cancelledCount = filteredOrdersForPartner.filter(o => o.status === 'cancelled').length;

    // Delivery compliance accuracy: percentage of delivered orders relative to dispatched/resolved (non-cancelled)
    const activeResolved = totalCount - cancelledCount;
    const successRate = activeResolved > 0 ? Math.round((deliveredCount / activeResolved) * 100) : 100;

    // Accumulated balance of freight rates (financeiro)
    // - value is the total freight services billed to Partner Client
    // - valorCondutor is the repasse due to courier
    let totalFreightCharged = 0; 
    let totalFreightRepasse = 0;

    filteredOrdersForPartner.forEach(o => {
      if (o.status !== 'cancelled') {
        totalFreightCharged += o.value || 0;
        totalFreightRepasse += o.valorCondutor || 0;
      }
    });

    const netFreightProfit = totalFreightCharged - totalFreightRepasse;

    return {
      totalCount,
      deliveredCount,
      inRouteCount,
      pendingCount,
      cancelledCount,
      successRate,
      totalFreightCharged,
      totalFreightRepasse,
      netFreightProfit
    };
  }, [filteredOrdersForPartner]);

  // Pagination matching OrdersTable style
  const totalPages = Math.ceil(filteredOrdersForPartner.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrdersForPartner.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Title & Partner Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Desempenho e Extrato do Parceiro</h2>
          <p className="text-xs text-slate-500">Métricas financeiras de frete acumulado e taxa de conformidade por integrador operacional</p>
        </div>

        {/* Big styled selector */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm max-w-sm w-full">
          <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 ml-1" />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Selecione o Cliente Parceiro:</span>
            <select
              value={selectedPartnerId}
              onChange={(e) => {
                setSelectedPartnerId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-bold text-slate-800 focus:outline-none bg-transparent cursor-pointer"
            >
              {partnerClients.map(partner => (
                <option key={partner.id} value={partner.id}>
                  {partner.id} - {partner.name}{partner.isActive === false ? ' (Inativo)' : ''}
                </option>
              ))}
              {partnerClients.length === 0 && (
                <option value="">Nenhum cliente disponível</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Interactive Filter Bar mimicking the OrdersTable filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col xl:flex-row gap-4 justify-between xl:items-center">
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase">
              <Filter className="h-4 w-4 text-slate-500" />
              <span>Intervalo de Entrega:</span>
            </div>

            {/* Enable date toggle */}
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableDateFilter}
                onChange={(e) => {
                  setEnableDateFilter(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-[11px] select-none text-slate-700 font-bold">Ativar Filtro de Período</span>
            </label>

            {/* Inputs De / Ate */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">De</span>
              <input 
                type="date" 
                disabled={!enableDateFilter}
                value={startDateFil}
                onChange={(e) => {
                  setStartDateFil(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:outline-none disabled:opacity-40"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Até</span>
              <input 
                type="date" 
                disabled={!enableDateFilter}
                value={endDateFil}
                onChange={(e) => {
                  setEndDateFil(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 focus:outline-none disabled:opacity-40"
              />
            </div>

            <button
               onClick={() => {
                 setStartDateFil(todayISO);
                 setEndDateFil(todayISO);
                 setEnableDateFilter(true);
                 setCurrentPage(1);
               }}
               className="text-xs px-2.5 py-1 text-slate-600 border border-slate-200 rounded-lg font-bold bg-slate-50 hover:bg-slate-100 transition-all"
             >
               Resetar para Hoje
             </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search inputs */}
            <div className="relative max-w-xs w-full lg:w-48 xl:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ID, destinatário, CEP..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status quick select */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border border-slate-200 rounded-xl py-1.5 px-3 focus:outline-none bg-white cursor-pointer font-bold text-slate-600"
            >
              <option value="all">Sincronizar Qualquer Status</option>
              <option value="pending">Pendente de Despacho</option>
              <option value="in_route">Em Trânsito / Em Rota</option>
              <option value="delivered">Entregues / Finalizados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>

        </div>
      </div>

      {/* 3. KPI METRICS CARDS: freight balance + delivery performance rates */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Metric A: Saldo Acumulado de Fretes */}
        <div className="bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl shadow-md p-5 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-y-2 translate-x-2 opacity-10">
            <DollarSign className="h-28 w-28 text-white stroke-[1]" />
          </div>
          <p className="text-[11px] font-bold text-indigo-100 uppercase tracking-widest">Saldo Acumulado de Fretes</p>
          <h4 className="text-2xl font-bold font-mono mt-2" id="kpi-partner-total-freight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalFreightCharged)}
          </h4>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-emerald-200 font-semibold bg-white/10 w-fit px-2 py-0.5 rounded-md">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
            <span>Cobrados à carteira do cliente</span>
          </div>
        </div>

        {/* Metric B: Repasse Descontado */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custo de Frota / Repasses</p>
          <h4 className="text-xl font-bold font-mono text-slate-800 mt-2">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalFreightRepasse)}
          </h4>
          <p className="text-[11.5px] text-indigo-600 font-bold mt-3">
            Sobrou R$ {metrics.netFreightProfit.toFixed(2).replace('.', ',')} de lucro líquido
          </p>
        </div>

        {/* Metric C: Taxa de Sucesso (Performance) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conformidade e Desempenho</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-slate-800">{metrics.successRate}%</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Taxa de Sucesso</span>
            </div>
          </div>
          {/* Visual progress bar */}
          <div className="space-y-1 mt-2">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${metrics.successRate}%` }}
              ></div>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold block">Calculado sobre remessas resolvidas</span>
          </div>
        </div>

        {/* Metric D: Distorções e Divisão de Status */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-semibold">Distribuição de Status</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => {
                setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1 text-[11px] font-semibold p-1.5 rounded-lg justify-center border transition-all cursor-pointer active:scale-95 ${
                statusFilter === 'delivered'
                  ? 'text-emerald-800 bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500 scale-[1.03] shadow-sm'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50'
              }`}
              title="Filtrar por Entregas Concluídas"
            >
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>{metrics.deliveredCount} Entrs</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter(statusFilter === 'in_route' ? 'all' : 'in_route');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1 text-[11px] font-semibold p-1.5 rounded-lg justify-center border transition-all cursor-pointer active:scale-95 ${
                statusFilter === 'in_route'
                  ? 'text-yellow-800 bg-yellow-100 border-yellow-400 ring-2 ring-yellow-500 scale-[1.03] shadow-sm'
                  : 'text-yellow-700 bg-yellow-50 border-yellow-105 hover:bg-yellow-100/50'
              }`}
              title="Filtrar por Pedidos em Trânsito"
            >
              <Play className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 stroke-none" />
              <span>{metrics.inRouteCount} Rota</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1 text-[11px] font-semibold p-1.5 rounded-lg justify-center border transition-all cursor-pointer active:scale-95 ${
                statusFilter === 'pending'
                  ? 'text-amber-800 bg-amber-100 border-amber-400 ring-2 ring-amber-500 scale-[1.03] shadow-sm'
                  : 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100/50'
              }`}
              title="Filtrar por Pedidos Pendentes"
            >
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>{metrics.pendingCount} Pends</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1 text-[11px] font-semibold p-1.5 rounded-lg justify-center border transition-all cursor-pointer active:scale-95 ${
                statusFilter === 'cancelled'
                  ? 'text-slate-900 bg-slate-200 border-slate-400 ring-2 ring-slate-400 scale-[1.03] shadow-sm'
                  : 'text-slate-705 bg-slate-50 border-slate-205 hover:bg-slate-100'
              }`}
              title="Filtrar por Pedidos Cancelados"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
              <span>{metrics.cancelledCount} Cancs</span>
            </button>
          </div>
        </div>

      </div>

      {/* 4. Filtered dedicated grid: Client info + Orders lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lefhand component: Client file metadata */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">Ficha de Cadastro</h3>
            
            {currentPartner ? (
              <div className="space-y-4 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                    {currentPartner.id}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{currentPartner.name}</p>
                    <p className="text-[10px] text-slate-400">Cliente Sincronizado</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">CNPJ/CPF:</span>
                    <span className="font-mono text-slate-800">{currentPartner.cnpjCpf || 'Não Informado'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Email:</span>
                    <span className="text-slate-800">{currentPartner.email || 'Não Informado'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 font-bold">Telefone:</span>
                    <span className="text-slate-800">{currentPartner.phone || 'Não Informado'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400 font-bold">Afiliado desde:</span>
                    <span className="text-slate-800">{currentPartner.createdAt}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[10px] leading-relaxed text-blue-750">
                  <strong className="block text-blue-800 mb-0.5">Regra Operacional:</strong>
                  Sincronização automática via planilha em lote. Filtros de data agendada recalibram o acumulativo de faturamento de fretes em tempo real.
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Por favor, selecione um Cliente Parceiro ativo para carregar os dados cadastrais correspondentes.</p>
            )}
          </div>
        </div>

        {/* Righthand: Only Partner's filtered Orders lists */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Remessas Pertencentes</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Mostrando apenas coletas vinculadas ao código de faturamento</p>
              </div>
              <span className="bg-slate-100 hover:bg-slate-150 border border-slate-200 rounded-lg px-2 text-[10px] py-0.5 font-bold text-slate-650">
                {filteredOrdersForPartner.length} Encontrados
              </span>
            {/* Sublist Table */}
            <div className="overflow-x-auto text-[11px] select-text">
              <table className="min-w-[4200px] w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                    <th className="py-2.5 px-3 text-center border-r border-slate-150 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[100px]">Ação</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-100">Status Sincronizado</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">NUM  PEDIDO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">EMPRESA PARCEIRO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">DT SOLICITACAO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">Destinatario</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">DESTINÁTARIO FINAL</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">ENDEREÇO COMPLETO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 font-mono text-center">CEP</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 font-mono">TELEFONE</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">Detalhe</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">EMAIL</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">COMPLEMENTO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">TEL- CONDUTOR</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center font-mono">Horario Conclusao</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 font-mono">Documento Empresa</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">Tipo Entrega</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 font-mono">Chamado</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 font-mono">DANFE</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">Data Conclusao</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">Nome Fantasia</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">Horario Inicio</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">DT AGENDAMENTO</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">Municipio</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-center">Estado</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">VALOR NF</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">Valor Receber</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">Valor Entrega</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">Latitude</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">Longitude</th>
                    <th className="py-2.5 px-3 border-r border-slate-100">Cnpj-Cpf</th>
                    <th className="py-2.5 px-3 border-r border-slate-100 text-right">Repasse Condutor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] text-slate-705">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={33} className="py-12 text-center text-slate-400 font-medium">
                        Nenhum pedido atende aos filtros de data ou busca de termos para este cliente parceiro.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* 1. Action Cell first! */}
                        <td className="py-2 px-3 text-center border-r border-slate-150 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[100px]">
                          {order.status === 'pending' ? (
                            <button
                              onClick={() => onUpdateStatus(order.id, 'in_route')}
                              className="text-[9px] text-blue-600 hover:text-blue-700 font-bold border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                            >
                              Despachar
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-medium">--</span>
                          )}
                        </td>

                        {/* 2. Status Badge */}
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          {order.status === 'delivered' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded-full border border-emerald-100">
                              Entregue
                            </span>
                          )}
                          {order.status === 'in_route' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-50 text-yellow-700 font-bold text-[9px] rounded-full border border-yellow-101 animate-pulse">
                              Em Rota
                            </span>
                          )}
                          {order.status === 'pending' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 font-bold text-[9px] rounded-full border border-amber-100">
                              Pendente
                            </span>
                          )}
                          {order.status === 'cancelled' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-650 font-bold text-[9px] rounded-full border border-slate-200">
                              Cancelado
                            </span>
                          )}
                        </td>

                        {/* 30 Columns of Spreadsheet: */}
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 border-r border-slate-100">
                          {order.pedido || order.id}
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-700 border-r border-slate-100 text-left">
                          <span className="bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] text-indigo-950 font-bold block truncate max-w-[160px]" title={`Empresa Parceiro: ${resolvePartnerName(order, partnerClients)}`}>
                            {resolvePartnerName(order, partnerClients)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100 font-medium">
                          {order.dataSolicitacao ? normalizeIncomingDateToBrasilia(order.dataSolicitacao) : '-'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800 border-r border-slate-100 max-w-[200px] truncate" title={resolveRecipientName(order, partnerClients)}>
                          {resolveRecipientName(order, partnerClients)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 border-r border-slate-100 max-w-[200px] truncate" title={resolveRecipientName(order, partnerClients)}>
                          {resolveRecipientName(order, partnerClients)}
                        </td>
                        <td className="py-2 px-3 text-slate-705 border-r border-slate-100 max-w-[240px] truncate" title={order.address}>
                          {order.address}
                        </td>
                        <td className="py-2 px-3 font-mono border-r border-slate-100 font-semibold text-center text-slate-800">
                          {formatCep(order.cep) || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-605 border-r border-slate-100">
                          {order.telefone || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 border-r border-slate-100 max-w-[200px] truncate" title={order.detalhe || ''}>
                          {order.detalhe || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 border-r border-slate-100">
                          {order.email || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 border-r border-slate-100 max-w-[150px] truncate" title={order.complemento || ''}>
                          {order.complemento || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 border-r border-slate-100 text-center">
                          {order.dispositivoCondutor || '-'}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100 text-rose-600 font-bold font-mono">
                          {order.horarioFinal || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 border-r border-slate-100">
                          {order.documentoEmpresa || '-'}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                            {order.tipoEntrega || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 border-r border-slate-100">
                          {order.chamado || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 border-r border-slate-100 max-w-[150px] truncate" title={order.danfe || ''}>
                          {order.danfe || '-'}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          {order.dataLimite || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium border-r border-slate-100 max-w-[180px] truncate" title={order.nomeFantasia || ''}>
                          {order.nomeFantasia || '-'}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100 font-mono">
                          {order.horarioInicio || '-'}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          {order.dataAgendamento || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-700 border-r border-slate-100">
                          {order.cidadeMunicipio || 'São Paulo'}
                        </td>
                        <td className="py-2 px-3 text-center font-bold border-r border-slate-100">
                          {order.estado || 'SP'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-700 border-r border-slate-100">
                          R$ {order.valorNotaFiscal ? order.valorNotaFiscal.toFixed(2).replace('.', ',') : '0,00'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 border-r border-slate-100">
                          R$ {order.valorReceber ? order.valorReceber.toFixed(2).replace('.', ',') : '0,00'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-100">
                          R$ {order.valorEntrega ? order.valorEntrega.toFixed(2).replace('.', ',') : order.value ? order.value.toFixed(2).replace('.', ',') : '0,00'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-400 border-r border-slate-100">
                          {order.latitude || '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-400 border-r border-slate-100">
                          {order.longitude || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 border-r border-slate-100">
                          {order.destinatarioCnpjCpf || '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-800 font-bold border-r border-slate-100">
                          R$ {order.valorCondutor ? order.valorCondutor.toFixed(2).replace('.', ',') : '0,00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>

            {/* Pagination Controls */}
            {filteredOrdersForPartner.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-400">Pág. {currentPage} de {totalPages}</span>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="p-1 border border-slate-200 rounded hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="p-1 border border-slate-200 rounded hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

    </div>
  );
}
