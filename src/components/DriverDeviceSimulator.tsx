import React, { useState, useEffect } from 'react';
import { Order, Courier, PartnerClient, OrderStatus, AppBranding, matchClientCode } from '../types';
import { formatToBrasiliaISODate, formatToBrasiliaDate, parseToISODate } from '../utils/dateUtils';
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
  Layers
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
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);
  const knownAssignedOrderIdsRef = React.useRef<Set<string> | null>(null);

  // Single-session enforcement state
  const [isSessionRevoked, setIsSessionRevoked] = useState(false);
  const [revokedDetails, setRevokedDetails] = useState<{ time?: string; device?: string }>({});

  // Active protocol modal state
  const [selectedOrderForProtocol, setSelectedOrderForProtocol] = useState<Order | null>(null);
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<Order | null>(null);

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
    const targetId = (standaloneCourierId || selectedDriverId || '').trim();
    if (!targetId) {
      return !isStandalone && couriers.length > 0 ? couriers[0] : null;
    }
    const userCleanPhone = targetId.replace(/\D/g, '');
    const matched = couriers.find(c => {
      const cPhoneClean = (c.phone || '').replace(/\D/g, '');
      return (
        c.id === targetId || 
        (cPhoneClean && userCleanPhone && (cPhoneClean === userCleanPhone || cPhoneClean.endsWith(userCleanPhone) || userCleanPhone.endsWith(cPhoneClean))) ||
        (c.name && targetId && c.name.toLowerCase() === targetId.toLowerCase())
      );
    });
    if (matched) return matched;
    // In standalone mode (real driver phone), NEVER fallback to another driver's data
    return isStandalone ? null : (couriers.length > 0 ? couriers[0] : null);
  }, [couriers, standaloneCourierId, selectedDriverId, isStandalone]);

  // Synchronize default driver selection when couriers load
  useEffect(() => {
    if (!isStandalone && couriers.length > 0) {
      if (!selectedDriverId || !couriers.some(c => c.id === selectedDriverId || c.phone === selectedDriverId)) {
        // If an order has a courier assigned, prioritize that courier for instant preview
        const firstActiveCourierId = orders.find(o => o.courierId && o.status !== 'cancelled')?.courierId;
        const targetId = firstActiveCourierId && couriers.some(c => c.id === firstActiveCourierId)
          ? firstActiveCourierId
          : couriers[0].id;
        setSelectedDriverId(targetId);
        localStorage.setItem('vinimap_driver_id', targetId);
      }
    }
  }, [couriers, isStandalone, selectedDriverId, orders]);

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

    // Collect all valid IDs and exact phone numbers for the active driver
    const validIds = new Set<string>();
    const validPhones = new Set<string>();

    const targetCourier = selectedCourier;
    if (targetCourier) {
      if (targetCourier.id) validIds.add(String(targetCourier.id).trim().toLowerCase());
      if (targetCourier.phone) {
        const d = String(targetCourier.phone).replace(/\D/g, '');
        if (d.length >= 8) validPhones.add(d);
      }
    }

    if (selectedDriverId) {
      validIds.add(String(selectedDriverId).trim().toLowerCase());
    }

    if (standaloneCourierId) {
      validIds.add(String(standaloneCourierId).trim().toLowerCase());
    }

    // 1. Primary and definitive check: exact courier ID match
    const orderCourierId = o.courierId || o.driverId || o.entregadorId || o.motoristaId;
    if (orderCourierId && orderCourierId !== 'null' && orderCourierId !== 'undefined') {
      const ordCId = String(orderCourierId).trim().toLowerCase();
      return validIds.has(ordCId);
    }

    // 2. Secondary fallback: exact phone match on dispositivoCondutor (ONLY if order has no courierId)
    const orderDevice = o.dispositivoCondutor || o.dispositivo_condutor || o.driverPhone;
    if (orderDevice && orderDevice !== 'null' && orderDevice !== 'undefined') {
      const ordDigits = String(orderDevice).replace(/\D/g, '');
      if (ordDigits && ordDigits.length >= 10 && validPhones.has(ordDigits)) {
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

  // Function to identify if an assigned order is active on the current day (pending or in_route for today)
  const isOrderActiveToday = React.useCallback((o: Order): boolean => {
    const isPendingOrInRoute = o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress';
    if (!isPendingOrInRoute) return false;

    // 1. Check allocatedDate
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

    // 3. Check dataSolicitacao
    if (o.dataSolicitacao) {
      const solISO = parseToISODate(o.dataSolicitacao, '');
      if (solISO === todayISO) return true;
    }

    // 4. Check order.createdAt or custom date property safely
    const customDate = (o as any).date || o.createdAt;
    if (customDate) {
      const dateISO = parseToISODate(customDate, '');
      if (dateISO === todayISO) return true;
    }

    // Default for pending or in_route assigned to driver without a conflicting date is active today
    return true;
  }, [todayISO]);

  const totalAssigned = assignedOrders.length;
  const pendingCount = assignedOrders.filter(o => o.status === 'pending').length;
  const inRouteCount = assignedOrders.filter(o => o.status === 'in_route' || o.status === 'in_progress').length;
  const deliveredCount = assignedOrders.filter(o => o.status === 'delivered').length;
  const activeCount = pendingCount + inRouteCount;
  const deliveredOrders = assignedOrders.filter(o => o.status === 'delivered' && (o.deliveryProtocol || o.proofPhotoUrl));

  // Orders active today (pendentes ou em rota ativos no dia atual)
  const activeTodayOrders = React.useMemo(() => {
    return assignedOrders.filter(o => isOrderActiveToday(o));
  }, [assignedOrders, isOrderActiveToday]);

  const activeTodayCount = activeTodayOrders.length;
  const pendingTodayCount = activeTodayOrders.filter(o => o.status === 'pending').length;
  const inRouteTodayCount = activeTodayOrders.filter(o => o.status === 'in_route' || o.status === 'in_progress').length;

  // Filter orders for the selected courier with memoization
  const driverOrders = React.useMemo(() => {
    const list = assignedOrders.filter(o => {
      // Active status filter (default): automatically hides delivered/failed orders to unpollute the driver's screen
      if (statusFilter === 'active' && (o.status === 'delivered' || o.status === 'failure')) return false;
      if (statusFilter === 'pending' && o.status !== 'pending') return false;
      if (statusFilter === 'in_route' && o.status !== 'in_route' && o.status !== 'in_progress') return false;
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;

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

    // When viewing active orders, prioritize today's active orders at the top
    if (statusFilter === 'active') {
      return [...list].sort((a, b) => {
        const aToday = isOrderActiveToday(a) ? 1 : 0;
        const bToday = isOrderActiveToday(b) ? 1 : 0;
        return bToday - aToday;
      });
    }

    return list;
  }, [assignedOrders, statusFilter, searchTerm, partnerClients, isOrderActiveToday]);

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
    await handleStatusChangeWithSync(orderId, 'delivered', {
      deliveryProtocol: {
        signedName: protocolData.signedName,
        signedDoc: protocolData.signedDoc,
        signatureData: protocolData.signatureData,
        signedAt: new Date().toISOString(),
        photoUrl: protocolData.photoUrl
      },
      proofPhotoUrl: protocolData.photoUrl,
      signatureDataUrl: protocolData.signatureData,
      receiverName: protocolData.signedName,
      receiverDoc: protocolData.signedDoc,
      deliveredAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  };

  return (
    <div className={`transition-all ${isStandalone || isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 p-0 overflow-hidden flex flex-col w-full h-full min-h-screen' : 'my-6'}`}>
      
      {/* Container header (only when in embedded preview inside admin dashboard) */}
      {!isFullScreen && !isStandalone && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                <span>Aplicativo do Condutor</span>
                <span className="text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase">
                  PWA Mobile
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Interface oficial de campo com cards padrões, navegação GPS, fotos e assinatura digital para o protocolo
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

      {/* Main Driver Phone Device Screen Viewport */}
      <div className={`mx-auto bg-slate-950 text-white flex flex-col transition-all relative overflow-hidden ${
        isStandalone || isFullScreen 
          ? 'w-full h-full flex-1 rounded-none border-0 shadow-none' 
          : 'max-w-md w-full h-[760px] rounded-[36px] border-8 border-slate-800 shadow-2xl'
      }`}>

        {/* Top Device Bar & Driver Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2 overflow-hidden">
              {branding?.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt={branding.appName || 'Logo'} 
                  className="w-6 h-6 rounded-lg object-contain bg-white/10 p-0.5 shrink-0" 
                />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              )}
              <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                {branding?.appName || 'ViniMap'} Driver
              </span>
              <button
                onClick={handleManualRefresh}
                title="Sincronizar pedidos com a central em tempo real"
                className="text-[9.5px] text-emerald-400 font-bold bg-emerald-950/80 hover:bg-emerald-900 px-2 py-0.5 rounded-full border border-emerald-800 shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                <span>● GPS / Sync</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                title="Diagnóstico do Aplicativo & Limpeza de Pedidos Antigos"
                className="p-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800/60 text-blue-300 hover:text-white flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <Activity size={13} className="animate-pulse text-blue-400" />
                <span className="hidden sm:inline">Diagnóstico</span>
              </button>

              <button
                onClick={handleManualRefresh}
                title="Atualizar Pedidos"
                disabled={isRefreshing}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>

              <button
                onClick={handleTriggerInstall}
                title="Instalar aplicativo no celular"
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center gap-1.5 text-xs font-black shadow-md shadow-emerald-950/40 cursor-pointer transition-all shrink-0"
              >
                <Download size={13} className="animate-bounce" />
                <span>Instalar App</span>
              </button>

              {isStandalone && onLogoutStandalone && (
                <button
                  onClick={onLogoutStandalone}
                  title="Desconectar da conta do condutor"
                  className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <LogOut size={13} />
                  <span>Sair</span>
                </button>
              )}

              {isFullScreen && !isStandalone && (
                <button
                  onClick={() => setIsFullScreen(false)}
                  title="Sair da tela cheia"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <Minimize2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Active Driver Selector */}
          <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <img
                  src={selectedCourier?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                  alt={selectedCourier?.name || 'Condutor'}
                  className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Condutor Conectado</span>
                  <div>
                    <h4 className="font-extrabold text-xs text-white truncate">
                      {selectedCourier?.name || 'Condutor Conectado'}
                    </h4>
                    {selectedCourier?.phone && (
                      <span className="text-[10px] text-emerald-400 font-mono block">
                        {selectedCourier.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  {deliveredCount}/{totalAssigned} Entregas
                </span>
              </div>
            </div>

            {/* Real-time Driver Status Controls */}
            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-700/60">
              <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  selectedCourier?.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                  selectedCourier?.status === 'busy' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
                }`} />
                Status em Campo:
              </span>
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('online')}
                  disabled={isUpdatingCourierStatus}
                  title="Disponível para novas entregas"
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    selectedCourier?.status === 'online' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  ● Livre
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('busy')}
                  disabled={isUpdatingCourierStatus}
                  title="Em rota ativa"
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    selectedCourier?.status === 'busy' 
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  ● Em Rota
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCourierStatus('offline')}
                  disabled={isUpdatingCourierStatus}
                  title="Pausa ou fora de expediente"
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    selectedCourier?.status === 'offline' 
                      ? 'bg-slate-700 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  ● Pausa
                </button>
              </div>
            </div>
          </div>

          {/* Card em Destaque: Ativos no Dia Atual (Pendentes ou Em Rota) */}
          <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-indigo-950/90 p-2.5 rounded-2xl border border-blue-500/40 shadow-lg">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-300 flex items-center gap-1 truncate">
                  <Calendar size={11} className="text-blue-400 shrink-0" />
                  Ativos no Dia Atual
                </span>
              </div>
              <span className="text-[9.5px] bg-blue-500/20 text-blue-200 font-extrabold px-2 py-0.5 rounded-full border border-blue-500/30 shrink-0">
                {todayFormatted}
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800/80">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white leading-none tracking-tight">{activeTodayCount}</span>
                <span className="text-[11px] font-bold text-slate-300">pedidos ativos hoje</span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {pendingTodayCount} pend.
                </span>
                <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                  {inRouteTodayCount} rota
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-blue-500/30">
              <span className="text-[9px] text-blue-300 font-black uppercase block truncate" title="Pendentes ou em rota no dia atual">Ativos Hoje</span>
              <span className="text-sm font-black text-white">{activeTodayCount}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[9px] text-amber-400 font-bold uppercase block truncate">Pendentes</span>
              <span className="text-sm font-black text-amber-400">{pendingTodayCount}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[9px] text-blue-400 font-bold uppercase block truncate">Em Rota</span>
              <span className="text-sm font-black text-blue-400">{inRouteCount}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[9px] text-emerald-400 font-bold uppercase block truncate">Entregues</span>
              <span className="text-sm font-black text-emerald-400">{deliveredCount}</span>
            </div>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {/* New Order Alert Banner */}
          {newOrderAlert && (
            <div className="bg-emerald-600 border border-emerald-400 text-white p-3 rounded-2xl shadow-lg flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-1.5 bg-white/20 rounded-xl shrink-0">
                  <Bell size={18} className="text-white" />
                </div>
                <span className="text-xs font-black truncate">{newOrderAlert}</span>
              </div>
              <button 
                onClick={() => setNewOrderAlert(null)}
                className="text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg shrink-0 cursor-pointer"
              >
                Ver
              </button>
            </div>
          )}

          {/* TAB 1: ENTREGAS (CARDS PADRÕES) */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              
              {/* Installation Banner */}
              {!isStandalone && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/80 border border-emerald-500/40 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Smartphone size={18} />
                    </div>
                    <div className="truncate">
                      <h5 className="font-extrabold text-xs text-white truncate flex items-center gap-1.5">
                        <span>Instalar App do Condutor</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">PWA</span>
                      </h5>
                      <p className="text-[10px] text-slate-300 truncate">Acesso em tela cheia, GPS e modo offline</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerInstall}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-xl shrink-0 flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer transition-all"
                  >
                    <Download size={13} />
                    <span>Instalar</span>
                  </button>
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, cliente ou endereço..."
                    className="w-full bg-slate-900 border border-slate-800 text-xs py-2.5 pl-8 pr-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'active'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>A Entregar (Hoje)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'active' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {activeTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Pendentes</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'pending' ? 'bg-amber-600 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {pendingCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('in_route')}
                    className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'in_route'
                        ? 'bg-blue-500 text-white border-blue-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Em Rota</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'in_route' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {inRouteCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('delivered')}
                    className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'delivered'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Concluídas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'delivered' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {deliveredCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'all'
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Todas</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full font-bold">
                      {totalAssigned}
                    </span>
                  </button>
                </div>
              </div>

              {/* Summary Banner of Active Orders Today */}
              <div className="p-3 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 border border-blue-500/40 rounded-2xl shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Package size={16} />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider block">Fila Ativa no Dia Atual</span>
                    <h5 className="text-xs font-black text-white truncate">
                      {activeTodayCount} {activeTodayCount === 1 ? 'pedido ativo' : 'pedidos ativos'} para entrega
                    </h5>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10.5px] font-black">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg" title="Pedidos pendentes aguardando início">
                    {pendingTodayCount} pendentes
                  </span>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-lg" title="Pedidos atualmente em rota de entrega">
                    {inRouteTodayCount} em rota
                  </span>
                </div>
              </div>

              {/* Delivery Cards List */}
              {driverOrders.length === 0 ? (
                <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center space-y-3 my-4">
                  <Package size={32} className="mx-auto text-slate-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-300">Nenhum pedido encontrado no momento.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Assim que o despachador alocar uma entrega para o seu cadastro, ela aparecerá aqui automaticamente.
                    </p>
                  </div>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
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
                    /* CARD PADRÃO DE ENTREGA DO CONDUTOR */
                    <div
                      key={order.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden shadow-md ${
                        isDelivered
                          ? 'bg-slate-900/90 border-emerald-500/40'
                          : isInRoute
                          ? 'bg-slate-900 border-blue-500 shadow-blue-900/20'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      {/* Top Order Tag & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-black text-sm text-blue-400 tracking-wider shrink-0">#{order.id}</span>
                          <span 
                            className="text-[9.5px] font-black bg-blue-950/90 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0"
                            title="Posição nesta rota / Total de pedidos ativos hoje"
                          >
                            <Calendar size={10} className="text-blue-400" />
                            <span>{idx + 1} de {activeTodayCount || driverOrders.length} hoje</span>
                          </span>
                          {getPartnerDisplayName(order) && (
                            <span 
                              className="text-[10.5px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded-lg flex items-center gap-1 truncate max-w-[190px]"
                              title={`Cliente Parceiro: ${getPartnerDisplayName(order)}`}
                            >
                              <Building2 size={11} className="text-blue-400 shrink-0" />
                              <span className="truncate">{getPartnerDisplayName(order)}</span>
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                          isDelivered
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isInRoute
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {isDelivered && <CheckCircle2 size={12} />}
                          {isInRoute && <Truck size={12} />}
                          <span>{order.status === 'in_route' ? 'Em Rota' : order.status === 'delivered' ? 'Entregue' : 'Pendente'}</span>
                        </span>
                      </div>

                      {/* Default Banner on Card: Total Ativos no Dia Atual (Pendentes / Em Rota) */}
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-blue-500/25 text-[10px] font-bold">
                        <div className="flex items-center gap-1.5 text-slate-300 truncate">
                          <Package size={11} className="text-blue-400 shrink-0" />
                          <span className="text-slate-400">Ativos no dia:</span>
                          <span className="text-white font-black">{activeTodayCount} pedidos</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9.5px] font-black shrink-0">
                          <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {pendingTodayCount} pendentes
                          </span>
                          <span className="text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {inRouteTodayCount} em rota
                          </span>
                        </div>
                      </div>

                      {/* Customer & Address Details */}
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 truncate">
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">Destinatário</span>
                            <h4 className="font-extrabold text-sm text-white leading-snug truncate">{order.customerName || order.procurarPor || 'Destinatário'}</h4>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-400 shrink-0 pt-2">
                            R$ {(order.valorEntrega || order.value || 15).toFixed(2)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed font-medium pt-0.5">
                          <MapPin size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <span>
                            {order.address}
                            {order.numero ? `, nº ${order.numero}` : ''}
                            {order.complemento ? ` (${order.complemento})` : ''}
                            {order.bairro ? `, ${order.bairro}` : ''}
                            {order.cidadeMunicipio ? ` - ${order.cidadeMunicipio}` : ''}
                          </span>
                        </p>

                        {/* Customer Contact Badges (Telefone e Email) */}
                        <div className="flex items-center gap-3 pt-0.5 text-[11px] flex-wrap">
                          {hasRealPhone ? (
                            <a 
                              href={`tel:${recipientPhone}`} 
                              className="inline-flex items-center gap-1.5 font-bold text-emerald-300 hover:text-white font-mono bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                              title="Clique para discar diretamente para o cliente"
                            >
                              <PhoneCall size={11} className="text-emerald-400" />
                              <span>{rawPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-500 italic text-[10.5px]">Tel: Não informado</span>
                          )}

                          {order.email && (
                            <span className="text-blue-300/90 text-[10.5px] truncate max-w-[200px]" title={order.email}>
                              ✉ {order.email}
                            </span>
                          )}
                        </div>

                        {order.volume && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5 font-mono">
                            <Package size={12} className="text-blue-400" />
                            <span>Volume: {order.volume}</span>
                          </p>
                        )}
                      </div>

                      {/* Quick Communication & GPS Bar */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-bold">
                        {/* OPÇÃO PRÁTICA DE LIGAR PARA O CLIENTE */}
                        <a
                          href={hasRealPhone ? `tel:${recipientPhone}` : '#'}
                          onClick={(e) => {
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
                          className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            hasRealPhone
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 active:scale-95'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                          title={hasRealPhone ? `Ligar para o cliente: ${rawPhone}` : 'Digitar número e ligar para o cliente'}
                        >
                          <PhoneCall size={13} className={hasRealPhone ? 'text-white' : 'text-emerald-400'} />
                          <span className="font-extrabold">Ligar</span>
                        </a>

                        <a
                          href={hasRealPhone ? whatsappUrl : '#'}
                          onClick={(e) => {
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
                          className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Enviar mensagem no WhatsApp do cliente"
                        >
                          <MessageSquare size={13} />
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 bg-blue-950/80 hover:bg-blue-900 border border-blue-800/60 text-blue-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Abrir rota no Waze GPS"
                        >
                          <Navigation size={13} />
                          <span>Waze</span>
                        </a>
                      </div>

                      {/* Main Driver Route Action Buttons */}
                      <div className="pt-2">
                        {isPending && (
                          <button
                            onClick={() => handleStatusChangeWithSync(order.id, 'in_route')}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Truck size={16} />
                            <span>Iniciar Rota (Em Rota)</span>
                          </button>
                        )}

                        {isInRoute && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setSelectedOrderForProtocol(order)}
                              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Camera size={15} />
                              <span>Concluir Entrega (Foto)</span>
                            </button>

                            <button
                              onClick={() => handleStatusChangeWithSync(order.id, 'failure', { note: 'Tentativa de entrega falhou - Ausente' })}
                              className="py-2.5 bg-slate-800 hover:bg-red-950/80 text-red-300 border border-slate-700 hover:border-red-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <AlertTriangle size={14} />
                              <span>Ocorrência</span>
                            </button>
                          </div>
                        )}

                        {isDelivered && (
                          <div className="flex items-center justify-between p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                              <div className="truncate">
                                <span className="font-extrabold text-emerald-300 block truncate">
                                  Recebido por: {order.deliveryProtocol?.signedName || order.receiverName || 'Cliente'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {order.deliveredAt || 'Entregue com Sucesso'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedOrderForProtocol(order)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg shrink-0 transition-colors cursor-pointer"
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
            <div className="space-y-3">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                    <Navigation size={16} className="text-blue-400" />
                    <span>Sequência Recomendada de Paradas</span>
                  </h4>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono">
                    {assignedOrders.filter(o => o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress').length} paradas
                  </span>
                </div>

                <div className="space-y-2">
                  {assignedOrders.filter(o => o.status === 'pending' || o.status === 'in_route' || o.status === 'in_progress').map((ord, idx) => {
                    const pName = getPartnerDisplayName(ord);
                    const ordPhone = (ord.telefone || ord.phone || '').trim();
                    const ordDigits = ordPhone.replace(/\D/g, '');
                    const hasOrdPhone = ordDigits.length >= 8;

                    return (
                      <div key={ord.id} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="truncate">
                            {pName && (
                              <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1 truncate mb-0.5">
                                <Building2 size={11} className="shrink-0" />
                                <span className="truncate">{pName}</span>
                              </span>
                            )}
                            <p className="font-extrabold text-xs text-white truncate">{ord.customerName}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {ord.address}{ord.numero ? `, nº ${ord.numero}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={hasOrdPhone ? `tel:${ordDigits}` : '#'}
                            onClick={(e) => {
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
                            className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                              hasOrdPhone
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            }`}
                            title={hasOrdPhone ? `Ligar para ${ord.customerName}: ${ordPhone}` : 'Digitar número e ligar'}
                          >
                            <PhoneCall size={13} />
                          </a>

                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(ord.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-lg flex items-center gap-1"
                            title="Navegar no Waze"
                          >
                            <ExternalLink size={12} /> Navegar
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 size={16} className="text-emerald-400" />
                  <span>Histórico de Protocolos Assinados</span>
                </h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                  {deliveredOrders.length} comprovantes
                </span>
              </div>

              {deliveredOrders.length === 0 ? (
                <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
                  <ShieldCheck size={32} className="mx-auto text-slate-600" />
                  <p className="text-xs font-bold text-slate-300">Nenhum protocolo registrado ainda.</p>
                  <p className="text-[10px] text-slate-500">Conclua entregas com foto e assinatura para visualizar os comprovantes aqui.</p>
                </div>
              ) : (
                deliveredOrders.map((ord) => {
                  const proto = ord.deliveryProtocol;
                  const photo = proto?.photoUrl || ord.proofPhotoUrl;
                  const sig = proto?.signatureData || ord.signatureDataUrl;
                  const pName = getPartnerDisplayName(ord);

                  return (
                    <div key={ord.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-extrabold text-xs text-blue-400">#{ord.id}</span>
                          {pName && (
                            <span className="text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[170px]">
                              <Building2 size={10} className="shrink-0" />
                              <span className="truncate">{pName}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{proto?.signedAt || ord.deliveredAt}</span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-white">{proto?.signedName || ord.customerName}</p>
                        <p className="text-[10px] text-slate-400">{ord.address}</p>
                        {proto?.signedDoc && <p className="text-[10px] text-slate-400 font-mono">Doc: {proto.signedDoc}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {photo && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Foto Comprovante:</span>
                            <img src={photo} alt="Foto comprovante" className="w-full h-20 object-cover rounded-xl border border-slate-800" />
                          </div>
                        )}

                        {sig && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Assinatura Digital:</span>
                            <div className="bg-white p-1 rounded-xl border border-slate-800 flex items-center justify-center">
                              <img src={sig} alt="Assinatura" className="h-18 object-contain" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setWhatsappModalOrder(ord)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <WhatsAppIcon className="w-4 h-4" />
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
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 text-center">
              {branding?.logoUrl ? (
                <div className="w-16 h-16 bg-white p-2 rounded-2xl border border-slate-700 shadow-lg mx-auto flex items-center justify-center">
                  <img src={branding.logoUrl} alt={branding.appName || 'Logo'} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                  <Smartphone size={26} />
                </div>
              )}
              
              <div>
                <h4 className="font-black text-sm text-white">{branding?.appName || 'App do Condutor'}</h4>
                <p className="text-[11px] text-emerald-400 font-bold">Base Oficial Cadastrada</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  O aplicativo PWA funciona em qualquer smartphone Android ou iPhone com acesso offline, rota GPS e comprovante com foto e assinatura.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleTriggerInstall}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download size={16} className="animate-bounce" />
                  <span>Baixar & Instalar no Celular</span>
                </button>

                <button
                  onClick={() => setIsPwaModalOpen(true)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Ver Guia Completo & QR Code</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Mobile Navigation Bar */}
        <div className="bg-slate-900 border-t border-slate-800 p-2 grid grid-cols-4 gap-1 shrink-0 text-center select-none">
          <button
            onClick={() => setActiveTab('orders')}
            className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'orders' ? 'text-blue-400 bg-blue-950/60 font-black' : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <Package size={18} />
            <span className="text-[10px]">Entregas</span>
          </button>

          <button
            onClick={() => setActiveTab('gps')}
            className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'gps' ? 'text-blue-400 bg-blue-950/60 font-black' : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <Navigation size={18} />
            <span className="text-[10px]">Rota GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('protocols')}
            className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'protocols' ? 'text-emerald-400 bg-emerald-950/60 font-black' : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <FileCheck2 size={18} />
            <span className="text-[10px]">Protocolos</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'install' ? 'text-amber-400 bg-amber-950/60 font-black' : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <Download size={18} />
            <span className="text-[10px]">Baixar App</span>
          </button>
        </div>

      </div>

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
