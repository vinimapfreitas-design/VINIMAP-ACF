import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  Check, 
  Trash2,
  Edit2,
  Printer,
  FileCheck,
  History,
  UserPlus,
  UserCheck,
  UserX,
  X,
  Calendar,
  Clock,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PackageCheck,
  AlertTriangle,
  Play,
  Zap,
  SlidersHorizontal,
  Power,
  CheckCircle2,
  FileText,
  Filter,
  FilterX,
  RotateCcw,
  CheckCircle,
  FileSignature,
  Notebook,
  ClipboardCheck,
  ClipboardSignature,
  Flag,
  Camera,
  Upload,
  Eye,
  EyeOff,
  Settings,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RefreshCcw,
  LayoutGrid,
  Copy,
  Download,
  Loader2,
  Building2,
  Truck,
  Database,
  Calculator,
  Hash,
  Phone,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderStatus, PartnerClient, Courier, Operator, HubCentral, matchClientCode } from '../types';
import { resolvePartnerName, getPartnerObject, resolveRecipientName, isOrderMatchingPartner } from '../utils/partnerUtils';
import { formatCep, compareOrdersByCep } from '../utils/cepUtils';
import { exportOrdersToCSV, EXPORT_COLUMNS, exportOrdersToPDF } from '../utils/exportUtils';
import { exportProtocolToPDF } from '../utils/exportProtocolPDF';
import { ProtocolWhatsAppModal, WhatsAppIcon } from './ProtocolWhatsAppModal';
import { formatToBrasiliaDate, formatToBrasiliaTime, formatToBrasiliaDateTime, formatToBrasiliaISODate, getBrasiliaDate, parseToISODate as parseToISODateUtil, normalizeIncomingDateToBrasilia } from '../utils/dateUtils';
import { compressImageFile } from '../lib/imageCompression';
import { 
  resolveOrderPhoto, 
  resolveOrderSignature, 
  resolveReceiverName, 
  resolveReceiverDoc, 
  resolveDeliveryTime, 
  saveOrderPhoto,
  getOrderPhoto,
  getAllOrderKeys
} from '../utils/photoStorage';

const parseToISODateInApp = (str: string | undefined): string => {
  const todayISO = formatToBrasiliaISODate(new Date());
  return parseToISODateUtil(str, todayISO);
};

interface OrdersTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus, protocol?: any) => void;
  onBulkUpdateStatus?: (orderIds: string[], nextStatus: OrderStatus) => Promise<void>;
  onBulkAllocateCourier?: (orderIds: string[], courierId: string) => Promise<void> | void;
  searchTerm: string;
  onSearchTermChange?: (term: string) => void;
  onResetDashboardFilterStatus?: () => void;
  partnerClients?: PartnerClient[];
  couriers?: Courier[];
  hubs?: HubCentral[];
  freightRules?: any[];
  onAllocateCourier?: (orderId: string, courierId: string) => void;
  onDeallocateCourier?: (orderId: string) => void;
  onEditOrder?: (updatedOrder: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  onAddOrder?: (newOrder: Omit<Order, 'id' | 'time'> & { id?: string }) => void;
  initialEnableDateFilter?: boolean;
  initialStartDate?: string;
  initialEndDate?: string;
  currentUser?: Operator | null;
  selectedCourierId?: string | null;
  setSelectedCourierId?: (id: string | null) => void;
  onDateFilterChange?: (enabled: boolean, startDate: string, endDate: string) => void;
  statusFilter?: OrderStatus | 'all' | 'open';
  selectedPartnerId?: string;
  onSelectPartner?: (partnerId: string) => void;
  onRefetchDatabase?: (options?: { startDate?: string; endDate?: string; loadAll?: boolean }) => Promise<void> | void;
  isSyncing?: boolean;
  onLoadPeriod?: (startDate: string, endDate: string) => Promise<void> | void;
  onLoadFullHistory?: () => Promise<void> | void;
  isFullHistoryLoaded?: boolean;
  totalOrdersInDb?: number;
  isLoadingPeriod?: boolean;
}

