import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  MapPin, 
  User, 
  Check, 
  ChevronRight, 
  ChevronDown,
  X,
  LayoutGrid,
  Sparkles, 
  Filter, 
  AlertCircle,
  Truck,
  Send,
  ArrowUpDown,
  UserCheck,
  Search,
  CheckCircle2,
  Printer,
  Eye,
  EyeOff
} from 'lucide-react';
import { Order, Courier, PartnerClient, matchClientCode, Operator } from '../types';
import { resolvePartnerName, getPartnerObject, resolveRecipientName } from '../utils/partnerUtils';
import { normalizeIncomingDateToBrasilia } from '../utils/dateUtils';
import { formatCep } from '../utils/cepUtils';
import { motion, AnimatePresence } from 'motion/react';

interface AllocationTabProps {
  orders: Order[];
  couriers: Courier[];
  partnerClients: PartnerClient[];
  onAllocateCourier: (orderId: string, courierId: string) => void;
  onBulkAllocateCourier: (orderIds: string[], courierId: string) => void;
  currentUser: Operator | null;
}

export default function AllocationTab({
  orders,
  couriers,
  partnerClients,
  onAllocateCourier,
  onBulkAllocateCourier,
  currentUser
}: AllocationTabProps) {
  const isAdmin = currentUser?.id === 'ope-1' || currentUser?.login === 'admin' || currentUser?.canAlter !== false;

  const computeRepasse = (order: Order, courier?: Courier): number => {
    if (order.status === 'cancelled') return 0;
    if (order.courierId && order.valorCondutor && order.valorCondutor > 0) return order.valorCondutor;
    if (!courier) return order.valorCondutor || 0;

    const formato = courier.repasseFormato || 'tabela_cep';
    const defaultRate = courier.repasseTaxa !== undefined ? Number(courier.repasseTaxa) : 9.50;

    if (formato === 'porcentagem') {
      const pct = courier.repassePorcentagem !== undefined ? Number(courier.repassePorcentagem) : 80;
      const freightVal = Number(order.valorEntrega) || Number(order.value) || 0;
      return Math.round((freightVal * (pct / 100)) * 100) / 100;
    }

    if (formato === 'fixo') {
      return defaultRate;
    }

    const orderCep = (order.cep || '').replace(/\D/g, '');
    if (!orderCep) return defaultRate;

    try {
      const saved = localStorage.getItem('vinimap_freight_rules');
      if (saved) {
        const rules = JSON.parse(saved);
        const cepNum = parseInt(orderCep, 10);
        const matchedPartner = getPartnerObject(order, partnerClients);
        const partnerId = matchedPartner?.id || order.codigoCliente;

        const matchedRule = rules.find((rule: any) => {
          const isPartnerMatch = rule.partnerId === partnerId || rule.codigoCliente === partnerId || matchClientCode(partnerId, rule.partnerId) || matchClientCode(partnerId, rule.codigoCliente);
          if (!isPartnerMatch) return false;
          const minCep = (rule.cepMin || '').replace(/\D/g, '');
          const maxCep = (rule.cepMax || '').replace(/\D/g, '');
          if (!minCep || !maxCep) return false;
          return cepNum >= parseInt(minCep, 10) && cepNum <= parseInt(maxCep, 10);
        });

        if (matchedRule) {
          const repasseVal = matchedRule.valorRepasse !== undefined && matchedRule.valorRepasse !== null && matchedRule.valorRepasse !== ''
            ? Number(matchedRule.valorRepasse)
            : (matchedRule.repasseRegra !== undefined ? Number(matchedRule.repasseRegra) : 0);
          if (repasseVal > 0) return repasseVal;
        }
      }
    } catch (e) {}

    return defaultRate;
  };

  // Pending (unallocated) orders:
  const pendingOrders = orders.filter(o => !o.courierId && o.status !== 'delivered' && o.status !== 'cancelled');
  
  // States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [courierSearch, setCourierSearch] = useState<string>('');
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>('');
  const [isCourierDropdownOpen, setIsCourierDropdownOpen] = useState<boolean>(false);
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState<boolean>(false);
  const [colSearchTerm, setColSearchTerm] = useState<string>('');
  
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('allocation_table_hidden_columns');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('allocation_table_hidden_columns', JSON.stringify(hiddenColumns));
    } catch (e) {}
  }, [hiddenColumns]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#courier-dropdown-container')) {
        setIsCourierDropdownOpen(false);
      }
      if (!target.closest('#allocation-columns-dropdown-container')) {
        setIsColumnsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Custom sorting states for the columns
  const [sortField, setSortField] = useState<keyof Order | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Limpa automaticamente a seleção de pedidos (checkboxes) ao filtrar por região ou pesquisar
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [filterRegion, orderSearchTerm]);

  const regions = ['Centro-Paulista', 'Zona Sul', 'Zona Oeste', 'Zona Norte', 'Zona Leste'];

  // All active (online or busy) couriers or matching search
  const availableCouriers = couriers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(courierSearch.toLowerCase()) || 
      c.vehicle.toLowerCase().includes(courierSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(courierSearch));
    if (courierSearch.trim()) return matchesSearch;
    return (c.status === 'online' || c.status === 'busy') && matchesSearch;
  });

  // Filter pending orders by region and search term
  const filteredPending = pendingOrders.filter(o => {
    if (filterRegion !== 'all' && o.region !== filterRegion) return false;
    if (orderSearchTerm.trim()) {
      const q = orderSearchTerm.toLowerCase();
      const matchId = (o.id || '').toLowerCase().includes(q);
      const matchAddr = (o.address || '').toLowerCase().includes(q);
      const matchCep = (o.cep || '').toLowerCase().includes(q);
      const matchClient = (o.codigoCliente || '').toLowerCase().includes(q) || 
                          (o.customerName || '').toLowerCase().includes(q) || 
                          (o.procurarPor || '').toLowerCase().includes(q);
      if (!matchId && !matchAddr && !matchCep && !matchClient) return false;
    }
    return true;
  });

  // Handle Dynamic Sorting
  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPending = [...filteredPending].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'codigoCliente') {
      const nameA = resolvePartnerName(a, partnerClients).toLowerCase();
      const nameB = resolvePartnerName(b, partnerClients).toLowerCase();
      return sortDirection === 'asc' 
        ? nameA.localeCompare(nameB, 'pt-BR') 
        : nameB.localeCompare(nameA, 'pt-BR');
    }

    const valA = a[sortField];
    const valB = b[sortField];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    return sortDirection === 'asc' 
      ? strA.localeCompare(strB, 'pt-BR') 
      : strB.localeCompare(strA, 'pt-BR');
  });

  const handleSelectAll = () => {
    if (selectedOrderIds.length === sortedPending.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(sortedPending.map(o => o.id));
    }
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  // Perform bulk allocation
  const handleAllocateSelection = () => {
    if (!isAdmin) {
      alert('Operação restrita: Apenas administradores do sistema podem alocar pedidos para condutores.');
      return;
    }
    if (!selectedCourierId) {
      alert('Por favor, selecione primeiro um condutor na caixa de seleção acima da tabela.');
      return;
    }
    if (selectedOrderIds.length === 0) {
      alert('Selecione pelo menos um pedido na lista para realizar a alocação.');
      return;
    }

    onBulkAllocateCourier(selectedOrderIds, selectedCourierId);
    setSelectedOrderIds([]);
  };

  // Smart Auto distribution fallback
  const handleAutoDistribute = () => {
    if (!isAdmin) {
      alert('Operação restrita: Apenas administradores do sistema podem executar a distribuição automática.');
      return;
    }
    if (pendingOrders.length === 0) {
      alert('Não existem pedidos pendentes para distribuição automática.');
      return;
    }
    const onlineDrivers = couriers.filter(c => c.status === 'online' || c.status === 'busy');
    if (onlineDrivers.length === 0) {
      alert('Não há entregadores ativos (online ou com rotas) no momento.');
      return;
    }

    let count = 0;
    pendingOrders.forEach((order, idx) => {
      const matchingCourier = onlineDrivers[idx % onlineDrivers.length];
      if (matchingCourier) {
        onAllocateCourier(order.id, matchingCourier.id);
        count++;
      }
    });

    setSelectedOrderIds([]);
  };

  // Column headers definition matching system standard
  const columnsList: { id: keyof Order; label: string }[] = [
    { id: 'codigoCliente', label: 'EMPRESA PARCEIRO' },
    { id: 'dataSolicitacao', label: 'DT SOLICITACAO' },
    { id: 'id', label: 'NUM  PEDIDO' },
    { id: 'customerName', label: 'DESTINÁTARIO FINAL' },
    { id: 'address', label: 'ENDEREÇO COMPLETO' },
    { id: 'cep', label: 'CEP' },
    { id: 'telefone', label: 'TELEFONE' },
    { id: 'priority', label: 'PRIORIDADE' },
    { id: 'courierId', label: 'ENTREGADOR ALOCADO' },
    { id: 'email', label: 'EMAIL' },
    { id: 'dispositivoCondutor', label: 'TEL- CONDUTOR' },
    { id: 'complemento', label: 'COMPLEMENTO' },
    { id: 'valorNotaFiscal', label: 'VALOR NF' },
    { id: 'horarioInicio', label: 'Horario Inicio' },
    { id: 'horarioFinal', label: 'Horario Conclusao' },
    { id: 'tipoEntrega', label: 'Tipo Entrega' },
    { id: 'chamado', label: 'Chamado' },
    { id: 'danfe', label: 'DANFE' },
    { id: 'dataLimite', label: 'Data Conclusao' },
    { id: 'nomeFantasia', label: 'Nome Fantasia' },
    { id: 'documentoEmpresa', label: 'Documento Empresa' },
    { id: 'dataAgendamento', label: 'DT AGENDAMENTO' },
    { id: 'cidadeMunicipio', label: 'Municipio' },
    { id: 'estado', label: 'Estado' },
    { id: 'detalhe', label: 'Detalhe' },
    { id: 'valorReceber', label: 'Valor Receber' },
    { id: 'valorEntrega', label: 'Valor Entrega' },
    { id: 'latitude', label: 'Latitude' },
    { id: 'longitude', label: 'Longitude' },
    { id: 'procurarPor', label: 'Destinatario' },
    { id: 'destinatarioCnpjCpf', label: 'Cnpj-Cpf' },
    { id: 'valorCondutor', label: 'Repasse Condutor' },
    { id: 'status', label: 'Status Sincronizado' },
  ];

  const activeCourier = couriers.find(c => c.id === selectedCourierId);

  const renderCell = (colId: string, order: Order, partnerObj: PartnerClient | undefined) => {
    switch (colId) {
      case 'id':
        return (
          <td key={colId} className="py-3 px-3 font-mono font-bold text-indigo-900 text-[11px]">
            {order.id}
          </td>
        );
      case 'cep':
        return <td key={colId} className="py-3 px-3 font-mono font-semibold text-slate-600">{formatCep(order.cep) || '-'}</td>;
      case 'address':
        return (
          <td key={colId} className="py-3 px-3 text-slate-700 font-medium max-w-[260px] truncate" title={order.address}>
            {order.address || '-'}
          </td>
        );
      case 'status':
        return (
          <td key={colId} className="py-3 px-3 text-center">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              order.status === 'pending'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : order.status === 'in_route'
                ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                : order.status === 'delivered'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : order.status === 'failure'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                order.status === 'pending' ? 'bg-amber-500' :
                order.status === 'in_route' ? 'bg-fuchsia-500' :
                order.status === 'delivered' ? 'bg-emerald-500' :
                order.status === 'failure' ? 'bg-rose-500' : 'bg-blue-500'
              }`} />
              {order.status === 'pending' ? 'Pendente' :
               order.status === 'in_route' ? 'Em Rota' :
               order.status === 'delivered' ? 'Entregue' :
               order.status === 'failure' ? 'Ocorrência' : order.status}
            </span>
          </td>
        );
      case 'codigoCliente':
        const partnerName = resolvePartnerName(order, partnerClients);
        return (
          <td key={colId} className="py-3 px-3">
            <span 
              className="font-bold text-indigo-950 text-[11px] block truncate max-w-[140px]" 
              title={`Cliente Parceiro: ${partnerName}`}
            >
              {partnerName}
            </span>
          </td>
        );
      case 'dataSolicitacao':
        return <td key={colId} className="py-3 px-3 text-slate-500">{order.dataSolicitacao ? normalizeIncomingDateToBrasilia(order.dataSolicitacao) : '-'}</td>;
      case 'procurarPor':
        const rec = resolveRecipientName(order, partnerClients);
        return <td key={colId} className="py-3 px-3 text-slate-700 font-bold max-w-[150px] truncate" title={rec}>{rec}</td>;
      case 'customerName':
        const recipient = resolveRecipientName(order, partnerClients);
        return (
          <td key={colId} className="py-3 px-3 text-[11px] text-slate-600 font-bold max-w-[180px] truncate" title={recipient}>
            {recipient}
          </td>
        );
      case 'telefone':
        return <td key={colId} className="py-3 px-3 text-slate-650">{order.telefone || '-'}</td>;
      case 'detalhe':
        return <td key={colId} className="py-3 px-3 text-slate-505 max-w-[120px] truncate" title={order.detalhe}>{order.detalhe || '-'}</td>;
      case 'email':
        return <td key={colId} className="py-3 px-3 text-slate-600">{order.email || '-'}</td>;
      case 'complemento':
        return <td key={colId} className="py-3 px-3 text-slate-600">{order.complemento || '-'}</td>;
      case 'dispositivoCondutor':
        return <td key={colId} className="py-3 px-3 text-slate-550">{order.dispositivoCondutor || '-'}</td>;
      case 'horarioFinal':
        return (
          <td key={colId} className="py-3 px-3 text-center">
            {order.horarioFinal ? (
              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-extrabold font-mono">
                {order.horarioFinal}
              </span>
            ) : '-'}
          </td>
        );
      case 'documentoEmpresa':
        return <td key={colId} className="py-3 px-3 text-slate-550">{order.documentoEmpresa || '-'}</td>;
      case 'tipoEntrega':
        return <td key={colId} className="py-3 px-3 text-slate-600 capitalize">{order.tipoEntrega || '-'}</td>;
      case 'chamado':
        return <td key={colId} className="py-3 px-3 font-mono font-bold text-slate-755">{order.chamado || '-'}</td>;
      case 'danfe':
        return (
          <td key={colId} className="py-3 px-3 font-mono text-slate-500 max-w-[150px] truncate" title={order.danfe}>
            {order.danfe || '-'}
          </td>
        );
      case 'dataLimite':
        return <td key={colId} className="py-3 px-3 text-slate-500">{order.dataLimite || '-'}</td>;
      case 'nomeFantasia':
        return <td key={colId} className="py-3 px-3 text-slate-600 max-w-[120px] truncate">{order.nomeFantasia || '-'}</td>;
      case 'horarioInicio':
        return <td key={colId} className="py-3 px-3 text-slate-555 font-mono text-[10px]">{order.horarioInicio || '-'}</td>;
      case 'dataAgendamento':
        return <td key={colId} className="py-3 px-3 text-slate-500">{order.dataAgendamento || '-'}</td>;
      case 'cidadeMunicipio':
        return <td key={colId} className="py-3 px-3 text-slate-605">{order.cidadeMunicipio || '-'}</td>;
      case 'estado':
        return <td key={colId} className="py-3 px-3 text-center font-extrabold text-slate-700">{order.estado || '-'}</td>;
      case 'value':
        return (
          <td key={colId} className="py-3 px-3 text-right font-mono font-extrabold text-indigo-700">
            R$ {order.value.toFixed(2).replace('.', ',')}
          </td>
        );
      case 'valorNotaFiscal':
        return (
          <td key={colId} className="py-3 px-3 text-right font-mono">
            {order.valorNotaFiscal ? `R$ ${order.valorNotaFiscal.toFixed(2).replace('.', ',')}` : '-'}
          </td>
        );
      case 'valorReceber':
        return (
          <td key={colId} className="py-3 px-3 text-right font-mono text-emerald-700">
            {order.valorReceber ? `R$ ${order.valorReceber.toFixed(2).replace('.', ',')}` : '-'}
          </td>
        );
      case 'valorEntrega':
        return (
          <td key={colId} className="py-3 px-3 text-right font-mono">
            {order.valorEntrega ? `R$ ${order.valorEntrega.toFixed(2).replace('.', ',')}` : '-'}
          </td>
        );
      case 'latitude':
        return <td key={colId} className="py-3 px-3 font-mono text-slate-450">{order.latitude || '-'}</td>;
      case 'longitude':
        return <td key={colId} className="py-3 px-3 font-mono text-slate-450">{order.longitude || '-'}</td>;
      case 'destinatarioCnpjCpf':
        return <td key={colId} className="py-3 px-3 font-mono text-slate-600">{order.destinatarioCnpjCpf || '-'}</td>;
      case 'valorCondutor':
        const targetCou = order.courierId ? couriers.find(c => c.id === order.courierId) : activeCourier;
        const repVal = computeRepasse(order, targetCou);
        return (
          <td key={colId} className="py-3 px-3 text-right font-mono font-bold text-slate-800">
            {repVal > 0 ? `R$ ${repVal.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
          </td>
        );
      default:
        return <td key={colId} className="py-3 px-3 text-slate-600">-</td>;
    }
  };

  const handlePrint = () => {
    const el = document.getElementById('print-allocation-tab');
    if (!el) return;
    const originalId = el.id;
    el.id = 'printable-area';
    window.print();
    setTimeout(() => {
      el.id = originalId;
    }, 500);
  };

  return (
    <div className="space-y-6" id="print-allocation-tab">
      
      {/* Upper header section */}
      <div className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Vincular Rota (Workspace de Alocação)</h2>
          <p className="text-xs text-slate-500 font-medium">Selecione o condutor desejado e depois atribua as ordens com ordenação tática de entrega</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            title="Impressão rápida apenas com foco na tabela de dados daquela aba"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Impressão Rápida</span>
          </button>

          <button
            onClick={handleAutoDistribute}
            disabled={!isAdmin}
            title={isAdmin ? "Distribuição Inteligente (Auto-Zonamento)" : "Restrito: Apenas administradores podem executar a distribuição automática"}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
              isAdmin 
                ? "bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer hover:scale-[1.02]"
                : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Distribuição Inteligente (Auto-Zonamento)</span>
          </button>
        </div>
      </div>

      {/* MAIN FULL-WIDTH WORKSPACE (Livre do menu lateral, com dropdown imediatamente acima da tabela) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col min-w-0 w-full overflow-hidden">
        
        {/* BARRA DE CONTROLE SUPERIOR: CAIXA DROP DOWN DO CONDUTOR & ATRIBUIÇÃO */}
        <div className="p-4 bg-slate-50/90 border-b border-slate-200/80 space-y-3">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            
            {/* CAIXA DROP DOWN ACIMA DA TABELA: ESCOLHA DO CONDUTOR */}
            <div className="flex-1 max-w-xl relative" id="courier-dropdown-container">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  <span>Escolha do Condutor (Caixa Drop Down)</span>
                </label>
                <span className="text-[9px] font-bold text-slate-400">
                  {availableCouriers.length} condutores ativos
                </span>
              </div>

              {/* Caixa Seletora / Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCourierDropdownOpen(prev => !prev)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isCourierDropdownOpen 
                      ? 'border-blue-500 ring-2 ring-blue-100 bg-white shadow-sm' 
                      : activeCourier 
                        ? 'border-blue-300 bg-blue-50/60 hover:bg-blue-50/90 shadow-xs' 
                        : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 shadow-xs'
                  }`}
                >
                  {activeCourier ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                          {activeCourier.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                          activeCourier.status === 'busy' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate">{activeCourier.name}</span>
                          <span className="capitalize text-[9px] font-bold bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-mono">
                            {activeCourier.vehicle === 'motorcycle' ? 'Moto' : activeCourier.vehicle === 'car' ? 'Carro' : activeCourier.vehicle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="text-emerald-700 font-bold font-mono">
                            R$ {(activeCourier.repasseTaxa ?? 9.50).toFixed(2).replace('.', ',')} / entrega
                          </span>
                          <span>•</span>
                          <span>{orders.filter(o => o.courierId === activeCourier.id && o.status === 'in_route').length} rotas ativas</span>
                          {activeCourier.phone && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400 font-mono">{activeCourier.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-slate-500 py-0.5">
                      <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Clique para escolher o Condutor...</span>
                        <span className="text-[10px] text-slate-400">Selecione para vincular os pedidos marcados</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {activeCourier && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourierId('');
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Desmarcar condutor selecionado"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCourierDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </div>
                </button>

                {/* Painel Dropdown Aberto */}
                {isCourierDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={courierSearch}
                        onChange={(e) => setCourierSearch(e.target.value)}
                        placeholder="Buscar por nome, veículo ou telefone..."
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-50">
                      {availableCouriers.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs italic">
                          Nenhum condutor encontrado com o filtro informado.
                        </div>
                      ) : (
                        availableCouriers.map((c) => {
                          const isSelected = selectedCourierId === c.id;
                          const activeOrdersCount = orders.filter(o => o.courierId === c.id && o.status === 'in_route').length;
                          const currentRepasseRate = c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50;

                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCourierId(c.id);
                                setIsCourierDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected 
                                  ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200 shadow-xs' 
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative flex-shrink-0">
                                  <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                                    {c.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                                    c.status === 'busy' ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold truncate">{c.name}</span>
                                    <span className="capitalize font-mono text-[9px] bg-slate-100 px-1 py-0.2 rounded text-slate-600">
                                      {c.vehicle === 'motorcycle' ? 'Moto' : c.vehicle === 'car' ? 'Carro' : c.vehicle}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span className="text-emerald-700 font-semibold font-mono">
                                      R$ {currentRepasseRate.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span>•</span>
                                    <span>{activeOrdersCount} rota(s) ativa(s)</span>
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BOTÃO E STATUS DE ATRIBUIÇÃO */}
            {activeCourier ? (() => {
              const selectedOrdersList = sortedPending.filter(o => selectedOrderIds.includes(o.id));
              const totalRepasseSelected = selectedOrdersList.reduce((acc, o) => acc + computeRepasse(o, activeCourier), 0);

              return (
                <div className="flex flex-wrap items-center gap-3 lg:self-end">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                    <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-[11px]">
                      {selectedOrderIds.length}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">
                        {selectedOrderIds.length} pedido(s) selecionado(s)
                      </span>
                      {selectedOrderIds.length > 0 && (
                        <span className="text-[10px] font-black text-emerald-700 font-mono">
                          Repasse Total: R$ {totalRepasseSelected.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAllocateSelection}
                    disabled={selectedOrderIds.length === 0 || !isAdmin}
                    title={isAdmin ? `Atribuir de Imediato para ${activeCourier.name}` : "Restrito: Apenas administradores podem alocar pedidos"}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                      isAdmin && selectedOrderIds.length > 0
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                        : "bg-slate-200 border border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                    }`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Atribuir ({selectedOrderIds.length}) para {activeCourier.name.split(' ')[0]}</span>
                  </button>
                </div>
              );
            })() : (
              <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 lg:self-end">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>Escolha um Condutor na caixa suspensa ao lado para habilitar a alocação de rotas.</span>
              </div>
            )}

          </div>

          {/* SECOND ROW: FILTROS DE REGIAO, BUSCA DE PEDIDOS E COLUNAS */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/60">
            
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Filtro de Busca de Pedidos */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  placeholder="Buscar por Pedido, CEP, Endereço, Cliente..."
                  className="w-full pl-8 pr-7 py-1.5 border border-slate-250 bg-white rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-medium"
                />
                {orderSearchTerm && (
                  <button
                    onClick={() => setOrderSearchTerm('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro por Região */}
              <div className="flex items-center gap-2 bg-white border border-slate-250 px-2.5 py-1 rounded-lg h-8 shadow-2xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={filterRegion}
                  onChange={(e) => {
                    setFilterRegion(e.target.value);
                    setSelectedOrderIds([]);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Todas as Regiões</option>
                  {regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GERENCIADOR DE VISIBILIDADE DE COLUNAS */}
            <div className="relative" id="allocation-columns-dropdown-container">
              <button
                type="button"
                onClick={() => setIsColumnsDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                title="Personalizar colunas visíveis da tabela"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
                <span>Colunas</span>
                {hiddenColumns.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono">
                    {columnsList.length - hiddenColumns.length}
                  </span>
                )}
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isColumnsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isColumnsDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Colunas Visíveis</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setHiddenColumns([])}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Todas
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => {
                          const primaryCols = ['id', 'cep', 'address', 'status'];
                          setHiddenColumns(columnsList.filter(c => !primaryCols.includes(c.id)).map(c => c.id));
                        }}
                        className="text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Básicas
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={colSearchTerm}
                    onChange={(e) => setColSearchTerm(e.target.value)}
                    placeholder="Filtrar colunas..."
                    className="w-full px-2.5 py-1 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500"
                  />

                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {columnsList
                      .filter(col => col.label.toLowerCase().includes(colSearchTerm.toLowerCase()))
                      .map(col => {
                        const isVisible = !hiddenColumns.includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => {
                                if (isVisible) {
                                  setHiddenColumns(prev => [...prev, col.id]);
                                } else {
                                  setHiddenColumns(prev => prev.filter(id => id !== col.id));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span className="truncate">{col.label}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* TABELA DE PEDIDOS PENDENTES (LARGURA TOTAL / SEM BARRA LATERAL) */}
        {sortedPending.length === 0 ? (
          <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <AlertCircle className="h-10 w-10 text-slate-350 mx-auto mb-2" />
            <p className="text-slate-600 font-bold text-xs">Nenhum pedido pendente encontrado com os filtros atuais.</p>
            <p className="text-[10px] text-slate-400 mt-1">Altere a região ou termo de busca para listar outros pedidos.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs overflow-x-auto min-w-full">
            <table className="w-full text-left text-xs border-collapse font-medium">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="border-b border-slate-150 text-slate-500 font-extrabold uppercase text-[9px] whitespace-nowrap">
                  <th className="py-2.5 px-3 w-10 text-center sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="hover:text-blue-600 outline-none text-slate-450 cursor-pointer"
                      title="Selecionar todos os pedidos listados"
                    >
                      {selectedOrderIds.length === sortedPending.length ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600 mx-auto" />
                      ) : (
                        <Square className="h-4 w-4 mx-auto" />
                      )}
                    </button>
                  </th>
                  {columnsList.filter(col => !hiddenColumns.includes(col.id)).map((col) => {
                    const isSorted = sortField === col.id;
                    return (
                      <th 
                        key={col.id} 
                        className="py-2.5 px-3 font-extrabold text-slate-500 select-none cursor-pointer hover:bg-slate-100/60 transition-colors"
                        onClick={() => handleSort(col.id)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          <ArrowUpDown className={`h-3 w-3 ${isSorted ? 'text-indigo-600 font-bold' : 'text-slate-350'}`} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPending.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const partnerObj = getPartnerObject(order, partnerClients);
                  return (
                    <tr 
                      key={order.id}
                      className={`hover:bg-slate-50/70 cursor-pointer transition-colors whitespace-nowrap ${
                        isSelected ? 'bg-indigo-50/25 font-semibold' : ''
                      }`}
                      onClick={() => handleToggleSelect(order.id)}
                    >
                      <td className="py-3 px-3 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-305 mx-auto" />
                        )}
                      </td>
                      
                      {/* Colunas renderizadas na ordem: Sequência, Pedido, CEP, Endereço, Status e demais */}
                      {columnsList
                        .filter(col => !hiddenColumns.includes(col.id))
                        .map((col) => renderCell(col.id, order, partnerObj))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* RODAPÉ DA TABELA: ESTATÍSTICAS E CONTAGENS */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mt-2 bg-slate-50/80 p-3 rounded-xl border border-slate-150 gap-2">
          <span>Mostrando <b>{sortedPending.length}</b> pedido(s) pendente(s) de alocação de rota</span>
          <div className="flex items-center gap-4">
            <span>Selecionados: <b className="text-indigo-600 font-mono font-bold">{selectedOrderIds.length}</b></span>
            <span>Região: <b className="text-slate-700 uppercase font-mono font-bold">{filterRegion === 'all' ? 'TUDO' : filterRegion}</b></span>
            {activeCourier && (
              <span>Condutor Ativo: <b className="text-blue-700 font-bold">{activeCourier.name}</b></span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
