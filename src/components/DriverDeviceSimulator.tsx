import React, { useState, useEffect } from 'react';
import { Order, Courier, PartnerClient, OrderStatus, AppBranding, matchClientCode } from '../types';
import { formatToBrasiliaISODate, formatToBrasiliaDate, formatToBrasiliaTime, parseToISODate } from '../utils/dateUtils';
import { 
  Smartphone, 
  CheckCircle2, 
  Truck, 
  Package, 
  LogOut, 
  Download, 
  MapPin, 
  Navigation, 
  Phone, 
  PhoneCall,
  MessageSquare, 
  Camera, 
  PenTool, 
  Search, 
  Filter, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  FileCheck2, 
  AlertTriangle, 
  RotateCcw, 
  Clock, 
  User, 
  ChevronRight, 
  ExternalLink, 
  Building2, 
  Box, 
  Map, 
  RefreshCw, 
  Bell, 
  Activity, 
  Wrench,
  Calendar,
  Layers,
  X,
  ZoomIn
} from 'lucide-react';
import DeliveryProtocolModal from './DeliveryProtocolModal';
import DriverPwaInstallModal from './DriverPwaInstallModal';
import ProtocolWhatsAppModal, { WhatsAppIcon } from './ProtocolWhatsAppModal';
import { removeFromStore } from '../lib/indexedDB';
import { DriverDiagnosticModal } from './DriverDiagnosticModal';

interface DriverDeviceSimulatorProps {
  orders: Order[];
  couriers: Courier[];
  partnerClients?: PartnerClient[];
  branding?: AppBranding;
  onUpdateStatus?: (orderId: string, status: OrderStatus, details?: any) => void;
  onUpdateCourier?: (id: string, updatedData: Partial<Courier>) => Promise<any> | void;
  onReorderOrders?: () => void;
  isStandalone?: boolean;
  standaloneCourierId?: string;
  onLogoutStandalone?: () => void;
}