export default function OrdersTable({ 
  orders, 
  onUpdateStatus,
  onBulkUpdateStatus,
  onBulkAllocateCourier,
  searchTerm,
  onSearchTermChange,
  onResetDashboardFilterStatus,
  partnerClients = [],
  couriers = [],
  hubs = [],
  freightRules = [],
  onAllocateCourier,
  onDeallocateCourier,
  onEditOrder,
  onDeleteOrder,
  onAddOrder,
  initialEnableDateFilter = true,
  initialStartDate,
  initialEndDate,
  currentUser,
  selectedCourierId,
  setSelectedCourierId,
  selectedPartnerId = 'all',
  onSelectPartner,
  onDateFilterChange,
  statusFilter,
  onRefetchDatabase,
  isSyncing = false,
  onLoadPeriod,
  onLoadFullHistory,
  isFullHistoryLoaded = false,
  totalOrdersInDb = 0,
  isLoadingPeriod = false
}: OrdersTableProps) {
  const isAdmin = currentUser?.id === 'ope-1' || currentUser?.login === 'admin' || currentUser?.canAlter !== false;

  const checkIsManualFreight = (order: Order): boolean => {
    if ((order as any).isManualFreight === true) return true;

    const clientCode = order.codigoCliente || '';
    const cep = order.cep || '';
    const cleanCep = (cep || '').replace(/\D/g, '');

    if (!cleanCep || !clientCode) return true;

    const cepNum = parseInt(cleanCep, 10);
    if (isNaN(cepNum)) return true;

    const rulesToUse = freightRules && freightRules.length > 0 ? freightRules : (() => {
      try {
        const saved = localStorage.getItem('vinimap_freight_rules');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    })();

    if (!rulesToUse || rulesToUse.length === 0) return true;

    const matchedPartner = getPartnerObject(order, partnerClients);
    const partnerId = matchedPartner?.id || clientCode;

    const matchedRule = rulesToUse.find((rule: any) => {
      const isPartnerMatch = rule.partnerId === partnerId || 
                             rule.codigoCliente === partnerId || 
                             matchClientCode(partnerId, rule.partnerId) || 
                             matchClientCode(partnerId, rule.codigoCliente);
      if (!isPartnerMatch) return false;

      const minCep = (rule.cepMin || '').replace(/\D/g, '');
      const maxCep = (rule.cepMax || '').replace(/\D/g, '');
      if (!minCep || !maxCep) return false;

      const minNum = parseInt(minCep, 10);
      const maxNum = parseInt(maxCep, 10);

      return cepNum >= minNum && cepNum <= maxNum;
    });

    if (!matchedRule) return true;

    const orderVal = Number(order.valorEntrega) || Number(order.value) || 0;
    const normalRuleVal = Number(matchedRule.value) || 0;
    const priorityRuleVal = Number(matchedRule.prioridade) || 0;

    const matchesNormal = Math.abs(orderVal - normalRuleVal) < 0.02;
    const matchesPriority = priorityRuleVal > 0 && Math.abs(orderVal - priorityRuleVal) < 0.02;

    return !(matchesNormal || matchesPriority);
  };

  const computeOrderRepasse = (order: Order, courier?: Courier): number => {
    if (order.status === 'cancelled') return 0;
    if (order.valorCondutor && order.valorCondutor > 0) return order.valorCondutor;
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
        const matchedRule = rules.find((rule: any) => {
          const isPartnerMatch = rule.partnerId === order.codigoCliente || rule.codigoCliente === order.codigoCliente || matchClientCode(order.codigoCliente || '', rule.partnerId) || matchClientCode(order.codigoCliente || '', rule.codigoCliente);
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

  // Tabs & Pagination states - Default to 'open' to show only open orders on initial load
  const [activeTab, setActiveTab] = useState<string>(statusFilter || 'open');

  // Manual search mode is revoked: totals are always calculated dynamically in real-time
  const showTotalsManual = true;

  // Sync activeTab with statusFilter prop if provided
  useEffect(() => {
    if (statusFilter) {
      setActiveTab(statusFilter);
    }
  }, [statusFilter]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Grouping states for region/CEP optimizations
  const [groupBy, setGroupBy] = useState<'none' | 'endereco' | 'cep' | 'parceiro'>('none');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getActiveGroupLabel = () => {
    switch (groupBy) {
      case 'none': return 'Nenhum';
      case 'endereco': return 'Destino';
      case 'cep': return 'CEP';
      case 'parceiro': return 'Cliente Parceiro';
      default: return 'Nenhum';
    }
  };

  const handleAllocateGroup = (groupOrders: Order[], courierId: string) => {
    if (!courierId || !onAllocateCourier) return;
    groupOrders.forEach(order => {
      onAllocateCourier(order.id, courierId);
    });
    alert(`Alocados ${groupOrders.length} pedidos com sucesso para o entregador selecionado!`);
  };

  // Custom UI dropdown toggle states to maximize screen usage and reduce clutter
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState<boolean>(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState<boolean>(false);

  // CSV Column Selection Export Modal state variables
  const [isExportCsvModalOpen, setIsExportCsvModalOpen] = useState<boolean>(false);
  const [csvSelectedColumns, setCsvSelectedColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orders_table_csv_columns');
      return saved ? JSON.parse(saved) : EXPORT_COLUMNS.map(c => c.key);
    } catch {
      return EXPORT_COLUMNS.map(c => c.key);
    }
  });

  // Keep CSV columns selection in sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('orders_table_csv_columns', JSON.stringify(csvSelectedColumns));
    } catch (e) {
      console.error('Failed to save CSV column selection', e);
    }
  }, [csvSelectedColumns]);

  // Local Search Term field
  const [localSearchTerm, setLocalSearchTerm] = useState<string>('');
  const [cepSearchTerm, setCepSearchTerm] = useState<string>('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string | null>(null);
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>(selectedPartnerId || 'all');

  useEffect(() => {
    if (selectedPartnerId !== undefined) {
      setSelectedPartnerFilter(selectedPartnerId);
      setDetSearchClientCode(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  // Detailed Search (Pesquisa Detalhada) state variables - default to true as the sole primary search panel
  const [isDetailedSearchOpen, setIsDetailedSearchOpen] = useState<boolean>(true);
  const [detSearchIds, setDetSearchIds] = useState<string>(''); // For multi-ID / batch search separated by comma or lines
  const [detSearchDanfe, setDetSearchDanfe] = useState<string>('');
  const [detSearchClientCode, setDetSearchClientCode] = useState<string>('all');
  const [detSearchCustomerName, setDetSearchCustomerName] = useState<string>('');
  const [detSearchCity, setDetSearchCity] = useState<string>('');
  const [detSearchCourierId, setDetSearchCourierId] = useState<string>('all');
  const [detSearchTipoEntrega, setDetSearchTipoEntrega] = useState<string>('all');
  const [detSearchPedido, setDetSearchPedido] = useState<string>('');

  // Selection states for batch operations
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkCourierId, setBulkCourierId] = useState<string>('');

  // Smart Date Range state - Synchronized dynamically
  const getTodayISO = (): string => {
    return formatToBrasiliaISODate(new Date());
  };

  const getTodayStrSP = (): string => {
    return formatToBrasiliaDate(new Date());
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

  const todayStrSP = getTodayStrSP();
  const todayISO = getTodayISO();
  const [startDateFil, setStartDateFil] = useState<string>(initialStartDate || todayISO);
  const [endDateFil, setEndDateFil] = useState<string>(initialEndDate || todayISO);
  const [enableDateFilter, setEnableDateFilter] = useState<boolean>(initialEnableDateFilter !== undefined ? initialEnableDateFilter : true);

  // Sync state values if initial values from parent component change (e.g. user selected different period/card)
  useEffect(() => {
    if (initialStartDate) {
      setStartDateFil(initialStartDate);
    }
  }, [initialStartDate]);

  useEffect(() => {
    if (initialEndDate) {
      setEndDateFil(initialEndDate);
    }
  }, [initialEndDate]);

  useEffect(() => {
    if (initialEnableDateFilter !== undefined) {
      setEnableDateFilter(initialEnableDateFilter);
    }
  }, [initialEnableDateFilter]);

  useEffect(() => {
    if (onDateFilterChange) {
      onDateFilterChange(enableDateFilter, startDateFil, endDateFil);
    }
  }, [enableDateFilter, startDateFil, endDateFil, onDateFilterChange]);

  // Synchronize detailed search courier with dashboard courier filter prop without resetting manual dates
  useEffect(() => {
    if (selectedCourierId) {
      setDetSearchCourierId(selectedCourierId);
      setCurrentPage(1);
    } else {
      setDetSearchCourierId('all');
    }
  }, [selectedCourierId]);

  // Limpa automaticamente a seleção de caixas box (checkboxes) ao mudar de tela, aba de status, página ou filtros
  // Garante que seleções anteriores sejam ignoradas ao navegar para outra tela ou visualização,
  // eliminando qualquer risco de realizar alterações em massa incorretas em pedidos não visíveis.
  useEffect(() => {
    setSelectedOrderIds([]);
    setBulkCourierId('');
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    groupBy,
    selectedPartnerFilter,
    selectedRegionFilter,
    detSearchCourierId,
    detSearchTipoEntrega,
    detSearchPedido,
    startDateFil,
    endDateFil,
    enableDateFilter,
    localSearchTerm,
    cepSearchTerm,
  ]);

  // Function to reset all filters (search terms, status tab, date range to current day, partner, region, courier, and detailed search)
  const handleClearAllFilters = () => {
    setSelectedOrderIds([]);
    setBulkCourierId('');
    setLocalSearchTerm('');
    if (onSearchTermChange) {
      onSearchTermChange('');
    }

    setCepSearchTerm('');

    setActiveTab('open');
    if (onResetDashboardFilterStatus) {
      onResetDashboardFilterStatus();
    }

    setSelectedRegionFilter(null);
    setSelectedPartnerFilter('all');
    if (setSelectedCourierId) {
      setSelectedCourierId(null);
    }

    const today = getTodayISO();
    setStartDateFil(today);
    setEndDateFil(today);
    setEnableDateFilter(true);
    if (onDateFilterChange) {
      onDateFilterChange(true, today, today);
    }

    setDetSearchIds('');
    setDetSearchDanfe('');
    setDetSearchClientCode('all');
    setDetSearchCustomerName('');
    setDetSearchCity('');
    setDetSearchCourierId('all');
    setDetSearchTipoEntrega('all');
    setDetSearchPedido('');
    setIsDetailedSearchOpen(false);

    setCurrentPage(1);
  };

  // State for copying address feedback and opening route
  const [copiedAddressOrderId, setCopiedAddressOrderId] = useState<string | null>(null);

  const resolveOriginBaseAddress = (order: Order) => {
    if (hubs && hubs.length > 0) {
      const activeHub = hubs.find(h => h.isActive) || hubs[0];
      if (activeHub) {
        const namePart = activeHub.name ? `${activeHub.name}, ` : 'HUB Central Principal, ';
        const addressPart = activeHub.address || "Rua Cerro corá, 385 - Vila Romana, São Paulo - SP";
        return `${namePart}${addressPart}`;
      }
    }
    return "HUB Central Principal, Rua Cerro corá, 385 - Vila Romana, São Paulo - SP";
  };

  const handleCopyAndRoute = (order: Order) => {
    if (!order.address) return;

    // Copy exact delivery address to clipboard
    navigator.clipboard.writeText(order.address);

    // Open route on Google Maps from base central to destination address
    const destination = order.address;
    const baseAddress = resolveOriginBaseAddress(order);

    let url = "";
    if (baseAddress) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(baseAddress)}&destination=${encodeURIComponent(destination)}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    }

    window.open(url, '_blank');

    setCopiedAddressOrderId(order.id);
    setTimeout(() => {
      setCopiedAddressOrderId(null);
    }, 2000);
  };

  // Click outside to close dropdowns dynamically
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#period-presets-dropdown-container')) {
        setIsPresetDropdownOpen(false);
      }
      if (!target.closest('#status-filters-dropdown-container')) {
        setIsStatusDropdownOpen(false);
      }
      if (!target.closest('#group-by-dropdown-container')) {
        setIsGroupDropdownOpen(false);
      }
      if (!target.closest('#columns-dropdown-container')) {
        setIsColumnsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const getActivePresetLabel = () => {
    if (!enableDateFilter) return 'Exibir Tudo';
    if (startDateFil === todayISO && endDateFil === todayISO) return 'Hoje';
    if (startDateFil === getYesterdayISO() && endDateFil === getYesterdayISO()) return 'Ontem';
    if (startDateFil === getDaysAgoISO(6) && endDateFil === todayISO) return 'Últimos 7 Dias';
    if (startDateFil === getFirstDayOfMonthISO() && endDateFil === todayISO) return 'Este Mês';
    return 'Customizado';
  };

  const getActiveStatusLabel = () => {
    switch (activeTab) {
      case 'open': return 'Em Aberto';
      case 'all': return 'Todos';
      case 'pending': return 'Pendentes';
      case 'in_progress': return 'Em Andamento';
      case 'in_route': return 'Em Rota';
      case 'failure': return 'Ocorrência';
      case 'delivered': return 'Entregues';
      case 'cancelled': return 'Cancelados';
      default: return 'Em Aberto';
    }
  };

  const getActiveSortLabel = () => {
    if (!sortField || !sortDirection) return 'Sem ordenação';
    const col = initialColumns.find(c => c.id === sortField);
    if (!col) return 'Sem ordenação';
    return `${col.label} (${sortDirection === 'asc' ? 'Crescente' : 'Decrescente'})`;
  };

  // Active Interactive Modal modes
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Deletion verify modal
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Cancellation confirmation modal
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelConfirmIdInput, setCancelConfirmIdInput] = useState<string>('');
  const [isBulkCancelModalOpen, setIsBulkCancelModalOpen] = useState<boolean>(false);

  // Bulk Status Change confirmation modal
  const [bulkStatusToConfirm, setBulkStatusToConfirm] = useState<OrderStatus | null>(null);
  const [isExecutingBulkStatus, setIsExecutingBulkStatus] = useState<boolean>(false);

  // Mobile accordion state for collapsible columns in responsive view
  const [expandedMobileOrders, setExpandedMobileOrders] = useState<Record<string, boolean>>({});
  const toggleMobileOrderExpand = (id: string) => {
    setExpandedMobileOrders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Column Reordering & Drag & Drop & Sorting - Compact Density Layout
  const initialColumns = [
    { id: 'select', label: 'Seleção', align: 'center', sortable: false, width: 'w-[32px] min-w-[32px] max-w-[32px]' },
    { id: 'actions', label: 'Ações', align: 'center', sortable: false, width: 'w-[140px] min-w-[140px] max-w-[140px]' },
    { id: 'status', label: 'Status Sincronizado', align: 'center', sortable: true, width: 'w-[105px] min-w-[100px] max-w-[110px]' },
    { id: 'codigoCliente', label: 'EMPRESA PARCEIRO', align: 'left', sortable: true, width: 'w-[140px] min-w-[120px] max-w-[170px]' },
    { id: 'dataSolicitacao', label: 'DT SOLICITACAO', align: 'center', sortable: true, width: 'w-[80px] min-w-[75px] max-w-[85px]' },
    { id: 'pedido', label: 'NUM  PEDIDO', align: 'left', sortable: true, width: 'w-[85px] min-w-[75px] max-w-[90px]' },
    { id: 'customerName', label: 'DESTINÁTARIO FINAL', align: 'left', sortable: true, width: 'w-[110px] min-w-[95px]' },
    { id: 'endereco', label: 'ENDEREÇO COMPLETO', align: 'left', sortable: true, width: 'w-[200px] min-w-[170px] max-w-[240px]' },
    { id: 'cep', label: 'CEP', align: 'left', sortable: true, width: 'w-[68px] min-w-[62px] max-w-[72px]' },
    { id: 'telefone', label: 'TELEFONE', align: 'left', sortable: true, width: 'w-[85px] min-w-[75px] max-w-[90px]' },
    { id: 'prioridade', label: 'PRIORIDADE', align: 'center', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'courier', label: 'ENTREGADOR ALOCADO', align: 'left', sortable: false, width: 'w-[130px] min-w-[120px]' },
    { id: 'email', label: 'EMAIL', align: 'left', sortable: true, width: 'w-[95px] min-w-[85px]' },
    { id: 'dispositivoCondutor', label: 'TEL- CONDUTOR', align: 'left', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'complemento', label: 'COMPLEMENTO', align: 'left', sortable: true, width: 'w-[85px] min-w-[75px]' },
    { id: 'valorNotaFiscal', label: 'VALOR NF', align: 'right', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'horarioInicio', label: 'Horario Inicio', align: 'center', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'horarioFinal', label: 'Horario Conclusao', align: 'center', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'tipoEntrega', label: 'Tipo Entrega', align: 'left', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'chamado', label: 'Chamado', align: 'left', sortable: true, width: 'w-[70px] min-w-[65px]' },
    { id: 'danfe', label: 'DANFE', align: 'left', sortable: true, width: 'w-[85px] min-w-[75px]' },
    { id: 'dataLimite', label: 'Data Conclusao', align: 'center', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'nomeFantasia', label: 'Nome Fantasia', align: 'left', sortable: true, width: 'w-[95px] min-w-[85px]' },
    { id: 'documentoEmpresa', label: 'Documento Empresa', align: 'left', sortable: true, width: 'w-[90px] min-w-[80px]' },
    { id: 'dataAgendamento', label: 'DT AGENDAMENTO', align: 'center', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'cidadeMunicipio', label: 'Municipio', align: 'left', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'estado', label: 'Estado', align: 'center', sortable: true, width: 'w-[36px] min-w-[32px] max-w-[40px]' },
    { id: 'detalhe', label: 'Detalhe', align: 'left', sortable: true, width: 'w-[105px] min-w-[90px]' },
    { id: 'valorReceber', label: 'Valor Receber', align: 'right', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'valorEntrega', label: 'Valor Entrega', align: 'right', sortable: true, width: 'w-[75px] min-w-[65px]' },
    { id: 'latitude', label: 'Latitude', align: 'right', sortable: true, width: 'w-[70px] min-w-[65px]' },
    { id: 'longitude', label: 'Longitude', align: 'right', sortable: true, width: 'w-[70px] min-w-[65px]' },
    { id: 'procurarPor', label: 'Destinatario', align: 'left', sortable: true, width: 'w-[110px] min-w-[95px]' },
    { id: 'destinatarioCnpjCpf', label: 'Cnpj-Cpf', align: 'left', sortable: true, width: 'w-[90px] min-w-[80px]' },
    { id: 'valorCondutor', label: 'Repasse Condutor', align: 'right', sortable: true, width: 'w-[80px] min-w-[72px]' },
  ];

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultOrder = [
      'select',
      'actions',
      'status',
      'codigoCliente',
      'dataSolicitacao',
      'pedido',
      'customerName',
      'endereco',
      'cep',
      'telefone',
      'prioridade',
      'courier',
      'email',
      'dispositivoCondutor',
      'complemento',
      'valorNotaFiscal',
      'horarioInicio',
      'horarioFinal',
      'tipoEntrega',
      'chamado',
      'danfe',
      'dataLimite',
      'nomeFantasia',
      'documentoEmpresa',
      'dataAgendamento',
      'cidadeMunicipio',
      'estado',
      'detalhe',
      'valorReceber',
      'valorEntrega',
      'latitude',
      'longitude',
      'procurarPor',
      'destinatarioCnpjCpf',
      'valorCondutor'
    ];
    try {
      const saved = localStorage.getItem('orders_table_column_order_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        const combined = Array.from(new Set([...parsed, ...defaultOrder])).filter(id => id !== 'sequencia');
        return combined;
      }
    } catch (e) {}
    return defaultOrder.filter(id => id !== 'sequencia');
  });

  useEffect(() => {
    try {
      localStorage.setItem('orders_table_column_order_v5', JSON.stringify(columnOrder));
    } catch (e) {}
  }, [columnOrder]);

  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orders_table_hidden_columns');
      return saved ? JSON.parse(saved).filter((id: string) => id !== 'sequencia') : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('orders_table_hidden_columns', JSON.stringify(hiddenColumns));
    } catch (e) {
      console.error(e);
    }
  }, [hiddenColumns]);

  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState<boolean>(false);
  const [colSearchTerm, setColSearchTerm] = useState<string>('');

  const visibleColumnOrder = columnOrder.filter(id => !hiddenColumns.includes(id) && (id !== 'valorEntrega' || isAdmin));
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const handleColumnSwap = (draggedId: string | null, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedId);
    const targetIdx = newOrder.indexOf(targetId);
    
    newOrder[draggedIdx] = targetId;
    newOrder[targetIdx] = draggedId;
    setColumnOrder(newOrder);
    setDraggedColId(null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Smart digital delivery protocol modal state
  const [protocolOrder, setProtocolOrder] = useState<Order | null>(null);
  const [isEditingProtocol, setIsEditingProtocol] = useState(false);
  const [isSavingProtocol, setIsSavingProtocol] = useState(false);
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [protocolSuccessMsg, setProtocolSuccessMsg] = useState<string | null>(null);
  const [protocolName, setProtocolName] = useState('');
  const [protocolDoc, setProtocolDoc] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [protocolNotes, setProtocolNotes] = useState('');
  const [protocolSignature, setProtocolSignature] = useState<string | null>(null);
  const [keepExistingSignature, setKeepExistingSignature] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [protocolPhoto, setProtocolPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isGeoRegionsOpen, setIsGeoRegionsOpen] = useState(false);

  // Timeline Order status histories modal state
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [newHistoryNote, setNewHistoryNote] = useState('');

  // Voucher print state
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printHistoryOrder, setPrintHistoryOrder] = useState<Order | null>(null);
  const [printFormat, setPrintFormat] = useState<'a4' | 'half'>('a4');
  const [includeFinancialValues, setIncludeFinancialValues] = useState<boolean>(false);
  const [showFinancialsInPrint, setShowFinancialsInPrint] = useState<boolean>(false);
  const [printPhoto, setPrintPhoto] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<Order | null>(null);

  // Automatically ensure photo is hydrated from memory cache or IndexedDB whenever protocolOrder changes
  useEffect(() => {
    if (!protocolOrder) return;
    const initialPhoto = resolveOrderPhoto(protocolOrder);
    if (initialPhoto) {
      setProtocolPhoto(initialPhoto);
    } else {
      const keys = getAllOrderKeys(protocolOrder);
      let isCurrent = true;
      (async () => {
        for (const k of keys) {
          const p = await getOrderPhoto(k);
          if (p && isCurrent) {
            setProtocolPhoto(p);
            break;
          }
        }
      })();
      return () => { isCurrent = false; };
    }
  }, [protocolOrder?.id, protocolOrder?.pedido]);

  useEffect(() => {
    if (printOrder) {
      setShowFinancialsInPrint(!!printOrder.deliveryProtocol?.includeFinancialValues);
      const photo = resolveOrderPhoto(printOrder);
      if (photo) {
        setPrintPhoto(photo);
      } else {
        const keys = getAllOrderKeys(printOrder);
        let active = true;
        (async () => {
          for (const k of keys) {
            const p = await getOrderPhoto(k);
            if (p && active) {
              setPrintPhoto(p);
              break;
            }
          }
        })();
        return () => { active = false; };
      }
    } else {
      setPrintPhoto(null);
    }
  }, [printOrder?.id, printOrder?.pedido]);

  // Form Field states for Full 30 Columns CRUD
  const [id, setId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [numero, setNumero] = useState('');
  const [value, setValue] = useState(0);
  const [region, setRegion] = useState('Centro-Paulista');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [time, setTime] = useState('');

  // Sheet 30 columns fields
  const [codigoCliente, setCodigoCliente] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState(todayStrSP);
  const [pedido, setPedido] = useState('');
  const [procurarPor, setProcurarPor] = useState('');
  const [cep, setCep] = useState('');
  const [telefone, setTelefone] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [email, setEmail] = useState('');
  const [complemento, setComplemento] = useState('');
  const [dispositivoCondutor, setDispositivoCondutor] = useState('');
  const [horarioFinal, setHorarioFinal] = useState('');
  const [documentoEmpresa, setDocumentoEmpresa] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState('');
  const [prioridade, setPrioridade] = useState('Normal');
  const [chamado, setChamado] = useState('');
  const [danfe, setDanfe] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [cidadeMunicipio, setCidadeMunicipio] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');
  const [valorNotaFiscal, setValorNotaFiscal] = useState(0);
  const [valorReceber, setValorReceber] = useState(0);
  const [valorEntrega, setValorEntrega] = useState(0);
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [destinatarioCnpjCpf, setDestinatarioCnpjCpf] = useState('');
  const [valorCondutor, setValorCondutor] = useState(0);
  const [isCepLoading, setIsCepLoading] = useState(false);

  // Real-time Freight auto-recalculation when CEP or Client Code changes
  const recalculateFreightValue = (targetCep: string, targetClientCode: string) => {
    const cleanCep = (targetCep || '').replace(/\D/g, '');
    if (cleanCep.length === 8 && targetClientCode) {
      try {
        const cached = localStorage.getItem('vinimap_freight_rules');
        if (cached) {
          const rules = JSON.parse(cached);
          if (Array.isArray(rules)) {
            const matchedRule = rules.find((rule: any) => {
              if (!matchClientCode(rule.partnerId, targetClientCode)) return false;
              
              const minCep = (rule.cepMin || '').replace(/\D/g, '');
              const maxCep = (rule.cepMax || '').replace(/\D/g, '');
              if (!minCep || !maxCep) return false;
              
              const minNum = parseInt(minCep, 10);
              const maxNum = parseInt(maxCep, 10);
              const cepNum = parseInt(cleanCep, 10);
              
              return cepNum >= minNum && cepNum <= maxNum;
            });
            
            if (matchedRule) {
              setValorEntrega(Number(matchedRule.value));
            }
          }
        }
      } catch (err) {
        console.error('Error auto-calculating freight in edit form:', err);
      }
    }
  };

  const triggerCepAutoComplete = async (enteredCep: string) => {
    // Format input as XXXXX-XXX
    let cleaned = enteredCep.replace(/\D/g, '');
    if (cleaned.length > 8) {
      cleaned = cleaned.slice(0, 8);
    }
    
    let formatted = cleaned;
    if (cleaned.length > 5) {
      formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    setCep(formatted);
    recalculateFreightValue(formatted, codigoCliente);

    // If we have full 8 digits, try to resolve via public API ViaCEP
    if (cleaned.length === 8) {
      setIsCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.erro) {
            // Smart auto-fill
            const resolvedStreet = data.logradouro || '';
            const resolvedBairro = data.bairro || '';
            let finalAddressString = resolvedStreet;
            if (resolvedBairro) {
              finalAddressString += finalAddressString ? `, ${resolvedBairro}` : resolvedBairro;
            }
            if (finalAddressString) {
              setAddress(finalAddressString);
            }
            
            setCidadeMunicipio(data.localidade || 'São Paulo');
            setEstado(data.uf || 'SP');

            // Set Region based on neighborhood (bairro) pattern matching for São Paulo
            const b = (data.bairro || '').toLowerCase();
            let detectedRegion = 'Centro-Paulista';
            if (
              b.includes('pinheiros') || b.includes('itaim') || b.includes('paulista') || 
              b.includes('consolacao') || b.includes('bela vista') || b.includes('centro') || 
              b.includes('se') || b.includes('liberdade') || b.includes('perdizes') || 
              b.includes('vila mariana') || b.includes('cambuci') || b.includes('republica') || 
              b.includes('santa cecilia') || b.includes('bom retiro') || b.includes('bras') || 
              b.includes('paraiso')
            ) {
              detectedRegion = 'Centro-Paulista';
            } else if (
              b.includes('santo amaro') || b.includes('saude') || b.includes('ipiranga') || 
              b.includes('jabaquara') || b.includes('interlagos') || b.includes('vila olimpia') || 
              b.includes('morumbi') || b.includes('brooklin') || b.includes('socorro') || 
              b.includes('campo belo') || b.includes('parelheiros') || b.includes('capao redondo') || 
              b.includes('campo limpo') || b.includes('moema')
            ) {
              detectedRegion = 'Zona Sul';
            } else if (
              b.includes('lapa') || b.includes('butanta') || b.includes('barra funda') || 
              b.includes('jaguare') || b.includes('freguesia') || b.includes('perus') || 
              b.includes('vila leopoldina') || b.includes('pirituba')
            ) {
              detectedRegion = 'Zona Oeste';
            } else if (
              b.includes('tatuape') || b.includes('mooca') || b.includes('penha') || 
              b.includes('itaim paulista') || b.includes('sao mateus') || b.includes('itaquera') || 
              b.includes('belem') || b.includes('sapopemba') || b.includes('carrao') || 
              b.includes('analia franco') || b.includes('vila prudente')
            ) {
              detectedRegion = 'Zona Leste';
            } else if (
              b.includes('santana') || b.includes('tucuruvi') || b.includes('casa verde') || 
              b.includes('vila maria') || b.includes('jacana') || b.includes('limao') || 
              b.includes('tremembe') || b.includes('mandaqui')
            ) {
              detectedRegion = 'Zona Norte';
            }
            setRegion(detectedRegion);

            // Approximate GPS Coordinates with slight random offsets
            setLatitude(-23.55052 + (Math.random() - 0.5) * 0.04);
            setLongitude(-46.633308 + (Math.random() - 0.5) * 0.04);
          }
        }
      } catch (err) {
        console.error('ViaCEP resolution error, fallback to offline estimation', err);
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  // Format Helper for Date solicitation strings to ISO
  const parseToISODate = (str: string | undefined): string => {
    return parseToISODateUtil(str, getYesterdayISO());
  };

  const getRegionFromCEP = (cepStr: string): string => {
    if (!cepStr) return 'Sem CEP / Outros';
    const cleanCep = cepStr.replace(/\D/g, '');
    if (!cleanCep) return 'Sem CEP / Outros';
    
    const prefix5 = parseInt(cleanCep.substring(0, 5), 10);
    const firstDigit = cleanCep.charAt(0);
    
    if (firstDigit !== '0') {
      if (firstDigit === '1') {
        return 'SP Interior / Litoral';
      }
      return 'Outros Estados';
    }
    
    if (prefix5 >= 1000 && prefix5 <= 1599) {
      return 'Centro (Sé, República)';
    }
    if (prefix5 >= 2000 && prefix5 <= 2999) {
      return 'Zona Norte (Santana, Tucuruvi)';
    }
    if ((prefix5 >= 3000 && prefix5 <= 3999) || (prefix5 >= 8000 && prefix5 <= 8499)) {
      return 'Zona Leste (Mooca, Penha, Itaquera)';
    }
    if (prefix5 >= 4000 && prefix5 <= 4999) {
      return 'Zona Sul (Vila Mariana, Santo Amaro)';
    }
    if (prefix5 >= 5000 && prefix5 <= 5899) {
      return 'Zona Oeste (Lapa, Pinheiros, Butantã)';
    }
    if (prefix5 >= 9000 && prefix5 <= 9999) {
      return 'Grande ABC / Metropol.';
    }
    
    return 'Grande SP - Outras Regiões';
  };

  // Pre-index the orders for extremely efficient and instant querying
  const ordersIndex = React.useMemo(() => {
    const byCourier: Record<string, any[]> = {};
    const byDate: Record<string, any[]> = {}; // Map of launchDateISO -> items
    
    const allIndexed = orders.map((order) => {
      const idLower = order.id.toLowerCase();
      const customerNameLower = (order.customerName || '').toLowerCase();
      const addressLower = (order.address || '').toLowerCase();
      const regionLower = (order.region || '').toLowerCase();
      const pedidoLower = (order.pedido || '').toLowerCase();
      const codigoClienteLower = (order.codigoCliente || '').toLowerCase();
      const partnerName = resolvePartnerName(order, partnerClients);
      const partnerNameLower = partnerName.toLowerCase();
      const recipientName = resolveRecipientName(order, partnerClients);
      const recipientNameLower = recipientName.toLowerCase();
      const cepClean = (order.cep || '').replace(/\D/g, '').toLowerCase();
      const procurarPorLower = (order.procurarPor || '').toLowerCase();
      const danfeLower = (order.danfe || '').toLowerCase();
      const chamadoLower = (order.chamado || '').toLowerCase();
      const cidadeMunicipioLower = (order.cidadeMunicipio || '').toLowerCase();

      // Memoize date parsing to avoid re-parsing on every filter pass
      const rawDateStr = order.dataSolicitacao || (typeof order.createdAt === 'string' ? order.createdAt : (typeof order.createdAt === 'number' ? formatToBrasiliaDate(new Date(order.createdAt)) : ''));
      const launchDateISO = parseToISODate(rawDateStr);

      // Memoize and pre-index history status times to avoid looping/reverse/split repeatedly
      const transitionDates: Record<string, string> = {};
      if (order.history && Array.isArray(order.history)) {
        for (let i = order.history.length - 1; i >= 0; i--) {
          const h = order.history[i];
          if (h && h.status && h.time && !transitionDates[h.status]) {
            const parts = h.time.split(' ');
            const datePart = parts[0];
            if (datePart) {
              transitionDates[h.status] = parseToISODate(datePart);
            }
          }
        }
      }

      // Guarantee transition date for delivered orders from protocol, deliveredAt, or statusUpdatedAt
      if (order.status === 'delivered' || !!order.deliveryProtocol || !!order.proofPhotoUrl) {
        if (!transitionDates['delivered']) {
          if (order.deliveryProtocol?.signedAt) {
            transitionDates['delivered'] = parseToISODate(order.deliveryProtocol.signedAt.split(' ')[0] || order.deliveryProtocol.signedAt);
          } else if (order.deliveredAt) {
            transitionDates['delivered'] = parseToISODate(order.deliveredAt.split(' ')[0]);
          } else if (order.statusUpdatedAt || order.updatedAt) {
            const rawTs = Number(order.statusUpdatedAt || order.updatedAt);
            if (rawTs > 0) {
              transitionDates['delivered'] = parseToISODate(formatToBrasiliaDate(new Date(rawTs)));
            }
          }
        }
      }

      let allocatedDateISO: string | null = null;
      if (order.allocatedDate) {
        allocatedDateISO = parseToISODate(order.allocatedDate);
      } else if (order.courierId) {
        if (order.history && Array.isArray(order.history)) {
          const allocEntry = [...order.history].reverse().find(h => 
            h && (
              ((h as any).details && String((h as any).details).toLowerCase().includes('alocad')) ||
              (h.note && (h.note.toLowerCase().includes('alocad') || h.note.toLowerCase().includes('atribuíd') || h.note.toLowerCase().includes('condutor'))) ||
              (h.status && (h.status === 'in_route' || h.status === 'in_progress'))
            )
          );
          if (allocEntry && allocEntry.time) {
            const parts = allocEntry.time.split(' ');
            if (parts[0]) allocatedDateISO = parseToISODate(parts[0]);
          }
        }
        if (!allocatedDateISO && (order.statusUpdatedAt || order.updatedAt || order.versionTimestamp)) {
          const rawTs = Number(order.statusUpdatedAt || order.updatedAt || order.versionTimestamp);
          if (rawTs > 0) {
            allocatedDateISO = parseToISODate(formatToBrasiliaDate(new Date(rawTs)));
          }
        }
      }

      const indexedItem = {
        order,
        idLower,
        customerNameLower,
        addressLower,
        regionLower,
        pedidoLower,
        codigoClienteLower,
        partnerNameLower,
        cepClean,
        procurarPorLower,
        recipientNameLower,
        danfeLower,
        chamadoLower,
        cidadeMunicipioLower,
        launchDateISO,
        transitionDates,
        allocatedDateISO,
      };

      // Group by courierId
      const courierKey = order.courierId || 'unallocated';
      if (!byCourier[courierKey]) {
        byCourier[courierKey] = [];
      }
      byCourier[courierKey].push(indexedItem);

      // Group by date for quick date bounds filtering
      if (!byDate[launchDateISO]) {
        byDate[launchDateISO] = [];
      }
      byDate[launchDateISO].push(indexedItem);

      return indexedItem;
    });

    return {
      all: allIndexed,
      byCourier,
      byDate,
    };
  }, [orders, partnerClients]);

  // Helper to determine if an order matches the selected period by launch date or allocation date
  const isWithinDatePeriod = (item: any, startDate: string, endDate: string): boolean => {
    if (!item.launchDateISO && !item.allocatedDateISO) return false;
    // Na data atual do dia ("Hoje"), exibir pedidos lançados no dia OU alocados para entrega no dia.
    // Os pedidos de dias anteriores entram na lista se o seletor de datas estiver correspondente ou se estiverem alocados hoje.
    const today = getTodayISO();
    if (startDate === today && endDate === today) {
      return item.launchDateISO === today || item.allocatedDateISO === today;
    }
    // Caso um período customizado ou com múltiplos dias seja selecionado:
    const launchInRange = item.launchDateISO ? (item.launchDateISO >= startDate && item.launchDateISO <= endDate) : false;
    const allocInRange = item.allocatedDateISO ? (item.allocatedDateISO >= startDate && item.allocatedDateISO <= endDate) : false;
    return launchInRange || allocInRange;
  };

  // Orders strictly within the selected period to power the synchronized count badges
  const periodOrders = React.useMemo(() => {
    if (!enableDateFilter) return orders;
    return orders.filter(order => {
      const item = ordersIndex.all.find(i => i.order.id === order.id);
      if (!item) return true;
      return isWithinDatePeriod(item, startDateFil, endDateFil);
    });
  }, [orders, ordersIndex, enableDateFilter, startDateFil, endDateFil]);

  const activePartner = selectedPartnerFilter !== 'all' ? selectedPartnerFilter : detSearchClientCode;
  const activeCourier = detSearchCourierId !== 'all' ? detSearchCourierId : (selectedCourierId || 'all');

  // Selected courier object if a specific courier is active in filters
  const selectedCourierObj = React.useMemo(() => {
    if (!activeCourier || activeCourier === 'all' || activeCourier === 'unallocated') return null;
    return couriers.find(c => c.id === activeCourier) || null;
  }, [couriers, activeCourier]);

  // Check if active courier has pending orders from dates prior to the current start date
  const courierPriorPendingOrders = React.useMemo(() => {
    if (!activeCourier || activeCourier === 'all' || activeCourier === 'unallocated') return [];
    return orders.filter(o => {
      if (o.courierId !== activeCourier) return false;
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      const item = ordersIndex.all.find(i => i.order.id === o.id);
      const launchDateISO = item ? item.launchDateISO : parseToISODateInApp(o.dataSolicitacao);
      const allocatedDateISO = o.allocatedDate ? parseToISODateInApp(o.allocatedDate) : null;
      const effectiveDate = allocatedDateISO || launchDateISO;
      return effectiveDate < startDateFil;
    });
  }, [orders, activeCourier, startDateFil, ordersIndex]);

  // Alerta Global para o Administrador: pedidos em aberto (não entregues e não cancelados) de datas anteriores à data de início consultada
  // Só emitir quando o administrador estiver consultando um período ou houver pendências de dias anteriores
  const [isPriorOpenAlertDismissed, setIsPriorOpenAlertDismissed] = useState<boolean>(false);
  const priorOpenOrders = React.useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      const item = ordersIndex.all.find(i => i.order.id === o.id);
      const launchDateISO = item ? item.launchDateISO : parseToISODateInApp(o.dataSolicitacao);
      const allocatedDateISO = o.allocatedDate ? parseToISODateInApp(o.allocatedDate) : null;
      const effectiveDate = allocatedDateISO || launchDateISO;
      return effectiveDate && effectiveDate < startDateFil;
    });
  }, [orders, startDateFil, ordersIndex]);

  // Counts by Partner in the selected period (reflecting selected courier if filtered)
  const partnerCountsInPeriod = React.useMemo(() => {
    const counts: Record<string, number> = { all: 0, avulsa: 0 };
    partnerClients.forEach(p => { counts[p.id] = 0; });

    const baseOrdersForPartnerCounts = activeCourier === 'all'
      ? periodOrders
      : activeCourier === 'unallocated'
        ? periodOrders.filter(o => !o.courierId)
        : periodOrders.filter(o => o.courierId === activeCourier);

    counts.all = baseOrdersForPartnerCounts.length;

    baseOrdersForPartnerCounts.forEach(o => {
      const partnerObj = getPartnerObject(o, partnerClients);
      if (partnerObj) {
        counts[partnerObj.id] = (counts[partnerObj.id] || 0) + 1;
      } else {
        counts.avulsa = (counts.avulsa || 0) + 1;
      }
    });

    return counts;
  }, [periodOrders, partnerClients, activeCourier]);

  // Counts by Courier in the selected period (reflecting selected partner if filtered)
  const courierCountsInPeriod = React.useMemo(() => {
    const counts: Record<string, number> = { all: 0, unallocated: 0 };
    couriers.forEach(c => { counts[c.id] = 0; });

    const baseOrdersForCourierCounts = activePartner === 'all'
      ? periodOrders
      : periodOrders.filter(o => isOrderMatchingPartner(o, activePartner, partnerClients));

    counts.all = baseOrdersForCourierCounts.length;

    baseOrdersForCourierCounts.forEach(o => {
      if (o.courierId) {
        counts[o.courierId] = (counts[o.courierId] || 0) + 1;
      } else {
        counts.unallocated = (counts.unallocated || 0) + 1;
      }
    });

    return counts;
  }, [periodOrders, couriers, activePartner, partnerClients]);

  // Counts by Status in the selected period (reflecting selected courier AND partner if filtered)
  const statusCountsInPeriod = React.useMemo(() => {
    const counts: Record<string, number> = {
      open: 0,
      all: 0,
      pending: 0,
      in_progress: 0,
      in_route: 0,
      failure: 0,
      delivered: 0,
      cancelled: 0,
    };

    let scopedOrders = periodOrders;

    // Filter by selected partner if active
    if (activePartner !== 'all') {
      scopedOrders = scopedOrders.filter(o => isOrderMatchingPartner(o, activePartner, partnerClients));
    }

    // Filter by selected courier if active
    if (activeCourier !== 'all') {
      if (activeCourier === 'unallocated') {
        scopedOrders = scopedOrders.filter(o => !o.courierId);
      } else {
        scopedOrders = scopedOrders.filter(o => o.courierId === activeCourier);
      }
    }

    counts.all = scopedOrders.length;
    scopedOrders.forEach(o => {
      if (counts[o.status] !== undefined) {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
      if (o.status !== 'delivered' && o.status !== 'cancelled') {
        counts.open = (counts.open || 0) + 1;
      }
    });
    return counts;
  }, [periodOrders, activePartner, activeCourier, partnerClients]);

  // Filter orders based on active Tab + searchTerm + smart date ranges + cepSearchTerm + Partner + Courier
  const filteredOrdersBeforeRegion = React.useMemo(() => {
    // Determine the base set to filter from (utilizing our pre-indexed courier collections to reduce search space instantly)
    let candidates = ordersIndex.all;
    if (activeCourier !== 'all') {
      const courierKey = activeCourier === 'unallocated' ? 'unallocated' : activeCourier;
      candidates = ordersIndex.byCourier[courierKey] || [];
    }

    const activeSearch = localSearchTerm || searchTerm;
    const qSearch = activeSearch ? activeSearch.toLowerCase() : '';
    const qCep = cepSearchTerm ? cepSearchTerm.replace(/\D/g, '').toLowerCase() : '';
    
    // Batch search IDs
    let idsList: string[] = [];
    if (isDetailedSearchOpen && detSearchIds.trim()) {
      idsList = detSearchIds
        .split(/[\s,;\n]+/)
        .map(id => id.trim().toLowerCase())
        .filter(id => id.length > 0);
    }

    const qDanfe = (isDetailedSearchOpen && detSearchDanfe.trim()) ? detSearchDanfe.trim().toLowerCase() : '';
    const qPedido = (isDetailedSearchOpen && detSearchPedido.trim()) ? detSearchPedido.trim().toLowerCase() : '';
    const qCustomerName = (isDetailedSearchOpen && detSearchCustomerName.trim()) ? detSearchCustomerName.trim().toLowerCase() : '';
    const qCity = (isDetailedSearchOpen && detSearchCity.trim()) ? detSearchCity.trim().toLowerCase() : '';
    
    // Process only candidate items using primitive pre-indexed lookups
    const results: Order[] = [];
    const len = candidates.length;

    for (let i = 0; i < len; i++) {
      const item = candidates[i];
      const { order } = item;

      // 1. Tab Status Filter (chosen by ADM)
      if (activeTab !== 'all') {
        if (activeTab === 'open') {
          if (order.status === 'delivered' || order.status === 'cancelled') {
            continue;
          }
        } else if (order.status !== activeTab) {
          continue;
        }
      }

      // 1.1. Partner Filter (activePartner - intersects with courier, status, and date)
      if (activePartner !== 'all') {
        if (!isOrderMatchingPartner(order, activePartner, partnerClients)) {
          continue;
        }
      }

      // 1.2. Courier Filter (activeCourier - intersects with partner, status, and date)
      if (activeCourier !== 'all') {
        if (activeCourier === 'unallocated') {
          if (order.courierId) continue;
        } else {
          if (order.courierId !== activeCourier) continue;
        }
      }

      // 2. Query Search Filter
      if (qSearch) {
        const matchQuery = (
          item.idLower.includes(qSearch) ||
          item.customerNameLower.includes(qSearch) ||
          item.recipientNameLower.includes(qSearch) ||
          item.addressLower.includes(qSearch) ||
          item.regionLower.includes(qSearch) ||
          item.pedidoLower.includes(qSearch) ||
          item.partnerNameLower.includes(qSearch) ||
          item.codigoClienteLower.includes(qSearch) ||
          (order.cep && order.cep.includes(qSearch)) ||
          item.procurarPorLower.includes(qSearch)
        );
        if (!matchQuery) continue;
      }

      // 2.2. CEP Search Filter
      if (qCep) {
        if (!item.cepClean.includes(qCep)) {
          continue;
        }
      }

      // 2.3. Detailed Search (Pesquisa Detalhada) Filters
      if (isDetailedSearchOpen) {
        // Multiple IDs / batch search
        if (idsList.length > 0) {
          const matchAny = idsList.some(targetId => 
            item.idLower.includes(targetId) || 
            item.pedidoLower.includes(targetId) ||
            item.chamadoLower.includes(targetId)
          );
          if (!matchAny) continue;
        }

        // Danfe filter
        if (qDanfe && !item.danfeLower.includes(qDanfe)) {
          continue;
        }

        // Pedido filter
        if (qPedido && !item.pedidoLower.includes(qPedido)) {
          continue;
        }

        // Nome do Destinatário / Procurar Por filter
        if (qCustomerName && !item.customerNameLower.includes(qCustomerName) && !item.procurarPorLower.includes(qCustomerName) && !item.recipientNameLower.includes(qCustomerName)) {
          continue;
        }

        // Cidade / Bairro / CEP filter
        if (qCity && !item.cidadeMunicipioLower.includes(qCity) && !item.addressLower.includes(qCity) && !item.cepClean.includes(qCity)) {
          continue;
        }

        // Tipo de Entrega filter
        if (detSearchTipoEntrega !== 'all') {
          if (!order.tipoEntrega || order.tipoEntrega.toLowerCase() !== detSearchTipoEntrega.toLowerCase()) {
            continue;
          }
        }
      }

      // 3. Smart Date Range filter (respects launch date, status transition, and allocated date)
      // Se o operador está realizando uma busca explícita por termo (ex: nome, pedido, danfe, CEP ou ID), não ocultar o resultado pelo período
      const isExplicitTextSearch = Boolean(
        qSearch || 
        qCep || 
        (isDetailedSearchOpen && (idsList.length > 0 || qDanfe || qPedido || qCustomerName || qCity))
      );

      if (enableDateFilter && !isExplicitTextSearch) {
        if (!isWithinDatePeriod(item, startDateFil, endDateFil)) {
          continue;
        }
      }

      // 4. Column Specific Filters
      let colFiltersFailed = false;
      for (const [colId, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal) continue;
        const qCol = String(filterVal).toLowerCase();

        // Resolve a user-friendly string for the specific column
        let resolvedValue = '';
        if (colId === 'status') {
          const translatedStatus = 
            order.status === 'pending' ? 'não iniciado' :
            order.status === 'in_progress' ? 'em andamento' :
            order.status === 'in_route' ? 'entregando' :
            order.status === 'failure' ? 'ocorrência' :
            order.status === 'delivered' ? 'concluído' : 'cancelado';
          resolvedValue = translatedStatus;
        } else if (colId === 'courier') {
          const allocatedCourier = couriers.find(c => c.id === order.courierId);
          resolvedValue = allocatedCourier ? allocatedCourier.name : 'não alocado';
        } else if (colId === 'codigoCliente') {
          resolvedValue = resolvePartnerName(order, partnerClients);
        } else {
          // Fallback to property of the order object
          resolvedValue = String((order as any)[colId] || '');
        }

        if (!resolvedValue.toLowerCase().includes(qCol)) {
          colFiltersFailed = true;
          break;
        }
      }

      if (colFiltersFailed) {
        continue;
      }

      results.push(order);
    }

    return results;
  }, [
    ordersIndex,
    activeTab,
    activePartner,
    activeCourier,
    localSearchTerm,
    searchTerm,
    cepSearchTerm,
    isDetailedSearchOpen,
    detSearchIds,
    detSearchDanfe,
    detSearchPedido,
    detSearchCustomerName,
    detSearchCity,
    detSearchTipoEntrega,
    enableDateFilter,
    startDateFil,
    endDateFil,
    columnFilters,
    couriers,
    partnerClients,
  ]);

  // Apply Region Filter to get final filteredOrders
  const filteredOrders = React.useMemo(() => {
    let result = filteredOrdersBeforeRegion;
    if (selectedRegionFilter) {
      result = result.filter(order => getRegionFromCEP(order.cep) === selectedRegionFilter);
    }
    return result;
  }, [filteredOrdersBeforeRegion, selectedRegionFilter]);

  // Calculate region stats based on filteredOrdersBeforeRegion
  const regionStats = React.useMemo(() => {
    const statsMap: Record<string, { count: number; totalValue: number; deliveredCount: number; color: string; bgLight: string; borderCol: string; progressCol: string }> = {
      'Centro (Sé, República)': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-indigo-600', bgLight: 'bg-indigo-50/50', borderCol: 'border-indigo-100', progressCol: 'bg-indigo-600' },
      'Zona Norte (Santana, Tucuruvi)': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-sky-600', bgLight: 'bg-sky-50/50', borderCol: 'border-sky-100', progressCol: 'bg-sky-600' },
      'Zona Leste (Mooca, Penha, Itaquera)': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-emerald-600', bgLight: 'bg-emerald-50/50', borderCol: 'border-emerald-100', progressCol: 'bg-emerald-600' },
      'Zona Sul (Vila Mariana, Santo Amaro)': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-amber-600', bgLight: 'bg-amber-50/50', borderCol: 'border-amber-100', progressCol: 'bg-amber-600' },
      'Zona Oeste (Lapa, Pinheiros, Butantã)': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-violet-600', bgLight: 'bg-violet-50/50', borderCol: 'border-violet-100', progressCol: 'bg-violet-600' },
      'Grande ABC / Metropol.': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-pink-600', bgLight: 'bg-pink-50/50', borderCol: 'border-pink-100', progressCol: 'bg-pink-600' },
      'SP Interior / Litoral': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-teal-600', bgLight: 'bg-teal-50/50', borderCol: 'border-teal-100', progressCol: 'bg-teal-600' },
      'Grande SP - Outras Regiões': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-cyan-600', bgLight: 'bg-cyan-50/50', borderCol: 'border-cyan-100', progressCol: 'bg-cyan-600' },
      'Sem CEP / Outros': { count: 0, totalValue: 0, deliveredCount: 0, color: 'text-slate-500', bgLight: 'bg-slate-50/50', borderCol: 'border-slate-150', progressCol: 'bg-slate-400' }
    };

    filteredOrdersBeforeRegion.forEach((order) => {
      const region = getRegionFromCEP(order.cep);
      if (statsMap[region]) {
        statsMap[region].count += 1;
        statsMap[region].totalValue += (order.value || 0);
        if (order.status === 'delivered') {
          statsMap[region].deliveredCount += 1;
        }
      } else {
        statsMap['Sem CEP / Outros'].count += 1;
        statsMap['Sem CEP / Outros'].totalValue += (order.value || 0);
        if (order.status === 'delivered') {
          statsMap['Sem CEP / Outros'].deliveredCount += 1;
        }
      }
    });

    return Object.entries(statsMap)
      .map(([name, data]) => ({ name, ...data }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredOrdersBeforeRegion]);

  // Sort calculated outputs
  const sortedOrders = React.useMemo(() => {
    if (!sortField || !sortDirection) return filteredOrders;
    return [...filteredOrders].sort((a, b) => {
      
      let keyA: any = '';
      let keyB: any = '';

      switch (sortField) {
        case 'id':
        case 'pedido':
          // Try parsing number if possible
          keyA = parseInt(String(a.pedido || a.id).replace(/\D/g, '')) || 0;
          keyB = parseInt(String(b.pedido || b.id).replace(/\D/g, '')) || 0;
          break;
        case 'client':
        case 'codigoCliente':
          keyA = resolvePartnerName(a, partnerClients).toLowerCase();
          keyB = resolvePartnerName(b, partnerClients).toLowerCase();
          break;
        case 'procurarPor':
        case 'customerName':
          keyA = resolveRecipientName(a, partnerClients).toLowerCase();
          keyB = resolveRecipientName(b, partnerClients).toLowerCase();
          break;
        case 'cep':
          return sortDirection === 'asc' ? compareOrdersByCep(a.cep, b.cep) : compareOrdersByCep(b.cep, a.cep);
        case 'address':
        case 'endereco':
          keyA = String(a.address || '').toLowerCase();
          keyB = String(b.address || '').toLowerCase();
          break;
        case 'dates':
        case 'dataSolicitacao':
        case 'dataLimite':
        case 'dataAgendamento':
          keyA = parseToISODate(a.dataSolicitacao || a.dataLimite || a.dataAgendamento || '');
          keyB = parseToISODate(b.dataSolicitacao || b.dataLimite || b.dataAgendamento || '');
          break;
        case 'values':
        case 'valorNotaFiscal':
        case 'valorReceber':
        case 'valorEntrega':
        case 'valorCondutor':
          keyA = Number((a as any)[sortField] || a.value || 0);
          keyB = Number((b as any)[sortField] || b.value || 0);
          break;
        case 'status':
          keyA = String(a.status || '').toLowerCase();
          keyB = String(b.status || '').toLowerCase();
          break;
        default:
          const fieldValA = (a as any)[sortField];
          const fieldValB = (b as any)[sortField];
          if (typeof fieldValA === 'number') {
            keyA = fieldValA;
            keyB = typeof fieldValB === 'number' ? fieldValB : 0;
          } else {
            keyA = String(fieldValA || '').toLowerCase();
            keyB = String(fieldValB || '').toLowerCase();
          }
      }

      if (keyA < keyB) return sortDirection === 'asc' ? -1 : 1;
      if (keyA > keyB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortField, sortDirection, partnerClients]);

  // Grouping calculations on top of sorted outcomes
  const groupedOrders = React.useMemo(() => {
    if (groupBy === 'none') return [];
    
    const map: Record<string, Order[]> = {};
    sortedOrders.forEach((order) => {
      let key = '';
      if (groupBy === 'cep') {
        key = order.cep ? order.cep.trim() : 'Sem CEP';
      } else if (groupBy === 'parceiro') {
        key = resolvePartnerName(order, partnerClients);
      } else {
        key = order.address ? order.address.trim() : 'Sem Endereço';
      }
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(order);
    });

    return Object.entries(map)
      .map(([key, list]) => ({
        key,
        orders: list,
      }))
      .sort((a, b) => b.orders.length - a.orders.length || a.key.localeCompare(b.key));
  }, [sortedOrders, groupBy, partnerClients]);

  // Pagination calculations on top of sorted/grouped outcomes
  const groupsPerPage = itemsPerPage;
  const totalPages = groupBy === 'none' 
    ? (Math.ceil(sortedOrders.length / itemsPerPage) || 1)
    : (Math.ceil(groupedOrders.length / groupsPerPage) || 1);

  // Safeguard currentPage from going out of bounds when list sizes change in real-time
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * (groupBy === 'none' ? itemsPerPage : groupsPerPage);
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);
  const paginatedGroups = groupedOrders.slice(startIndex, startIndex + groupsPerPage);

  const currentPageOrderIds = React.useMemo(() => {
    if (groupBy === 'none') {
      return paginatedOrders.map(o => o.id);
    }
    return paginatedGroups.flatMap(g => g.orders).map(o => o.id);
  }, [groupBy, paginatedOrders, paginatedGroups]);

  const itemsToRender = React.useMemo(() => {
    if (groupBy === 'none') {
      return paginatedOrders.map(order => ({ type: 'order' as const, order, groupKey: 'none' }));
    }
    const items: ({ type: 'header'; key: string; groupKey: string; orders: Order[] } | { type: 'order'; order: Order; groupKey: string })[] = [];
    paginatedGroups.forEach(group => {
      const isCollapsed = collapsedGroups[group.key] || false;
      items.push({
        type: 'header',
        key: `header-${group.key}`,
        groupKey: group.key,
        orders: group.orders
      });
      if (!isCollapsed) {
        group.orders.forEach(order => {
          items.push({
            type: 'order',
            order,
            groupKey: group.key
          });
        });
      }
    });
    return items;
  }, [groupBy, paginatedOrders, paginatedGroups, collapsedGroups]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Init CRUD Form for creating
  const openCreateForm = () => {
    setFormMode('create');
    setSelectedOrder(null);
    
    // Default values matching 15/06/2026 SP
    setId('');
    setCustomerName('');
    setAddress('');
    setNumero('');
    setValue(45.00);
    setRegion('Centro-Paulista');
    setStatus('pending');
    setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    setCodigoCliente('CLI-001');
    setDataSolicitacao(todayStrSP);
    setPedido('');
    setProcurarPor('');
    setCep('');
    setTelefone('');
    setDetalhe('');
    setEmail('');
    setComplemento('');
    setDispositivoCondutor('');
    setHorarioFinal('');
    setDocumentoEmpresa('');
    setTipoEntrega('Motoboy Padrão');
    setChamado('');
    setDanfe('');
    setDataLimite(todayStrSP);
    setNomeFantasia('');
    setHorarioInicio('08:00');
    setDataAgendamento('');
    setCidadeMunicipio('São Paulo');
    setEstado('SP');
    setValorNotaFiscal(150.00);
    setValorReceber(0);
    setValorEntrega(15.00);
    setLatitude(0);
    setLongitude(0);
    setDestinatarioCnpjCpf('');
    setValorCondutor(9.50);

    setIsFormModalOpen(true);
  };

  // Init CRUD Form for editing
  const openEditForm = (order: Order) => {
    if (!isAdmin) {
      alert('Operação restrita: Apenas administradores do sistema podem editar pedidos.');
      return;
    }
    setFormMode('edit');
    setSelectedOrder(order);

    const resolvedRec = resolveRecipientName(order, partnerClients);
    const validRec = (resolvedRec && resolvedRec !== '-') ? resolvedRec : (order.procurarPor || order.customerName || '');

    setId(order.id);
    setCustomerName(validRec);
    setAddress(order.address || '');
    setNumero(order.numero || '');
    setValue(order.value || 0);
    setRegion(order.region || 'Centro-Paulista');
    setStatus(order.status || 'pending');
    setTime(order.time || '');

    setCodigoCliente(order.codigoCliente || '');
    setDataSolicitacao(order.dataSolicitacao ? normalizeIncomingDateToBrasilia(order.dataSolicitacao) : todayStrSP);
    setPedido(order.pedido || '');
    setProcurarPor(validRec);
    setCep(order.cep || '');
    setTelefone(order.telefone || '');
    setDetalhe(order.detalhe || '');
    setEmail(order.email || '');
    setComplemento(order.complemento || '');
    setDispositivoCondutor(order.dispositivoCondutor || '');
    setHorarioFinal(order.horarioFinal || '');
    setDocumentoEmpresa(order.documentoEmpresa || '');
    setTipoEntrega(order.tipoEntrega || '');
    setPrioridade(order.prioridade || 'Normal');
    setChamado(order.chamado || '');
    setDanfe(order.danfe || '');
    setDataLimite(order.dataLimite || '');
    setNomeFantasia(order.nomeFantasia || '');
    setHorarioInicio(order.horarioInicio || '');
    setDataAgendamento(order.dataAgendamento || '');
    setCidadeMunicipio(order.cidadeMunicipio || 'São Paulo');
    setEstado(order.estado || 'SP');
    setValorNotaFiscal(order.valorNotaFiscal || 0);
    setValorReceber(order.valorReceber || 0);
    setValorEntrega(order.valorEntrega || 0);
    setLatitude(order.latitude || 0);
    setLongitude(order.longitude || 0);
    setDestinatarioCnpjCpf(order.destinatarioCnpjCpf || '');
    setValorCondutor(order.valorCondutor || 0);

    setIsFormModalOpen(true);
  };

  // Handle CRUD Form submission
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    // Permitir que operadores salvem edições e cancelamentos no ambiente de desenvolvimento

    if (!customerName.trim() || !address.trim() || !codigoCliente.trim() || !cep.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    const compiled: Order = {
      id: formMode === 'edit' && selectedOrder ? selectedOrder.id : `PED-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName.trim(),
      address: address.trim(),
      value: Number(value),
      status,
      time: time || '12:00',
      region,
      courierId: selectedOrder?.courierId,
      codigoCliente,
      dataSolicitacao,
      pedido: pedido || id || `PED-${Date.now().toString().slice(-4)}`,
      procurarPor: procurarPor || customerName.trim(),
      cep,
      numero: numero.trim() || undefined,
      telefone: telefone.trim() || undefined,
      phone: telefone.trim() || undefined,
      detalhe,
      email: email.trim() || undefined,
      complemento: complemento.trim() || undefined,
      dispositivoCondutor,
      horarioFinal,
      documentoEmpresa,
      tipoEntrega,
      prioridade: prioridade || 'Normal',
      chamado,
      danfe,
      dataLimite,
      nomeFantasia,
      horarioInicio,
      dataAgendamento,
      cidadeMunicipio,
      estado,
      valorNotaFiscal: Number(valorNotaFiscal),
      valorReceber: Number(valorReceber),
      valorEntrega: Number(valorEntrega),
      latitude: Number(latitude),
      longitude: Number(longitude),
      destinatarioCnpjCpf,
      valorCondutor: Number(valorCondutor),
      isImported: formMode === 'edit' ? selectedOrder?.isImported : false,
      deliveryProtocol: selectedOrder?.deliveryProtocol,
      history: (() => {
        let hist = selectedOrder?.history || [];
        if (formMode === 'create') {
          const dateStr = formatToBrasiliaDate(new Date());
          const timeStr = formatToBrasiliaTime(new Date());
          hist = [
            {
              id: `hist-${Date.now()}`,
              time: `${dateStr} ${timeStr}`,
              status: 'pending',
              note: 'Pedido criado manualmente no painel',
              user: currentUser?.name || 'Operador (Sistema)'
            }
          ];
        } else if (selectedOrder && status !== selectedOrder.status) {
          const statusLabels: Record<OrderStatus, string> = {
            pending: 'Não Iniciado',
            in_progress: 'Em Andamento',
            in_route: 'Entregando',
            failure: 'Ocorrência',
            delivered: 'Concluído',
            cancelled: 'Cancelado'
          };
          const dateStr = formatToBrasiliaDate(new Date());
          const timeStr = formatToBrasiliaTime(new Date());
          hist = [
            ...hist,
            {
              id: `hist-${Date.now()}`,
              time: `${dateStr} ${timeStr}`,
              status,
              note: `Status alterado manualmente para "${statusLabels[status]}" via painel de edição.`,
              user: currentUser?.name || 'Operador (Sistema)'
            }
          ];
        }
        return hist;
      })()
    };

    if (formMode === 'create') {
      if (onAddOrder) {
        onAddOrder(compiled);
      }
    } else {
      if (status === 'cancelled' && selectedOrder && selectedOrder.status !== 'cancelled') {
        setIsFormModalOpen(false);
        setCancellingOrder(selectedOrder);
        setCancelConfirmIdInput('');
        return;
      }
      if (onEditOrder) {
        onEditOrder(compiled);
      }
    }

    setIsFormModalOpen(false);
  };

  // Handle Deletion with confirmation and definitive guarantee
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);

  const confirmDeleteOrder = async (orderId: string) => {
    if (!onDeleteOrder) {
      setDeletingOrderId(null);
      return;
    }
    setIsDeleting(true);
    try {
      const orderToDelete = orders.find(o => o.id === orderId);
      const orderNumber = orderToDelete?.pedido || orderId;
      await onDeleteOrder(orderId);
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      setDeletingOrderId(null);
      setDeleteSuccessMessage(`Pedido ${orderNumber} excluído definitivamente com sucesso!`);
      setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 4500);
    } catch (err: any) {
      alert(err?.message || 'Erro ao tentar excluir pedido.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!onDeleteOrder || selectedOrderIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const targetIds = [...selectedOrderIds];
      for (const id of targetIds) {
        await onDeleteOrder(id);
      }
      setSelectedOrderIds([]);
      setIsBulkDeleteModalOpen(false);
      setDeleteSuccessMessage(`${targetIds.length} pedidos excluídos definitivamente com sucesso!`);
      setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 4500);
    } catch (err: any) {
      alert(err?.message || 'Erro ao tentar excluir pedidos em lote.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Digital Delivery Signature Canvas listeners
  useEffect(() => {
    if (!protocolOrder) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Fix scaling in canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [protocolOrder]);

  // Camera cleanup on modal close or unmount
  useEffect(() => {
    if (!protocolOrder) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
      setProtocolPhoto(null);
    }
  }, [protocolOrder]);

  // Cleanup stream if user closes camera or modal inactive
  useEffect(() => {
    if (!isCameraActive && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Erro ao acessar a câmera: ", err);
      alert("Não foi possível acessar a câmera. Certifique-se de conceder a permissão nas configurações do navegador.");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setProtocolPhoto(dataUrl);
      
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie um arquivo de imagem válido.');
      return;
    }

    compressImageFile(file, 1200, 1200, 0.75)
      .then(compressed => setProtocolPhoto(compressed))
      .catch(() => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setProtocolPhoto(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep slate
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Intelligent Print export helper for PDF/Printer
  const handlePrintProtocol = (order: Order, format: 'a4' | 'half' = 'a4') => {
    const photo = resolveOrderPhoto(order);
    if (photo) {
      setPrintPhoto(photo);
    } else {
      const candidateKeys = getAllOrderKeys(order);
      for (const key of candidateKeys) {
        getOrderPhoto(key).then(p => {
          if (p) setPrintPhoto(p);
        });
      }
    }
    setPrintFormat(format);
    setPrintOrder(order);
  };

  // Open delivery protocol modal (supports view mode, create mode, or edit mode)
  const openProtocolModal = (order: Order, startInEditMode = false) => {
    setProtocolOrder(order);
    setProtocolError(null);
    setProtocolSuccessMsg(null);
    setIsSavingProtocol(false);
    const existing = order.deliveryProtocol;
    const resolvedName = resolveReceiverName(order);
    const resolvedDoc = resolveReceiverDoc(order);
    const resolvedDate = resolveDeliveryTime(order);
    const resolvedPhoto = resolveOrderPhoto(order);
    const resolvedSig = resolveOrderSignature(order);

    setProtocolName(resolvedName === 'Recebedor não identificado' ? '' : resolvedName);
    setProtocolDoc(resolvedDoc === 'Não informado' ? '' : resolvedDoc);
    setProtocolDate(resolvedDate === 'Horário não registrado' ? `${formatToBrasiliaDate(new Date())} ${formatToBrasiliaTime(new Date())}` : resolvedDate);
    setProtocolNotes(existing?.notes || '');
    setProtocolPhoto(resolvedPhoto);
    setProtocolSignature(resolvedSig);
    setKeepExistingSignature(!!resolvedSig);
    setIncludeFinancialValues(!!existing?.includeFinancialValues);
    
    const isConcluded = !!existing || !!resolvedPhoto || !!resolvedSig || order.status === 'delivered';
    setIsEditingProtocol(startInEditMode || !isConcluded);
    setIsCameraActive(false);

    // Asynchronously try to fetch from IndexedDB if not found immediately
    const candidateKeys = getAllOrderKeys(order);
    for (const key of candidateKeys) {
      getOrderPhoto(key).then(p => {
        if (p) {
          setProtocolPhoto(p);
        }
      });
    }
  };

  // Save the smart delivery protocol (creates or updates an existing signed protocol)
  const saveProtocol = async () => {
    if (!protocolOrder) return;
    setProtocolError(null);
    setProtocolSuccessMsg(null);
    setIsSavingProtocol(true);

    try {
      const trimmedName = protocolName.trim();
      const fallbackName = resolveReceiverName(protocolOrder);
      const effectiveName = trimmedName || (fallbackName !== 'Recebedor não identificado' ? fallbackName : '') || protocolOrder.customerName || (protocolOrder as any).destinatario || (protocolOrder as any).procurarPor || 'Recebedor no Destino';

      const trimmedDoc = protocolDoc.trim();
      const fallbackDoc = resolveReceiverDoc(protocolOrder);
      const effectiveDoc = trimmedDoc || (fallbackDoc !== 'Não informado' ? fallbackDoc : '') || 'Não informado';

      const canvas = canvasRef.current;
      let signatureImg = protocolSignature || '';
      if (!keepExistingSignature && canvas) {
        try {
          signatureImg = canvas.toDataURL('image/png');
        } catch (cvErr) {
          console.warn('[Protocol] Aviso ao ler canvas de assinatura:', cvErr);
        }
      }

      const effectiveDate = protocolDate.trim() || resolveDeliveryTime(protocolOrder) || `${formatToBrasiliaDate(new Date())} ${formatToBrasiliaTime(new Date())}`;
      const isPreviousSigned = !!protocolOrder.deliveryProtocol;

      const protocolMetadata = {
        ...(protocolOrder.deliveryProtocol || {}),
        signedName: effectiveName,
        signedDoc: effectiveDoc,
        signatureData: signatureImg || protocolOrder.deliveryProtocol?.signatureData || undefined,
        signedAt: effectiveDate,
        photoUrl: protocolPhoto || protocolOrder.deliveryProtocol?.photoUrl || undefined,
        notes: protocolNotes.trim() || undefined,
        isUpdated: true,
        updatedAt: `${formatToBrasiliaDate(new Date())} ${formatToBrasiliaTime(new Date())}`,
        includeFinancialValues
      };

      if (protocolPhoto) {
        try {
          saveOrderPhoto(protocolOrder.id, protocolPhoto);
          if (protocolOrder.pedido) {
            saveOrderPhoto(String(protocolOrder.pedido), protocolPhoto);
          }
        } catch (photoErr) {
          console.warn('[Protocol] Aviso ao salvar foto local no IndexedDB:', photoErr);
        }
      }

      const dateStr = formatToBrasiliaDate(new Date());
      const timeStr = formatToBrasiliaTime(new Date());
      const timestamp = `${dateStr} ${timeStr}`;

      const nowTs = Date.now();
      const updatedOrder: Order = {
        ...protocolOrder,
        status: 'delivered',
        deliveryProtocol: protocolMetadata,
        proofPhotoUrl: protocolPhoto || undefined,
        signatureDataUrl: signatureImg || undefined,
        receiverName: effectiveName,
        receiverDoc: effectiveDoc,
        deliveredAt: effectiveDate,
        versionTimestamp: nowTs,
        updatedAt: nowTs,
        statusUpdatedAt: nowTs,
        version: (Number(protocolOrder.version) || 0) + 1,
        history: [
          ...(protocolOrder.history || []),
          {
            id: `hist-${nowTs}`,
            time: timestamp,
            status: 'delivered',
            note: `Protocolo de entrega ${isPreviousSigned ? 'editado e retificado' : 'homologado com sucesso'} (Recebedor: ${effectiveName} • Doc: ${effectiveDoc})`
          }
        ]
      };

      const protocolPayload = {
        ...protocolMetadata,
        deliveryProtocol: protocolMetadata,
        proofPhotoUrl: protocolPhoto || undefined,
        signatureDataUrl: signatureImg || undefined,
        receiverName: effectiveName,
        receiverDoc: effectiveDoc,
        deliveredAt: effectiveDate
      };

      // Always notify status handler
      try {
        onUpdateStatus(protocolOrder.id, 'delivered', protocolPayload);
      } catch (stErr) {
        console.warn('[Protocol] Aviso ao atualizar status do pedido:', stErr);
      }

      // Notify parent order editor handler
      if (onEditOrder) {
        try {
          await onEditOrder(updatedOrder);
        } catch (editErr) {
          console.warn('[Protocol] Aviso ao salvar via onEditOrder:', editErr);
        }
      }

      // Keep updated order active in modal and switch to view mode with updated export option
      setProtocolOrder(updatedOrder);
      setProtocolName(effectiveName);
      setProtocolDoc(effectiveDoc);
      setProtocolDate(effectiveDate);
      setProtocolNotes(protocolNotes.trim());
      setProtocolPhoto(protocolPhoto || protocolMetadata.photoUrl || null);
      setProtocolSignature(signatureImg || protocolMetadata.signatureData || null);
      setKeepExistingSignature(true);
      setIsEditingProtocol(false);
      setIsCameraActive(false);
      setProtocolSuccessMsg('Edição do protocolo salva com sucesso e sincronizada!');
    } catch (err: any) {
      console.error('[Protocol] Erro ao salvar protocolo:', err);
      setProtocolError(`Erro ao salvar protocolo: ${err?.message || 'Falha inesperada ao gravar alterações'}`);
    } finally {
      setIsSavingProtocol(false);
    }
  };

  // Unified status changes with professional logs
  const handleUpdateStatusWithHistory = (orderId: string, nextStatus: OrderStatus, customNote?: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    if (nextStatus === 'cancelled') {
      setCancellingOrder(targetOrder);
      setCancelConfirmIdInput('');
      return;
    }

    onUpdateStatus(orderId, nextStatus, customNote ? { note: customNote, detalhe: customNote } : undefined);
  };

  const handleAllocateCourierWithHistory = (orderId: string, courierId: string) => {
    if (onAllocateCourier) {
      onAllocateCourier(orderId, courierId);
      return;
    }

    const targetOrder = orders.find(o => o.id === orderId);
    const courierObj = couriers.find(c => c.id === courierId);
    if (!targetOrder || !courierObj) return;

    const dateStr = formatToBrasiliaDate(new Date());
    const timeStr = formatToBrasiliaTime(new Date());
    const timestamp = `${dateStr} ${timeStr}`;

    const currentStatus = targetOrder.status || 'pending';
    const newLog = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: timestamp,
      status: currentStatus,
      note: `Entregador alocado: ${courierObj.name} (${courierObj.vehicle === 'motorcycle' ? 'Moto' : 'Carro'}).`,
      user: currentUser?.name || 'Operador (Sistema)'
    };

    if (onEditOrder) {
      onEditOrder({
        ...targetOrder,
        courierId,
        status: currentStatus,
        history: [...(targetOrder.history || []), newLog]
      });
    }
  };

  const handleDeallocateCourierWithHistory = (orderId: string) => {
    if (!isAdmin) {
      alert('Operação restrita: Apenas administradores do sistema podem desalocar portadores/entregadores.');
      return;
    }

    if (onDeallocateCourier) {
      onDeallocateCourier(orderId);
      return;
    }

    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const dateStr = formatToBrasiliaDate(new Date());
    const timeStr = formatToBrasiliaTime(new Date());
    const timestamp = `${dateStr} ${timeStr}`;

    const newLog = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: timestamp,
      status: targetOrder.status,
      note: 'Entregador desalocado. O pedido retornou para a fila de atribuições.',
      user: currentUser?.name || 'Operador (Sistema)'
    };

    if (onEditOrder) {
      onEditOrder({
        ...targetOrder,
        courierId: undefined,
        history: [...(targetOrder.history || []), newLog]
      });
    }
  };

  // Add historical timeline manual note
  const addTimelineNote = () => {
    if (!historyOrder || !newHistoryNote.trim()) return;

    const dateStr = formatToBrasiliaDate(new Date());
    const timeStr = formatToBrasiliaTime(new Date());
    const timestamp = `${dateStr} ${timeStr}`;

    const newEvent = {
      id: `hist-${Date.now()}`,
      time: timestamp,
      status: historyOrder.status,
      note: newHistoryNote.trim(),
      user: currentUser?.name || 'Operador (Manual)'
    };

    const updatedOrder: Order = {
      ...historyOrder,
      history: [...(historyOrder.history || []), newEvent]
    };

    if (onEditOrder) {
      onEditOrder(updatedOrder);
    }

    setHistoryOrder(updatedOrder);
    setNewHistoryNote('');
  };

  // Copy formatted history timeline text to clipboard
  const handleCopyHistoryText = (order: Order) => {
    const partnerName = resolvePartnerName(order, partnerClients);
    const recipientName = resolveRecipientName(order, partnerClients);
    
    let text = `📦 === HISTÓRICO DO PEDIDO ID: ${order.id} ===\n`;
    text += `🏢 Empresa Parceiro: ${partnerName}\n`;
    text += `👤 Destinatário: ${recipientName}\n`;
    text += `📍 Endereço: ${order.address}\n`;
    text += `📊 Status Atual: ${order.status.toUpperCase()}\n`;
    text += `⏰ Criado às: ${order.time}\n\n`;
    text += `📜 LINHA DO TEMPO:\n`;
    
    if (!order.history || order.history.length === 0) {
      text += `- ${order.time || '08:00'} hs | Criação do Registro | Pedido na fila para alocação. (Operador)\n`;
    } else {
      order.history.forEach((event) => {
        text += `- ${event.time} | ${event.status.toUpperCase()} | ${event.note} (por: ${event.user || 'Operador'})\n`;
      });
    }
    
    navigator.clipboard.writeText(text);
    alert('Histórico copiado para a área de transferência com sucesso!');
  };

  // Download history timeline as CSV
  const handleDownloadHistoryCSV = (order: Order) => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Data/Hora,Status,Ocorrencia/Nota,Responsavel\n";
    
    if (!order.history || order.history.length === 0) {
      csvContent += `"${order.time || '08:00'}","Criação","Pedido criado na fila pronto para alocação","Operador"\n`;
    } else {
      order.history.forEach(event => {
        csvContent += `"${event.time}","${event.status}","${(event.note || '').replace(/"/g, '""')}","${event.user || 'Operador'}"\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historico_pedido_${order.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download history timeline as JSON
  const handleDownloadHistoryJSON = (order: Order) => {
    const partnerName = resolvePartnerName(order, partnerClients);
    const recipientName = resolveRecipientName(order, partnerClients);
    
    const exportData = {
      orderId: order.id,
      pedido: order.pedido,
      empresaParceiro: partnerName,
      destinatarioFinal: recipientName,
      cliente: partnerName,
      endereco: order.address,
      statusAtual: order.status,
      linhaTempo: order.history || [
        {
          time: order.time || '08:00',
          status: 'pending',
          note: 'Pedido criado na fila pronto para alocação',
          user: 'Operador'
        }
      ]
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historico_pedido_${order.id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fast trigger standard browser printing layout
  const handlePrint = (order: Order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Color mappings
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-700 border-amber-200/50" title="Status Sincronizado: Não Iniciado">
            <Flag className="h-3 w-3 fill-amber-500 text-amber-600 animate-pulse" />
            <span>Não Iniciado</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-blue-50 text-blue-700 border-blue-200/50" title="Status Sincronizado: Em Andamento">
            <Flag className="h-3 w-3 fill-blue-500 text-blue-600 animate-pulse" />
            <span>Em Andamento</span>
          </span>
        );
      case 'in_route':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-yellow-50 text-yellow-700 border-yellow-200/50 animate-pulse" title="Status Sincronizado: Entregando">
            <Flag className="h-3 w-3 fill-yellow-500 text-yellow-600" />
            <span>Entregando</span>
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-red-50 text-red-700 border-red-200/50" title="Status Sincronizado: Ocorrência">
            <Flag className="h-3 w-3 fill-red-500 text-red-650 animate-bounce" />
            <span>Ocorrência</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-emerald-50 text-emerald-800 border-emerald-250/30" title="Status Sincronizado: Concluído">
            <Flag className="h-3 w-3 fill-emerald-500 text-emerald-600" />
            <span>Concluído</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-slate-50 text-slate-650 border-slate-200" title="Status Sincronizado: Cancelado">
            <Flag className="h-3 w-3 fill-slate-400 text-slate-500" />
            <span>Cancelado</span>
          </span>
        );
    }
  };

  return (
    <div id="orders-inventory-card" className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm mb-6 relative">
      
      {/* ----------------- COMPACT INTELIGENT HEADER ----------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight font-sans">
              Painel Geral de Controle de Pedidos
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-bold uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                Consulta sob demanda
              </span>
              <span className="inline-flex items-center px-2 py-0.5 text-[9.5px] bg-blue-50 text-blue-700 border border-blue-150 rounded-full font-bold">
                {todayStrSP}
              </span>

              {/* Lazy loading / Initial date query scope indicator */}
              {!isFullHistoryLoaded && typeof totalOrdersInDb === 'number' && totalOrdersInDb > orders.length ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9.5px] bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold">
                  <Database className="h-3 w-3 text-amber-600 shrink-0" />
                  <span>Filtragem inicial: Data atual ({orders.length} de {totalOrdersInDb} no banco)</span>
                  {onLoadFullHistory && (
                    <button
                      type="button"
                      onClick={() => onLoadFullHistory()}
                      disabled={isLoadingPeriod}
                      className="ml-1 px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 active:bg-amber-400 text-amber-900 rounded font-black text-[9px] cursor-pointer transition-colors"
                      title="Carregar todos os registros do banco de dados (histórico completo)"
                    >
                      {isLoadingPeriod ? 'Carregando...' : 'Carregar Tudo'}
                    </button>
                  )}
                </div>
              ) : isFullHistoryLoaded && orders.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                  <Database className="h-2.5 w-2.5 text-emerald-600" />
                  Base Completa ({orders.length} pedidos)
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Consola unificada de coletas, vistorias logísticas e rastreamento operacional de fretes.
          </p>
        </div>

        {/* Botão de Consulta Manual & Indicador de Filtros Ativos */}
        <div className="flex items-center gap-2 shrink-0">
          {onRefetchDatabase && (
            <button
              id="btn-manual-query-orders"
              type="button"
              onClick={() => {
                if (enableDateFilter) {
                  onRefetchDatabase({ startDate: startDateFil, endDate: endDateFil });
                } else {
                  onRefetchDatabase({ loadAll: true });
                }
              }}
              disabled={isSyncing || isLoadingPeriod}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all"
              title="Consultar e atualizar lista de pedidos diretamente do banco de dados para o período ativo"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${(isSyncing || isLoadingPeriod) ? 'animate-spin' : ''}`} />
              <span>{(isSyncing || isLoadingPeriod) ? 'Consultando...' : 'Consultar / Atualizar'}</span>
            </button>
          )}

          {(() => {
            const isDateFilterCustom = enableDateFilter && (startDateFil !== todayISO || endDateFil !== todayISO);
            const activeDetailedFiltersCount = [
              detSearchDanfe,
              detSearchPedido,
              detSearchClientCode !== 'all' ? detSearchClientCode : '',
              detSearchCustomerName,
              detSearchCity,
              cepSearchTerm,
              detSearchCourierId !== 'all' ? detSearchCourierId : '',
              detSearchTipoEntrega !== 'all' ? detSearchTipoEntrega : '',
              detSearchIds,
              isDateFilterCustom ? 'date' : ''
            ].filter(Boolean).length;

            return activeDetailedFiltersCount > 0 ? (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-[10.5px] font-bold flex items-center gap-1">
                <Filter className="h-3 w-3 text-blue-600" />
                {activeDetailedFiltersCount} {activeDetailedFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
              </span>
            ) : null;
          })()}
        </div>
      </div>

      {/* ----------------- BARRA DE PESQUISA UNIFICADA & SINCRONIZADA ----------------- */}
      <div id="unified-search-toolbar" className="flex flex-col gap-2.5 bg-slate-50/90 p-2.5 sm:p-3 rounded-2xl border border-slate-200 mb-2 shadow-2xs relative">
        {/* LINHA 1: PESQUISA GLOBAL ÚNICO + CARD PARCEIRO + CARD CONDUTOR + CARD STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 w-full items-center">
          
          {/* 1. CAMPO DE PESQUISA GLOBAL ÚNICO */}
          <div className="md:col-span-5 relative flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="global-search-input"
              type="text"
              value={localSearchTerm || searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setLocalSearchTerm(val);
                if (onSearchTermChange) onSearchTermChange(val);
                setCurrentPage(1);
              }}
              placeholder="Pesquisar por pedido, nota fiscal/DANFE, cliente, endereço, CEP..."
              className="w-full pl-9 pr-14 h-10 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all shadow-2xs"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {(localSearchTerm || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearchTerm('');
                    if (onSearchTermChange) onSearchTermChange('');
                    setCurrentPage(1);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Limpar texto da pesquisa"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                {filteredOrders.length}
              </span>
            </div>
          </div>

          {/* 2. CARD PESQUISA POR PARCEIRO */}
          <div className="md:col-span-3 relative flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
              <Building2 className="h-4 w-4" />
            </div>
            <select
              id="search-partner-select"
              value={selectedPartnerFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPartnerFilter(val);
                setDetSearchClientCode(val);
                if (onSelectPartner) {
                  onSelectPartner(val);
                }
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-7 h-10 bg-white border border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer appearance-none truncate"
              title="Pesquisa por Cliente Parceiro"
            >
              <option value="all">Parceiros: Todos ({partnerCountsInPeriod.all ?? 0})</option>
              <option value="avulsa">Avulsos / Sem Contrato ({partnerCountsInPeriod.avulsa ?? 0})</option>
              {partnerClients.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name} ({partnerCountsInPeriod[partner.id] ?? 0})
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* 3. CARD PESQUISA POR CONDUTOR */}
          <div className="md:col-span-2 relative flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500">
              <Truck className="h-4 w-4" />
            </div>
            <select
              id="search-courier-select"
              value={detSearchCourierId}
              onChange={(e) => {
                const val = e.target.value;
                setDetSearchCourierId(val);
                if (setSelectedCourierId) {
                  setSelectedCourierId(val === 'all' || val === 'unallocated' ? null : val);
                }
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-7 h-10 bg-white border border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer appearance-none truncate"
              title="Pesquisa por Condutor"
            >
              <option value="all">Condutores: Todos ({courierCountsInPeriod.all ?? 0})</option>
              <option value="unallocated">Não Alocados ({courierCountsInPeriod.unallocated ?? 0})</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name} ({courierCountsInPeriod[courier.id] ?? 0})
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* 4. CARD PESQUISA POR STATUS */}
          <div className="md:col-span-2 relative flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <select
              id="search-status-select"
              value={activeTab}
              onChange={(e) => {
                setActiveTab(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-7 h-10 bg-white border border-slate-200 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer appearance-none truncate"
              title="Pesquisa por Status"
            >
              <option value="open">Status: Em Aberto ({statusCountsInPeriod.open ?? 0})</option>
              <option value="all">Status: Todos ({statusCountsInPeriod.all ?? 0})</option>
              <option value="pending">Pendentes ({statusCountsInPeriod.pending ?? 0})</option>
              <option value="in_progress">Em Andamento ({statusCountsInPeriod.in_progress ?? 0})</option>
              <option value="in_route">Em Rota ({statusCountsInPeriod.in_route ?? 0})</option>
              <option value="failure">Ocorrências ({statusCountsInPeriod.failure ?? 0})</option>
              <option value="delivered">Concluídos ({statusCountsInPeriod.delivered ?? 0})</option>
              <option value="cancelled">Cancelados ({statusCountsInPeriod.cancelled ?? 0})</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* LINHA 2: CONTROLES COMPACTOS (PERÍODO SINCRONIZADO + COLUNAS + LIMPAR + FILTROS AVANÇADOS) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
          
          {/* Período Selecionado Integrado */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 h-8 rounded-xl px-2.5 shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">De</span>
                <input
                  type="date"
                  value={startDateFil}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDateFil(newStart);
                    setCurrentPage(1);
                    if (onLoadPeriod && newStart) {
                      onLoadPeriod(newStart, endDateFil);
                    }
                  }}
                  className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>
              <div className="h-3.5 w-[1px] bg-slate-200 mx-0.5" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Até</span>
                <input
                  type="date"
                  value={endDateFil}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    setEndDateFil(newEnd);
                    setCurrentPage(1);
                    if (onLoadPeriod && newEnd) {
                      onLoadPeriod(startDateFil, newEnd);
                    }
                  }}
                  className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Quick date shortcut: Hoje */}
            <button
              type="button"
              onClick={() => {
                setStartDateFil(todayISO);
                setEndDateFil(todayISO);
                setCurrentPage(1);
                if (onLoadPeriod) {
                  onLoadPeriod(todayISO, todayISO);
                }
              }}
              className={`px-2.5 h-8 rounded-xl text-[10.5px] font-bold border transition-colors cursor-pointer ${
                startDateFil === todayISO && endDateFil === todayISO
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Hoje
            </button>

            {/* Quick date shortcut: Ontem */}
            <button
              type="button"
              onClick={() => {
                const y = getYesterdayISO();
                setStartDateFil(y);
                setEndDateFil(y);
                setCurrentPage(1);
                if (onLoadPeriod) {
                  onLoadPeriod(y, y);
                }
              }}
              className={`px-2.5 h-8 rounded-xl text-[10.5px] font-bold border transition-colors cursor-pointer ${
                startDateFil === getYesterdayISO() && endDateFil === getYesterdayISO()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Ontem
            </button>

            {/* Quick date shortcut: Carregar Histórico Completo sob Demanda */}
            {onLoadFullHistory && !isFullHistoryLoaded && (
              <button
                type="button"
                onClick={() => {
                  onLoadFullHistory();
                }}
                disabled={isLoadingPeriod}
                className="px-2.5 h-8 rounded-xl text-[10px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                title="Buscar todo o histórico de pedidos no banco de dados sob demanda"
              >
                <Database className="h-3 w-3 text-amber-700" />
                <span>{isLoadingPeriod ? 'Buscando...' : 'Carregar Tudo'}</span>
              </button>
            )}

            {isLoadingPeriod && (
              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold animate-pulse">
                <RefreshCcw className="h-3 w-3 animate-spin text-blue-600" />
                <span>Consultando período...</span>
              </div>
            )}
          </div>

          {/* Ações: Colunas, Filtros Avançados, Limpar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Colunas */}
            <div className="relative shrink-0" id="columns-dropdown-container">
              <button
                type="button"
                onClick={() => {
                  setIsColumnsDropdownOpen(!isColumnsDropdownOpen);
                }}
                className={`flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-xl border select-none transition-all cursor-pointer font-bold text-[11px] shadow-2xs ${
                  isColumnsDropdownOpen
                    ? 'bg-blue-50/70 border-blue-200 text-blue-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Configurar visibilidade das colunas da tabela"
              >
                <SlidersHorizontal className="h-3 w-3 text-blue-600" />
                <span>Colunas ({columnOrder.length - hiddenColumns.length}/{columnOrder.length})</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isColumnsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isColumnsDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-55 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exibição de Colunas</span>
                    <button
                      type="button"
                      onClick={() => setHiddenColumns([])}
                      className="text-[9px] font-black text-blue-600 hover:underline cursor-pointer"
                    >
                      Mostrar Todas
                    </button>
                  </div>
                  <div className="py-1">
                    {initialColumns
                      .filter(col => col.id !== 'select' && col.id !== 'actions')
                      .map((col) => {
                        const isHidden = hiddenColumns.includes(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-slate-50 cursor-pointer select-none text-xs font-semibold text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => {
                                if (isHidden) {
                                  setHiddenColumns(prev => prev.filter(id => id !== col.id));
                                } else {
                                  setHiddenColumns(prev => [...prev, col.id]);
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500/20 h-4 w-4 border-slate-350 cursor-pointer"
                            />
                            <span>{col.label}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filtros Avançados Toggle */}
            <button
              type="button"
              onClick={() => setIsDetailedSearchOpen(!isDetailedSearchOpen)}
              className={`flex items-center gap-1.5 px-2.5 h-8 border rounded-xl text-[11px] font-bold transition-colors cursor-pointer shadow-2xs ${
                isDetailedSearchOpen
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
              title="Filtros adicionais (DANFE, NFe, Cidade, etc.)"
            >
              <Filter className="h-3 w-3 text-blue-600" />
              <span>Mais Filtros</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isDetailedSearchOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Limpar Filtros */}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="flex items-center gap-1 px-2.5 h-8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="h-3 w-3 text-rose-600" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Linha Opcional: Filtros Avançados Expansíveis */}
        {isDetailedSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200/80 pt-2.5 mt-0.5 w-full text-left"
          >
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between select-none pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
                    Filtros Avançados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetSearchIds('');
                    setDetSearchDanfe('');
                    setDetSearchCustomerName('');
                    setDetSearchCity('');
                    setDetSearchTipoEntrega('all');
                    setDetSearchPedido('');
                    setCepSearchTerm('');
                  }}
                  className="px-2 py-0.5 text-[9.5px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  Limpar Campos
                </button>
              </div>

              {/* 4-Column Grid for Secondary Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    Nota Fiscal (DANFE) / Chave
                  </label>
                  <input
                    type="text"
                    placeholder="DANFE ou Chave NFe..."
                    value={detSearchDanfe}
                    onChange={(e) => {
                      setDetSearchDanfe(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full px-2.5 h-8 border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    Número do Pedido
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PED-1029..."
                    value={detSearchPedido}
                    onChange={(e) => {
                      setDetSearchPedido(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full px-2.5 h-8 border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    Destinatário
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do destinatário..."
                    value={detSearchCustomerName}
                    onChange={(e) => {
                      setDetSearchCustomerName(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full px-2.5 h-8 border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    Cidade / Bairro
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade ou Bairro..."
                    value={detSearchCity}
                    onChange={(e) => {
                      setDetSearchCity(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full px-2.5 h-8 border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ----------------- GEOGRAPHIC REGIONS & CEP GROUPING ANALYSIS PANEL ----------------- */}
      <div id="geographic-regions-panel" className="mb-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsGeoRegionsOpen(!isGeoRegionsOpen)}
            className="flex items-center gap-2 text-left cursor-pointer group select-none"
          >
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-slate-800 text-xs tracking-tight">Distribuição Geográfica (Regiões de SP)</h4>
                <span className="text-[9.5px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  {regionStats.length} regiões
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-medium">
                {isGeoRegionsOpen || selectedRegionFilter ? 'Clique para recolher o painel' : 'Clique para expandir o agrupamento por regiões'}
              </p>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 ml-1 transition-transform ${isGeoRegionsOpen || selectedRegionFilter ? 'rotate-180' : ''}`} />
          </button>

          {selectedRegionFilter && (
            <button
              onClick={() => setSelectedRegionFilter(null)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[9.5px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-blue-200 shadow-2xs uppercase tracking-wider"
            >
              <span>Filtro Ativo: {selectedRegionFilter}</span>
              <X className="h-3 w-3 text-blue-600" />
            </button>
          )}
        </div>

        {(isGeoRegionsOpen || selectedRegionFilter) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 animate-in fade-in duration-200">
            {regionStats.length > 0 ? (
              regionStats.map((reg) => {
                const percentage = Math.max(2, Math.round((reg.count / filteredOrdersBeforeRegion.length) * 100));
                const isSelected = selectedRegionFilter === reg.name;

                return (
                  <button
                    key={reg.name}
                    type="button"
                    onClick={() => {
                      if (selectedRegionFilter === reg.name) {
                        setSelectedRegionFilter(null);
                      } else {
                        setSelectedRegionFilter(reg.name);
                      }
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs hover:bg-blue-600'
                        : `${reg.bgLight} ${reg.borderCol} hover:bg-white hover:border-slate-300 hover:shadow-xs text-slate-700`
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                      <span className="truncate max-w-[190px]">{reg.name}</span>
                      <span className={`font-mono text-[9.5px] shrink-0 font-extrabold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/60 text-slate-700'}`}>
                        {reg.count} {reg.count === 1 ? 'ped' : 'peds'}
                      </span>
                    </div>

                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-slate-200/50'} mb-1.5`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-white' : reg.progressCol}`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9.5px]">
                      <span className={isSelected ? 'text-blue-100' : 'text-slate-500'}>
                        Concluídos: <strong>{reg.deliveredCount}</strong> ({reg.count > 0 ? Math.round((reg.deliveredCount / reg.count) * 100) : 0}%)
                      </span>
                      <span className={`font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                        R$ {reg.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full py-4 text-center text-xs text-slate-400 font-medium">
                Nenhum CEP identificado nos pedidos atuais para mapeamento de região.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerta Global do Administrador: Pedidos em aberto de dias anteriores ao período selecionado */}
      {priorOpenOrders.length > 0 && !isPriorOpenAlertDismissed && (
        <div 
          id="global-prior-open-orders-alert"
          className="mb-4 p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded-md">
                  Alerta: Pedidos em Aberto de Dias Anteriores
                </span>
                <span className="text-xs font-black text-amber-900">
                  {priorOpenOrders.length} pedido(s) pendente(s)
                </span>
              </div>
              <p className="text-xs font-medium text-amber-900 mt-1">
                Existem <strong>{priorOpenOrders.length} pedido(s) em aberto</strong> registrados em data anterior a {startDateFil} aguardando finalização ou tratativa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                const earliestPriorDate = priorOpenOrders.reduce((min, o) => {
                  const item = ordersIndex.all.find(i => i.order.id === o.id);
                  const d = item ? item.launchDateISO : parseToISODateInApp(o.dataSolicitacao);
                  return d && d < min ? d : min;
                }, startDateFil);
                setStartDateFil(earliestPriorDate);
                setActiveTab('open');
                if (onDateFilterChange) {
                  onDateFilterChange(true, earliestPriorDate, endDateFil);
                }
                if (onLoadPeriod) {
                  onLoadPeriod(earliestPriorDate, endDateFil);
                }
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Consultar Período Anterior ({priorOpenOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPriorOpenAlertDismissed(true)}
              className="p-1.5 text-amber-800/70 hover:text-amber-950 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
              title="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta Operacional: Pedidos anteriores pendentes para o condutor selecionado */}
      {selectedCourierObj && courierPriorPendingOrders.length > 0 && (
        <div 
          id="courier-prior-pending-alert-table"
          className="mb-4 p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded-md">
                  Alerta: Condutor com Pedido Anterior Pendente
                </span>
                <span className="text-xs font-black text-amber-900">
                  {selectedCourierObj.name}
                </span>
              </div>
              <p className="text-xs font-medium text-amber-900 mt-1">
                Este condutor possui <strong>{courierPriorPendingOrders.length} pedido(s) em aberto</strong> registrado(s) em data anterior a {startDateFil}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                const earliestPriorDate = courierPriorPendingOrders.reduce((min, o) => {
                  const d = parseToISODateInApp(o.dataSolicitacao);
                  return d < min ? d : min;
                }, startDateFil);
                setStartDateFil(earliestPriorDate);
                setActiveTab('open');
                if (onDateFilterChange) {
                  onDateFilterChange(true, earliestPriorDate, endDateFil);
                }
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Ver Pendências Anteriores ({courierPriorPendingOrders.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Notification for Definitive Deletions */}
      {deleteSuccessMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-500 rounded-full text-white">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-emerald-900">{deleteSuccessMessage}</p>
              <p className="text-[10px] text-emerald-700 font-medium">O registro foi expurgado definitivamente de todas as bases de dados.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setDeleteSuccessMessage(null)} 
            className="text-emerald-700 hover:text-emerald-950 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ----------------- BATCH OPERATIONS CONTROL BAR (INTEGRATED ABOVE TABLE) ----------------- */}
      <div 
        id="selected-orders-batch-actions-panel" 
        className={`mb-2.5 p-3 rounded-xl border transition-all duration-300 flex flex-col lg:flex-row items-center justify-between gap-3 select-none ${
          selectedOrderIds.length > 0
            ? 'bg-slate-900 border-slate-800 text-white shadow-md animate-in slide-in-from-top duration-300'
            : 'bg-slate-50 border-slate-100/85 text-slate-400 opacity-60'
        }`}
      >
        <div className="flex items-center gap-3 w-full lg:w-auto">
          {selectedOrderIds.length > 0 ? (
            <>
              <div className="bg-blue-600 text-white text-xs font-black h-7 min-w-7 px-2 rounded-full flex items-center justify-center font-mono shadow-md">
                {selectedOrderIds.length}
              </div>
              <div className="leading-tight text-left">
                <h4 className="text-xs font-extrabold tracking-wider text-slate-100 uppercase font-sans">Pedidos selecionados para operações</h4>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Ações automáticas em lote aplicadas aos itens marcados</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-205 text-slate-500 bg-slate-200 text-xs font-black h-7 min-w-7 px-2 rounded-full flex items-center justify-center font-mono">
                0
              </div>
              <div className="leading-tight text-left">
                <h4 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase font-sans">Nenhum pedido selecionado</h4>
                <p className="text-[10px] text-slate-450 font-medium font-sans">Marque os pedidos na tabela abaixo para habilitar operações em lote</p>
              </div>
            </>
          )}
        </div>

        {selectedOrderIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            {/* Driver dropdown selection */}
            <div id="bulk-courier-select-wrapper" className="relative w-full sm:w-auto">
              <select
                id="bulk-courier-select"
                value={bulkCourierId}
                onChange={(e) => setBulkCourierId(e.target.value)}
                className="bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-550 cursor-pointer pr-8 appearance-none w-full"
              >
                <option value="">Selecione Condutor...</option>
                {couriers.filter(c => c.isActive !== false).map(c => {
                  const rate = c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.vehicle === 'motorcycle' ? 'Moto' : 'Carro'}) • Repasse: R$ {rate.toFixed(2).replace('.', ',')}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Elegant Bulk Status selection dropdown */}
            <div id="bulk-status-select-wrapper" className="relative w-full sm:w-auto animate-fade-in">
              <select
                id="bulk-status-select"
                defaultValue=""
                disabled={!isAdmin}
                title={isAdmin ? "Alteração de status em massa" : "Restrito: Apenas administradores podem alterar status em massa"}
                onChange={(e) => {
                  const nextStatus = e.target.value as OrderStatus;
                  if (!nextStatus) return;
                  
                  if (!isAdmin) {
                    alert('Operação restrita: Apenas administradores do sistema podem realizar alteração de status em massa.');
                    e.target.value = "";
                    return;
                  }
                  
                  if (selectedOrderIds.length === 0) {
                    alert('Selecione ao menos um pedido para realizar a alteração de status em massa.');
                    e.target.value = "";
                    return;
                  }
                  
                  // Open confirmation modal
                  setBulkStatusToConfirm(nextStatus);
                  e.target.value = "";
                }}
                className={`${
                  isAdmin
                    ? "bg-indigo-900 border border-indigo-700 hover:bg-indigo-950 text-indigo-100 hover:text-white cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                } text-xs font-black rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 pr-8 appearance-none w-full`}
              >
                <option value="" className="bg-slate-900 font-bold text-slate-350">⚡ Status em Massa...</option>
                <option value="pending" className="bg-slate-900 text-amber-300">⏳ Pendente (Não Iniciado)</option>
                <option value="in_progress" className="bg-slate-900 text-blue-300">⚙️ Em Andamento</option>
                <option value="in_route" className="bg-slate-900 text-yellow-300">🚚 Em Rota (Entregando)</option>
                <option value="failure" className="bg-slate-900 text-pink-300">⚠️ Ocorrência (Falha)</option>
                <option value="delivered" className="bg-slate-900 text-emerald-300">✅ Concluído (Entregue)</option>
                <option value="cancelled" className="bg-slate-900 text-rose-300">❌ Cancelado</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-indigo-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Actions list */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              {/* Button: Alocar */}
              <button
                id="bulk-btn-allocate"
                type="button"
                disabled={!bulkCourierId}
                onClick={async () => {
                  if (!bulkCourierId) return;
                  const courierName = couriers.find(c => c.id === bulkCourierId)?.name || 'entregador';
                  try {
                    if (onBulkAllocateCourier) {
                      await onBulkAllocateCourier(selectedOrderIds, bulkCourierId);
                    } else {
                      selectedOrderIds.forEach(id => {
                        handleAllocateCourierWithHistory(id, bulkCourierId);
                      });
                    }
                    alert(`Portador "${courierName}" alocado com sucesso para ${selectedOrderIds.length} pedido(s)!`);
                    setBulkCourierId('');
                    setSelectedOrderIds([]);
                  } catch (err) {
                    console.error(err);
                    alert('Erro ao alocar portador em lote.');
                  }
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 active:scale-95"
              >
                Alocar
              </button>

              {/* Button: Desalocar */}
              <button
                id="bulk-btn-deallocate"
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Operação restrita: Desalocação em lote só pode ser realizada por administradores.');
                    return;
                  }
                  selectedOrderIds.forEach(id => {
                    handleDeallocateCourierWithHistory(id);
                  });
                  alert(`Portador desvinculado com sucesso de ${selectedOrderIds.length} pedido(s)!`);
                  setSelectedOrderIds([]);
                }}
                className={`px-3.5 py-1.5 border text-xs font-bold rounded-xl transition-all active:scale-95 ${
                  isAdmin
                    ? "bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 border-slate-700/40 cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                title={isAdmin ? "Desalocar portadores dos pedidos selecionados" : "Restrito: Apenas administradores podem desalocar"}
              >
                Desalocar
              </button>

              {/* Button: Cancelar */}
              <button
                id="bulk-btn-cancel"
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Operação restrita: Apenas administradores do sistema podem cancelar pedidos em massa.');
                    return;
                  }
                  if (selectedOrderIds.length === 0) {
                    alert('Selecione ao menos um pedido para realizar o cancelamento em massa.');
                    return;
                  }
                  setIsBulkCancelModalOpen(true);
                }}
                className={`px-3.5 py-1.5 border text-xs font-bold rounded-xl transition-all active:scale-95 ${
                  isAdmin
                    ? "bg-rose-955/80 hover:bg-rose-900 border-rose-900/60 text-rose-200 hover:text-white cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                title={isAdmin ? "Cancelar pedidos selecionados" : "Restrito: Apenas administradores podem cancelar em massa"}
              >
                Cancelar
              </button>

              {/* Button: Reativar */}
              <button
                id="bulk-btn-reactivate"
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Operação restrita: Apenas administradores do sistema podem reativar pedidos em massa.');
                    return;
                  }
                  if (confirm(`Deseja reativar (mudar para Pendente) os ${selectedOrderIds.length} pedidos selecionados?`)) {
                    if (onBulkUpdateStatus) {
                      onBulkUpdateStatus(selectedOrderIds, 'pending').then(() => {
                        alert(`Reativação de ${selectedOrderIds.length} pedido(s) efetuada com sucesso!`);
                      }).catch((err) => {
                        console.error(err);
                        alert(`Erro ao tentar se conectar ao servidor.`);
                      }).finally(() => {
                        setSelectedOrderIds([]);
                      });
                    } else {
                      selectedOrderIds.forEach(id => {
                        handleUpdateStatusWithHistory(id, 'pending', 'Pedido reativado via operação em lote.');
                      });
                      alert(`Reativação de ${selectedOrderIds.length} pedido(s) efetuada com sucesso!`);
                      setSelectedOrderIds([]);
                    }
                  }
                }}
                className={`px-3.5 py-1.5 border text-xs font-bold rounded-xl transition-all active:scale-95 ${
                  isAdmin
                    ? "bg-emerald-955/80 hover:bg-emerald-900 border-emerald-900/60 text-emerald-200 hover:text-white cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                title={isAdmin ? "Reativar pedidos selecionados" : "Restrito: Apenas administradores podem reativar em massa"}
              >
                Reativar
              </button>

              {/* Button: Excluir em Massa */}
              <button
                id="bulk-btn-delete-selected"
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Operação restrita: Apenas administradores do sistema podem excluir pedidos.');
                    return;
                  }
                  if (selectedOrderIds.length === 0) {
                    alert('Selecione ao menos um pedido para realizar a exclusão.');
                    return;
                  }
                  setIsBulkDeleteModalOpen(true);
                }}
                className={`px-3.5 py-1.5 border text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 ${
                  isAdmin
                    ? "bg-rose-600 hover:bg-rose-700 border-rose-500 text-white cursor-pointer shadow-md shadow-rose-600/20"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                title={isAdmin ? "Excluir pedidos selecionados definitivamente" : "Restrito: Apenas administradores podem excluir"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir ({selectedOrderIds.length})</span>
              </button>

              {/* Button: Export CSV */}
              <button
                id="bulk-btn-export-csv"
                type="button"
                onClick={() => {
                  setIsExportCsvModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 active:scale-95 font-sans"
              >
                📥 Exportar em Massa (CSV)
              </button>

              {/* Button: Export PDF */}
              <button
                id="bulk-btn-export-pdf"
                type="button"
                onClick={() => {
                  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
                  exportOrdersToPDF(selectedOrders, partnerClients || []);
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-red-500/10 flex items-center justify-center gap-1.5 active:scale-95 font-sans"
              >
                📄 Exportar em Massa (PDF)
              </button>

              {/* Button: Limpar */}
              <button
                id="bulk-btn-clear-selection"
                type="button"
                onClick={() => {
                  setSelectedOrderIds([]);
                  setBulkCourierId('');
                }}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block text-[10px] text-slate-400 font-medium italic">
            Dica: use as teclas de atalho e o checkbox na coluna de seleção rápida para realizar operações em massa.
          </div>
        )}
      </div>

      {/* ----------------- LISTING ARCHITECTURE (TABLE) ----------------- */}
      {/* MOBILE COLLAPSIBLE CARDS VERSION */}
      <div className="block lg:hidden space-y-4 mb-4 select-text">
        {itemsToRender.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
            <PackageCheck className="h-12 w-12 text-slate-350 mx-auto mb-3 animate-bounce" />
            <p className="text-slate-500 font-bold text-sm">Nenhum pedido atende aos filtros atuais.</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Verifique se a data selecionada possui registros válidos ou clique em 
              <span className="font-bold text-blue-600"> "Exibir Tudo" </span> no painel de período.
            </p>
          </div>
        ) : (
          itemsToRender.map((item) => {
            if (item.type === 'header') {
              const isCollapsed = collapsedGroups[item.groupKey] || false;
              return (
                <div 
                  key={item.key}
                  className="bg-slate-50 border border-slate-250 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm border-l-4 border-l-blue-500 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(item.groupKey)}
                        className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      </button>
                      <div className="flex flex-col text-left">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                          {groupBy === 'cep' ? 'Região CEP' : groupBy === 'parceiro' ? 'Cliente Parceiro' : 'Destino'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 break-all">
                          {item.groupKey}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 shrink-0">
                      {item.orders.length} Peds
                    </span>
                  </div>

                  {onAllocateCourier && (
                    <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-slate-200/60">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Atribuir Grupo:</span>
                      <select
                        onChange={(e) => {
                          const courierId = e.target.value;
                          if (courierId) {
                            handleAllocateGroup(item.orders, courierId);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 bg-white text-[10.5px] font-bold text-slate-750 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-xs"
                        defaultValue=""
                      >
                        <option value="" disabled>Selecione entregador...</option>
                        {couriers.filter(c => c.isActive !== false).map((courier) => {
                          const rate = courier.repasseTaxa !== undefined ? courier.repasseTaxa : 9.50;
                          return (
                            <option key={courier.id} value={courier.id}>
                              {courier.name} • Repasse: R$ {rate.toFixed(2).replace('.', ',')}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>
              );
            }

            const { order } = item;
            const partnerObj = getPartnerObject(order, partnerClients);
            const partnerName = resolvePartnerName(order, partnerClients);
            const recipientName = resolveRecipientName(order, partnerClients);
            const resolvedName = partnerObj ? partnerObj.name : order.customerName;
            const allocatedCourier = couriers.find(c => c.id === order.courierId);
            const isProtocolSigned = !!order.deliveryProtocol || !!order.proofPhotoUrl || !!order.signatureDataUrl || (order.status === 'delivered' && (!!order.receiverName || !!order.deliveryProtocol));
            const isExpanded = expandedMobileOrders[order.id] || false;

            return (
              <div 
                key={`mobile-card-${order.id}`}
                className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300"
              >
                {/* 1. Header Row */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="checkbox"
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        if (isChecked) {
                          setSelectedOrderIds(prev => [...prev, order.id]);
                        } else {
                          setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                        }
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-slate-900 leading-none">
                          {order.pedido || order.id}
                        </span>
                        {isProtocolSigned && (
                          <div className="relative group/mobile-protocol inline-flex items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintProtocol(order, 'a4');
                              }}
                              className="p-0.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-full transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                              title="Protocolo finalizado! Clique para ver via oficial"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 fill-emerald-100" />
                            </button>

                            {/* Tooltip para mobile */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover/mobile-protocol:flex flex-col w-56 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl z-50 pointer-events-none text-left border border-slate-700 text-xs gap-1 animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                                <span className="font-bold text-emerald-400 text-[10px] flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Protocolo Concluído
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-200"><strong>Recebedor:</strong> {resolveReceiverName(order)}</p>
                              <p className="text-[10px] text-slate-300"><strong>Doc:</strong> {resolveReceiverDoc(order)}</p>
                              <p className="text-[9px] text-slate-400">{resolveDeliveryTime(order)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-[10.5px] text-indigo-900 font-bold mt-0.5 truncate max-w-[200px]" title={`Cliente Parceiro: ${partnerName}`}>
                        {partnerName}
                      </div>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="relative group/status">
                    <select
                      value={order.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as OrderStatus;
                        handleUpdateStatusWithHistory(order.id, nextStatus);
                      }}
                      className={`appearance-none text-[10px] pr-6 pl-2.5 py-1 rounded-full font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-sans ${
                        order.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100/60'
                          : order.status === 'in_progress'
                          ? 'bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-105/60'
                          : order.status === 'in_route'
                          ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100/50 hover:bg-fuchsia-105/60'
                          : order.status === 'failure'
                          ? 'bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100/60'
                          : order.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-250/30 hover:bg-emerald-100/60'
                          : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <option value="pending">⏳ Pendente</option>
                      <option value="in_progress">⚙️ Andamento</option>
                      <option value="in_route">🚚 Rota</option>
                      <option value="failure">⚠️ Ocorrência</option>
                      <option value="delivered">✅ Concluído</option>
                      <option value="cancelled">❌ Cancelado</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                      <svg className="h-3 w-3 fill-current opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 2. Core Operational Row: Recipient & CEP & Courier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destinatário</p>
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="font-bold text-xs text-slate-800 truncate" title={recipientName}>
                        {recipientName}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço de Entrega</p>
                    <div className="text-xs text-slate-700 font-medium leading-relaxed truncate" title={order.address}>
                      {order.address}
                    </div>
                    {/* Compact indicators and Copy & Route button in line */}
                    <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {/* CEP Indicator */}
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{order.cep || '-'}</span>
                        </span>
                        
                        {/* Item Count Indicator */}
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md">
                          <span>📦 1 Item</span>
                        </span>
                      </div>

                      {/* Copy & Route Action Button */}
                      {copiedAddressOrderId === order.id ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-pulse shrink-0">
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Copiado e Maps Aberto!</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAndRoute(order);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold shadow-xs cursor-pointer transition-all shrink-0 active:scale-95"
                          title="Copiar Endereço e Abrir Rota no Google Maps"
                        >
                          <MapPin className="h-3 w-3" />
                          <span>Copiar e Rota</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Courier Assignment Section on Card */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">Portador:</span>
                    {allocatedCourier ? (
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                          {allocatedCourier.name.charAt(0)}
                        </div>
                        <span className="font-bold text-[11px] text-slate-800 truncate">{allocatedCourier.name}</span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.2 rounded font-mono shrink-0">
                          Repasse: R$ {computeOrderRepasse(order, allocatedCourier).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-semibold">Não alocado</span>
                    )}
                  </div>
                  
                  {/* Courier selection / removal action */}
                  <div>
                    {allocatedCourier ? (
                      <button
                        onClick={() => {
                          if (!isAdmin) {
                            alert('Operação restrita: Apenas administradores do sistema podem desalocar portadores.');
                            return;
                          }
                          onDeallocateCourier?.(order.id);
                        }}
                        className={`px-2 py-1 text-[9px] bg-rose-50 hover:bg-rose-100 border border-rose-150 rounded-lg text-rose-600 font-bold transition-all flex items-center gap-0.5 ${
                          isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                        }`}
                      >
                        <Trash2 className="h-3 w-3 inline text-rose-500 shrink-0" /> Desalocar
                      </button>
                    ) : (
                      <select
                        onChange={(e) => {
                          const cid = e.target.value;
                          if (cid && onAllocateCourier) {
                            onAllocateCourier(order.id, cid);
                          }
                        }}
                        defaultValue=""
                        className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 rounded-lg px-2 py-1 shadow-sm focus:outline-none cursor-pointer"
                      >
                        <option value="" disabled>+ Alocar Portador</option>
                        {couriers
                          .filter(c => c.status === 'online' || c.status === 'busy')
                          .map(c => {
                            const rate = c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50;
                            return (
                              <option key={c.id} value={c.id}>
                                {c.status === 'busy' ? '🟡' : '🟢'} {c.name} • Repasse: R$ {rate.toFixed(2).replace('.', ',')} {c.status === 'busy' ? '(Com Pedidos)' : '(Livre)'}
                              </option>
                            );
                          })
                        }
                      </select>
                    )}
                  </div>
                </div>

                {/* 4. Collapsible Columns Details section (The "Accordion" columns viewer) */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-[11px] leading-relaxed animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Cód. Cliente:</span>
                      <strong className="text-indigo-950 font-bold">{order.codigoCliente || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Nome Fantasia:</span>
                      <strong className="text-slate-700 font-bold">{order.nomeFantasia || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Data Solicitação:</span>
                      <strong className="text-slate-700 font-mono font-bold">{order.dataSolicitacao ? normalizeIncomingDateToBrasilia(order.dataSolicitacao) : todayStrSP}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Complemento:</span>
                      <strong className="text-slate-705">{order.complemento || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Cidade / UF:</span>
                      <strong className="text-slate-705 font-bold">
                        {order.cidadeMunicipio || '-'} {order.estado ? `/ ${order.estado}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Telefone:</span>
                      <strong className="text-slate-700 font-mono">{order.telefone || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">E-mail:</span>
                      <strong className="text-slate-650 font-mono break-all leading-tight">{order.email || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Disp. Condutor:</span>
                      <strong className="text-slate-700">{order.dispositivoCondutor || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Horário Limite:</span>
                      <strong className="text-slate-750 font-mono font-bold">{order.horarioFinal || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">CNPJ Empresa:</span>
                      <strong className="text-slate-650 font-mono">{order.documentoEmpresa || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Tipo Entrega:</span>
                      <strong className="text-slate-700 font-bold">{order.tipoEntrega || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Prioridade:</span>
                      <strong className="text-slate-700 font-bold">{order.prioridade || 'Normal'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Chamado #:</span>
                      <strong className="text-slate-700 font-mono font-bold">{order.chamado || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">DANFE:</span>
                      <strong className="text-slate-600 font-mono font-bold break-all">{order.danfe || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Data Limite:</span>
                      <strong className="text-slate-700 font-mono font-bold">{order.dataLimite ? normalizeIncomingDateToBrasilia(order.dataLimite) : '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Data Agendamento:</span>
                      <strong className="text-slate-700 font-mono font-bold">{order.dataAgendamento ? normalizeIncomingDateToBrasilia(order.dataAgendamento) : '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Horário Início:</span>
                      <strong className="text-slate-700 font-mono">{order.horarioInicio || '-'}</strong>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Detalhes / Obs:</span>
                      <strong className="text-slate-655 font-medium leading-normal block italic">{order.detalhe || '-'}</strong>
                    </div>
                    <div className="col-span-2 sm:col-span-3 border-t border-slate-200/65 pt-2.5 mt-1 grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Valor NF:</span>
                        <strong className="text-slate-800 font-mono font-bold">R$ {order.valorNotaFiscal ? order.valorNotaFiscal.toFixed(2).replace('.', ',') : '0,00'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Valor Entrega:</span>
                        <div className="flex items-center gap-1">
                          <strong className="text-rose-700 font-mono font-bold">R$ {order.valorEntrega ? order.valorEntrega.toFixed(2).replace('.', ',') : '0,00'}</strong>
                          {checkIsManualFreight(order) && (
                            <span className="text-[8px] font-bold uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0" title="Valor não derivado da tabela de CEPs configurada">
                              Manual
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block text-[9px] uppercase tracking-wider">Valor Rec.:</span>
                        <strong className="text-slate-800 font-mono font-bold">R$ {order.valorReceber ? order.valorReceber.toFixed(2).replace('.', ',') : '0,00'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toggle Accordion columns trigger button */}
                <div className="mt-2.5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => toggleMobileOrderExpand(order.id)}
                    className="py-1 px-3.5 bg-slate-105 hover:bg-slate-200 border border-slate-200 rounded-full text-[10px] text-slate-600 font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>Recolher Detalhes <ChevronRight className="h-3 w-3 transform rotate-90 shrink-0" /></>
                    ) : (
                      <>Ver Colunas Ocultas ({initialColumns.length - 5}) <ChevronRight className="h-3 w-3 shrink-0" /></>
                    )}
                  </button>
                </div>

                {/* 5. Mobile Actions Row */}
                <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          alert('Operação restrita: Apenas administradores do sistema podem editar pedidos.');
                          return;
                        }
                        openEditForm(order);
                      }}
                      className={`p-2 border rounded-xl transition-all shadow-sm flex items-center justify-center ${
                        isAdmin
                          ? "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-105 cursor-pointer"
                          : "text-slate-504 bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
                      }`}
                      title={isAdmin ? "Editar Pedido" : "Administrador Requerido"}
                    >
                      <Notebook className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold ml-1">Editar</span>
                    </button>

                    {isProtocolSigned ? (
                      <>
                        <button
                          onClick={() => openProtocolModal(order, false)}
                          className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                          title="Ver / Editar Protocolo de Entrega Registrado"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold ml-1 text-emerald-800">Protocolo</span>
                        </button>
                        <button
                          onClick={() => setWhatsappModalOrder(order)}
                          className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                          title="Enviar Protocolo de Entrega via WhatsApp"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold ml-1 text-emerald-800">WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={order.status === 'cancelled'}
                        onClick={() => openProtocolModal(order, true)}
                        className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 border border-indigo-100 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                        title="Assinar Protocolo Digital de Entrega"
                      >
                        <ClipboardSignature className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold ml-1 text-indigo-805">Assinar</span>
                      </button>
                    )}

                    <button
                      onClick={() => setHistoryOrder(order)}
                      className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                      title="Linha do Tempo de Status"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold ml-1">Anotações</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => handlePrint(order)}
                      className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                      title="Imprimir Comprovante"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingOrderId(order.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-750 border border-transparent rounded-xl transition-all flex items-center justify-center cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ----------------- LISTING ARCHITECTURE (TABLE) - DESKTOP ----------------- */}
      <div className="hidden lg:block overflow-x-auto select-text">
        <table className="min-w-[2600px] w-full text-left text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px] bg-slate-50">
              {visibleColumnOrder.map((colId) => {
                const col = initialColumns.find(c => c.id === colId);
                if (!col) return null;
                const isSorted = sortField === col.id;

                if (colId === 'select') {
                  return (
                    <th 
                      key="select"
                      id="table-header-col-select"
                      className="py-1 px-0.5 text-center bg-slate-50 border-r border-slate-100 w-[32px] min-w-[32px] max-w-[32px] select-none sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox"
                          className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 h-3 w-3 cursor-pointer"
                          checked={currentPageOrderIds.length > 0 && currentPageOrderIds.every(id => selectedOrderIds.includes(id))}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            if (isChecked) {
                              const pageIds = currentPageOrderIds;
                              setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pageIds])));
                            } else {
                              const pageIds = currentPageOrderIds;
                              setSelectedOrderIds(prev => prev.filter(id => !pageIds.includes(id)));
                            }
                          }}
                        />
                      </div>
                    </th>
                  );
                }

                if (colId === 'actions') {
                  return (
                    <th 
                      key="actions"
                      id="table-header-col-actions"
                      className="py-1 px-0.5 text-center bg-slate-50 border-r border-slate-150 w-[140px] min-w-[140px] max-w-[140px] select-none sticky left-[32px] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)] font-bold uppercase tracking-wider text-[9px]"
                    >
                      Ações
                    </th>
                  );
                }

                return (
                  <th 
                    key={col.id}
                    id={`table-header-col-${col.id}`}
                    draggable={true}
                    onDragStart={() => setDraggedColId(col.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleColumnSwap(draggedColId, col.id)}
                    onClick={() => col.sortable && handleSort(col.id)}
                    className={`py-1 px-1.5 cursor-move hover:bg-slate-100 transition-all text-slate-600 font-bold uppercase tracking-wider text-[9px] select-none ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    } ${isSorted ? 'bg-blue-50/80 text-blue-700' : ''} ${col.width || ''}`}
                    title="Arraste para reordenar coluna ou Clique para ordenar (Crescente/Decrescente)"
                  >
                    <div className={`flex items-center gap-1 ${
                      col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span className="truncate">{col.label}</span>
                      {col.sortable && (
                        <span className="text-[8.5px] text-blue-600 font-bold font-mono shrink-0">
                          {sortField === col.id ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
            {showColumnFilters && (
              <tr className="bg-slate-50 border-b border-slate-200">
                {visibleColumnOrder.map((colId) => {
                  const col = initialColumns.find(c => c.id === colId);
                  if (!col) return null;

                  if (colId === 'select') {
                    return (
                      <th key="select-filter" className="py-0.5 px-0.5 text-center bg-slate-50 border-r border-slate-100 w-[32px] min-w-[32px] max-w-[32px] sticky left-0 z-20">
                      </th>
                    );
                  }

                  if (colId === 'actions') {
                    return (
                      <th key="actions-filter" className="py-0.5 px-0.5 text-center bg-slate-50 border-r border-slate-100 sticky left-[32px] z-20 w-[140px] min-w-[140px] max-w-[140px] shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                        <button
                          type="button"
                          onClick={() => {
                            setColumnFilters({});
                            setCurrentPage(1);
                          }}
                          disabled={Object.keys(columnFilters).length === 0}
                          className="text-[8px] px-1 py-0.5 bg-white hover:bg-slate-100 text-slate-500 font-bold border border-slate-200 rounded shadow-2xs disabled:opacity-40 select-none transition-all active:scale-95"
                          title="Limpar todos os filtros de coluna"
                        >
                          Limpar
                        </button>
                      </th>
                    );
                  }

                  if (colId === 'status') {
                    return (
                      <th key={`${colId}-filter`} className={`py-1 px-1 bg-slate-50 border-r border-slate-100 ${col.width || ''}`}>
                        <select
                          value={columnFilters[colId] || ''}
                          onChange={(e) => {
                            setColumnFilters(prev => ({ ...prev, [colId]: e.target.value }));
                            setCurrentPage(1);
                          }}
                          className="w-full text-[8.5px] font-bold py-0.5 px-1 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        >
                          <option value="">Status...</option>
                          <option value="não iniciado">Não Iniciado</option>
                          <option value="em andamento">Em Andamento</option>
                          <option value="entregando">Entregando</option>
                          <option value="ocorrência">Ocorrência</option>
                          <option value="concluído">Concluído</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </th>
                    );
                  }

                  if (colId === 'courier') {
                    return (
                      <th key={`${colId}-filter`} className={`py-1 px-1 bg-slate-50 border-r border-slate-100 ${col.width || ''}`}>
                        <select
                          value={columnFilters[colId] || ''}
                          onChange={(e) => {
                            setColumnFilters(prev => ({ ...prev, [colId]: e.target.value }));
                            setCurrentPage(1);
                          }}
                          className="w-full text-[8.5px] font-bold py-0.5 px-1 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        >
                          <option value="">Entregador...</option>
                          <option value="não alocado">Não Alocado</option>
                          {couriers.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name}{c.isActive === false ? ' (Inativo)' : ''}
                            </option>
                          ))}
                        </select>
                      </th>
                    );
                  }

                  return (
                    <th key={`${colId}-filter`} className={`py-1 px-1 bg-slate-50 border-r border-slate-100 ${col.width || ''}`}>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder={`${col.label}...`}
                          value={columnFilters[colId] || ''}
                          onChange={(e) => {
                            setColumnFilters(prev => ({ ...prev, [colId]: e.target.value }));
                            setCurrentPage(1);
                          }}
                          className="w-full text-[8.5px] px-1.5 py-0.5 pr-4 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium shadow-2xs transition-all placeholder:text-slate-350"
                        />
                        {columnFilters[colId] && (
                          <button
                            type="button"
                            onClick={() => {
                              setColumnFilters(prev => ({ ...prev, [colId]: '' }));
                              setCurrentPage(1);
                            }}
                            className="absolute right-0.5 text-slate-400 hover:text-slate-600 font-extrabold text-[10px] px-0.5 focus:outline-none"
                            title="Limpar filtro"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-705 font-sans">
            {itemsToRender.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnOrder.length} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center p-4">
                    <PackageCheck className="h-12 w-12 text-slate-350 mb-3 animate-bounce" />
                    <p className="text-slate-500 font-bold text-sm">Nenhum pedido atende aos filtros atuais.</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                      Verifique se a data selecionada possui registros válidos ou clique em 
                      <span className="font-bold text-blue-600"> "Exibir Tudo" </span> no painel de período.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              itemsToRender.map((item) => {
                if (item.type === 'header') {
                  const isCollapsed = collapsedGroups[item.groupKey] || false;
                  return (
                    <tr key={item.key} className="bg-slate-50 border-y border-slate-200 hover:bg-slate-100/60 transition-all duration-150 select-none">
                      <td colSpan={visibleColumnOrder.length} className="py-2.5 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapse(item.groupKey)}
                              className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center"
                              title={isCollapsed ? "Expandir grupo" : "Recolher grupo"}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                            </button>

                            <div className="flex items-center gap-2">
                              {groupBy === 'parceiro' ? (
                                <User className="h-4 w-4 text-indigo-600" />
                              ) : (
                                <MapPin className="h-4 w-4 text-blue-600" />
                              )}
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                                {groupBy === 'cep' ? 'CEP:' : groupBy === 'parceiro' ? 'PARCEIRO:' : 'Destino:'}
                              </span>
                              <span className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-150 rounded-xl px-2.5 py-0.5 break-all">
                                {item.groupKey}
                              </span>
                            </div>

                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
                              {item.orders.length} {item.orders.length === 1 ? 'Pedido' : 'Pedidos'}
                            </span>

                            <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 border border-emerald-150 rounded px-1.5 py-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Rota Otimizada por Região
                            </span>
                          </div>

                          {onAllocateCourier && (
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:inline">Despachar todos para:</span>
                              <select
                                onChange={(e) => {
                                  const courierId = e.target.value;
                                  if (courierId) {
                                    handleAllocateGroup(item.orders, courierId);
                                    e.target.value = '';
                                  }
                                }}
                                className="appearance-none bg-white text-[10.5px] font-bold text-slate-700 border border-slate-200 rounded-xl pl-3 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-xs"
                                defaultValue=""
                              >
                                 <option value="" disabled>Selecione um entregador...</option>
                                {couriers.filter(c => c.isActive !== false).map((courier) => {
                                  const rate = courier.repasseTaxa !== undefined ? courier.repasseTaxa : 9.50;
                                  return (
                                    <option key={courier.id} value={courier.id}>
                                      {courier.name} • Repasse: R$ {rate.toFixed(2).replace('.', ',')}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                const { order } = item;
                const partnerObj = getPartnerObject(order, partnerClients);
                const partnerName = resolvePartnerName(order, partnerClients);
                const recipientName = resolveRecipientName(order, partnerClients);
                const resolvedName = partnerObj ? partnerObj.name : order.customerName;
                const allocatedCourier = couriers.find(c => c.id === order.courierId);
                const isProtocolSigned = !!order.deliveryProtocol || !!order.proofPhotoUrl || !!order.signatureDataUrl || (order.status === 'delivered' && (!!order.receiverName || !!order.deliveryProtocol));

                return (
                  <tr 
                    key={order.id} 
                    id={`order-row-${order.id}`}
                    className="hover:bg-slate-50/50 transition-colors duration-150"
                  >
                    {visibleColumnOrder.map((colId) => {
                      const col = initialColumns.find(c => c.id === colId);
                      if (!col) return null;
                      switch (colId) {
                        case 'select':
                          return (
                            <td key={`select-${order.id}`} className="py-0.5 px-0.5 text-center border-r border-slate-100 bg-white sticky left-0 z-10 w-[32px] min-w-[32px] max-w-[32px] shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                              <div className="flex items-center justify-center">
                                <input 
                                  type="checkbox"
                                  className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 h-3 w-3 cursor-pointer"
                                  checked={selectedOrderIds.includes(order.id)}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    if (isChecked) {
                                      setSelectedOrderIds(prev => [...prev, order.id]);
                                    } else {
                                      setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                                    }
                                  }}
                                />
                              </div>
                            </td>
                          );
                        case 'actions':
                          return (
                            <td key="actions" className="py-0.5 px-0.5 text-center border-r border-slate-100 bg-white sticky left-[32px] z-10 w-[140px] min-w-[140px] max-w-[140px] shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => {
                                    if (!isAdmin) {
                                      alert('Operação restrita: Apenas administradores do sistema podem editar pedidos.');
                                      return;
                                    }
                                    openEditForm(order);
                                  }}
                                  className={`p-0.5 border rounded transition-all shadow-2xs flex items-center justify-center transform hover:scale-105 ${
                                    isAdmin
                                      ? "text-blue-600 bg-blue-50/50 hover:bg-blue-100/80 border-blue-100 cursor-pointer"
                                      : "text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
                                  }`}
                                  title={isAdmin ? "Editar Pedido (Caderninho CRUD)" : "Restrito: Apenas administradores podem editar"}
                                >
                                  <Notebook className="h-3 w-3" />
                                </button>
                                {isProtocolSigned ? (
                                  <>
                                    <button
                                      onClick={() => openProtocolModal(order, false)}
                                      className="p-0.5 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-150 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                      title="Ver / Editar Protocolo de Entrega Registrado"
                                    >
                                      <ClipboardCheck className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => setWhatsappModalOrder(order)}
                                      className="p-0.5 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                      title="Enviar Protocolo de Entrega via WhatsApp"
                                    >
                                      <WhatsAppIcon className="h-3 w-3 text-emerald-600" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    disabled={order.status === 'cancelled'}
                                    onClick={() => openProtocolModal(order, true)}
                                    className="p-0.5 text-indigo-650 bg-indigo-50/55 hover:bg-indigo-100/80 disabled:opacity-35 border border-indigo-100 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                    title="Preencher Protocolo Digital de Assinatura"
                                  >
                                    <ClipboardSignature className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setHistoryOrder(order)}
                                  className="p-0.5 text-amber-700 bg-amber-50/55 hover:bg-amber-100/80 border border-amber-100 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                  title="Linha do Tempo e Notas de Status"
                                >
                                  <History className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setPrintOrder(order)}
                                  className="p-0.5 text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-100 hover:border-blue-300 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                  title="Imprimir Resumo do Pedido (PDF)"
                                >
                                  <FileText className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handlePrint(order)}
                                  className="p-0.5 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-350 rounded transition-all shadow-2xs flex items-center justify-center cursor-pointer transform hover:scale-105"
                                  title="Imprimir Comprovante Térmico / Via"
                                >
                                  <Printer className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setDeletingOrderId(order.id)}
                                  className="p-0.5 text-rose-600 hover:bg-rose-50/90 hover:text-rose-750 border border-transparent hover:border-rose-100 rounded transition-all flex items-center justify-center cursor-pointer transform hover:scale-105"
                                  title="Excluir Registro Operacional"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          );
                        case 'status':
                          return (
                            <td key="status" className="py-0.5 px-1 text-center border-r border-slate-100">
                              <div className="relative group/status inline-block w-fit mx-auto">
                                <select
                                  value={order.status}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as OrderStatus;
                                    handleUpdateStatusWithHistory(order.id, nextStatus);
                                  }}
                                  className={`appearance-none text-[8.5px] pr-4 pl-1.5 py-0.5 rounded-full font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-sans ${
                                    order.status === 'pending'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100/60'
                                      : order.status === 'in_progress'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-105/60'
                                      : order.status === 'in_route'
                                      ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100/50 hover:bg-fuchsia-105/60'
                                      : order.status === 'failure'
                                      ? 'bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100/60'
                                      : order.status === 'delivered'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-250/30 hover:bg-emerald-100/60'
                                      : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'
                                  }`}
                                  title="Clique para alterar o status deste pedido instantaneamente"
                                >
                                  <option value="pending" className="bg-white text-amber-700 font-bold">⏳ Pendente</option>
                                  <option value="in_progress" className="bg-white text-blue-700 font-bold">⚙️ Andamento</option>
                                  <option value="in_route" className="bg-white text-fuchsia-700 font-bold">🚚 Rota (Entregando)</option>
                                  <option value="failure" className="bg-white text-rose-700 font-bold">⚠️ Ocorrência</option>
                                  <option value="delivered" className="bg-white text-emerald-800 font-bold">✅ Concluído</option>
                                  <option value="cancelled" className="bg-white text-slate-600 font-bold">❌ Cancelado</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-slate-400 group-hover/status:text-slate-650">
                                  <svg className="h-2 w-2 fill-current opacity-60 group-hover/status:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                  </svg>
                                </div>
                              </div>
                            </td>
                          );
                        case 'courier':
                          return (
                            <td key="courier" className={`py-0.5 px-1 border-r border-slate-100 ${col.width || ''}`}>
                              {allocatedCourier ? (
                                <div className="bg-slate-50 border border-slate-200 p-0.5 rounded flex items-center justify-between gap-1 max-w-[130px]">
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    <div className="h-4.5 w-4.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[8px] shrink-0">
                                      {allocatedCourier.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden leading-tight">
                                      <p className="font-bold text-slate-800 text-[9px] truncate">{allocatedCourier.name}</p>
                                      <span className="text-[7px] text-slate-400 block truncate">
                                        {allocatedCourier.vehicle === 'motorcycle' ? 'Moto' : 'Carro'} • <b className="text-emerald-700 font-mono">R$ {computeOrderRepasse(order, allocatedCourier).toFixed(2).replace('.', ',')}</b>
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!isAdmin) {
                                        alert('Operação restrita: Apenas administradores do sistema podem desalocar portadores.');
                                        return;
                                      }
                                      onDeallocateCourier?.(order.id);
                                    }}
                                    className={`p-0.5 rounded transition-all ${
                                      isAdmin
                                        ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                        : "text-slate-300 cursor-not-allowed opacity-40"
                                    }`}
                                    title={isAdmin ? "Desalocar Entregador (Liberar Corrida)" : "Restrito: Apenas administradores podem desalocar"}
                                  >
                                    <Trash2 className="h-2.5 w-2.5 text-rose-500" />
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-slate-50 border border-dashed border-slate-250 p-0.5 rounded flex items-center justify-center max-w-[130px]">
                                  <select
                                    onChange={(e) => {
                                      const cid = e.target.value;
                                      if (cid && onAllocateCourier) {
                                        onAllocateCourier(order.id, cid);
                                      }
                                    }}
                                    defaultValue=""
                                    className="w-full text-[8.5px] bg-transparent font-bold text-blue-600 py-0.5 focus:outline-none cursor-pointer"
                                  >
                                    <option value="" disabled>+ Alocar</option>
                                    {couriers
                                      .filter(c => c.isActive !== false && (c.status === 'online' || c.status === 'busy'))
                                      .map(c => (
                                        <option key={c.id} value={c.id}>
                                          {c.status === 'busy' ? '🟡' : '🟢'} {c.name} ({c.vehicle === 'motorcycle' ? 'Moto' : c.vehicle}) • R$ {(c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50).toFixed(2).replace('.', ',')}
                                        </option>
                                      ))
                                    }
                                  </select>
                                </div>
                              )}
                            </td>
                          );

                        case 'pedido':
                          return (
                            <td key="pedido" className={`py-0.5 px-1.5 font-mono font-bold text-slate-900 border-r border-slate-100 text-[9.5px] ${col.width || ''}`}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setHistoryOrder(order)}
                                  className="hover:underline text-blue-600 hover:text-blue-800 font-extrabold transition-colors cursor-pointer text-left focus:outline-none flex items-center gap-0.5 group/btn"
                                  title="Visualizar Linha do Tempo / Histórico de Ocorrências"
                                >
                                  <span>{order.pedido || order.id}</span>
                                </button>

                                {isProtocolSigned && (
                                  <div className="relative group/protocol inline-flex items-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrintProtocol(order, 'a4');
                                      }}
                                      className="p-0.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-full transition-all cursor-pointer flex items-center justify-center shadow-2xs hover:scale-110"
                                      title="Protocolo de entrega finalizado! Clique para visualizar a via em tela cheia"
                                    >
                                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 fill-emerald-100" />
                                    </button>

                                    {/* Resumo do protocolo ao passar o mouse */}
                                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/protocol:flex flex-col w-60 bg-slate-900 text-white p-2 rounded-lg shadow-xl z-50 pointer-events-none text-left border border-slate-700 text-[9.5px] gap-1 animate-in fade-in zoom-in-95 duration-150">
                                      <div className="flex items-center justify-between border-b border-slate-700/80 pb-1">
                                        <span className="font-bold text-emerald-400 flex items-center gap-1 text-[9.5px]">
                                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Protocolo Finalizado
                                        </span>
                                        <span className="text-[8px] text-slate-400 font-mono">{resolveDeliveryTime(order)}</span>
                                      </div>
                                      <div className="space-y-0.5 text-[9.5px] text-slate-200">
                                        <p><span className="text-slate-400 font-medium">Recebedor:</span> <strong className="text-white">{resolveReceiverName(order)}</strong></p>
                                        <p><span className="text-slate-400 font-medium">Documento:</span> <span className="font-mono text-slate-300">{resolveReceiverDoc(order)}</span></p>
                                      </div>
                                      {(resolveOrderSignature(order) || resolveOrderPhoto(order)) && (
                                        <div className="flex items-center gap-1.5 pt-0.5 border-t border-slate-800 text-[8.5px] text-slate-300">
                                          {resolveOrderSignature(order) && (
                                            <span className="bg-emerald-950/80 text-emerald-300 px-1 py-0.2 rounded border border-emerald-800/60 font-semibold flex items-center gap-0.5">
                                              ✍️ Assinatura
                                            </span>
                                          )}
                                          {resolveOrderPhoto(order) && (
                                            <span className="bg-blue-950/80 text-blue-300 px-1 py-0.2 rounded border border-blue-800/60 font-semibold flex items-center gap-0.5">
                                              📷 Foto
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div className="absolute top-full left-3 border-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        case 'codigoCliente':
                          return (
                            <td key="codigoCliente" className={`py-0.5 px-1 font-bold text-indigo-950 border-r border-slate-100 text-left ${col.width || ''}`}>
                              <span className="text-[9.5px] text-indigo-900 block truncate max-w-[150px]" title={`Cliente Parceiro: ${partnerName}`}>
                                {partnerName}
                              </span>
                            </td>
                          );
                        case 'dataSolicitacao': {
                          const rawInputDate = order.dataSolicitacao || (order.createdAt ? formatToBrasiliaDate(order.createdAt) : '') || (order.allocatedDate ? formatToBrasiliaDate(order.allocatedDate) : '');
                          const displayDate = rawInputDate ? normalizeIncomingDateToBrasilia(rawInputDate) : '-';
                          return (
                            <td key="dataSolicitacao" className={`py-0.5 px-1 text-center border-r border-slate-100 font-medium text-[9.5px] ${col.width || ''}`} title={`Data de Imputação: ${displayDate}`}>
                              {displayDate}
                            </td>
                          );
                        }
                        case 'procurarPor':
                          return (
                            <td key="procurarPor" className={`py-0.5 px-1.5 font-bold text-slate-800 border-r border-slate-100 truncate text-[9.5px] ${col.width || ''}`} title={recipientName}>
                              <button
                                onClick={() => setHistoryOrder(order)}
                                className="hover:underline text-slate-800 hover:text-blue-700 font-bold transition-colors cursor-pointer text-left block w-full truncate focus:outline-none"
                                title="Visualizar Linha do Tempo / Histórico de Ocorrências"
                              >
                                {recipientName}
                              </button>
                            </td>
                          );
                        case 'customerName':
                          return (
                            <td key="customerName" className={`py-0.5 px-1.5 font-semibold text-slate-700 border-r border-slate-100 truncate text-[9.5px] ${col.width || ''}`} title={recipientName}>
                              {recipientName}
                            </td>
                          );
                        case 'endereco': {
                          const isCopied = copiedAddressOrderId === order.id;
                          const rawAddress = (order.address || '').trim();
                          const isLong = rawAddress.length > 100;
                          const displayAddress = isLong ? `${rawAddress.slice(0, 100)}...` : rawAddress;
                          return (
                            <td 
                              key="endereco" 
                              className={`py-0.5 px-1.5 border-r border-slate-100 relative group/address-cell ${col.width || ''}`}
                              title={rawAddress}
                            >
                              <div className="flex items-center justify-between w-full min-w-0 h-full">
                                <span 
                                  className={`truncate block pr-6 text-[9.5px] leading-tight transition-colors duration-150 ${isCopied ? 'text-emerald-600 font-bold' : 'text-slate-700'}`}
                                  title={rawAddress}
                                >
                                  {isCopied ? 'Copiado e Maps Aberto!' : displayAddress}
                                </span>
                                
                                {isCopied ? (
                                  <span className="flex items-center gap-0.5 text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded shrink-0 animate-in fade-in duration-150 absolute right-1 top-1/2 -translate-y-1/2">
                                    <Check className="h-2 w-2 text-emerald-500" />
                                    <span>Copiado!</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyAndRoute(order);
                                    }}
                                    className="opacity-0 group-hover/address-cell:opacity-100 transition-all duration-150 p-0.5 px-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 rounded shrink-0 flex items-center gap-0.5 text-[8px] font-bold shadow-2xs absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer z-10"
                                    title="Copiar Endereço e Roteamento no Google Maps"
                                  >
                                    <MapPin className="h-2 w-2 text-blue-500" />
                                    <span>Rota</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        }
                        case 'cep':
                          return (
                            <td key="cep" className={`py-0.5 px-1 font-mono border-r border-slate-100 font-semibold text-center text-slate-800 text-[9.5px] ${col.width || ''}`} title={`CEP: ${formatCep(order.cep) || '-'}`}>
                              {formatCep(order.cep) || '-'}
                            </td>
                          );
                        case 'telefone':
                          return (
                            <td key="telefone" className={`py-0.5 px-1 font-mono text-slate-600 border-r border-slate-100 text-[9.5px] ${col.width || ''}`}>
                              {order.telefone || '-'}
                            </td>
                          );
                        case 'detalhe':
                          return (
                            <td key="detalhe" className={`py-0.5 px-1 text-slate-500 border-r border-slate-100 truncate text-[9.5px] ${col.width || ''}`} title={order.detalhe || ''}>
                              {order.detalhe || '-'}
                            </td>
                          );
                        case 'email':
                          return (
                            <td key="email" className={`py-0.5 px-1 text-slate-600 border-r border-slate-100 truncate text-[9.5px] ${col.width || ''}`}>
                              {order.email || '-'}
                            </td>
                          );
                        case 'complemento':
                          return (
                            <td key="complemento" className={`py-0.5 px-1 text-slate-550 border-r border-slate-100 truncate text-[9.5px] ${col.width || ''}`} title={order.complemento || ''}>
                              {order.complemento || '-'}
                            </td>
                          );
                        case 'dispositivoCondutor':
                          return (
                            <td key="dispositivoCondutor" className="py-0.5 px-0.5 font-mono text-slate-500 border-r border-slate-100 text-center text-[9px]">
                              {order.dispositivoCondutor || '-'}
                            </td>
                          );
                        case 'horarioFinal':
                          return (
                            <td key="horarioFinal" className="py-0.5 px-0.5 text-center border-r border-slate-100 text-rose-600 font-bold font-mono text-[9.5px]">
                              {order.horarioFinal || '-'}
                            </td>
                          );
                        case 'documentoEmpresa':
                          return (
                            <td key="documentoEmpresa" className="py-0.5 px-0.5 font-mono text-slate-500 border-r border-slate-100 text-[9px]">
                              {order.documentoEmpresa || '-'}
                            </td>
                          );
                        case 'tipoEntrega':
                          return (
                            <td key="tipoEntrega" className="py-0.5 px-0.5 text-center border-r border-slate-100">
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-700">
                                {order.tipoEntrega || '-'}
                              </span>
                            </td>
                          );
                        case 'prioridade':
                          const isPriority = order.prioridade?.toLowerCase().includes('prioridade') || 
                                             order.prioridade?.toLowerCase().includes('expresso') || 
                                             order.prioridade?.toLowerCase().includes('urgente') ||
                                             order.prioridade === 'Sim' || order.prioridade === '1';
                          return (
                            <td key="prioridade" className="py-0.5 px-0.5 text-center border-r border-slate-100">
                              <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                isPriority 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {order.prioridade || 'Normal'}
                              </span>
                            </td>
                          );
                        case 'chamado':
                          return (
                            <td key="chamado" className="py-0.5 px-1 font-mono text-slate-600 border-r border-slate-100 text-[9px]">
                              {order.chamado || '-'}
                            </td>
                          );
                        case 'danfe':
                          return (
                            <td key="danfe" className="py-0.5 px-1 font-mono text-slate-500 border-r border-slate-100 truncate text-[9px]" title={order.danfe || ''}>
                              {order.danfe || '-'}
                            </td>
                          );
                        case 'dataLimite':
                          return (
                            <td key="dataLimite" className="py-0.5 px-0.5 text-center border-r border-slate-100 text-[9px]">
                              {order.dataLimite ? normalizeIncomingDateToBrasilia(order.dataLimite) : '-'}
                            </td>
                          );
                        case 'nomeFantasia':
                          return (
                            <td key="nomeFantasia" className="py-0.5 px-1 text-slate-700 font-medium border-r border-slate-100 truncate text-[9.5px]" title={order.nomeFantasia || ''}>
                              {order.nomeFantasia || '-'}
                            </td>
                          );
                        case 'horarioInicio':
                          return (
                            <td key="horarioInicio" className="py-0.5 px-0.5 text-center border-r border-slate-100 font-mono text-[9px]">
                              {order.horarioInicio || '-'}
                            </td>
                          );
                        case 'dataAgendamento':
                          return (
                            <td key="dataAgendamento" className="py-0.5 px-0.5 text-center border-r border-slate-100 text-[9px]">
                              {order.dataAgendamento ? normalizeIncomingDateToBrasilia(order.dataAgendamento) : '-'}
                            </td>
                          );
                        case 'cidadeMunicipio':
                          return (
                            <td key="cidadeMunicipio" className="py-0.5 px-1 text-slate-700 border-r border-slate-100 text-[9.5px]">
                              {order.cidadeMunicipio || 'São Paulo'}
                            </td>
                          );
                        case 'estado':
                          return (
                            <td key="estado" className="py-0.5 px-0.5 text-center font-bold border-r border-slate-100 text-[9.5px]">
                              {order.estado || 'SP'}
                            </td>
                          );
                        case 'valorNotaFiscal':
                          return (
                            <td key="valorNotaFiscal" className="py-0.5 px-1 text-right font-mono font-medium text-slate-700 border-r border-slate-100 text-[9.5px]">
                              R$ {order.valorNotaFiscal ? order.valorNotaFiscal.toFixed(2).replace('.', ',') : '0,00'}
                            </td>
                          );
                        case 'valorReceber':
                          return (
                            <td key="valorReceber" className="py-0.5 px-1 text-right font-mono font-bold text-amber-700 border-r border-slate-100 text-[9.5px]">
                              R$ {order.valorReceber ? order.valorReceber.toFixed(2).replace('.', ',') : '0,00'}
                            </td>
                          );
                        case 'valorEntrega':
                          const isManualVal = checkIsManualFreight(order);
                          return (
                            <td key="valorEntrega" className="py-0.5 px-1 text-right font-mono font-bold text-emerald-700 border-r border-slate-100 text-[9.5px]">
                              <div className="flex items-center justify-end gap-1">
                                <span>R$ {order.valorEntrega ? order.valorEntrega.toFixed(2).replace('.', ',') : order.value ? order.value.toFixed(2).replace('.', ',') : '0,00'}</span>
                                {isManualVal && (
                                  <span className="text-[7.5px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0" title="Valor não derivado da tabela de CEPs configurada">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        case 'latitude':
                          return (
                            <td key="latitude" className="py-0.5 px-0.5 text-right font-mono text-[8.5px] text-slate-400 border-r border-slate-100">
                              {order.latitude || '-'}
                            </td>
                          );
                        case 'longitude':
                          return (
                            <td key="longitude" className="py-0.5 px-0.5 text-right font-mono text-[8.5px] text-slate-400 border-r border-slate-100">
                              {order.longitude || '-'}
                            </td>
                          );
                        case 'destinatarioCnpjCpf':
                          return (
                            <td key="destinatarioCnpjCpf" className="py-0.5 px-1 font-mono text-slate-600 border-r border-slate-100 text-[9px]">
                              {order.destinatarioCnpjCpf || '-'}
                            </td>
                          );
                        case 'valorCondutor':
                          const allocatedCou = couriers.find(c => c.id === order.courierId);
                          const repasseVal = (order.courierId && order.status !== 'cancelled') ? computeOrderRepasse(order, allocatedCou) : 0;
                          return (
                            <td key="valorCondutor" className="py-0.5 px-1 text-right font-mono text-blue-800 font-bold border-r border-slate-100 text-[9.5px]">
                              R$ {repasseVal.toFixed(2).replace('.', ',')}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-500 font-medium">
            <p>
              Exibindo <span className="font-bold text-slate-800">
                {startIndex + 1} - {Math.min(startIndex + (groupBy === 'none' ? itemsPerPage : groupsPerPage), groupBy === 'none' ? filteredOrders.length : groupedOrders.length)}
              </span> de <span className="font-bold text-slate-800">
                {groupBy === 'none' ? filteredOrders.length : groupedOrders.length}
              </span> {groupBy === 'none' ? 'registros' : 'grupos de rota'}
            </p>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-medium">Itens por página:</span>
              <select
                id="select-items-per-page"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-xs"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página (Padrão)</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {(() => {
              if (totalPages <= 7) {
                return Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(idx + 1)}
                    className={`h-7 min-w-7 px-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      currentPage === idx + 1
                        ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-500/10'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ));
              }

              const pages: (number | string)[] = [];
              if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
              } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
              } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
              }

              return pages.map((page, idx) => {
                if (typeof page === 'string') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`h-7 min-w-7 px-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-500/10'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              });
            })()}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Próxima Página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}


      {/* ==================================== MODAL: FULL 30 COLS CRUD (EDIT & CREATE) ==================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFormModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col text-xs">
            {/* Modal Header */}
            <div className="bg-slate-900/90 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-blue-400" />
                <div>
                  <h4 className="font-bold text-sm tracking-tight">
                    {formMode === 'create' ? 'Cadastrar Novo Registro do Padrão de 30 Colunas' : `Editar Pedido Operacional: ${id}`}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Definições completas do leiaute de carga expressa</p>
                </div>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Form Scrollable block */}
            <form onSubmit={handleSaveForm} className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-50">
              
              {/* SECTION 1: MANDATORY / CORE FIELDS */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-blue-650 flex items-center gap-1 border-b border-slate-100 pb-2">
                  <span className="h-1.5 w-1.5 bg-blue-600 rounded-full"></span>
                  <span>Campos Mandatórios e Chaves Principais</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* CodigoCliente */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Código do Cliente *</label>
                    <select
                      value={codigoCliente}
                      onChange={(e) => {
                        const newClientCode = e.target.value;
                        setCodigoCliente(newClientCode);
                        recalculateFreightValue(cep, newClientCode);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-semibold focus:ring-1 focus:ring-blue-550 focus:outline-none"
                    >
                      {partnerClients.filter(p => p.isActive !== false).map(p => (
                        <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                      ))}
                      {partnerClients.length === 0 && <option value="CLI-001">CLI-001</option>}
                    </select>
                  </div>

                  {/* DataSolicitacao */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Data de Solicitação *</label>
                    <input
                      type="text"
                      placeholder="Ex: 15/06/2026"
                      value={dataSolicitacao}
                      onChange={(e) => setDataSolicitacao(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 focus:outline-none font-bold text-slate-800"
                      required
                    />
                  </div>

                  {/* ProcurarPor / Cliente Destinatário */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Destinatário (ProcurarPor) *</label>
                    <input
                      type="text"
                      placeholder="Nome do Destinatário"
                      value={procurarPor || customerName}
                      onChange={(e) => {
                        setProcurarPor(e.target.value);
                        setCustomerName(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 focus:outline-none font-bold text-slate-800"
                      required
                    />
                  </div>

                  {/* CEP */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-slate-650 uppercase">CEP de Destino *</label>
                      {isCepLoading && (
                        <span className="text-[9px] text-blue-600 font-bold animate-pulse">Buscando endereço...</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="01311-200"
                      value={cep}
                      onChange={(e) => triggerCepAutoComplete(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 focus:outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endereco */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Endereço (Rua / Logradouro) *</label>
                    <input
                      type="text"
                      placeholder="Rua, avenida ou logradouro"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 focus:outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>

                  {/* Numero e Complemento */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-650 uppercase flex items-center gap-1">
                        <Hash className="h-3 w-3 text-blue-600" />
                        <span>Número *</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 1234 ou S/N"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-650 uppercase">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto, Bloco, etc."
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550"
                      />
                    </div>
                  </div>
                </div>

                {/* Contato do Cliente: Telefone e Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      <span>Telefone / WhatsApp do Cliente</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="(11) 98765-4321"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-550 font-mono font-medium text-slate-800"
                    />
                    <span className="text-[9px] text-slate-400 block">Usado para ligar ou enviar WhatsApp no app do condutor</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-blue-600" />
                      <span>E-mail do Cliente / Notificação</span>
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-550 text-slate-800"
                    />
                    <span className="text-[9px] text-slate-400 block">Para envio do comprovante e rastreamento</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: VALUES AND MONETARY RATES */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-650 flex items-center gap-1 border-b border-slate-100 pb-2">
                  <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full"></span>
                  <span>Faturamento, Notas Fiscais e Repasses financeiros</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Valor Total */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Faturamento (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                    />
                  </div>

                  {/* ValorNotaFiscal */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Valor N.F. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorNotaFiscal}
                      onChange={(e) => setValorNotaFiscal(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  {/* ValorReceber */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">A Receber no Ato (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorReceber}
                      onChange={(e) => setValorReceber(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  {/* ValorEntrega */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Taxa Entrega (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorEntrega}
                      onChange={(e) => setValorEntrega(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  {/* ValorCondutor */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Repasse Moto (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorCondutor}
                      onChange={(e) => setValorCondutor(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-slate-850"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: SYSTEM AND TIMING ATTRIBUTES */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-purple-650 flex items-center gap-1 border-b border-slate-100 pb-2">
                  <span className="h-1.5 w-1.5 bg-purple-600 rounded-full"></span>
                  <span>Planejamento, Prazos e Status de Triagem</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Status */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase font-black text-blue-600">Status Atual</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as OrderStatus)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white focus:outline-none"
                    >
                      <option value="pending">Não Iniciado (Pendente)</option>
                      <option value="in_progress">Em Andamento</option>
                      <option value="in_route">Entregando</option>
                      <option value="failure">Ocorrência</option>
                      <option value="delivered">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>

                  {/* Region */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Região Designada</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold bg-white"
                    >
                      <option value="Centro-Paulista">Centro-Paulista</option>
                      <option value="Zona Sul">Zona Sul</option>
                      <option value="Zona Oeste">Zona Oeste</option>
                      <option value="Zona Norte">Zona Norte</option>
                      <option value="Zona Leste">Zona Leste</option>
                    </select>
                  </div>

                  {/* Pedido */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Identificador Pedido Ref</label>
                    <input
                      type="text"
                      placeholder="PED-XXXX"
                      value={pedido}
                      onChange={(e) => setPedido(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Tempo Entrada */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase font-mono">Horário Cadastro</label>
                    <input
                      type="text"
                      placeholder="Ex: 14:15"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-700"
                    />
                  </div>

                  {/* Data Agendamento */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Data Agendamento</label>
                    <input
                      type="text"
                      placeholder="15/06/2026"
                      value={dataAgendamento}
                      onChange={(e) => setDataAgendamento(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-705"
                    />
                  </div>

                  {/* Data Limite */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase">Data Limite</label>
                    <input
                      type="text"
                      placeholder="15/06/2026"
                      value={dataLimite}
                      onChange={(e) => setDataLimite(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-705"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: REMAINING TECHNICAL COLUMNS FOR 30 COL ARCH (COMPREHENSIVE EXPANSION) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-650 flex items-center gap-1 border-b border-slate-100 pb-2">
                  <span className="h-1.5 w-1.5 bg-slate-600 rounded-full"></span>
                  <span>Outros Dados Acessórios de Triagem (Atendimento ao Padrão de 30 Colunas)</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Telefone */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Telefone de Contato</label>
                    <input
                      type="text"
                      placeholder="(11) 90000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Email de Notificação</label>
                    <input
                      type="email"
                      placeholder="exemplo@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-805"
                    />
                  </div>

                  {/* DocumentoEmpresa */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">CNPJ Cliente Embarcador</label>
                    <input
                      type="text"
                      placeholder="CNPJ"
                      value={documentoEmpresa}
                      onChange={(e) => setDocumentoEmpresa(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-805"
                    />
                  </div>

                  {/* DestinatarioCnpjCpf */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Documento Recebedor (CPF/CNPJ)</label>
                    <input
                      type="text"
                      placeholder="CPF / CNPJ"
                      value={destinatarioCnpjCpf}
                      onChange={(e) => setDestinatarioCnpjCpf(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-805"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* TipoEntrega */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Tipo de Entrega</label>
                    <input
                      type="text"
                      placeholder="Expressa / Convencional"
                      value={tipoEntrega}
                      onChange={(e) => setTipoEntrega(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* Prioridade */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Prioridade</label>
                    <input
                      type="text"
                      placeholder="Normal / Prioridade / Expresso"
                      value={prioridade}
                      onChange={(e) => setPrioridade(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* Chamado */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Registro OS / Chamado ID</label>
                    <input
                      type="text"
                      placeholder="OS-XXXX"
                      value={chamado}
                      onChange={(e) => setChamado(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* DANFE */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Chave DANFE</label>
                    <input
                      type="text"
                      placeholder="NFe Chave Acesso"
                      value={danfe}
                      onChange={(e) => setDanfe(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  {/* NomeFantasia */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Nome Fantasia Embarcador</label>
                    <input
                      type="text"
                      placeholder="Nome Fantasia"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* HorarioInicio */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase">Janela Início</label>
                    <input
                      type="text"
                      placeholder="08:00"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* HorarioFinal */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase">Janela Fim</label>
                    <input
                      type="text"
                      placeholder="18:00"
                      value={horarioFinal}
                      onChange={(e) => setHorarioFinal(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* CidadeMunicipio */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase">Cidade / Município</label>
                    <input
                      type="text"
                      value={cidadeMunicipio}
                      onChange={(e) => setCidadeMunicipio(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* Estado */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase">Estado</label>
                    <input
                      type="text"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Latitude */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Latitude GPS</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-700"
                    />
                  </div>

                  {/* Longitude */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-550 uppercase">Longitude GPS</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-700"
                    />
                  </div>

                  {/* DispositivoCondutor */}
                  <div className="space-y-1 col-span-1">
                    <label className="block text-[10px] font-bold text-slate-555 uppercase">Dispositivo Condutor Cod</label>
                    <input
                      type="text"
                      placeholder="DISP-99"
                      value={dispositivoCondutor}
                      onChange={(e) => setDispositivoCondutor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-550 uppercase font-bold">Detalhamento Instruções de Coleta / Entrega</label>
                  <textarea
                    rows={2}
                    placeholder="Instruções e especificidades para o condutor..."
                    value={detalhe}
                    onChange={(e) => setDetalhe(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 text-slate-700"
                  />
                </div>
              </div>

              {/* SECTION 5: VISUAL STATUS AUDIT LOG TIMELINE */}
              {formMode === 'edit' && selectedOrder && (
                <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                  <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-rose-650 flex items-center gap-1 border-b border-slate-100 pb-2">
                    <span className="h-1.5 w-1.5 bg-rose-600 rounded-full animate-pulse"></span>
                    <span>Log de Auditoria Visual & Histórico do Pedido</span>
                  </h5>

                  <div className="space-y-4">
                    {(!selectedOrder.history || selectedOrder.history.length === 0) ? (
                      <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/80">
                        <History className="h-6 w-6 mx-auto text-slate-350 mb-1.5 opacity-60" />
                        <span className="text-[10px] font-semibold block">Sem histórico registrado para este pedido.</span>
                        <span className="text-[9px] text-slate-400">Alterações futuras de status serão registradas aqui em tempo real.</span>
                      </div>
                    ) : (
                      <div className="relative pl-5 border-l-2 border-slate-200 space-y-4 py-1 ml-2">
                        {selectedOrder.history.filter(Boolean).map((hist, hIdx) => {
                          const isLast = hIdx === (selectedOrder.history?.length || 0) - 1;
                          let stepColor = "bg-slate-400";
                          let stepText = "Pendente";
                          
                          if (hist.status === 'pending') {
                            stepColor = "bg-amber-500"; stepText = "Pendente";
                          } else if (hist.status === 'in_progress') {
                            stepColor = "bg-blue-500"; stepText = "Em Andamento";
                          } else if (hist.status === 'in_route') {
                            stepColor = "bg-fuchsia-500"; stepText = "Em Rota";
                          } else if (hist.status === 'failure') {
                            stepColor = "bg-rose-500"; stepText = "Ocorrência / Falha";
                          } else if (hist.status === 'delivered') {
                            stepColor = "bg-emerald-500"; stepText = "Concluído";
                          } else if (hist.status === 'cancelled') {
                            stepColor = "bg-slate-500"; stepText = "Cancelado";
                          }

                          return (
                            <div key={`audit-${hist.id || hIdx}`} className="relative">
                              {/* Connector dot */}
                              <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white ring-4 ring-slate-100 ${stepColor}`} />
                              
                              <div className="bg-slate-50 hover:bg-slate-100/75 border border-slate-200/60 rounded-xl p-3 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold text-white uppercase ${stepColor}`}>
                                      {stepText}
                                    </span>
                                    <span className="text-slate-800 font-bold text-[11px]">
                                      {hist.user || "Operador (Sistema)"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-blue-900 font-mono font-bold leading-none sm:text-right">
                                    🕒 {hist.time}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                                  {hist.note || 'Sem anotações adicionais.'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>

            {/* Modal actions Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex items-center justify-between gap-3 rounded-b-3xl">
              <div>
                {formMode === 'edit' && selectedOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormModalOpen(false);
                      setDeletingOrderId(selectedOrder.id);
                    }}
                    className="px-4 py-2 border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-xs active:scale-95 shadow-xs"
                    title="Excluir este pedido definitivamente"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    <span>Excluir Definitivamente</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition-all cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-xs"
                >
                  {formMode === 'create' ? 'Concluir Cadastro' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ==================================== MODAL: DIGITAL DELIVERY PROTOCOLO SIGNATURE PAD ==================================== */}
      {protocolOrder && (() => {
        const partnerObj = partnerClients.find(p => matchClientCode(p.id, protocolOrder.codigoCliente));
        const partnerNameExtenso = partnerObj ? partnerObj.name : "Não Atribuído (Cliente Avulso)";
        return (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-4 sm:p-6 md:p-12 select-text">
            
            {/* Header / Actions toolbar displayed on screen (following print format) */}
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md flex items-center justify-center">
                  <FileSignature className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-50 tracking-tight">Protocolo Digital de Entrega</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Formalização e assinatura em tela cheia do destinatário</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {(protocolOrder.deliveryProtocol || protocolOrder.status === 'delivered' || protocolOrder.proofPhotoUrl) && !isEditingProtocol ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProtocol(true)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="Retificar dados do protocolo de entrega concluído"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Editar Dados</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={async () => {
                        setIsGeneratingPDF(true);
                        try {
                          await exportProtocolToPDF(protocolOrder, partnerClients, 'a4', showFinancialsInPrint);
                        } catch (e) {
                          console.error('Erro ao gerar PDF A4:', e);
                        } finally {
                          setIsGeneratingPDF(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Gerar e baixar PDF do Protocolo Oficial em Folha A4"
                    >
                      {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span>Baixar PDF (A4)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={async () => {
                        setIsGeneratingPDF(true);
                        try {
                          await exportProtocolToPDF(protocolOrder, partnerClients, 'half', showFinancialsInPrint);
                        } catch (e) {
                          console.error('Erro ao gerar PDF A5:', e);
                        } finally {
                          setIsGeneratingPDF(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Gerar e baixar PDF do Protocolo em Meia Folha / A5"
                    >
                      {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                      <span>Baixar PDF (A5)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappModalOrder(protocolOrder)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="Enviar protocolo e comprovante de entrega via WhatsApp"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintProtocol(protocolOrder, 'a4')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="Abrir pré-visualização completa para impressão"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Visualizar</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {protocolOrder.deliveryProtocol && (
                      <button
                        type="button"
                        onClick={() => setIsEditingProtocol(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Cancelar Edição</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSavingProtocol}
                      onClick={saveProtocol}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProtocol ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      <span>{isSavingProtocol ? 'Salvando...' : (protocolOrder.deliveryProtocol ? 'Salvar Edição do Protocolo' : 'Salvar e Protocolar')}</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setProtocolOrder(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Protocol Status Feedback Alerts */}
            {protocolSuccessMsg && (
              <div className="w-full max-w-4xl mb-4 p-3.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-100" />
                  <span>{protocolSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProtocolSuccessMsg(null)}
                  className="text-white/80 hover:text-white text-xs px-2 py-0.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {protocolError && (
              <div className="w-full max-w-4xl mb-4 p-3.5 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-100" />
                  <span>{protocolError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProtocolError(null)}
                  className="text-white/80 hover:text-white text-xs px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* The high-fidelity document paper sheet (full screen style) */}
            <div className="w-full max-w-4xl bg-white text-slate-900 p-8 sm:p-12 md:p-14 rounded-3xl shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-400 text-xs">
              
              {/* Document Header */}
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-4 mb-6 gap-3">
                <div>
                  <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                    PROTOCOLO DIGITAL DE ENTREGA E ASSINATURA
                  </h1>
                  <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                    Gerenciador Operacional ViniMap • Certificação Física Destinatário
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="inline-block bg-slate-900 text-white font-mono font-bold text-[9px] px-2.5 py-1 rounded">
                    COMPROVANTE DIGITAL
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1 font-mono font-bold">Lote ID: {protocolOrder.id}</p>
                </div>
              </div>

              {/* Dynamic Status / Driver mobile sync bar */}
              <div className="mb-6">
                {protocolOrder.courierId ? (() => {
                  const courierObj = couriers.find(c => c.id === protocolOrder.courierId);
                  return (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-emerald-800 text-left">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-900 font-sans">Dispositivo de Condutor Sincronizado</span>
                      </div>
                      <p className="text-[10px] text-emerald-700 font-sans leading-relaxed">
                        O condutor alocado <strong>{courierObj?.name || 'Não Identificado'}</strong> está online e em andamento. Os dados coletados de assinatura, foto do canhoto ou certificado digital físico serão gravados instantaneamente no banco de ocorrências operacionais do cliente parceiro.
                      </p>
                    </div>
                  );
                })() : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-[10px] leading-snug text-left">
                    ⚠️ Sem condutor alocado para sincronização em tempo real do aplicativo móvel ou dispositivo do motorista.
                  </div>
                )}
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 text-left space-y-2">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">CLIENTE PARCEIRO / EMISSOR</span>
                    <p className="font-bold text-slate-905 text-[11px] uppercase">{partnerNameExtenso}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">CÓDIGO DE CLIENTE</span>
                    <p className="font-mono text-slate-800 text-[10px] font-bold">{protocolOrder.codigoCliente || 'N/A'}</p>
                  </div>
                </div>

                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50 text-left space-y-2">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">DESTINATÁRIO / PROCURAR POR</span>
                    <p className="font-bold text-slate-900 text-[11.5px] uppercase">{protocolOrder.customerName || protocolOrder.procurarPor || '-'}</p>
                    {protocolOrder.procurarPor && protocolOrder.customerName && protocolOrder.procurarPor !== protocolOrder.customerName && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Procurar por: {protocolOrder.procurarPor}</p>
                    )}
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">ENDEREÇO DE DESTINO</span>
                    <p className="font-medium text-slate-700 text-[11px]">{protocolOrder.address}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">CEP REGISTRADO</span>
                    <p className="font-mono text-slate-800 text-[10px] font-bold">{protocolOrder.cep || 'Não Informado'}</p>
                  </div>
                </div>
              </div>

              {/* Protocol content slot: Read Only vs Interactive Flow */}
              <div className="border-t border-slate-200 pt-6">
                {(protocolOrder.deliveryProtocol || protocolOrder.status === 'delivered' || protocolOrder.proofPhotoUrl || protocolPhoto || resolveOrderPhoto(protocolOrder)) && !isEditingProtocol ? (() => {
                  const effectiveRec = protocolName || resolveReceiverName(protocolOrder);
                  const effectiveDoc = protocolDoc || resolveReceiverDoc(protocolOrder);
                  const effectiveDate = protocolDate || resolveDeliveryTime(protocolOrder);
                  const effectiveSig = protocolSignature || resolveOrderSignature(protocolOrder);
                  const effectivePhoto = protocolPhoto || resolveOrderPhoto(protocolOrder);

                  return (
                    <div className="space-y-6 text-left">
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 font-bold text-[11px] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                          <span>✓ Protocolo homologado e assinado digitalmente no ato da entrega física no local.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWhatsappModalOrder(protocolOrder)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="Enviar comprovante e dados do protocolo via WhatsApp"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingProtocol(true)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>Editar Dados</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">NOME COMPLETO DO RECEBEDOR</span>
                          <p className="text-slate-900 bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl font-extrabold text-[11px] uppercase">
                            {effectiveRec}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">DATA E HORA DO PROTOCOLO</span>
                          <p className="text-slate-700 bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl font-mono font-bold text-[10.5px]">
                            {effectiveDate}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">DOCUMENTO DO RECEBEDOR</span>
                          <p className="text-slate-900 bg-slate-50 px-3 py-2.5 border border-slate-200 rounded-xl font-mono font-bold text-[11px]">
                            {effectiveDoc}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-1.5">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">ASSINATURA DIGITAL COLETADA</span>
                          <div className="border border-slate-200 bg-neutral-50 rounded-xl p-4 flex items-center justify-center min-h-36">
                            {effectiveSig ? (
                              <img 
                                src={effectiveSig} 
                                alt="Assinatura Destinatário" 
                                referrerPolicy="no-referrer"
                                className="max-h-24 object-contain brightness-90 bg-white shadow-sm rounded-lg border border-slate-100 p-2" 
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Nenhuma assinatura digital capturada.</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">REGISTRO FOTOGRÁFICO DE COMPROVAÇÃO</span>
                          <div className="border border-slate-200 bg-neutral-50 rounded-xl p-4 flex items-center justify-center min-h-36">
                            {effectivePhoto ? (
                              <img 
                                src={effectivePhoto} 
                                alt="Foto do Comprovante" 
                                referrerPolicy="no-referrer"
                                className="max-h-32 object-contain rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:scale-105 transition-transform" 
                                onClick={() => window.open(effectivePhoto, '_blank')}
                                title="Clique para ampliar a foto"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Procedimento concluído sem comprovação fotográfica.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {(protocolNotes || protocolOrder.deliveryProtocol?.notes) && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                          <span className="font-bold text-slate-500 uppercase text-[9px] block mb-0.5">Observações Gravadas:</span>
                          {protocolNotes || protocolOrder.deliveryProtocol?.notes}
                        </div>
                      )}

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[8px] text-center text-slate-500 select-all tracking-wider">
                        AUTENTICAÇÃO_SISTEMA: {btoa(`${protocolOrder.id}-${effectiveDoc}`).slice(0, 32).toUpperCase()}
                      </div>
                    </div>
                  );
                })() : (
                  /* 2. SIGNATURE / EDIT MODE */
                  <div className="space-y-6 text-left">
                    {protocolOrder.deliveryProtocol && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
                        <Edit2 className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Modo de Retificação: Altere os dados do recebedor, documento, data/hora ou foto/assinatura e clique em "Salvar Edição do Protocolo".</span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 mb-4 font-medium leading-relaxed">
                      Preencha formalmente abaixo as credenciais necessárias e desenhe a assinatura para emitir a declaração física do sinistro logístico.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Recebedor Name */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-650 uppercase">Nome Completo do Recebedor *</label>
                        <input
                          type="text"
                          value={protocolName}
                          onChange={(e) => {
                            setProtocolName(e.target.value);
                            if (protocolError) setProtocolError(null);
                          }}
                          placeholder="Ex: Clara Dias Nogueira ou Portaria"
                          className="w-full px-3.5 py-2.5 border border-slate-250 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 rounded-xl font-bold text-slate-850"
                        />
                      </div>

                      {/* Data e Hora */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-650 uppercase">Data e Hora da Entrega / Protocolo</label>
                        <input
                          type="text"
                          value={protocolDate}
                          onChange={(e) => setProtocolDate(e.target.value)}
                          placeholder="DD/MM/AAAA HH:MM:SS"
                          className="w-full px-3.5 py-2.5 border border-slate-250 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 rounded-xl font-mono text-slate-850"
                        />
                      </div>

                      {/* RG/CPF */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-650 uppercase">
                          Número do Documento (RG / CPF) <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={protocolDoc}
                          onChange={(e) => {
                            setProtocolDoc(e.target.value);
                            if (protocolError) setProtocolError(null);
                          }}
                          placeholder="Ex: 50.123.456-7 ou Não informado"
                          className="w-full px-3.5 py-2.5 border border-slate-250 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 rounded-xl font-mono text-slate-850"
                        />
                      </div>

                      {/* Observações */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-650 uppercase">Observações / Anotações (Opcional)</label>
                        <input
                          type="text"
                          value={protocolNotes}
                          onChange={(e) => setProtocolNotes(e.target.value)}
                          placeholder="Ex: Entregue na portaria / pacote lacrado"
                          className="w-full px-3.5 py-2.5 border border-slate-250 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 rounded-xl text-slate-850"
                        />
                      </div>
                    </div>

                    {/* Admin option: Include financial values (Valor da Mercadoria e Frete) */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Incluir Valores Financeiros no Protocolo (Mercadoria e Frete)
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Por padrão, valores financeiros são excluídos da exportação e impressão para privacidade. Ative esta opção caso deseje exibi-los no documento.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={includeFinancialValues}
                          onChange={(e) => setIncludeFinancialValues(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {/* Grid for Digital Signature & Photo Capture */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Interactive Canvas signature block */}
                      <div className="space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-650 uppercase">Assinatura Digital *</label>
                          {keepExistingSignature && protocolSignature ? (
                            <button 
                              type="button" 
                              onClick={() => setKeepExistingSignature(false)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100/70 px-3 py-1 rounded-lg border border-indigo-150 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Redesenhar</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              {protocolSignature && (
                                <button
                                  type="button"
                                  onClick={() => setKeepExistingSignature(true)}
                                  className="text-[10px] text-slate-600 hover:text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                >
                                  Manter Anterior
                                </button>
                              )}
                              <button 
                                type="button" 
                                onClick={clearCanvas}
                                className="text-[10px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/70 px-3 py-1 rounded-lg border border-rose-150 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                              >
                                Limpar
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {keepExistingSignature && protocolSignature ? (
                          <div className="border border-slate-300 bg-white rounded-xl overflow-hidden h-44 relative flex flex-col items-center justify-center p-3 shadow-inner">
                            <img 
                              src={protocolSignature} 
                              alt="Assinatura Atual" 
                              referrerPolicy="no-referrer"
                              className="max-h-28 object-contain"
                            />
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-2">
                              ✓ Assinatura gravada preservada
                            </span>
                          </div>
                        ) : (
                          <div className="border border-slate-300 bg-slate-100 rounded-xl overflow-hidden h-44 relative touch-none cursor-crosshair shadow-inner">
                            <canvas
                              ref={canvasRef}
                              onMouseDown={startDrawing}
                              onMouseMove={drawSignature}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              onTouchStart={startDrawing}
                              onTouchMove={drawSignature}
                              onTouchEnd={stopDrawing}
                              className="w-full h-full block bg-white"
                            />
                            <div className="pointer-events-none absolute bottom-2 right-3 text-[9px] text-slate-400 font-bold tracking-wider select-none font-mono">
                              ÁREA DE CAPTURA DO TOUCHPAD
                            </div>
                          </div>
                        )}

                        <div className="text-[9px] text-slate-400 font-medium italic mt-1 text-center">
                          {keepExistingSignature && protocolSignature ? 'Clique em "Redesenhar" para trocar a assinatura' : 'Desenhe usando o mouse ou o touch do celular'}
                        </div>
                      </div>

                      {/* Right: Foto do Comprovante / Canhoto */}
                      <div className="space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-650 uppercase">Foto do Comprovante / Canhoto</label>
                          {(protocolPhoto || resolveOrderPhoto(protocolOrder)) && (
                            <button
                              type="button"
                              onClick={() => {
                                setProtocolPhoto(null);
                                if (protocolOrder) {
                                  protocolOrder.proofPhotoUrl = undefined;
                                  if (protocolOrder.deliveryProtocol) {
                                    protocolOrder.deliveryProtocol.photoUrl = undefined;
                                  }
                                }
                              }}
                              className="text-[10px] text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/70 px-3 py-1 rounded-lg border border-rose-150 transition-all cursor-pointer active:scale-95"
                            >
                              Remover Foto
                            </button>
                          )}
                        </div>

                        <div className="border border-slate-300 bg-slate-100 rounded-xl overflow-hidden h-44 relative flex flex-col items-center justify-center shadow-inner">
                          {isCameraActive ? (
                            <div className="relative w-full h-full bg-black">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10 w-full px-2 justify-center">
                                <button
                                  type="button"
                                  onClick={capturePhoto}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[9px] shadow-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                >
                                  <Camera className="h-3 w-3" />
                                  Tirar Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsCameraActive(false)}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-lg text-[9px] shadow-lg transition-all cursor-pointer active:scale-95"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (protocolPhoto || resolveOrderPhoto(protocolOrder)) ? (
                            <div className="relative w-full h-full bg-white flex items-center justify-center p-2">
                              <img
                                src={protocolPhoto || resolveOrderPhoto(protocolOrder)!}
                                alt="Foto do Canhoto Coletada"
                                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                              />
                              <div className="absolute top-2 right-2 bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-[8px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                <Check className="h-2.5 w-2.5" />
                                FOTO SALVA
                              </div>
                            </div>
                          ) : (
                            <div 
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  compressImageFile(file, 1200, 1200, 0.75)
                                    .then(compressed => setProtocolPhoto(compressed))
                                    .catch(() => {
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        if (event.target?.result) {
                                          setProtocolPhoto(event.target.result as string);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                }
                              }}
                              onClick={() => document.getElementById('dialog-photo-upload-input')?.click()}
                              className="w-full h-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-indigo-500 transition-colors group cursor-pointer animate-fade-in"
                            >
                              <Camera className="h-6 w-6 text-slate-400 group-hover:text-indigo-650 transition-colors mb-1 animate-pulse" />
                              <p className="text-[10px] font-bold text-slate-650 group-hover:text-indigo-700 transition-colors">
                                Tirar Foto ou Selecionar arquivo
                              </p>
                              <p className="text-[9px] text-slate-400 mt-0.5 font-medium text-center">
                                Arraste ou clique para enviar foto física do canhoto
                              </p>
                              <input
                                type="file"
                                id="dialog-photo-upload-input"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>

                        {/* Quick trigger camera vs file buttons under placeholder box */}
                        {!isCameraActive && !protocolPhoto && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                              <Camera className="h-3 w-3" />
                              Câmera (Webcam)
                            </button>
                            <button
                              type="button"
                              onClick={() => document.getElementById('dialog-photo-upload-input')?.click()}
                              className="py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                            >
                              <Upload className="h-3 w-3" />
                              Upload de Canhoto
                            </button>
                          </div>
                        )}

                        {/* Visual guide status line for the photo */}
                        {!isCameraActive && protocolPhoto && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                            >
                              <Camera className="h-3 w-3" />
                              Substituir (Câmera)
                            </button>
                            <button
                              type="button"
                              onClick={() => document.getElementById('dialog-photo-upload-input')?.click()}
                              className="py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                            >
                              <Upload className="h-3 w-3" />
                              Novo Upload
                            </button>
                          </div>
                        )}
                        {!protocolPhoto && !isCameraActive && (
                          <div className="text-[9px] text-slate-400 font-medium italic mt-1 text-center">
                            Recomendado obter a foto legível do comprovante físico
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Smart certificate sign prompt */}
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-2.5 font-medium leading-relaxed">
                      <AlertTriangle className="h-4 w-4 text-amber-650 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Importante:</strong> Ao salvar, o sistema irá atualizar as informações do recebedor e manter o histórico rastreável e criptografado da entrega concluída.
                      </span>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      {protocolOrder.deliveryProtocol && (
                        <button
                          type="button"
                          onClick={() => setIsEditingProtocol(false)}
                          className="px-5 py-2.5 border border-slate-350 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-bold rounded-xl transition-all hover:border-slate-400 cursor-pointer text-xs active:scale-95"
                        >
                          Cancelar Edição
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setProtocolOrder(null)}
                        className="px-5 py-2.5 border border-slate-350 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-bold rounded-xl transition-all hover:border-slate-400 cursor-pointer text-xs active:scale-95"
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        disabled={isSavingProtocol}
                        onClick={saveProtocol}
                        className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer text-xs active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSavingProtocol ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                        <span>{isSavingProtocol ? 'Salvando...' : (protocolOrder.deliveryProtocol ? 'Salvar Edição do Protocolo' : 'Confirmar Entrega Assinada (Protocolar)')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}


      {/* ==================================== DRAWER: ORDER STATUS HISTORY LOG TIMELINE & EXPORTS ==================================== */}
      <AnimatePresence>
        {historyOrder && (
          <div className="fixed inset-0 z-50 flex justify-end no-print">
            {/* Backdrop Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOrder(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Slide-out Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative bg-white shadow-2xl border-l border-slate-200 w-full max-w-lg h-full flex flex-col z-10 text-xs text-slate-700 font-sans"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-slate-800 rounded-lg text-amber-500">
                    <History className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm tracking-tight text-white">Linha do Tempo & Histórico</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Auditoria cronológica e ocorrências do pedido</p>
                  </div>
                </div>
                <button 
                  onClick={() => setHistoryOrder(null)} 
                  className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Drawer Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
                {/* Operational Details Card */}
                {(() => {
                  const partnerNameExtenso = resolvePartnerName(historyOrder, partnerClients);
                  const recipientNameExtenso = resolveRecipientName(historyOrder, partnerClients);
                  const allocatedCourier = couriers?.find(c => c.id === historyOrder.courierId);
                  return (
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl text-left shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Dados Operacionais</p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(historyOrder.id);
                            alert('ID do pedido copiado!');
                          }}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-mono font-bold flex items-center gap-1 cursor-pointer"
                          title="Copiar ID do pedido"
                        >
                          ID: {historyOrder.id}
                          <Copy className="h-3 w-3 inline" />
                        </button>
                      </div>
                      
                      <div className="border-t border-slate-100 pt-2 space-y-1.5">
                        <p className="text-xs font-bold text-slate-800">
                          Cliente Parceiro: <span className="text-indigo-600 font-extrabold">{partnerNameExtenso}</span>
                        </p>
                        <p className="text-xs font-bold text-slate-800">
                          Destinatário: <span className="text-slate-700 font-semibold">{recipientNameExtenso}</span>
                        </p>
                        <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                          📍 {historyOrder.address} {historyOrder.cep ? `| CEP: ${historyOrder.cep}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {/* Status badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          historyOrder.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                            : historyOrder.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 border-blue-200/50'
                            : historyOrder.status === 'in_route'
                            ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100/50'
                            : historyOrder.status === 'failure'
                            ? 'bg-rose-50 text-rose-700 border-rose-150'
                            : historyOrder.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-250/30'
                            : 'bg-slate-50 text-slate-650 border-slate-200'
                        }`}>
                          📌 Status: {
                            historyOrder.status === 'pending' ? 'Pendente' :
                            historyOrder.status === 'in_progress' ? 'Em Preparação' :
                            historyOrder.status === 'in_route' ? 'Em Rota' :
                            historyOrder.status === 'failure' ? 'Ocorrência' :
                            historyOrder.status === 'delivered' ? 'Concluído' :
                            historyOrder.status === 'cancelled' ? 'Cancelado' : historyOrder.status
                          }
                        </span>

                        {/* Courier Badge */}
                        {allocatedCourier && (
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded-full flex items-center gap-1">
                            🛵 {allocatedCourier.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Export Options Panel */}
                <div className="p-4 bg-white border border-slate-150 rounded-2xl shadow-xs text-left">
                  <p className="font-extrabold text-slate-800 text-[10.5px] mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                    <Download className="h-3.5 w-3.5 text-blue-550" />
                    <span>Ferramentas de Exportação</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyHistoryText(historyOrder)}
                      className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-[10.5px] cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copiar Texto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadHistoryCSV(historyOrder)}
                      className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-[10.5px] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-550" />
                      <span>Excel / CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadHistoryJSON(historyOrder)}
                      className="py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-[10.5px] cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Dados JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintHistoryOrder(historyOrder)}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-[10.5px] cursor-pointer active:scale-95 shadow-md shadow-slate-900/15"
                    >
                      <Printer className="h-3.5 w-3.5 text-amber-400" />
                      <span>Imprimir Ficha</span>
                    </button>
                  </div>
                </div>

                {/* Timeline Flow */}
                <div className="relative pl-7 space-y-6 border-l border-slate-200 ml-3 pt-3 text-left">
                  {(!historyOrder.history || historyOrder.history.length === 0) ? (
                    <div className="relative group">
                      {/* Timeline Dot with Icon */}
                      <span className="absolute -left-[37px] top-0.5 h-6 w-6 rounded-full bg-amber-500 border-4 border-white flex items-center justify-center shadow-xs text-white">
                        <Clock className="h-2.5 w-2.5" />
                      </span>
                      <div className="bg-white p-3.5 border border-slate-150 rounded-2xl shadow-xs transition-all hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-extrabold text-slate-800 text-[11px] uppercase tracking-tight">Criação de Registro Sincronizado</p>
                          <span className="text-[9px] text-slate-400 font-mono font-semibold">{historyOrder.time || '08:00'} hs</span>
                        </div>
                        <p className="text-[9px] text-indigo-650 font-bold mt-0.5 w-fit bg-indigo-50/60 px-2 py-0.5 rounded-md border border-indigo-100/50">
                          Por: Operador (Inicial)
                        </p>
                        <p className="text-slate-600 text-[10.5px] mt-2 font-medium leading-relaxed">
                          Pedido criado na fila e pronto para alocação com o tipo de transporte adequado.
                        </p>
                      </div>
                    </div>
                  ) : (
                    [...historyOrder.history].filter(Boolean).map((event, idx) => {
                      const statusConfig: Record<string, { label: string; bg: string; dotBg: string; text: string; icon: React.ReactNode }> = {
                        pending: { label: 'Pendente', bg: 'bg-amber-50 border-amber-100', dotBg: 'bg-amber-500', text: 'text-amber-700', icon: <Clock className="h-2.5 w-2.5" /> },
                        in_progress: { label: 'Em Preparação', bg: 'bg-blue-50 border-blue-100', dotBg: 'bg-blue-500', text: 'text-blue-700', icon: <Settings className="h-2.5 w-2.5" /> },
                        in_route: { label: 'Em Rota', bg: 'bg-fuchsia-50 border-fuchsia-100', dotBg: 'bg-fuchsia-500', text: 'text-fuchsia-700', icon: <MapPin className="h-2.5 w-2.5" /> },
                        failure: { label: 'Ocorrência', bg: 'bg-rose-50 border-rose-100', dotBg: 'bg-rose-500', text: 'text-rose-700', icon: <AlertTriangle className="h-2.5 w-2.5" /> },
                        delivered: { label: 'Concluído', bg: 'bg-emerald-50 border-emerald-100', dotBg: 'bg-emerald-500', text: 'text-emerald-800', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
                        cancelled: { label: 'Cancelado', bg: 'bg-slate-100 border-slate-200', dotBg: 'bg-slate-500', text: 'text-slate-600', icon: <X className="h-2.5 w-2.5" /> }
                      };

                      const conf = statusConfig[event.status] || { label: event.status || 'Atualização', bg: 'bg-slate-50 border-slate-200', dotBg: 'bg-slate-500', text: 'text-slate-700', icon: <RefreshCcw className="h-2.5 w-2.5" /> };

                      return (
                        <motion.div 
                          key={event.id || idx} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="relative group"
                        >
                          {/* Timeline Dot */}
                          <span className={`absolute -left-[37px] top-0.5 h-6 w-6 rounded-full ${conf.dotBg} border-4 border-white flex items-center justify-center shadow-xs text-white`}>
                            {conf.icon}
                          </span>
                          
                          <div className="bg-white p-3.5 border border-slate-150 rounded-2xl shadow-xs transition-all hover:shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${conf.bg} ${conf.text}`}>
                                {conf.label}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono font-semibold ml-auto">{event.time}</span>
                            </div>
                            
                            {event.user && (
                              <p className="text-[9px] text-indigo-650 font-bold mt-1.5 flex items-center gap-1 bg-indigo-50/65 px-2 py-0.5 rounded-md w-fit border border-indigo-100/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-550 animate-pulse" />
                                <span>Por: <span className="font-extrabold capitalize">{event.user}</span></span>
                              </p>
                            )}
                            
                            <p className="text-slate-600 text-[10px] mt-1 font-medium bg-white p-2.5 border border-slate-150 rounded-xl text-left leading-relaxed">
                              {event.note}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Timeline Update Input Form */}
              <div className="p-5 border-t border-slate-150 space-y-3 bg-white shrink-0">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-650 uppercase text-left">Adicionar Ocorrência Operacional</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHistoryNote}
                      onChange={(e) => setNewHistoryNote(e.target.value)}
                      placeholder="Ex: Entrega reprogramada por atraso do fiscal ou tempo..."
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={addTimelineNote}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all"
                    >
                      Postar
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-400 italic text-left">Este log é anexado permanentemente no DANFE do faturamento do cliente.</p>
                </div>

                {/* Close Button */}
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryOrder(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition-all cursor-pointer text-center"
                  >
                    Fechar Painel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ==================================== MODAL: ORDER CANCELLATION CONFIRMATION ==================================== */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCancellingOrder(null)}></div>
          
          <div className="relative bg-white rounded-3xl shadow-xl max-w-sm w-full z-10 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-6 w-6 text-rose-600 animate-pulse" />
              <h4 className="font-bold text-sm text-slate-800 font-sans">Confirmar Cancelamento</h4>
            </div>
            <div className="space-y-3 font-sans">
              <p className="text-slate-600 font-semibold leading-relaxed">
                Você tem certeza de que deseja cancelar o pedido <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 select-all">{cancellingOrder.id}</span>?
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                Esta ação alterará o status do pedido para Cancelado e liberará qualquer portador vinculado.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 font-sans">
              <button
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold cursor-pointer transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  onUpdateStatus(cancellingOrder.id, 'cancelled');
                  setCancellingOrder(null);
                }}
                className="px-5 py-2 font-bold rounded-xl transition-all shadow-md bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-95"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ==================================== MODAL: BULK ORDER CANCELLATION CONFIRMATION ==================================== */}
      {isBulkCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkCancelModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-3xl shadow-xl max-w-sm w-full z-10 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-6 w-6 text-rose-600 animate-pulse" />
              <h4 className="font-bold text-sm text-slate-800 font-sans">Confirmar Cancelamento em Lote</h4>
            </div>
            <div className="space-y-3 font-sans">
              <p className="text-slate-600 font-semibold leading-relaxed">
                Você tem certeza de que deseja cancelar os <span className="font-mono font-black text-rose-750 bg-rose-50 px-2 py-0.5 rounded border border-rose-105 select-all">{selectedOrderIds.length}</span> pedidos selecionados?
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                Esta ação alterará o status de todos os pedidos selecionados para Cancelado e liberará seus portadores vinculados de uma só vez.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 font-sans">
              <button
                onClick={() => setIsBulkCancelModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold cursor-pointer transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  if (onBulkUpdateStatus) {
                    onBulkUpdateStatus(selectedOrderIds, 'cancelled').then(() => {
                      alert(`Cancelamento de ${selectedOrderIds.length} pedido(s) efetuado com sucesso!`);
                    }).catch((err) => {
                      console.error(err);
                      alert(`Erro ao tentar se conectar ao servidor.`);
                    }).finally(() => {
                      setSelectedOrderIds([]);
                      setIsBulkCancelModalOpen(false);
                    });
                  } else {
                    selectedOrderIds.forEach(id => {
                      handleUpdateStatusWithHistory(id, 'cancelled', 'Pedido cancelado via operação em lote.');
                    });
                    alert(`Cancelamento de ${selectedOrderIds.length} pedido(s) efetuado com sucesso!`);
                    setSelectedOrderIds([]);
                    setIsBulkCancelModalOpen(false);
                  }
                }}
                className="px-5 py-2 font-bold rounded-xl transition-all shadow-md bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-95"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: BULK STATUS UPDATE CONFIRMATION ==================================== */}
      {bulkStatusToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => !isExecutingBulkStatus && setBulkStatusToConfirm(null)}
          ></div>
          
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full z-10 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Confirmar Alteração de Status em Lote</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Operação administrativa em massa</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Pedidos Selecionados:</span>
                <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100 text-xs">
                  {selectedOrderIds.length}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                <span className="text-slate-600 font-medium">Novo Status:</span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                  bulkStatusToConfirm === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                  bulkStatusToConfirm === 'in_route' ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
                  bulkStatusToConfirm === 'in_progress' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                  bulkStatusToConfirm === 'failure' ? 'bg-pink-50 text-pink-800 border-pink-300' :
                  bulkStatusToConfirm === 'cancelled' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                  'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {bulkStatusToConfirm === 'pending' ? '⏳ Não Iniciado (Pendente)' :
                   bulkStatusToConfirm === 'in_progress' ? '⚙️ Em Andamento' :
                   bulkStatusToConfirm === 'in_route' ? '🚚 Em Rota (Entregando)' :
                   bulkStatusToConfirm === 'failure' ? '⚠️ Ocorrência (Falha)' :
                   bulkStatusToConfirm === 'delivered' ? '✅ Concluído (Entregue)' :
                   '❌ Cancelado'}
                </span>
              </div>
            </div>

            <p className="text-slate-500 font-normal leading-relaxed text-[11px]">
              Esta ação atualizará o status de todos os <strong className="text-slate-800">{selectedOrderIds.length}</strong> pedidos selecionados no banco de dados central e na interface de monitoramento em tempo real.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isExecutingBulkStatus}
                onClick={() => setBulkStatusToConfirm(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isExecutingBulkStatus}
                onClick={async () => {
                  if (!bulkStatusToConfirm) return;
                  setIsExecutingBulkStatus(true);
                  try {
                    const statusLabels: Record<OrderStatus, string> = {
                      pending: 'Não Iniciado',
                      in_progress: 'Em Andamento',
                      in_route: 'Entregando',
                      failure: 'Ocorrência',
                      delivered: 'Concluído',
                      cancelled: 'Cancelado'
                    };

                    if (onBulkUpdateStatus) {
                      await onBulkUpdateStatus(selectedOrderIds, bulkStatusToConfirm);
                    } else {
                      selectedOrderIds.forEach(id => {
                        handleUpdateStatusWithHistory(id, bulkStatusToConfirm, 'Status alterado em lote via painel de pedidos.');
                      });
                    }
                    alert(`Status de ${selectedOrderIds.length} pedido(s) alterado para "${statusLabels[bulkStatusToConfirm]}" com sucesso!`);
                    setSelectedOrderIds([]);
                    setBulkStatusToConfirm(null);
                  } catch (err) {
                    console.error('Erro ao atualizar status em lote:', err);
                    alert('Erro ao tentar atualizar status de pedidos.');
                  } finally {
                    setIsExecutingBulkStatus(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExecutingBulkStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isExecutingBulkStatus ? 'Atualizando...' : 'Confirmar Alteração'}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ==================================== MODAL: DELETION VERIFY CRUD DELETE ==================================== */}
      {deletingOrderId && (() => {
        const orderToDelete = orders.find(o => o.id === deletingOrderId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => !isDeleting && setDeletingOrderId(null)}
            ></div>
            
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full z-10 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-xs border border-slate-100">
              <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-rose-100/60">
                <div className="p-2.5 bg-rose-50 rounded-2xl">
                  <AlertTriangle className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">Confirmar Exclusão Definitiva</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Esta operação é permanente e irreversível</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-slate-700">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Pedido / ID:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-xs">
                    {orderToDelete?.pedido || deletingOrderId}
                  </span>
                </div>
                {(orderToDelete?.cliente || orderToDelete?.codigoCliente) && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Cliente / Parceiro:</span>
                    <span className="font-bold text-slate-800">
                      {orderToDelete.cliente || orderToDelete.codigoCliente}
                    </span>
                  </div>
                )}
                {orderToDelete?.customerName && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Destinatário:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                      {orderToDelete.customerName}
                    </span>
                  </div>
                )}
                {(orderToDelete?.address || orderToDelete?.cep) && (
                  <div className="flex justify-between items-start text-[11px] pt-1.5 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium shrink-0">Destino:</span>
                    <span className="font-medium text-slate-600 text-right truncate max-w-[220px]">
                      {orderToDelete.address || ''} {orderToDelete.cep ? `(${orderToDelete.cep})` : ''}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-slate-600 font-medium leading-relaxed text-[11px]">
                Você tem certeza de que deseja excluir definitivamente este registro do painel do administrador? Ele será removido permanentemente de todas as bases de dados (servidor, nuvem e cache local).
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingOrderId(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold transition-all disabled:opacity-50 cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => confirmDeleteOrder(deletingOrderId)}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 text-xs"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Excluindo definitivamente...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 text-white" />
                      <span>Sim, Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ==================================== MODAL: BULK DELETION VERIFY ==================================== */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
          ></div>
          
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full z-10 p-6 space-y-4 animate-in zoom-in-95 duration-150 text-xs border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-rose-100/60">
              <div className="p-2.5 bg-rose-50 rounded-2xl">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Excluir Pedidos em Massa</h4>
                <p className="text-[11px] text-slate-500 font-medium">Exclusão permanente de múltiplos registros</p>
              </div>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/80 space-y-2 text-rose-950">
              <p className="font-bold text-xs">
                Atenção: Você selecionou <span className="font-extrabold text-rose-700">{selectedOrderIds.length} pedidos</span> para exclusão.
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Esta ação é irreversível e excluirá definitivamente todos os pedidos selecionados de todas as bases de dados, nuvem e relatórios operacionais.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold transition-all disabled:opacity-50 cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={confirmBulkDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 text-xs"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Excluindo {selectedOrderIds.length} pedidos...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-white" />
                    <span>Sim, Excluir {selectedOrderIds.length} Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ==================================== MODAL: EXPORT CSV COLUMN PICKER ==================================== */}
      {isExportCsvModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsExportCsvModalOpen(false)}></div>
          
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-150 max-w-lg w-full overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col text-xs font-sans">
            {/* Modal Header */}
            <div className="bg-slate-900/95 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-sm tracking-tight text-white">Exportar CSV Personalizado</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Selecione as colunas relevantes que deseja incluir no arquivo final</p>
                </div>
              </div>
              <button onClick={() => setIsExportCsvModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-all cursor-pointer">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Quick Presets / Actions */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {csvSelectedColumns.length} de {EXPORT_COLUMNS.length} colunas selecionadas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCsvSelectedColumns(EXPORT_COLUMNS.map(c => c.key))}
                  className="px-2.5 py-1 text-[10px] bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition-all border border-slate-205 font-bold cursor-pointer"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setCsvSelectedColumns([])}
                  className="px-2.5 py-1 text-[10px] bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition-all border border-slate-205 font-bold cursor-pointer"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setCsvSelectedColumns(['id', 'codigoCliente', 'partnerName', 'dataSolicitacao', 'customer', 'value', 'status'])}
                  className="px-2.5 py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-all border border-blue-100 font-bold cursor-pointer"
                >
                  Simplificado
                </button>
              </div>
            </div>

            {/* Column Checklist Grid Area */}
            <div className="p-5 max-h-[50vh] overflow-y-auto bg-slate-50/30">
              <div className="grid grid-cols-2 gap-2.5">
                {EXPORT_COLUMNS.map((col) => {
                  const isChecked = csvSelectedColumns.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50 text-blue-900 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setCsvSelectedColumns(prev => prev.filter(k => k !== col.key));
                          } else {
                            setCsvSelectedColumns(prev => [...prev, col.key]);
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                      />
                      <span className="text-[11px] truncate leading-tight">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsExportCsvModalOpen(false)}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={csvSelectedColumns.length === 0}
                onClick={() => {
                  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
                  exportOrdersToCSV(selectedOrders, partnerClients, csvSelectedColumns);
                  setIsExportCsvModalOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] text-xs font-bold rounded-2xl transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 active:scale-95"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ==================================== DYNAMIC PRINTING COUPON INLINE BLOCK ==================================== */}
      {printOrder && (() => {
        const partnerObj = getPartnerObject(printOrder, partnerClients);
        const partnerNameExtenso = resolvePartnerName(printOrder, partnerClients);
        const partnerCNPJ = partnerObj?.cnpjCpf || "Não Informado";
        const recipientName = resolveRecipientName(printOrder, partnerClients);

        const effectiveReceiver = resolveReceiverName(printOrder);
        const effectiveDoc = resolveReceiverDoc(printOrder);
        const effectiveDeliveryTime = resolveDeliveryTime(printOrder);
        const effectivePhoto = resolveOrderPhoto(printOrder);
        const effectiveSignature = resolveOrderSignature(printOrder);
        const isConcluded = !!printOrder.deliveryProtocol || printOrder.status === 'delivered' || !!effectivePhoto || !!effectiveSignature;

        return (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-4 sm:p-6 md:p-12 print:p-0 print:bg-white print:absolute print:inset-0 select-text">
            {/* Header / Actions toolbar displayed on screen, hidden on print */}
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-50 tracking-tight">Visualização do Protocolo de Entrega</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Comprovante homologado com nome do recebedor, fotos, assinaturas e certificação</p>
                </div>
              </div>

              {/* Format Switcher & Actions */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                {/* A4 vs Meia Página toggle */}
                <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPrintFormat('a4')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      printFormat === 'a4' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                    title="Formato padrão Folha A4 em página única"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Folha A4 (Página Única)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('half')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      printFormat === 'half' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                    title="Formato resumido compacto para meia folha ou A5"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Meia Página (Resumido)</span>
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={showFinancialsInPrint}
                    onChange={(e) => setShowFinancialsInPrint(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-4 h-4"
                  />
                  <span>Exibir Valores Financeiros</span>
                </label>

                <button
                  type="button"
                  onClick={() => setWhatsappModalOrder(printOrder)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  title="Enviar protocolo e comprovante de entrega via WhatsApp"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Enviar WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPDF}
                  onClick={async () => {
                    setIsGeneratingPDF(true);
                    try {
                      await exportProtocolToPDF(printOrder, partnerClients, printFormat, showFinancialsInPrint);
                    } catch (e) {
                      console.error('Erro ao gerar PDF:', e);
                    } finally {
                      setIsGeneratingPDF(false);
                    }
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Gerar e salvar arquivo PDF do protocolo oficial"
                >
                  {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>{isGeneratingPDF ? 'Gerando PDF...' : 'Baixar Protocolo (PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.print();
                    } catch (_) {}
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all border border-slate-700 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  title="Enviar para a impressora conectada"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrder(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* The printable document paper sheet */}
            <div id="printable-receipt" className={`w-full ${printFormat === 'half' ? 'max-w-3xl' : 'max-w-4xl'} bg-white text-slate-900 p-5 sm:p-7 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:p-0 print:rounded-none animate-in fade-in slide-in-from-bottom-4 duration-400`}>
              {/* Embedded CSS for robust single-page print formatting */}
              <style dangerouslySetInnerHTML={{ __html: `
                #printable-receipt {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                  background: white !important;
                  color: #0f172a !important;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: ${printFormat === 'half' ? '5mm 8mm' : '6mm 8mm'};
                  }
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-receipt, #printable-receipt * {
                    visibility: visible !important;
                  }
                  #printable-receipt {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: ${printFormat === 'half' ? '4px 8px' : '6px 10px'} !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    max-height: ${printFormat === 'half' ? '138mm' : '282mm'} !important;
                    overflow: hidden !important;
                  }
                }
              `}} />

              {/* ======================= LAYOUT 1: FOLHA A4 (PÁGINA ÚNICA) ======================= */}
              {printFormat === 'a4' && (
                <div>
                  {/* Document Header */}
                  <div className="w-full flex items-center justify-between border-b-2 border-slate-900 pb-2.5 mb-2.5">
                    <div>
                      <h1 className="text-sm font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-700 print:text-black" />
                        PROTOCOLO DE ENTREGA CERTIFICADO
                      </h1>
                      <p className="text-[9px] text-slate-500 font-medium tracking-wide">
                        Gerenciador Operacional ViniMap • Documento de Conformidade Logística
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-slate-900 text-white font-mono font-bold text-[8.5px] px-2.5 py-0.5 rounded">
                        LOTE COMPROVANTE
                      </span>
                      <p className="text-[9px] text-slate-700 mt-0.5 font-mono font-black">{printOrder.pedido ? `PEDIDO: ${printOrder.pedido} • ID: ${printOrder.id}` : printOrder.id}</p>
                    </div>
                  </div>

                  {/* Main Info Blocks Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="border border-slate-300 p-2 rounded-lg bg-slate-50/50">
                      <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">EMISSOR LOGÍSTICO / CLIENTE</span>
                      <p className="font-bold text-slate-900 text-xs truncate">{partnerNameExtenso.toUpperCase()}</p>
                      <p className="text-[8.5px] text-slate-600 mt-0.5 font-mono">CNPJ/CPF: {partnerCNPJ}</p>
                    </div>

                    <div className="border border-slate-300 p-2 rounded-lg bg-slate-50/50">
                      <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">DADOS DO TRANSPORTE</span>
                      <p className="font-bold text-slate-900 text-xs">Ação ID: <span className="font-mono">{printOrder.pedido || printOrder.id}</span></p>
                      <p className="text-[8.5px] text-slate-600 mt-0.5">Operação: {printOrder.tipoEntrega || 'Transporte Rodoviário'} • Região: {printOrder.region || 'São Paulo'}</p>
                    </div>

                    <div className="border border-slate-300 p-2 rounded-lg bg-slate-50/50">
                      <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">DETALHES / DATAS</span>
                      <p className="font-bold text-slate-900 text-xs">Solicitação: {printOrder.dataSolicitacao ? normalizeIncomingDateToBrasilia(printOrder.dataSolicitacao) : todayStrSP}</p>
                      <p className="text-[8.5px] text-slate-600 mt-0.5 font-mono">Impressão: {formatToBrasiliaDateTime(new Date())}</p>
                    </div>
                  </div>

                  {/* Destination Panel - Dados Completos do Destinatário */}
                  <div className="border border-slate-300 rounded-lg p-2.5 mb-2.5 bg-slate-50/30">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
                      <h2 className="text-[8.5px] font-bold uppercase text-slate-900 tracking-wider">
                        DADOS COMPLETOS DO DESTINATÁRIO E LOCAL DE ENTREGA
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-[8.5px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                          🕒 Conclusão da Entrega: {effectiveDeliveryTime}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div>
                          <p className="text-[7.5px] text-slate-400 uppercase font-bold">Destinatário Final / Nome Registrado</p>
                          <p className="font-extrabold text-slate-900 text-xs leading-tight">{recipientName}</p>
                          {printOrder.procurarPor && printOrder.procurarPor !== recipientName && printOrder.procurarPor !== partnerNameExtenso && (
                            <p className="text-[9.5px] text-slate-600 font-medium mt-0.5">Aos cuidados de: <span className="font-bold text-slate-800">{printOrder.procurarPor}</span></p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div>
                            <p className="text-[7.5px] text-slate-400 uppercase font-semibold">CPF / CNPJ</p>
                            <p className="font-mono text-slate-800 text-[9.5px] font-bold">{printOrder.destinatarioCnpjCpf || printOrder.documento || 'Não informado'}</p>
                          </div>
                          <div>
                            <p className="text-[7.5px] text-slate-400 uppercase font-semibold">Telefone / Contato</p>
                            <p className="font-mono text-slate-800 text-[9.5px]">{printOrder.telefone || printOrder.phone || 'Não informado'}</p>
                          </div>
                        </div>

                        <div className="pt-0.5">
                          <p className="text-[7.5px] text-slate-400 uppercase font-semibold">Endereço de Entrega</p>
                          <p className="text-slate-900 font-medium text-[11px] leading-snug">
                            {printOrder.address}
                            {printOrder.complemento ? ` - Compl: ${printOrder.complemento}` : ''}
                            {printOrder.bairro ? ` • Bairro: ${printOrder.bairro}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 pl-3 border-l border-slate-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[7.5px] text-slate-400 uppercase font-semibold">CEP / Localidade</p>
                            <p className="font-bold text-slate-900 font-mono text-xs">{printOrder.cep || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[7.5px] text-slate-400 uppercase font-semibold">Cidade - UF</p>
                            <p className="text-slate-900 font-bold text-xs">{printOrder.cidadeMunicipio || 'São Paulo'} - {printOrder.estado || 'SP'}</p>
                          </div>
                        </div>

                        {/* Coordenadas GPS */}
                        <div className="p-1 bg-slate-100/90 border border-slate-200 rounded mt-1">
                          <p className="text-[7.5px] text-slate-500 uppercase font-bold tracking-wider">Coordenadas de Entrega (GPS)</p>
                          <p className="font-mono text-[9px] font-bold text-slate-800">
                            Lat: {printOrder.latitude ? Number(printOrder.latitude).toFixed(6) : '-23.550520'} | Lng: {printOrder.longitude ? Number(printOrder.longitude).toFixed(6) : '-46.633308'}
                          </p>
                        </div>

                        {/* Valores Financeiros: Only shown if enabled */}
                        {showFinancialsInPrint && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 mt-1">
                            <div>
                              <p className="text-[7.5px] text-slate-400 uppercase font-semibold">Valor Mercadoria</p>
                              <p className="font-bold text-slate-900 font-mono text-[9.5px]">R$ {Number(printOrder.valorNotaFiscal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-[7.5px] text-slate-400 uppercase font-semibold">Frete Cobrado</p>
                              <p className="font-bold text-slate-900 font-mono text-[9.5px]">R$ {Number(printOrder.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Validation & Comprovações Module (Nome do Recebedor, Foto e Assinatura) */}
                  <div className="border-2 border-slate-900 rounded-lg overflow-hidden mb-2.5">
                    <div className="bg-slate-900 text-white px-3 py-1.5 font-bold uppercase text-[8.5px] tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>DADOS DE VALIDAÇÃO OPERACIONAL E COMPROVAÇÃO DE ENTREGA</span>
                        {isConcluded && (
                          <span className="bg-emerald-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-[7.5px] uppercase">
                            ENTREGA CONCLUÍDA
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[8px] text-slate-400">CHAVE SHA-256</span>
                    </div>

                    <div className="p-3 space-y-2.5">
                      {/* Linha dos Dados do Recebedor */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-0.5">
                          <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider">
                            NOME DO RECEBEDOR (ASSINATURA / ENTREGA)
                          </span>
                          <p className="font-black text-slate-950 text-xs sm:text-sm bg-slate-100 p-2 border border-slate-300 rounded uppercase">
                            {effectiveReceiver}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider">
                            DATA / HORA DA ENTREGA
                          </span>
                          <p className="font-bold text-slate-900 font-mono text-xs bg-slate-100 p-2 border border-slate-300 rounded">
                            {effectiveDeliveryTime}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-wider">
                            RG / CPF REGISTRADO
                          </span>
                          <p className="font-bold text-slate-900 font-mono text-xs bg-slate-100 p-2 border border-slate-300 rounded">
                            {effectiveDoc}
                          </p>
                        </div>
                      </div>

                      {/* Observações do Protocolo (se houver) */}
                      {printOrder.deliveryProtocol?.notes && (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded text-left">
                          <span className="block text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Observações / Anotações do Protocolo</span>
                          <p className="text-slate-800 text-[9.5px] font-medium mt-0.5">{printOrder.deliveryProtocol.notes}</p>
                        </div>
                      )}

                      {/* Grade de Comprovações: Foto e Assinatura */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {/* 1. Foto do Comprovante */}
                        <div className="border border-slate-300 bg-slate-50/70 p-2 rounded-lg text-center flex flex-col items-center justify-center min-h-[115px]">
                          <span className="block text-[8px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Camera className="h-3 w-3 text-indigo-600 print:text-black" />
                            REGISTRO FOTOGRÁFICO NO LOCAL (FOTO / COMPROVANTE)
                          </span>
                          {effectivePhoto ? (
                            <img 
                              src={effectivePhoto} 
                              alt="Foto Comprovante Canhoto" 
                              referrerPolicy="no-referrer"
                              className="max-h-28 max-w-full object-contain rounded border border-slate-300 bg-white shadow-xs"
                            />
                          ) : (
                            <div className="py-4 text-center">
                              <p className="text-[10px] text-slate-400 italic">Nenhuma foto de comprovante anexada</p>
                            </div>
                          )}
                        </div>

                        {/* 2. Assinatura Digital */}
                        <div className="border border-slate-300 bg-slate-50/70 p-2 rounded-lg text-center flex flex-col items-center justify-center min-h-[115px]">
                          <span className="block text-[8px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <FileSignature className="h-3 w-3 text-indigo-600 print:text-black" />
                            ASSINATURA DIGITAL DO DESTINATÁRIO
                          </span>
                          {effectiveSignature ? (
                            <img 
                              src={effectiveSignature} 
                              alt="Assinatura Digital" 
                              referrerPolicy="no-referrer"
                              className="max-h-24 max-w-full object-contain mix-blend-multiply bg-white rounded border border-slate-300 p-1"
                            />
                          ) : (
                            <div className="w-full text-center space-y-1 py-3">
                              <div className="w-3/4 border-b border-slate-900 mx-auto h-7"></div>
                              <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider pt-0.5">ASSINATURA DO DESTINATÁRIO RESPONSÁVEL</p>
                              <p className="text-[7px] text-slate-400">Declaro ter recebido os materiais e mercadorias descritas em perfeito estado.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Digital Seals & Audit trail */}
                  <div className="border-t border-dashed border-slate-300 pt-2 flex items-center justify-between">
                    <div className="text-left space-y-0.5 font-mono text-[7.5px] text-slate-500">
                      <p>CERTIDÃO EXTRÍNSECA: {btoa(`${printOrder.id}-${effectiveDoc}`).slice(0, 32).toUpperCase()}</p>
                      <p>VINIMAP SISTEMAS LOGÍSTICOS • PROTOCOLO DE ENTREGA CERTIFICADO EM PÁGINA ÚNICA</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[8px] font-bold tracking-widest text-slate-400">
                        |||||| |||| | ||| | ||| |||| | ||| ||| |||
                      </span>
                      <p className="text-[7px] text-slate-400 font-sans mt-0.5 font-semibold">HOMOLOGADOR CENTRAL DIGITAL CERTIFICADO</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================= LAYOUT 2: MEIA PÁGINA (RESUMIDO) ======================= */}
              {printFormat === 'half' && (
                <div className="space-y-2">
                  {/* Header Compacto */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                    <div>
                      <h2 className="text-xs font-black uppercase text-slate-900 tracking-tight flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4 text-indigo-700 print:text-black" />
                        PROTOCOLO DE ENTREGA - VIA RESUMIDA (MEIA PÁGINA)
                      </h2>
                      <p className="text-[8px] text-slate-500 font-medium">
                        ViniMap Logística • Comprovante Homologado de Recebimento
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-slate-900 text-white font-mono font-bold text-[8px] px-2 py-0.5 rounded">
                        #{printOrder.pedido || printOrder.id}
                      </span>
                      <p className="text-[8px] text-slate-600 font-mono font-bold mt-0.5">{effectiveDeliveryTime}</p>
                    </div>
                  </div>

                  {/* Grid de Informações Essenciais */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Coluna 1: Destinatário e Endereço */}
                    <div className="border border-slate-300 p-2 rounded-lg bg-slate-50/50 space-y-1">
                      <div>
                        <span className="text-[7px] font-bold text-slate-400 uppercase block">Destinatário:</span>
                        <p className="text-[11px] font-extrabold text-slate-900 leading-tight truncate">
                          {recipientName}
                        </p>
                        {printOrder.procurarPor && printOrder.procurarPor !== recipientName && printOrder.procurarPor !== partnerNameExtenso && (
                          <p className="text-[9px] text-slate-600">A/C: <span className="font-bold">{printOrder.procurarPor}</span></p>
                        )}
                      </div>
                      <div>
                        <span className="text-[7px] font-bold text-slate-400 uppercase block">Endereço de Entrega:</span>
                        <p className="text-[9.5px] text-slate-800 font-medium leading-tight">
                          {printOrder.address}{printOrder.bairro ? ` - ${printOrder.bairro}` : ''}, {printOrder.cidadeMunicipio || 'SP'} - CEP: {printOrder.cep || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 text-[8px] text-slate-600 border-t border-slate-200">
                        <span>Emissor: <strong className="text-slate-900">{partnerNameExtenso}</strong></span>
                        {showFinancialsInPrint && (
                          <span>Mercadoria: <strong>R$ {Number(printOrder.valorNotaFiscal || 0).toFixed(2)}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Coluna 2: Dados em Destaque do Recebedor */}
                    <div className="border-2 border-slate-900 p-2 rounded-lg bg-slate-50/80 flex flex-col justify-between">
                      <div>
                        <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block">
                          NOME DO RECEBEDOR:
                        </span>
                        <p className="text-xs font-black text-slate-950 uppercase truncate bg-white p-1 rounded border border-slate-300 mt-0.5">
                          {effectiveReceiver}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-slate-200">
                        <div>
                          <span className="text-[7px] font-bold text-slate-500 uppercase block">HORA ENTREGA:</span>
                          <p className="text-[10px] font-bold font-mono text-slate-900 truncate">{effectiveDeliveryTime}</p>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold text-slate-500 uppercase block">DOC (RG/CPF):</span>
                          <p className="text-[10px] font-bold font-mono text-slate-900 truncate">{effectiveDoc}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comprovações Lado a Lado (Foto e Assinatura) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Foto do Comprovante */}
                    <div className="border border-slate-300 bg-slate-50/60 p-1.5 rounded-lg text-center flex flex-col items-center justify-center min-h-[95px]">
                      <span className="block text-[7.5px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Camera className="h-2.5 w-2.5 text-indigo-600 print:text-black" />
                        FOTO DO COMPROVANTE
                      </span>
                      {effectivePhoto ? (
                        <img 
                          src={effectivePhoto} 
                          alt="Foto Canhoto" 
                          referrerPolicy="no-referrer"
                          className="max-h-24 max-w-full object-contain rounded border border-slate-300 bg-white shadow-xs"
                        />
                      ) : (
                        <p className="text-[9px] text-slate-400 italic py-2">Sem foto anexada</p>
                      )}
                    </div>

                    {/* Assinatura Coletada */}
                    <div className="border border-slate-300 bg-slate-50/60 p-1.5 rounded-lg text-center flex flex-col items-center justify-center min-h-[95px]">
                      <span className="block text-[7.5px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <FileSignature className="h-2.5 w-2.5 text-indigo-600 print:text-black" />
                        ASSINATURA DO RECEBEDOR
                      </span>
                      {effectiveSignature ? (
                        <img 
                          src={effectiveSignature} 
                          alt="Assinatura" 
                          referrerPolicy="no-referrer"
                          className="max-h-20 max-w-full object-contain mix-blend-multiply bg-white rounded border border-slate-300 p-0.5"
                        />
                      ) : (
                        <div className="w-full text-center space-y-0.5 py-1">
                          <div className="w-4/5 border-b border-slate-900 mx-auto h-5"></div>
                          <p className="text-[7px] font-bold text-slate-500 uppercase">Assinatura Manual</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linha de Autenticação e Linha de Corte Inferior */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[7px] font-mono text-slate-500 pb-1">
                      <span>AUTENTICAÇÃO: {btoa(`${printOrder.id}-${effectiveDoc}`).slice(0, 24).toUpperCase()}</span>
                      <span>VINIMAP • CANHOTO HOMOLOGADO</span>
                    </div>
                    <div className="border-t-2 border-dashed border-slate-400 pt-1 text-center">
                      <span className="text-[7.5px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        ✂ - - - - - - - - - - - - - - - - - CANHOTO DE PROTOCOLO DE ENTREGA (MEIA PÁGINA) - - - - - - - - - - - - - - - - - ✂
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ==================================== DYNAMIC PRINTING FOR HISTORY TIMELINE LOGS ==================================== */}
      {printHistoryOrder && (() => {
        const partnerNameExtenso = resolvePartnerName(printHistoryOrder, partnerClients);
        const recipientName = resolveRecipientName(printHistoryOrder, partnerClients);
        
        return (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start p-4 sm:p-6 md:p-12 print:p-0 print:bg-white print:absolute print:inset-0 select-text">
            {/* Header Display Toolbar */}
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-amber-600 text-white p-2.5 rounded-xl shadow-md flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-50 tracking-tight">Relatório de Auditoria e Histórico Operacional</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Trilha oficial Auditada da vida útil do pedido</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Imprimir Histórico</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintHistoryOrder(null)}
                  className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Print paper layout */}
            <div id="printable-history-receipt" className="w-full max-w-4xl bg-white text-slate-900 p-8 sm:p-12 md:p-16 rounded-3xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:p-0 print:rounded-none">
              <style dangerouslySetInnerHTML={{ __html: `
                #printable-history-receipt {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                }
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-history-receipt, #printable-history-receipt * {
                    visibility: visible !important;
                  }
                  #printable-history-receipt {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    border: none !important;
                    box-shadow: none !important;
                  }
                }
              `}} />

              {/* Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-6">
                <div className="space-y-1.5 text-left">
                  <h2 className="font-sans font-black text-slate-900 text-lg uppercase tracking-tight">RELATÓRIO OPERACIONAL DE STATUS E OCORRÊNCIAS</h2>
                  <p className="text-[10px] text-slate-500 font-bold font-mono tracking-wide">CERTIFICAÇÃO DIGITAL DE LOGÍSTICA • VINIMAP</p>
                </div>
                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 space-y-0.5 text-left text-[10px] sm:w-64">
                  <p className="font-extrabold text-slate-850">Pedido ID: <span className="font-mono text-indigo-600">{printHistoryOrder.id}</span></p>
                  <p className="font-bold text-slate-500">Cliente Parceiro: <span className="font-bold text-slate-700">{partnerNameExtenso}</span></p>
                </div>
              </div>

              {/* Order Metadata summary */}
              <div className="my-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                  <h4 className="font-extrabold text-[10px] uppercase text-indigo-650 tracking-wider">Identificação do Pedido</h4>
                  <p className="font-bold text-xs">Destinatário: <span className="font-medium text-slate-700">{recipientName}</span></p>
                  <p className="font-bold text-xs">Endereço: <span className="font-medium text-slate-700">{printHistoryOrder.address}</span></p>
                  <p className="font-bold text-xs">CEP: <span className="font-mono text-slate-700">{printHistoryOrder.cep || 'Não Informado'}</span></p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                  <h4 className="font-extrabold text-[10px] uppercase text-indigo-650 tracking-wider">Metadados Internos</h4>
                  <p className="font-bold text-xs">Número do Pedido: <span className="font-mono font-medium text-slate-700">{printHistoryOrder.pedido || 'N/A'}</span></p>
                  <p className="font-bold text-xs">Data de Solicitação: <span className="font-mono font-medium text-slate-700">{printHistoryOrder.dataSolicitacao ? normalizeIncomingDateToBrasilia(printHistoryOrder.dataSolicitacao) : 'N/A'}</span></p>
                  <p className="font-bold text-xs">Status Atual: <span className="font-mono font-bold text-indigo-700 uppercase">{printHistoryOrder.status}</span></p>
                </div>
              </div>

              {/* Complete chronogram logs */}
              <div className="text-left space-y-4">
                <h4 className="font-extrabold text-xs uppercase text-slate-900 border-b border-slate-300 pb-2">LINHA DO TEMPO OPERACIONAL (AUDITORIA DE TRACKING)</h4>
                
                <div className="relative pl-6 space-y-6 border-l border-indigo-600 ml-2 mt-4">
                  {(!printHistoryOrder.history || printHistoryOrder.history.length === 0) ? (
                    <div className="relative">
                      <span className="absolute -left-[30px] top-1.5 h-4.5 w-4.5 rounded-full bg-indigo-600 border-4 border-white flex items-center justify-center"></span>
                      <p className="font-extrabold text-slate-900 text-xs">Criação Operacional / Importação de Pedido</p>
                      <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">{printHistoryOrder.time || '08:00'} hs • Informação Inicial Registrada</p>
                      <p className="text-slate-600 text-xs mt-1.5 bg-slate-50 p-3 border border-slate-150 rounded-xl leading-relaxed">
                        Pedido importado na fila e pronto para alocação com o tipo de transporte adequado.
                      </p>
                    </div>
                  ) : (
                    printHistoryOrder.history.filter(Boolean).map((event, idx) => (
                      <div key={event.id || idx} className="relative">
                        <span className="absolute -left-[30px] top-1.5 h-4 w-4 rounded-full bg-indigo-600 border-4 border-white flex items-center justify-center"></span>
                        
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-slate-850 text-xs uppercase tracking-tight">
                            {(() => {
                              const statusLabels: Record<string, string> = {
                                pending: 'Pendente',
                                in_progress: 'Em Preparação',
                                in_route: 'Em Rota',
                                failure: 'Ocorrência',
                                delivered: 'Concluído',
                                cancelled: 'Cancelado'
                              };
                              return statusLabels[event.status] || event.status || 'Atualização';
                            })()}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono font-semibold ml-auto">{event.time}</span>
                        </div>
                        {event.user && (
                          <p className="text-[9.5px] text-indigo-705 font-bold mt-0.5 text-left flex items-center gap-1 bg-indigo-50/50 px-2 py-0.5 rounded-md w-fit border border-indigo-100/30">
                            <span>Alterado por: <span className="font-extrabold capitalize">{event.user}</span></span>
                          </p>
                        )}
                        <p className="text-slate-700 text-xs mt-1.5 bg-slate-50 p-3 border border-slate-150 rounded-xl leading-relaxed">
                          {event.note}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Print Footer / Signing zone */}
              <div className="border-t border-slate-300 pt-16 mt-20 grid grid-cols-2 gap-12 text-center text-[10px] text-slate-500">
                <div className="space-y-1">
                  <div className="border-t border-slate-400 w-full pt-1.5 font-bold uppercase">RESPONSÁVEL OPERACIONAL DA EXPEDIÇÃO</div>
                  <p className="text-[8px] text-slate-400 font-mono">Assinatura / Carimbo do Emissor</p>
                </div>
                <div className="space-y-1">
                  <div className="border-t border-slate-400 w-full pt-1.5 font-bold uppercase">CERTIDÃO ELETRÔNICA VINIMAP AUDIT</div>
                  <p className="text-[8px] text-slate-400 font-mono">CHAVE OPERACIONAL: {btoa(`${printHistoryOrder.id}-history-log`).slice(0, 32).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* WhatsApp Protocol Share Modal */}
      <ProtocolWhatsAppModal
        isOpen={Boolean(whatsappModalOrder)}
        order={whatsappModalOrder}
        partnerClients={partnerClients}
        couriers={couriers}
        onClose={() => setWhatsappModalOrder(null)}
        onDownloadPDF={async () => {
          if (!whatsappModalOrder) return;
          try {
            await exportProtocolToPDF(whatsappModalOrder, partnerClients, 'a4', showFinancialsInPrint);
          } catch (e) {
            console.error('Erro ao gerar PDF:', e);
          }
        }}
      />

    </div>
  );
}