export const DriverDeviceSimulator: React.FC<DriverDeviceSimulatorProps> = ({
  orders = [],
  couriers = [],
  partnerClients = [],
  branding,
  onUpdateStatus,
  onUpdateCourier,
  onReorderOrders,
  isStandalone,
  standaloneCourierId,
  onLogoutStandalone
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    standaloneCourierId || localStorage.getItem('vinimap_driver_id') || (!isStandalone && couriers[0]?.id ? couriers[0].id : '')
  );
  
  const [activeTab, setActiveTab] = useState<'orders' | 'gps' | 'protocols' | 'install'>('orders');
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending' | 'in_route' | 'delivered' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllDeliveredHistory, setShowAllDeliveredHistory] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);
  const knownAssignedOrderIdsRef = React.useRef<Set<string> | null>(null);

  // Single-session enforcement state
  const [isSessionRevoked, setIsSessionRevoked] = useState(false);
  const [revokedDetails, setRevokedDetails] = useState<{ time?: string; device?: string }>({});

  // Active protocol modal state
  const [selectedOrderForProtocol, setSelectedOrderForProtocol] = useState<Order | null>(null);
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<Order | null>(null);

  // Super-zoom / expanded order view state (opens enlarged card on click, closes with any screen click)
  const [expandedOrder, setExpandedOrder] = useState<Order | null>(null);

  // Helper to resolve friendly Partner Name without exposing raw client codes (e.g. CLI-001)
  const getPartnerDisplayName = (order: Order): string => {
    if (!order) return '';

    // 1. Direct partner name if explicit and not a raw client code string
    if (order.nomeFantasia && !order.nomeFantasia.toUpperCase().startsWith('CLI-')) {
      return order.nomeFantasia.trim();
    }

    // 2. Lookup in partnerClients matching ID, codigoCliente, CNPJ, or Name
    if (partnerClients && partnerClients.length > 0) {
      const match = partnerClients.find(p => 
        matchClientCode(p, order.codigoCliente || '') ||
        matchClientCode(p, order.cliente || '') ||
        matchClientCode(p, order.nomeFantasia || '') ||
        (order.codigoCliente && (p.id === order.codigoCliente || p.codigoCliente === order.codigoCliente)) ||
        (order.cliente && (p.id === order.cliente || p.codigoCliente === order.cliente || (p.name && p.name.toLowerCase() === order.cliente.toLowerCase())))
      );
      if (match && match.name) {
        return match.name.trim();
      }
    }

    // 3. Check order.cliente if not a raw code
    if (order.cliente && !order.cliente.toUpperCase().startsWith('CLI-')) {
      return order.cliente.trim();
    }

    // 4. Check order.documentoEmpresa if named
    if (order.documentoEmpresa && !order.documentoEmpresa.toUpperCase().startsWith('CLI-') && isNaN(Number(order.documentoEmpresa.replace(/\D/g, '')))) {
      return order.documentoEmpresa.trim();
    }

    // 5. Fallback check for partner code match in list
    if (order.codigoCliente) {
      const p = partnerClients?.find(p => p.id === order.codigoCliente || p.codigoCliente === order.codigoCliente);
      if (p?.name) return p.name.trim();
    }

    return '';
  };

  // Catch native PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (_) {
        setIsPwaModalOpen(true);
      }
    } else {
      setIsPwaModalOpen(true);
    }
  };

  // Synchronize selectedDriverId with standaloneCourierId or local storage
  useEffect(() => {
    if (standaloneCourierId) {
      setSelectedDriverId(standaloneCourierId);
    } else {
      const stored = localStorage.getItem('vinimap_driver_id');
      if (stored) {
        setSelectedDriverId(stored);
      } else if (!isStandalone && couriers.length > 0 && !selectedDriverId) {
        setSelectedDriverId(couriers[0].id);
      }
    }
  }, [standaloneCourierId, couriers, isStandalone]);

  // Real-time synchronization interval for driver device with device screen wake / focus listeners
  useEffect(() => {
    const handleSync = () => {
      if (onReorderOrders) {
        onReorderOrders();
      }
    };

    // Fast 5-second polling interval for real-time mobile updates
    const interval = setInterval(handleSync, 5000);

    // Instant re-sync when driver unlocks phone screen, switches back from Waze/WhatsApp, or reconnects
    const handleDriverWakeOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        handleSync();
      }
    };
    window.addEventListener('focus', handleDriverWakeOrFocus);
    window.addEventListener('online', handleDriverWakeOrFocus);
    document.addEventListener('visibilitychange', handleDriverWakeOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleDriverWakeOrFocus);
      window.removeEventListener('online', handleDriverWakeOrFocus);
      document.removeEventListener('visibilitychange', handleDriverWakeOrFocus);
    };
  }, [onReorderOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onReorderOrders) {
        await onReorderOrders();
      }
    } catch (_) {
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Strict Courier isolation resolver
  const selectedCourier = React.useMemo(() => {
    // In standalone mode (real driver phone), strictly enforce standaloneCourierId
    // In preview / simulator mode, allow selecting courier via dropdown (selectedDriverId)
    const targetId = String(isStandalone ? (standaloneCourierId || selectedDriverId || '') : (selectedDriverId || standaloneCourierId || '')).trim();
    if (!targetId) {
      return !isStandalone && couriers.length > 0 ? couriers[0] : null;
    }
    const normPhone = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').replace(/^55(?=1[1-9])/, '');
    const userCleanPhone = normPhone(targetId);
    const targetLower = targetId.toLowerCase();

    const matched = couriers.find(c => {
      if (!c) return false;
      if (c.id && c.id.toLowerCase() === targetLower) return true;
      const cPhoneClean = normPhone(c.phone);
      if (userCleanPhone.length >= 10 && cPhoneClean.length >= 10 && cPhoneClean === userCleanPhone) {
        return true;
      }
      return false;
    });
    if (matched) return matched;
    // In standalone mode (real driver phone), NEVER fallback to another driver's data
    return isStandalone ? null : (couriers.length > 0 ? couriers[0] : null);
  }, [couriers, standaloneCourierId, selectedDriverId, isStandalone]);

  // Check if delivery fee should be displayed on the driver device according to courier registration
  const canShowDeliveryFee = Boolean(
    selectedCourier?.showDeliveryFee ??
    (typeof window !== 'undefined' ? (() => {
      try {
        const op = JSON.parse(localStorage.getItem('vinimap_current_operator') || '{}');
        return op?.showDeliveryFee;
      } catch (_) {
        return false;
      }
    })() : false)
  );

  // Synchronize default driver selection when couriers load without erratic order-based flipping
  useEffect(() => {
    if (!isStandalone && couriers.length > 0) {
      const normPhone = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').replace(/^55(?=1[1-9])/, '');
      const cleanSelected = normPhone(selectedDriverId);
      const isAlreadyValid = couriers.some(c => {
        const cPhoneClean = normPhone(c.phone);
        return c.id === selectedDriverId || (cleanSelected.length >= 10 && cPhoneClean.length >= 10 && cleanSelected === cPhoneClean);
      });

      if (!selectedDriverId || !isAlreadyValid) {
        const targetId = couriers[0].id;
        setSelectedDriverId(targetId);
        localStorage.setItem('vinimap_driver_id', targetId);
      }
    }
  }, [couriers, isStandalone, selectedDriverId]);

  // Single-session check (Rule: Driver cannot be logged in on 2 devices simultaneously; Exception: Simulator inside system)
  useEffect(() => {
    if (!isStandalone || !selectedCourier) return;
    const localSessionToken = localStorage.getItem('vinimap_driver_session_token');
    if (!localSessionToken) return;

    const localDeviceId = localStorage.getItem('vinimap_device_id') || localStorage.getItem('vinimap_driver_device_id');

    // 1. If activeDeviceId matches localDeviceId, it is definitively the SAME phone/device!
    if (localDeviceId && selectedCourier.activeDeviceId && selectedCourier.activeDeviceId === localDeviceId) {
      return;
    }

    // 2. If session tokens match, it is the same session
    if (!selectedCourier.activeSessionToken || selectedCourier.activeSessionToken === localSessionToken) {
      return;
    }

    // 3. Check login timestamp: only revoke if the courier's login timestamp is strictly NEWER than local login
    const localLoginTimeStr = localStorage.getItem('vinimap_driver_login_time');
    const localLoginTime = localLoginTimeStr ? new Date(localLoginTimeStr).getTime() : 0;
    const serverLoginTime = selectedCourier.lastLoginAt ? new Date(selectedCourier.lastLoginAt).getTime() : 0;

    if (serverLoginTime > localLoginTime + 3000 && selectedCourier.activeDeviceId && localDeviceId && selectedCourier.activeDeviceId !== localDeviceId) {
      console.warn('[Driver Session Guard] Detected newer login token for courier on another device.');
      setRevokedDetails({
        time: selectedCourier.lastLoginAt ? new Date(selectedCourier.lastLoginAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
        device: selectedCourier.lastLoginDevice || 'Outro Celular'
      });
      setIsSessionRevoked(true);
    }
  }, [isStandalone, selectedCourier?.activeSessionToken, selectedCourier?.activeDeviceId, selectedCourier?.lastLoginAt]);

  // 2. Active server-side heartbeat for concurrent session invalidation
  useEffect(() => {
    if (!isStandalone || !selectedCourier?.id) return;
    const localSessionToken = localStorage.getItem('vinimap_driver_session_token');
    if (!localSessionToken) return;

    const checkServerSession = async () => {
      try {
        const localDeviceId = localStorage.getItem('vinimap_device_id') || localStorage.getItem('vinimap_driver_device_id');
        const res = await fetch('/api/driver/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courierId: selectedCourier.id,
            sessionToken: localSessionToken,
            deviceId: localDeviceId
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid === false && data.reason === 'different_device') {
            console.warn('[Driver Session Guard] Server confirmed login on another device.');
            setRevokedDetails({
              time: data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
              device: data.lastLoginDevice || 'Outro Celular'
            });
            setIsSessionRevoked(true);
          }
        }
      } catch (_) {}
    };

    const intervalId = setInterval(checkServerSession, 8000);
    return () => clearInterval(intervalId);
  }, [isStandalone, selectedCourier?.id]);

  const handleSelectDriver = (id: string) => {
    setSelectedDriverId(id);
    localStorage.setItem('vinimap_driver_id', id);
  };

  const [isUpdatingCourierStatus, setIsUpdatingCourierStatus] = useState(false);

  const handleUpdateCourierStatus = async (newStatus: 'online' | 'busy' | 'offline') => {
    if (!selectedCourier) return;
    setIsUpdatingCourierStatus(true);
    try {
      if (onUpdateCourier) {
        await onUpdateCourier(selectedCourier.id, { status: newStatus });
      } else {
        await fetch(`/api/couriers/${selectedCourier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      }
      if (onReorderOrders) {
        onReorderOrders();
      }
    } catch (err) {
      console.error('Erro ao atualizar status do condutor:', err);
    } finally {
      setIsUpdatingCourierStatus(false);
    }
  };

  const handleStatusChangeWithSync = async (orderId: string, nextStatus: OrderStatus, details?: any) => {
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(orderId, nextStatus, details);
      } else {
        const payload: any = {
          status: nextStatus,
          statusSincronizado: nextStatus,
          status_sincronizado: nextStatus,
          versionTimestamp: Date.now(),
          updatedAt: Date.now()
        };
        if (details) Object.assign(payload, details);
        await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      // Automatically switch courier to 'busy' when putting an order in route
      if (selectedCourier) {
        if (nextStatus === 'in_route' && selectedCourier.status !== 'busy') {
          handleUpdateCourierStatus('busy');
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar status no condutor:', err);
    }
  };

  const targetCourierId = selectedCourier?.id || selectedDriverId;

  // Helper to reliably check if an order is cancelled, deleted, mock, or obsolete
  const isCancelledOrObsolete = (o: Order | any): boolean => {
    if (!o || !o.id) return true;
    const idStr = String(o.id).trim().toUpperCase();
    const idNoPed = idStr.replace(/^PED-/i, '');
    const pedidoStr = o.pedido ? String(o.pedido).trim().toUpperCase() : '';
    const pedidoNoPed = pedidoStr.replace(/^PED-/i, '');

    // Permanently deleted order 01005 (PED-01005) must never appear on any courier screen
    if (
      idStr === '01005' || idStr === 'PED-01005' || idNoPed === '01005' ||
      pedidoStr === '01005' || pedidoStr === 'PED-01005' || pedidoNoPed === '01005'
    ) {
      return true;
    }

    const isCancelled = 
      o.status === 'cancelled' || 
      o.statusSincronizado === 'cancelled' || 
      o.status_sincronizado === 'cancelled' ||
      o.status === 'deleted' ||
      o.isDeleted === true ||
      o.deleted === true;
    const isObsoleteTest = 
      idStr === 'CLI-001-100' || 
      idStr.startsWith('MOCK-') ||
      idStr.startsWith('TEST-');

    if (isCancelled || isObsoleteTest) return true;

    // Check tombstone deleted IDs
    try {
      const raw = localStorage.getItem('vinimap_deleted_order_ids');
      if (raw) {
        const deletedArr = JSON.parse(raw);
        if (Array.isArray(deletedArr)) {
          if (
            deletedArr.includes(o.id) ||
            deletedArr.includes(idStr) ||
            (idNoPed && deletedArr.includes(idNoPed)) ||
            (pedidoStr && deletedArr.includes(pedidoStr)) ||
            (pedidoNoPed && deletedArr.includes(pedidoNoPed))
          ) {
            return true;
          }
        }
      }
    } catch (_) {}

    return false;
  };

  // Active cleanup: ensure any permanently deleted order (e.g. 01005) is removed from IndexedDB on the driver device
  useEffect(() => {
    removeFromStore('orders', 'PED-01005').catch(() => {});
    removeFromStore('orders', '01005').catch(() => {});
    try {
      const raw = localStorage.getItem('vinimap_deleted_order_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((dId: string) => {
            if (dId) removeFromStore('orders', dId).catch(() => {});
          });
        }
      }
    } catch (_) {}
  }, []);

  // Robust helper to check if an order belongs to the active driver/courier
  const driverMatchesOrder = (o: Order | any): boolean => {
    if (!o) return false;

    // Cancelled and obsolete orders must never be assigned or matched to driver active workflow
    if (isCancelledOrObsolete(o)) return false;

    // Isolate strictly by selected active courier
    if (!selectedCourier) return false;

    const normPhone = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').replace(/^55(?=1[1-9])/, '');
    const activeCourierId = String(selectedCourier.id || '').trim().toLowerCase();
    const activeCourierPhone = normPhone(selectedCourier.phone);

    // 1. Primary and definitive check: exact courier ID match
    const orderCourierId = o.courierId || o.driverId || o.entregadorId || o.motoristaId;
    if (orderCourierId && orderCourierId !== 'null' && orderCourierId !== 'undefined') {
      const ordCId = String(orderCourierId).trim().toLowerCase();
      return ordCId === activeCourierId;
    }

    // 2. Secondary fallback: exact phone match on dispositivoCondutor (ONLY if order has no courierId)
    const orderDevice = o.dispositivoCondutor || o.dispositivo_condutor || o.driverPhone;
    if (orderDevice && orderDevice !== 'null' && orderDevice !== 'undefined') {
      const ordNorm = normPhone(orderDevice);
      if (ordNorm.length >= 10 && activeCourierPhone.length >= 10 && ordNorm === activeCourierPhone) {
        return true;
      }
    }

    return false;
  };

  // Calculate statistics for active driver (strictly excluding cancelled and obsolete orders)
  const assignedOrders = React.useMemo(() => {
    return orders.filter(o => !isCancelledOrObsolete(o) && driverMatchesOrder(o));
  }, [orders, selectedCourier, selectedDriverId, standaloneCourierId]);

  const todayISO = React.useMemo(() => formatToBrasiliaISODate(new Date()), []);
  const todayFormatted = React.useMemo(() => formatToBrasiliaDate(new Date()), []);

  // Function to identify if an assigned order was delivered today
  const isOrderDeliveredToday = React.useCallback((o: Order): boolean => {
    if (o.status !== 'delivered') return false;

    // 1. Delivery Protocol signedAt
    if (o.deliveryProtocol?.signedAt) {
      const d = parseToISODate(o.deliveryProtocol.signedAt.split(' ')[0] || o.deliveryProtocol.signedAt, '');
      if (d === todayISO) return true;
      if (d && d !== todayISO) return false;
    }

    // 2. deliveredAt
    if (o.deliveredAt) {
      const d = parseToISODate(o.deliveredAt.split(' ')[0] || o.deliveredAt, '');
      if (d === todayISO) return true;
      if (d && d !== todayISO) return false;
    }

    // 3. History transition to delivered
    if (o.history && Array.isArray(o.history) && o.history.length > 0) {
      const delivEntry = [...o.history].reverse().find(h => h && h.status === 'delivered');
      if (delivEntry && delivEntry.time) {
        const dPart = delivEntry.time.split(' ')[0];
        const d = parseToISODate(dPart, '');
        if (d === todayISO) return true;
        if (d && d !== todayISO) return false;
      }
    }

    // 4. statusUpdatedAt
    if (o.statusUpdatedAt) {
      const ts = Number(o.statusUpdatedAt);
      if (ts > 0) {
        const d = formatToBrasiliaISODate(new Date(ts));
        if (d === todayISO) return true;
        if (d && d !== todayISO) return false;
      }
    }

    return false;
  }, [todayISO]);

  // Function to identify if an assigned order is active on the current day (pending or in_route for today)
  // Regra de Negócio: ao abrir o dia o dispositivo deve iniciar zerado, aguardando novos pedidos
  // e/ou realocações de pedidos pendentes pelo adm.
  const isOrderActiveToday = React.useCallback((o: Order): boolean => {
    const isPendingOrInRoute = o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress';
    if (!isPendingOrInRoute) return false;

    // 1. Check allocatedDate: if explicitly allocated for today
    if (o.allocatedDate) {
      const allocISO = parseToISODate(o.allocatedDate, '');
      if (allocISO === todayISO) return true;
      if (allocISO && allocISO !== todayISO) return false;
    }

    // 2. Check history for any transition event today
    if (o.history && Array.isArray(o.history) && o.history.length > 0) {
      const hasTodayActivity = o.history.some(h => {
        if (!h || !h.time) return false;
        const dPart = h.time.split(' ')[0];
        return parseToISODate(dPart, '') === todayISO;
      });
      if (hasTodayActivity) return true;
    }

    // 3. Check dataSolicitacao: only active today if requested today
    if (o.dataSolicitacao) {
      const solISO = parseToISODate(o.dataSolicitacao, '');
      if (solISO === todayISO) return true;
      if (solISO && solISO !== todayISO) return false;
    }

    // 4. Check order.createdAt or custom date property safely
    const customDate = (o as any).date || o.createdAt;
    if (customDate) {
      const dateISO = parseToISODate(customDate, '');
      if (dateISO === todayISO) return true;
      if (dateISO && dateISO !== todayISO) return false;
    }

    // Orders without a today date are pending reallocation by the admin and must not pollute today's zeroed start
    return false;
  }, [todayISO]);

  const totalAssigned = assignedOrders.length;
  const deliveredOrders = assignedOrders.filter(o => o.status === 'delivered' && (o.deliveryProtocol || o.proofPhotoUrl));

  // Orders active today (pendentes ou em rota ativos no dia atual - inicia zerado)
  const activeTodayOrders = React.useMemo(() => {
    return assignedOrders.filter(o => isOrderActiveToday(o));
  }, [assignedOrders, isOrderActiveToday]);

  const activeTodayCount = activeTodayOrders.length;
  const pendingTodayCount = activeTodayOrders.filter(o => o.status === 'pending').length;
  const inRouteTodayCount = activeTodayOrders.filter(o => o.status === 'in_route' || o.status === 'in_progress').length;

  // Orders delivered today (inicia zerado para o dia)
  const deliveredTodayOrders = React.useMemo(() => {
    return assignedOrders.filter(o => isOrderDeliveredToday(o));
  }, [assignedOrders, isOrderDeliveredToday]);

  const deliveredTodayCount = deliveredTodayOrders.length;
  const todayAssignedCount = activeTodayCount + deliveredTodayCount;

  // Filter orders for the selected courier with memoization (inicia o dia zerado)
  const driverOrders = React.useMemo(() => {
    const list = assignedOrders.filter(o => {
      // Active status filter (default): only shows orders active TODAY
      if (statusFilter === 'active') {
        if (!isOrderActiveToday(o)) return false;
      }
      if (statusFilter === 'pending') {
        if (!isOrderActiveToday(o) || o.status !== 'pending') return false;
      }
      if (statusFilter === 'in_route') {
        if (!isOrderActiveToday(o) || (o.status !== 'in_route' && o.status !== 'in_progress')) return false;
      }
      if (statusFilter === 'delivered') {
        if (!showAllDeliveredHistory) {
          if (!isOrderDeliveredToday(o)) return false;
        } else {
          if (o.status !== 'delivered') return false;
        }
      }
      if (statusFilter === 'all') {
        if (!isOrderActiveToday(o) && !isOrderDeliveredToday(o)) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchId = o.id.toLowerCase().includes(term);
        const matchCustomer = o.customerName?.toLowerCase().includes(term);
        const matchAddress = o.address?.toLowerCase().includes(term);
        const partnerName = getPartnerDisplayName(o).toLowerCase();
        const matchPartner = partnerName.includes(term);
        return matchId || matchCustomer || matchAddress || matchPartner;
      }

      return true;
    });

    return list;
  }, [assignedOrders, statusFilter, searchTerm, partnerClients, isOrderActiveToday, isOrderDeliveredToday, showAllDeliveredHistory]);

  // Audio chime and alert banner ONLY when a genuinely brand new order ID is allocated
  useEffect(() => {
    const currentActiveIds = assignedOrders
      .filter(o => o.status === 'pending' || o.status === 'in_route')
      .map(o => o.id);

    // Initial mount: record existing order IDs without ringing alerts
    if (knownAssignedOrderIdsRef.current === null) {
      knownAssignedOrderIdsRef.current = new Set(currentActiveIds);
      return;
    }

    // Check for genuinely new orders that arrived after mount
    const newlyArrivedId = currentActiveIds.find(id => !knownAssignedOrderIdsRef.current?.has(id));

    if (newlyArrivedId) {
      const newest = assignedOrders.find(o => o.id === newlyArrivedId);
      if (newest) {
        const pName = getPartnerDisplayName(newest);
        setNewOrderAlert(`Novo Pedido #${newest.id} alocado para você! ${pName ? `• Parceiro: ${pName}` : `• ${newest.customerName || 'Cliente'}`}`);
        
        // Sound notification
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.14); // G5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch (_) {}

        // Vibration
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch (_) {}

        setTimeout(() => setNewOrderAlert(null), 8000);
      }
    }

    // Keep known IDs set synchronized
    knownAssignedOrderIdsRef.current = new Set(currentActiveIds);
  }, [assignedOrders]);

  const handleConfirmProtocol = async (orderId: string, protocolData: any) => {
    const now = new Date();
    const brDate = formatToBrasiliaDate(now);
    const brTime = formatToBrasiliaTime(now, true);
    const fullDateTime = `${brDate} ${brTime}`;

    await handleStatusChangeWithSync(orderId, 'delivered', {
      deliveryProtocol: {
        signedName: protocolData.signedName,
        signedDoc: protocolData.signedDoc,
        signatureData: protocolData.signatureData,
        signedAt: fullDateTime,
        photoUrl: protocolData.photoUrl,
        notes: protocolData.notes
      },
      proofPhotoUrl: protocolData.photoUrl,
      signatureDataUrl: protocolData.signatureData,
      receiverName: protocolData.signedName,
      receiverDoc: protocolData.signedDoc,
      deliveredAt: fullDateTime
    });
  };

  return (
    <div className={`transition-all ${isStandalone || isFullScreen ? 'fixed inset-0 z-50 bg-white p-0 overflow-hidden flex flex-col w-full h-full min-h-screen' : 'my-6 bg-white'}`}>
      
      {/* Container header (only when in embedded preview inside admin dashboard) */}
      {!isFullScreen && !isStandalone && (
        <div className="bg-white p-5 rounded-3xl border-2 border-slate-200 shadow-sm mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                <span>Aplicativo do Condutor</span>
                <span className="text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 px-3 py-0.5 rounded-full uppercase">
                  PWA Mobile
                </span>
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Interface oficial de campo com fundo branco de alta clareza, fontes ampliadas, rota GPS e assinatura digital
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => setIsPwaModalOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={16} />
              <span>Baixar / Instalar App</span>
            </button>

            <button
              onClick={() => setIsFullScreen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize2 size={16} />
              <span>Ocupar Tela Cheia</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Driver Phone Device Screen Viewport (High-Clarity Light Theme) */}
      <div className={`mx-auto bg-white text-slate-900 flex flex-col transition-all relative overflow-hidden ${
        isStandalone || isFullScreen 
          ? 'w-full h-full flex-1 rounded-none border-0 shadow-none' 
          : 'max-w-md w-full h-[780px] rounded-[36px] border-8 border-slate-300 shadow-2xl'
      }`}>

        {/* Top Device Bar & Driver Header */}
        <div className="bg-white border-b-2 border-slate-200 p-3.5 sm:p-4 space-y-3 shrink-0 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2 overflow-hidden">
              {branding?.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt={branding.appName || 'Logo'} 
                  className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0 border border-slate-300" 
                />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              )}
              <span className="font-black text-slate-900 text-base sm:text-lg truncate">
                {branding?.appName || 'ViniMap'} Driver
              </span>
              <button
                onClick={handleManualRefresh}
                title="Sincronizar pedidos com a central em tempo real"
                className="text-xs text-emerald-900 font-black bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-full border border-emerald-300 shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                <span>● GPS / Sync</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                title="Diagnóstico do Aplicativo & Limpeza de Pedidos Antigos"
                className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 flex items-center gap-1 text-xs font-bold cursor-pointer transition-colors"
              >
                <Activity size={15} className="animate-pulse text-blue-600" />
                <span className="hidden sm:inline">Diagnóstico</span>
              </button>

              <button
                onClick={handleManualRefresh}
                title="Atualizar Pedidos"
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1 text-xs font-bold cursor-pointer transition-colors"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>

              <button
                onClick={handleTriggerInstall}
                title="Instalar aplicativo no celular"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-black shadow-md shadow-emerald-600/30 cursor-pointer transition-all shrink-0"
              >
                <Download size={15} className="animate-bounce" />
                <span>Instalar</span>
              </button>

              {isStandalone && onLogoutStandalone && (
                <button
                  onClick={onLogoutStandalone}
                  title="Desconectar da conta do condutor"
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center gap-1 text-xs font-bold cursor-pointer transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sair</span>
                </button>
              )}

              {isFullScreen && !isStandalone && (
                <button
                  onClick={() => setIsFullScreen(false)}
                  title="Sair da tela cheia"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <Minimize2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Active Driver Selector (Crisp Pure White Card with Large Fonts) */}
          <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-300 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={selectedCourier?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                  alt={selectedCourier?.name || 'Condutor'}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shrink-0 shadow-sm"
                />
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-black uppercase tracking-wider block">Condutor Conectado</span>
                    {!isStandalone && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">Simulador</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-base sm:text-lg text-slate-900 truncate">
                      {selectedCourier?.name || 'Condutor Conectado'}
                    </h4>
                    {selectedCourier?.phone && (
                      <span className="text-sm text-emerald-700 font-bold font-mono block">
                        {selectedCourier.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                {!isStandalone && couriers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase hidden md:inline">Condutor:</label>
                    <select
                      value={selectedCourier?.id || selectedDriverId}
                      onChange={(e) => handleSelectDriver(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer shadow-xs"
                      title="Selecionar qual condutor simular na tela"
                    >
                      {couriers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <span className="text-sm font-black bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-full shadow-xs">
                  {deliveredTodayCount}/{todayAssignedCount} Entregas Hoje
                </span>
              </div>
            </div>

            {/* Real-time Driver Status Controls */}
            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-200">
              <span className="text-xs sm:text-sm text-slate-700 font-black uppercase flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${
                  selectedCourier?.status === 'online' ? 'bg-emerald-500 animate-pulse' :
                  selectedCourier?.status === 'busy' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                }`} />
                Status em Campo:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('online')}
                  disabled={isUpdatingCourierStatus}
                  title="Disponível para novas entregas"
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    selectedCourier?.status === 'online' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  ● Livre
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('busy')}
                  disabled={isUpdatingCourierStatus}
                  title="Em rota ativa"
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    selectedCourier?.status === 'busy' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  ● Em Rota
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('offline')}
                  disabled={isUpdatingCourierStatus}
                  title="Pausa ou fora de expediente"
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    selectedCourier?.status === 'offline' 
                      ? 'bg-slate-700 text-white shadow-xs' 
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  ● Pausa
                </button>
              </div>
            </div>
          </div>

          {/* Card em Destaque: Ativos no Dia Atual (Vibrant Blue Card) */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 rounded-2xl text-white shadow-md">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                </span>
                <span className="text-sm font-black uppercase tracking-wider text-blue-100 flex items-center gap-1.5 truncate">
                  <Calendar size={15} className="text-blue-200 shrink-0" />
                  Ativos no Dia Atual
                </span>
              </div>
              <span className="text-xs bg-white/20 text-white font-black px-3 py-1 rounded-full border border-white/30 shrink-0">
                {todayFormatted}
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-white/20">
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl sm:text-5xl font-black text-white leading-none tracking-tight">{activeTodayCount}</span>
                <span className="text-sm sm:text-base font-bold text-blue-100">pedidos ativos hoje</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span className="bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-400/30 font-black">
                  {pendingTodayCount} pend.
                </span>
                <span className="bg-blue-400/30 text-blue-100 px-2.5 py-1 rounded-lg border border-blue-300/30 font-black">
                  {inRouteTodayCount} rota
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar (Crisp White Tiles with Extra Large Numbers) */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-blue-300 shadow-xs">
              <span className="text-xs text-blue-800 font-black uppercase block truncate" title="Pendentes ou em rota no dia atual">Ativos Hoje</span>
              <span className="text-2xl sm:text-3xl font-black text-blue-800">{activeTodayCount}</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border-2 border-amber-300 shadow-xs">
              <span className="text-xs text-amber-800 font-black uppercase block truncate">Pendentes</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-600">{pendingTodayCount}</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border-2 border-blue-300 shadow-xs">
              <span className="text-xs text-blue-800 font-black uppercase block truncate">Em Rota</span>
              <span className="text-2xl sm:text-3xl font-black text-blue-600">{inRouteTodayCount}</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border-2 border-emerald-300 shadow-xs">
              <span className="text-xs text-emerald-800 font-black uppercase block truncate">Entregues</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600">{deliveredTodayCount}</span>
            </div>
          </div>
        </div>

        {/* Tab Content Area (Pure White High Clarity Background) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 bg-white">

          {/* New Order Alert Banner */}
          {newOrderAlert && (
            <div className="bg-emerald-600 border-2 border-emerald-400 text-white p-3.5 rounded-2xl shadow-lg flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 bg-white/20 rounded-xl shrink-0">
                  <Bell size={20} className="text-white" />
                </div>
                <span className="text-sm font-black truncate">{newOrderAlert}</span>
              </div>
              <button 
                onClick={() => setNewOrderAlert(null)}
                className="text-xs font-black bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-xl shrink-0 cursor-pointer shadow-xs"
              >
                Ver Pedido
              </button>
            </div>
          )}

          {/* TAB 1: ENTREGAS (CARDS PADRÕES AMPLIADOS) */}
          {activeTab === 'orders' && (
            <div className="space-y-3.5">
              
              {/* Installation Banner */}
              {!isStandalone && (
                <div className="bg-white border-2 border-emerald-300 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Smartphone size={20} />
                    </div>
                    <div className="truncate">
                      <h5 className="font-black text-sm text-slate-900 truncate flex items-center gap-1.5">
                        <span>Instalar App do Condutor</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 font-black">PWA</span>
                      </h5>
                      <p className="text-xs text-slate-600 truncate font-medium">Acesso rápido em tela cheia, GPS e modo offline</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerInstall}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shrink-0 flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer transition-all"
                  >
                    <Download size={14} />
                    <span>Instalar</span>
                  </button>
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="space-y-3">
                <div className="relative">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, destinatário, endereço..."
                    className="w-full bg-white border-2 border-slate-300 text-base sm:text-lg py-3.5 pl-12 pr-4 rounded-2xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 font-bold shadow-xs"
                  />
                </div>

                {/* Filter Pills with Enlarged Fonts */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-black">
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      statusFilter === 'active'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>A Entregar (Hoje)</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${statusFilter === 'active' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {activeTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Pendentes</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${statusFilter === 'pending' ? 'bg-amber-600 text-slate-950' : 'bg-slate-100 text-slate-800'}`}>
                      {pendingTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('in_route')}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      statusFilter === 'in_route'
                        ? 'bg-blue-600 text-white border-blue-600 font-black shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Em Rota</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${statusFilter === 'in_route' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {inRouteTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('delivered')}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      statusFilter === 'delivered'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Concluídas</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${statusFilter === 'delivered' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {deliveredTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      statusFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Todas (Hoje)</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {todayAssignedCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* Historical Delivered Toggle when viewing delivered */}
              {statusFilter === 'delivered' && deliveredOrders.length > deliveredTodayCount && (
                <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-semibold">
                    {showAllDeliveredHistory 
                      ? `Exibindo histórico completo (${deliveredOrders.length} entregas)` 
                      : `Dia iniciado zerado • ${deliveredOrders.length - deliveredTodayCount} entregas em dias anteriores`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllDeliveredHistory(!showAllDeliveredHistory)}
                    className="text-xs font-black text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    {showAllDeliveredHistory ? 'Exibir apenas hoje' : 'Ver histórico anterior'}
                  </button>
                </div>
              )}

              {/* Summary Banner of Active Orders Today */}
              <div className="p-4 bg-white border-2 border-blue-300 rounded-2xl shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Package size={22} />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-black uppercase text-blue-800 tracking-wider block">Fila Ativa no Dia Atual</span>
                    <h5 className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {activeTodayCount === 0 
                        ? 'Dia iniciado zerado • Aguardando novos pedidos' 
                        : `${activeTodayCount} ${activeTodayCount === 1 ? 'pedido ativo' : 'pedidos ativos'} para entrega`}
                    </h5>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs sm:text-sm font-black">
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-xl" title="Pedidos pendentes aguardando início">
                    {pendingTodayCount} pend.
                  </span>
                  <span className="bg-blue-100 text-blue-900 border border-blue-300 px-3 py-1 rounded-xl" title="Pedidos atualmente em rota de entrega">
                    {inRouteTodayCount} rota
                  </span>
                </div>
              </div>

              {/* Delivery Cards List (Fundo Branco, Fonte Ampliada, Clique para Super Zoom) */}
              {driverOrders.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border-2 border-slate-300 text-center space-y-4 my-4 shadow-sm">
                  <Package size={44} className="mx-auto text-slate-400" />
                  <div>
                    <p className="text-base font-black text-slate-900">
                      {statusFilter === 'delivered' ? 'Nenhuma entrega concluída hoje' : 'Dia iniciado zerado • Aguardando novos pedidos'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {statusFilter === 'delivered'
                        ? 'As entregas finalizadas no dia de hoje aparecerão aqui após a assinatura do comprovante.'
                        : 'Nenhum pedido ativo no momento. O dia inicia zerado aguardando novas entregas serem despachadas ou realocadas pelo administrador.'}
                    </p>
                  </div>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black shadow-md transition-all cursor-pointer"
                  >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>Verificar Novos Pedidos</span>
                  </button>
                </div>
              ) : (
                driverOrders.map((order, idx) => {
                  const isDelivered = order.status === 'delivered';
                  const isInRoute = order.status === 'in_route' || order.status === 'in_progress';
                  const isPending = order.status === 'pending';

                  const rawPhone = (order.telefone || order.phone || '').trim();
                  const digitsOnlyPhone = rawPhone.replace(/\D/g, '');
                  const hasRealPhone = digitsOnlyPhone.length >= 8;
                  const recipientPhone = hasRealPhone ? digitsOnlyPhone : '';
                  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(order.address)}`;
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
                  const whatsappUrl = hasRealPhone 
                    ? `https://wa.me/55${recipientPhone}?text=Olá%20${encodeURIComponent(order.customerName || 'Cliente')},%20sou%20o%20entregador%20da%20ViniMap%20com%20sua%20encomenda%20${order.id}.`
                    : '';

                  return (
                    /* CARD PADRÃO DE ENTREGA DO CONDUTOR (CLIQUE EXPANDIDO / SUPER ZOOM) */
                    <div
                      key={order.id}
                      onClick={() => setExpandedOrder(order)}
                      title="Toque no card para ampliar a exibição na tela cheia"
                      className={`p-4 sm:p-5 rounded-3xl border-2 transition-all space-y-4 relative overflow-hidden shadow-sm hover:shadow-md cursor-pointer ${
                        isDelivered
                          ? 'bg-white border-emerald-500 shadow-emerald-500/10'
                          : isInRoute
                          ? 'bg-white border-blue-600 ring-2 ring-blue-500/30 shadow-blue-500/15'
                          : 'bg-white border-slate-300 hover:border-blue-500'
                      }`}
                    >
                      {/* Top Order Tag & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-black text-lg sm:text-xl text-blue-700 tracking-tight shrink-0">#{order.id}</span>
                          <span 
                            className="text-xs sm:text-sm font-black bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-xl flex items-center gap-1.5 shrink-0"
                            title="Posição nesta rota / Total de pedidos ativos hoje"
                          >
                            <Calendar size={14} className="text-blue-600" />
                            <span>{idx + 1} de {activeTodayCount || driverOrders.length} hoje</span>
                          </span>
                          {getPartnerDisplayName(order) && (
                            <span 
                              className="text-xs sm:text-sm font-bold bg-white text-slate-900 border border-slate-300 px-3 py-1 rounded-xl flex items-center gap-1.5 truncate max-w-[220px]"
                              title={`Cliente Parceiro: ${getPartnerDisplayName(order)}`}
                            >
                              <Building2 size={13} className="text-blue-600 shrink-0" />
                              <span className="truncate">{getPartnerDisplayName(order)}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div 
                            className="text-xs sm:text-sm font-black text-blue-900 bg-blue-100 hover:bg-blue-200 border border-blue-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                            title="Clique para ver este pedido em tela cheia com letras grandes"
                          >
                            <ZoomIn size={15} className="text-blue-700" />
                            <span>Ampliar</span>
                          </div>

                          <span className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                              : isInRoute
                              ? 'bg-blue-100 text-blue-900 border border-blue-400 animate-pulse'
                              : 'bg-amber-100 text-amber-900 border border-amber-400'
                          }`}>
                            {isDelivered && <CheckCircle2 size={15} />}
                            {isInRoute && <Truck size={15} />}
                            <span>{order.status === 'in_route' ? 'Em Rota' : order.status === 'delivered' ? 'Entregue' : 'Pendente'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Default Banner on Card: Total Ativos no Dia Atual (Pendentes / Em Rota) */}
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold">
                        <div className="flex items-center gap-2 text-slate-700 truncate">
                          <Package size={15} className="text-blue-600 shrink-0" />
                          <span className="text-slate-600 font-bold">Ativos no dia:</span>
                          <span className="text-slate-900 font-black">{activeTodayCount} pedidos</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-black shrink-0">
                          <span className="text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                            {pendingTodayCount} pend.
                          </span>
                          <span className="text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-300">
                            {inRouteTodayCount} em rota
                          </span>
                        </div>
                      </div>

                      {/* Customer & Address Details (Enlarged Fonts for Quick Driver Glance) */}
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 truncate">
                            <span className="text-xs text-slate-500 font-black uppercase tracking-wider block">Destinatário:</span>
                            <h4 className="font-black text-xl sm:text-2xl text-slate-900 leading-snug truncate">
                              {order.customerName || order.procurarPor || 'Destinatário'}
                            </h4>
                          </div>
                          {canShowDeliveryFee && (
                            <span className="text-lg sm:text-xl font-black text-emerald-700 shrink-0 pt-1">
                              R$ {(order.valorEntrega || order.value || 15).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* High-Clarity Address Box with Extra Large Font */}
                        <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border-2 border-slate-300 flex items-start gap-3">
                          <MapPin size={22} className="text-red-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-base sm:text-lg text-slate-950 font-black leading-snug">
                              {order.address}
                              {order.numero ? `, nº ${order.numero}` : ''}
                              {order.complemento ? ` (${order.complemento})` : ''}
                            </p>
                            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 flex-wrap pt-1.5 border-t border-slate-200 mt-1.5">
                              {order.bairro && <span>Bairro: <strong className="text-slate-950">{order.bairro}</strong></span>}
                              {order.cidadeMunicipio && <span>• Cidade: <strong className="text-slate-950">{order.cidadeMunicipio}</strong></span>}
                              {order.cep && <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900 font-bold">CEP: {order.cep}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Customer Contact Badges (Telefone e Email) */}
                        <div className="flex items-center gap-3 pt-0.5 text-xs sm:text-sm flex-wrap">
                          {hasRealPhone ? (
                            <a 
                              href={`tel:${recipientPhone}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-2 font-black text-emerald-950 font-mono bg-emerald-50 border-2 border-emerald-300 px-3.5 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Clique para discar diretamente para o cliente"
                            >
                              <PhoneCall size={15} className="text-emerald-700" />
                              <span className="text-sm sm:text-base">{rawPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Tel: Não informado</span>
                          )}

                          {order.email && (
                            <span className="text-slate-700 text-sm truncate max-w-[240px] font-medium" title={order.email}>
                              ✉ {order.email}
                            </span>
                          )}
                        </div>

                        {order.volume && (
                          <p className="text-sm text-slate-700 font-bold flex items-center gap-1.5 pt-0.5 font-mono">
                            <Package size={15} className="text-blue-600" />
                            <span>Volume: {order.volume}</span>
                          </p>
                        )}
                      </div>

                      {/* Quick Communication & GPS Bar */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-xs sm:text-sm font-black">
                        {/* OPÇÃO PRÁTICA DE LIGAR PARA O CLIENTE */}
                        <a
                          href={hasRealPhone ? `tel:${recipientPhone}` : '#'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hasRealPhone) {
                              e.preventDefault();
                              const inputNumber = window.prompt(
                                `Nenhum telefone cadastrado para o pedido #${order.id} (${order.customerName || 'Cliente'}).\n\nDigite o número de telefone com DDD para efetuar a ligação direta:`
                              );
                              if (inputNumber) {
                                const cleanDigits = inputNumber.replace(/\D/g, '');
                                if (cleanDigits) {
                                  window.location.href = `tel:${cleanDigits}`;
                                }
                              }
                            }
                          }}
                          className={`py-3 px-2 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            hasRealPhone
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300'
                          }`}
                          title={hasRealPhone ? `Ligar para o cliente: ${rawPhone}` : 'Digitar número e ligar para o cliente'}
                        >
                          <PhoneCall size={16} className={hasRealPhone ? 'text-white' : 'text-emerald-700'} />
                          <span>Ligar</span>
                        </a>

                        <a
                          href={hasRealPhone ? whatsappUrl : '#'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hasRealPhone) {
                              e.preventDefault();
                              const inputNumber = window.prompt(
                                `Nenhum telefone cadastrado para o pedido #${order.id}.\nDigite o número do WhatsApp com DDD:`
                              );
                              if (inputNumber) {
                                const cleanDigits = inputNumber.replace(/\D/g, '');
                                if (cleanDigits) {
                                  window.open(`https://wa.me/55${cleanDigits}?text=Olá%20${encodeURIComponent(order.customerName || 'Cliente')},%20sou%20o%20entregador%20da%20ViniMap%20com%20sua%20encomenda%20${order.id}.`, '_blank');
                                }
                              }
                            }
                          }}
                          target={hasRealPhone ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="py-3 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                          title="Enviar mensagem no WhatsApp do cliente"
                        >
                          <MessageSquare size={16} />
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="py-3 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                          title="Abrir rota no Waze GPS"
                        >
                          <Navigation size={16} />
                          <span>Waze</span>
                        </a>
                      </div>

                      {/* Main Driver Route Action Buttons */}
                      <div className="pt-2">
                        {isPending && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChangeWithSync(order.id, 'in_route');
                            }}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                          >
                            <Truck size={20} />
                            <span>INICIAR ROTA DESTE PEDIDO</span>
                          </button>
                        )}

                        {isInRoute && (
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForProtocol(order);
                              }}
                              className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                            >
                              <Camera size={18} />
                              <span>Concluir Entrega</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChangeWithSync(order.id, 'failure', { note: 'Tentativa de entrega falhou - Ausente' });
                              }}
                              className="py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                            >
                              <AlertTriangle size={17} />
                              <span>Ocorrência</span>
                            </button>
                          </div>
                        )}

                        {isDelivered && (
                          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-xs sm:text-sm">
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                              <div className="truncate">
                                <span className="font-black text-emerald-950 block truncate text-sm sm:text-base">
                                  Recebido por: {order.deliveryProtocol?.signedName || order.receiverName || 'Cliente'}
                                </span>
                                <span className="text-xs text-slate-600 font-mono font-bold">
                                  {order.deliveredAt || 'Entregue com Sucesso'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForProtocol(order);
                              }}
                              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-xs sm:text-sm font-black text-slate-900 rounded-xl shrink-0 border-2 border-slate-300 shadow-xs transition-colors cursor-pointer"
                            >
                              Ver Protocolo
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              )}

            </div>
          )}

          {/* TAB 2: ROTA GPS */}
          {activeTab === 'gps' && (
            <div className="space-y-3.5">
              <div className="p-4 bg-white rounded-3xl border-2 border-slate-300 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-base text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Navigation size={20} className="text-blue-600" />
                    <span>Sequência de Paradas</span>
                  </h4>
                  <span className="text-xs sm:text-sm bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-full font-black">
                    {assignedOrders.filter(o => o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress').length} paradas
                  </span>
                </div>

                <div className="space-y-3">
                  {assignedOrders.filter(o => o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress').map((ord, idx) => {
                    const pName = getPartnerDisplayName(ord);
                    const ordPhone = (ord.telefone || ord.phone || '').trim();
                    const ordDigits = ordPhone.replace(/\D/g, '');
                    const hasOrdPhone = ordDigits.length >= 8;

                    return (
                      <div 
                        key={ord.id} 
                        onClick={() => setExpandedOrder(ord)}
                        className="p-4 bg-white hover:bg-blue-50/30 rounded-2xl border-2 border-slate-300 hover:border-blue-500 flex items-center justify-between gap-3 transition-colors cursor-pointer shadow-xs"
                        title="Toque no card para ampliar este pedido"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {idx + 1}
                          </div>
                          <div className="truncate">
                            {pName && (
                              <span className="text-xs sm:text-sm font-bold text-blue-700 flex items-center gap-1 truncate mb-0.5">
                                <Building2 size={13} className="shrink-0" />
                                <span className="truncate">{pName}</span>
                              </span>
                            )}
                            <p className="font-black text-base sm:text-lg text-slate-900 truncate">{ord.customerName}</p>
                            <p className="text-sm text-slate-700 truncate font-semibold">
                              {ord.address}{ord.numero ? `, nº ${ord.numero}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={hasOrdPhone ? `tel:${ordDigits}` : '#'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasOrdPhone) {
                                e.preventDefault();
                                const inputPhone = window.prompt(
                                  `O pedido #${ord.id} (${ord.customerName}) não tem telefone cadastrado. Digite o número com DDD para discar:`
                                );
                                if (inputPhone) {
                                  const clean = inputPhone.replace(/\D/g, '');
                                  if (clean) window.location.href = `tel:${clean}`;
                                }
                              }
                            }}
                            className={`p-3 rounded-2xl flex items-center justify-center transition-all ${
                              hasOrdPhone
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300'
                            }`}
                            title={hasOrdPhone ? `Ligar para ${ord.customerName}: ${ordPhone}` : 'Digitar número e ligar'}
                          >
                            <PhoneCall size={16} />
                          </a>

                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(ord.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 shadow-xs"
                            title="Navegar no Waze"
                          >
                            <ExternalLink size={15} />
                            <span>Waze</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROTOCOLOS SALVOS */}
          {activeTab === 'protocols' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck2 size={20} className="text-emerald-600" />
                  <span>Histórico de Protocolos</span>
                </h4>
                <span className="text-xs sm:text-sm bg-emerald-50 text-emerald-900 border border-emerald-300 font-black px-3 py-1 rounded-full">
                  {deliveredOrders.length} comprovantes
                </span>
              </div>

              {deliveredOrders.length === 0 ? (
                <div className="p-8 bg-white border-2 border-slate-300 rounded-3xl text-center space-y-3 shadow-sm">
                  <ShieldCheck size={44} className="mx-auto text-slate-400" />
                  <p className="text-base font-black text-slate-900">Nenhum protocolo registrado ainda.</p>
                  <p className="text-sm text-slate-600">Conclua entregas com foto e assinatura para visualizar os comprovantes aqui.</p>
                </div>
              ) : (
                deliveredOrders.map((ord) => {
                  const proto = ord.deliveryProtocol;
                  const photo = proto?.photoUrl || ord.proofPhotoUrl;
                  const sig = proto?.signatureData || ord.signatureDataUrl;
                  const pName = getPartnerDisplayName(ord);

                  return (
                    <div 
                      key={ord.id} 
                      onClick={() => setExpandedOrder(ord)}
                      className="p-5 bg-white border-2 border-slate-300 rounded-3xl space-y-4 shadow-sm hover:border-blue-500 cursor-pointer transition-all"
                      title="Toque no card para ampliar este comprovante"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-black text-base sm:text-lg text-blue-700">#{ord.id}</span>
                          {pName && (
                            <span className="text-xs sm:text-sm font-bold bg-white text-slate-900 border border-slate-300 px-2.5 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[200px]">
                              <Building2 size={13} className="shrink-0 text-blue-600" />
                              <span className="truncate">{pName}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm text-slate-600 font-mono font-bold shrink-0">{proto?.signedAt || ord.deliveredAt}</span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-base sm:text-lg font-black text-slate-900">{proto?.signedName || ord.customerName}</p>
                        <p className="text-sm text-slate-700 font-semibold">{ord.address}</p>
                        {proto?.signedDoc && <p className="text-xs sm:text-sm text-slate-600 font-mono font-bold">Doc: {proto.signedDoc}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {photo && (
                          <div className="space-y-1">
                            <span className="text-xs font-black text-slate-600 uppercase block">Foto Comprovante:</span>
                            <img src={photo} alt="Foto comprovante" className="w-full h-28 object-cover rounded-2xl border-2 border-slate-300 shadow-xs" />
                          </div>
                        )}

                        {sig && (
                          <div className="space-y-1">
                            <span className="text-xs font-black text-slate-600 uppercase block">Assinatura Digital:</span>
                            <div className="bg-slate-50 p-2 rounded-2xl border-2 border-slate-300 flex items-center justify-center h-28">
                              <img src={sig} alt="Assinatura" className="max-h-24 object-contain" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWhatsappModalOrder(ord);
                          }}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                          <span>Enviar Protocolo via WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: INSTALAR APP */}
          {activeTab === 'install' && (
            <div className="p-6 sm:p-8 bg-white border-2 border-slate-300 rounded-3xl space-y-5 text-center shadow-sm">
              {branding?.logoUrl ? (
                <div className="w-24 h-24 bg-white p-3 rounded-3xl border-2 border-slate-300 shadow-md mx-auto flex items-center justify-center">
                  <img src={branding.logoUrl} alt={branding.appName || 'Logo'} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-emerald-50 text-emerald-700 border-2 border-emerald-300 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                  <Smartphone size={36} />
                </div>
              )}
              
              <div>
                <h4 className="font-black text-xl text-slate-900">{branding?.appName || 'App do Condutor'}</h4>
                <p className="text-sm text-emerald-700 font-black">Base Oficial de Entregadores</p>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  O aplicativo PWA funciona em qualquer smartphone Android ou iPhone com acesso offline, rota GPS e comprovante com foto e assinatura.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleTriggerInstall}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Download size={20} className="animate-bounce" />
                  <span>Baixar & Instalar no Celular</span>
                </button>

                <button
                  onClick={() => setIsPwaModalOpen(true)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-sm rounded-2xl border-2 border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Ver Guia Completo & QR Code</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Mobile Navigation Bar (High Clarity Pure White) */}
        <div className="bg-white border-t-2 border-slate-200 p-2.5 sm:p-3 grid grid-cols-4 gap-1.5 shrink-0 text-center select-none shadow-lg">
          <button
            onClick={() => setActiveTab('orders')}
            className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'orders' ? 'text-blue-700 bg-blue-50 font-black shadow-xs' : 'text-slate-500 hover:text-slate-900 font-bold'
            }`}
          >
            <Package size={22} />
            <span className="text-xs sm:text-sm font-black">Entregas</span>
          </button>

          <button
            onClick={() => setActiveTab('gps')}
            className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'gps' ? 'text-blue-700 bg-blue-50 font-black shadow-xs' : 'text-slate-500 hover:text-slate-900 font-bold'
            }`}
          >
            <Navigation size={22} />
            <span className="text-xs sm:text-sm font-black">Rota GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('protocols')}
            className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'protocols' ? 'text-emerald-700 bg-emerald-50 font-black shadow-xs' : 'text-slate-500 hover:text-slate-900 font-bold'
            }`}
          >
            <FileCheck2 size={22} />
            <span className="text-xs sm:text-sm font-black">Protocolos</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`p-2 rounded-2xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'install' ? 'text-amber-700 bg-amber-50 font-black shadow-xs' : 'text-slate-500 hover:text-slate-900 font-bold'
            }`}
          >
            <Download size={22} />
            <span className="text-xs sm:text-sm font-black">Baixar App</span>
          </button>
        </div>

      </div>

      {/* SUPER-ZOOM / EXPANDED ORDER VIEW (AO CLICAR NO CARD DO PEDIDO, AUMENTA A EXIBIÇÃO VOLTANDO AO NORMAL APÓS UM CLIQUE NA TELA) */}
      {expandedOrder && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto cursor-pointer animate-in fade-in duration-150"
          onClick={() => setExpandedOrder(null)}
          title="Toque em qualquer lugar da tela para fechar e voltar ao normal"
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 shadow-2xl border-4 border-blue-600 space-y-4 my-auto relative cursor-pointer animate-in zoom-in-95 duration-150"
            onClick={() => {
              // Clicking anywhere on the card container also dismisses and returns to normal
              setExpandedOrder(null);
            }}
          >
            {/* Top Close / Dismiss Banner */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setExpandedOrder(null);
              }}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-center text-xs sm:text-sm font-black flex items-center justify-between cursor-pointer transition-colors shadow-md active:scale-[0.99]"
            >
              <span className="flex items-center gap-2">
                <Minimize2 size={18} />
                <span>MODO AMPLIADO • Toque na tela para voltar</span>
              </span>
              <span className="bg-white text-blue-700 rounded-full p-1 shadow-xs">
                <X size={16} />
              </span>
            </div>

            {/* Big Order Header */}
            <div className="flex items-center justify-between gap-2 border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-wider block">Código do Pedido</span>
                <h2 className="text-3xl sm:text-4xl font-black text-blue-700 tracking-tight">#{expandedOrder.id}</h2>
              </div>
              <span className={`text-xs sm:text-sm font-black px-4 py-2 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                expandedOrder.status === 'delivered'
                  ? 'bg-emerald-100 text-emerald-900 border-2 border-emerald-400'
                  : expandedOrder.status === 'in_route' || expandedOrder.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-900 border-2 border-blue-400 animate-pulse'
                  : 'bg-amber-100 text-amber-900 border-2 border-amber-400'
              }`}>
                {expandedOrder.status === 'delivered' && <CheckCircle2 size={18} />}
                {(expandedOrder.status === 'in_route' || expandedOrder.status === 'in_progress') && <Truck size={18} />}
                {expandedOrder.status === 'in_route' || expandedOrder.status === 'in_progress' ? 'Em Rota Ativa' : expandedOrder.status === 'delivered' ? 'Entregue' : 'Pendente'}
              </span>
            </div>

            {/* Partner / Empresa Name if available */}
            {getPartnerDisplayName(expandedOrder) && (
              <div className="bg-slate-100 p-3.5 rounded-2xl border-2 border-slate-200 flex items-center gap-3">
                <Building2 size={24} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-500 font-extrabold uppercase block">Empresa Parceira:</span>
                  <strong className="text-base sm:text-lg font-black text-slate-900 truncate block">{getPartnerDisplayName(expandedOrder)}</strong>
                </div>
              </div>
            )}

            {/* Destinatário (Extra Large Font) */}
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-wider block">Destinatário:</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {expandedOrder.customerName || expandedOrder.procurarPor || 'Destinatário'}
              </h3>
              {expandedOrder.procurarPor && expandedOrder.procurarPor !== expandedOrder.customerName && (
                <p className="text-base font-bold text-slate-700">
                  Procurar por: <strong className="text-slate-950 font-black">{expandedOrder.procurarPor}</strong>
                </p>
              )}
            </div>

            {/* Big High-Visibility Address Box */}
            <div className="bg-amber-50 border-2 border-amber-400 p-4 sm:p-5 rounded-2xl space-y-2.5 shadow-sm">
              <span className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={22} className="text-red-600 shrink-0" />
                <span>Endereço de Entrega Completo:</span>
              </span>
              <p className="text-lg sm:text-xl font-black text-slate-950 leading-snug">
                {expandedOrder.address}
                {expandedOrder.numero ? `, nº ${expandedOrder.numero}` : ''}
                {expandedOrder.complemento ? ` (${expandedOrder.complemento})` : ''}
              </p>
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 flex-wrap pt-2 border-t border-amber-300">
                {expandedOrder.bairro && <span>Bairro: <strong className="text-slate-950">{expandedOrder.bairro}</strong></span>}
                {expandedOrder.cidadeMunicipio && <span>• Cidade: <strong className="text-slate-950">{expandedOrder.cidadeMunicipio}</strong></span>}
                {expandedOrder.cep && <span className="font-mono bg-white px-2.5 py-0.5 rounded border border-amber-400 text-slate-950 font-bold">CEP: {expandedOrder.cep}</span>}
              </div>
            </div>

            {/* Customer Contact & Phone */}
            {(() => {
              const rawPhone = (expandedOrder.telefone || expandedOrder.phone || '').trim();
              const digits = rawPhone.replace(/\D/g, '');
              const hasPhone = digits.length >= 8;
              return (
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-300 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-500 uppercase block">Telefone do Cliente:</span>
                    <p className="text-lg sm:text-xl font-black font-mono text-slate-950 truncate">
                      {hasPhone ? rawPhone : 'Não informado'}
                    </p>
                  </div>
                  {hasPhone && (
                    <a
                      href={`tel:${digits}`}
                      onClick={(e) => e.stopPropagation()}
                      className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                    >
                      <PhoneCall size={18} />
                      <span>Ligar Agora</span>
                    </a>
                  )}
                </div>
              );
            })()}

            {/* Additional Key Info Grid (Volume, Delivery Fee, Observations, etc.) */}
            <div className={`grid ${canShowDeliveryFee ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 text-xs sm:text-sm`}>
              {canShowDeliveryFee && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-300">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Valor Repasse / Taxa:</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-700">
                    R$ {(expandedOrder.valorEntrega || expandedOrder.value || 15).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-300">
                <span className="text-xs text-slate-500 font-bold uppercase block">Volumes / Pacote:</span>
                <span className="text-lg sm:text-xl font-black text-slate-900">
                  {expandedOrder.volume || '1 volume'}
                </span>
              </div>
            </div>

            {expandedOrder.notes && (
              <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200">
                <span className="font-black text-blue-900 uppercase block mb-1 text-xs sm:text-sm">Observações da Central:</span>
                <p className="font-bold text-slate-900 leading-relaxed text-sm sm:text-base">{expandedOrder.notes}</p>
              </div>
            )}

            {/* Large Navigation & Contact Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(expandedOrder.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="py-4 px-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Navigation size={20} />
                <span>Abrir no Waze</span>
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(expandedOrder.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="py-4 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Map size={20} />
                <span>Google Maps</span>
              </a>
            </div>

            {/* Main Delivery Workflow Actions inside Super Zoom */}
            <div className="pt-2 border-t-2 border-slate-200 space-y-2.5">
              {expandedOrder.status === 'pending' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChangeWithSync(expandedOrder.id, 'in_route');
                    setExpandedOrder(prev => prev ? { ...prev, status: 'in_route' } : null);
                  }}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-base sm:text-lg rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Truck size={22} />
                  <span>INICIAR ROTA DESTE PEDIDO</span>
                </button>
              )}

              {(expandedOrder.status === 'in_route' || expandedOrder.status === 'in_progress') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrderForProtocol(expandedOrder);
                      setExpandedOrder(null);
                    }}
                    className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Camera size={20} />
                    <span>CONCLUIR COM FOTO & ASSINATURA</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChangeWithSync(expandedOrder.id, 'failure', { note: 'Tentativa de entrega falhou - Ausente' });
                      setExpandedOrder(null);
                    }}
                    className="py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <AlertTriangle size={20} />
                    <span>REGISTRAR OCORRÊNCIA</span>
                  </button>
                </div>
              )}

              {expandedOrder.status === 'delivered' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrderForProtocol(expandedOrder);
                    setExpandedOrder(null);
                  }}
                  className="w-full py-4 bg-emerald-700 text-white font-black text-base rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileCheck2 size={20} />
                  <span>VER PROTOCOLO COMPLETO ASSINADO</span>
                </button>
              )}
            </div>

            {/* Bottom Explicit Dismiss Bar */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setExpandedOrder(null);
              }}
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 rounded-2xl text-center text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.99]"
            >
              <Minimize2 size={16} />
              <span>Toque aqui ou em qualquer lugar da tela para fechar</span>
            </div>

          </div>
        </div>
      )}

      {/* Protocol Digital Modal */}
      {selectedOrderForProtocol && (
        <DeliveryProtocolModal
          order={selectedOrderForProtocol}
          partnerName={getPartnerDisplayName(selectedOrderForProtocol)}
          isOpen={!!selectedOrderForProtocol}
          onClose={() => setSelectedOrderForProtocol(null)}
          onConfirmProtocol={handleConfirmProtocol}
        />
      )}

      {/* PWA Installation Helper Modal */}
      <DriverPwaInstallModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
        branding={branding}
        courierName={selectedCourier?.name}
        courierPhone={selectedCourier?.phone || selectedDriverId}
      />

      {/* Driver Diagnostic & Obsolete Order Purge Modal */}
      <DriverDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        orders={orders}
        courier={selectedCourier}
        onRefreshData={onReorderOrders}
      />

      {/* SINGLE SESSION SECURITY MODAL (Enforces 1 Phone Active per Courier Rule) */}
      {isSessionRevoked && isStandalone && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
              <Smartphone size={32} className="animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800 px-3 py-1 rounded-full">
                Sessão Desconectada (Sessão Única)
              </span>
              <h3 className="font-black text-base text-white pt-2">Novo Login em Outro Celular</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Foi detectado um novo acesso para o condutor <strong className="text-white">{selectedCourier?.name || 'seu cadastro'}</strong> em outro aparelho móvel
                {revokedDetails.time ? ` às ${revokedDetails.time}` : ''}
                {revokedDetails.device ? ` (${revokedDetails.device})` : ''}.
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-left space-y-1 mt-2">
                <p className="font-bold text-slate-300">Regra de Segurança da Frota:</p>
                <p>• Não é permitido manter 2 celulares conectados ao mesmo tempo para o mesmo condutor.</p>
                <p>• Este aparelho foi desconectado para evitar duplicidade de atendimento em campo.</p>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('vinimap_driver_session_token');
                localStorage.removeItem('vinimap_driver_id');
                localStorage.removeItem('vinimap_driver_device_id');
                localStorage.removeItem('vinimap_driver_login_time');
                localStorage.removeItem('vinimap_current_operator');
                if (onLogoutStandalone) {
                  onLogoutStandalone();
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <LogOut size={16} />
              <span>Fazer Login Novamente</span>
            </button>
          </div>
        </div>
      )}

      {/* Protocol WhatsApp Share Modal */}
      <ProtocolWhatsAppModal
        isOpen={Boolean(whatsappModalOrder)}
        order={whatsappModalOrder}
        partnerClients={partnerClients}
        couriers={couriers}
        onClose={() => setWhatsappModalOrder(null)}
      />

    </div>
  );
};

export default DriverDeviceSimulator;
