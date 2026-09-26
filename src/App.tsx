import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  MapPin, 
  Package, 
  Users, 
  Navigation, 
  FileText, 
  Wallet, 
  CheckCircle,
  Truck,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Award,
  Clock,
  Sparkles,
  RefreshCw,
  Wifi,
  WifiOff,
  Search,
  Filter,
  ShieldCheck,
  ClipboardCheck,
  Printer,
  X,
  AlertTriangle,
  PhoneCall,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bug,
  Activity as ActivityIcon,
  Settings,
  Database,
  FileCode,
  Box
} from 'lucide-react';

import { Courier, Order, Activity, OrderStatus, PartnerClient, RegionDistribution, HourlyStat, Operator, HubCentral, AppBranding, matchClientCode } from './types';
import { formatToBrasiliaDate, formatToBrasiliaTime, formatToBrasiliaDateTime, formatToBrasiliaISODate, getBrasiliaDate, normalizeIncomingDateToBrasilia, parseToISODate, getTodayISO, getYesterdayISO } from './utils/dateUtils';
import { updateSupabaseClient, supabase } from './lib/supabase';
import { resolvePartnerName, resolveRecipientName } from './utils/partnerUtils';

// Component imports
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Banner from './components/Banner';
import KPIs from './components/KPIs';
import LiveMap from './components/LiveMap';
import CouriersList from './components/CouriersList';
import SVGCharts from './components/SVGCharts';
import OrdersTable from './components/OrdersTable';
import ActivityFeed from './components/ActivityFeed';
import NewOrderModal from './components/NewOrderModal';
import LogoManagerModal, { getStoredBranding, saveStoredBranding, DEFAULT_BRANDING } from './components/LogoManagerModal';

// New specialized components
import PartnersTab from './components/PartnersTab';
import ImportSpreadsheet from './components/ImportSpreadsheet';
import CouriersTab from './components/CouriersTab';
import BillingExportPanel from './components/BillingExportPanel';
import PartnerDashboardTab from './components/PartnerDashboardTab';
import AllocationTab from './components/AllocationTab';
import DriverDeviceSimulator from './components/DriverDeviceSimulator';
import DriverGpsTab from './components/DriverGpsTab';
import BackupTab from './components/BackupTab';
import FirebaseControlCenter from './components/FirebaseControlCenter';
import EnvironmentConfigTab from './components/EnvironmentConfigTab';
import SupabaseSqlGenTab from './components/SupabaseSqlGenTab';
import DiaryTab from './components/DiaryTab';
import LoginScreen from './components/LoginScreen';
import AppShareModal from './components/AppShareModal';
import { registerPushNotifications, onMessageReceived } from './lib/pushNotifications';
import { collection, getDocs, doc, setDoc as firestoreSetDoc, deleteDoc as firestoreDeleteDoc, updateDoc as firestoreUpdateDoc, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured, isLiveFirebase, OperationType, handleFirestoreError, isFirestoreQuotaExceeded, onFirestoreQuotaExceeded } from './lib/firebase';
import OperatorsTab from './components/OperatorsTab';
import HubsTab from './components/HubsTab';
import FreightConfigTab from './components/FreightConfigTab';
import SyncLogsTab from './components/SyncLogsTab';
import FinanceTab from './components/FinanceTab';
import IntegracoesTab from './components/IntegracoesTab';
import { exportOrdersToCSV } from './utils/exportUtils';
import { saveOrderPhoto } from './utils/photoStorage';
import GithubTab from './components/GithubTab';
import RouteOptimizerTab from './components/RouteOptimizerTab';
import VolumeCalculatorCorreiosTab from './components/VolumeCalculatorCorreiosTab';
import FirebaseDiagnosticsBanner from './components/FirebaseDiagnosticsBanner';
import { getVal, setVal, removeVal, getAllFromStore, saveAllToStore, clearAllStores, removeFromStore } from './lib/indexedDB';
import { 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
// Default system hub for central routing
const DEFAULT_HUBS: HubCentral[] = [
  {
    id: "hub-1",
    name: "HUB Central Principal",
    address: "Rua Cerro Cora 385 Vila Romana SP - Cep 05061-050",
    cep: "05061-050",
    latitude: -23.530385,
    longitude: -46.702677,
    isActive: true,
    endRoutingType: 'hub'
  }
];

// Shadow global localStorage to redirect offline/operational data caching to high-capacity IndexedDB storage instead of restrictive localStorage.
const localStorage = {
  getItem: (key: string): string | null => {
    if (key.startsWith('vinimap_') || key === 'vinimap_current_operator' || key === 'vinimap_driver_session_token' || key === 'vinimap_driver_id' || key === 'vinimap_device_id' || key === 'vinimap_driver_device_id' || key === 'vinimap_driver_login_time') {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    // Operational data is retrieved asynchronously from IndexedDB on startup/sync
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (key.startsWith('vinimap_') || key === 'vinimap_current_operator' || key === 'vinimap_driver_session_token' || key === 'vinimap_driver_id' || key === 'vinimap_device_id' || key === 'vinimap_driver_device_id' || key === 'vinimap_driver_login_time') {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    }
    
    // Asynchronously update IndexedDB in the background
    try {
      if (value) {
        const parsed = JSON.parse(value);
        if (key === 'vinimap_orders') {
          saveAllToStore('orders', parsed).catch(err => console.error('Error saving orders to IndexedDB:', err));
        } else if (key === 'vinimap_couriers') {
          saveAllToStore('couriers', parsed).catch(err => console.error('Error saving couriers to IndexedDB:', err));
        } else if (key === 'vinimap_activities') {
          saveAllToStore('activities', parsed).catch(err => console.error('Error saving activities to IndexedDB:', err));
        } else if (key === 'vinimap_partners') {
          saveAllToStore('partners', parsed).catch(err => console.error('Error saving partners to IndexedDB:', err));
        } else if (key === 'vinimap_hubs') {
          saveAllToStore('hubs', parsed).catch(err => console.error('Error saving hubs to IndexedDB:', err));
        } else {
          setVal(key, parsed).catch(err => console.error(`Error saving ${key} to IndexedDB:`, err));
        }
      }
    } catch (err) {
      // Fallback for non-JSON values
      setVal(key, value).catch(e => console.error(`Error saving text ${key} to IndexedDB:`, e));
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
    
    if (key === 'vinimap_orders') {
      saveAllToStore('orders', []).catch(err => console.error('Error clearing orders in IndexedDB:', err));
    } else if (key === 'vinimap_couriers') {
      saveAllToStore('couriers', []).catch(err => console.error('Error clearing couriers in IndexedDB:', err));
    } else if (key === 'vinimap_activities') {
      saveAllToStore('activities', []).catch(err => console.error('Error clearing activities in IndexedDB:', err));
    } else if (key === 'vinimap_partners') {
      saveAllToStore('partners', []).catch(err => console.error('Error clearing partners in IndexedDB:', err));
    } else if (key === 'vinimap_hubs') {
      saveAllToStore('hubs', []).catch(err => console.error('Error clearing hubs in IndexedDB:', err));
    } else {
      removeVal(key).catch(err => console.error(`Error removing ${key} in IndexedDB:`, err));
    }
  },
  clear: (): void => {
    try {
      window.localStorage.clear();
    } catch (e) {}
    clearAllStores().catch(err => console.error('Error clearing all stores in IndexedDB:', err));
  },
  key: (index: number): string | null => {
    try {
      return window.localStorage.key(index);
    } catch (e) {
      return null;
    }
  },
  get length(): number {
    try {
      return window.localStorage.length;
    } catch (e) {
      return 0;
    }
  }
};

// Safe deep clean that removes undefined values and prevents circular reference errors
function safeCleanForFirestore(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;

  // Protect against circular structures
  if (seen.has(obj)) {
    return null;
  }
  seen.add(obj);

  // Preserve Date instances as ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Preserve Firestore FieldValue, Timestamp, or DocumentReference if any
  if (obj && typeof obj === 'object' && (obj._methodName || (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'Timestamp' || obj.constructor.name === 'DocumentReference')))) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => safeCleanForFirestore(item, seen));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) continue;
    // Skip functions, symbols, and private internal properties
    if (typeof val === 'function' || typeof val === 'symbol') continue;
    if (key.startsWith('_') && key !== '_id') continue;
    result[key] = safeCleanForFirestore(val, seen);
  }
  return result;
}

// Custom safe wrappers that sanitize payloads, enforce circuit-breaker checks, and intercept quota errors
const setDoc = async (docRef: any, data: any, options?: any) => {
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    const cleaned = safeCleanForFirestore(data);
    return await firestoreSetDoc(docRef, cleaned, options);
  } catch (err: any) {
    handleFirestoreError(err, 'write', docRef?.path);
  }
};

const deleteDoc = async (docRef: any) => {
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    return await firestoreDeleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, 'delete', docRef?.path);
  }
};

const updateDoc = async (docRef: any, data: any) => {
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    const cleaned = safeCleanForFirestore(data);
    return await firestoreUpdateDoc(docRef, cleaned);
  } catch (err: any) {
    handleFirestoreError(err, 'update', docRef?.path);
  }
};

const parseToISODateInApp = (str: string | undefined): string => {
  const todayISO = formatToBrasiliaISODate(new Date());
  return parseToISODate(str, todayISO);
};

const safeSaveOrdersToLocalStorage = (ordersList: Order[]) => {
  try {
    localStorage.setItem('vinimap_orders', JSON.stringify(ordersList));
  } catch (e) {
    try {
      const stripped = ordersList.map(item => ({
        ...item,
        proofPhotoUrl: item.proofPhotoUrl ? '[saved]' : undefined,
        signatureDataUrl: item.signatureDataUrl ? '[saved]' : undefined,
        deliveryProtocol: item.deliveryProtocol ? { 
          ...item.deliveryProtocol, 
          photoUrl: item.deliveryProtocol.photoUrl ? '[saved]' : undefined, 
          signatureData: item.deliveryProtocol.signatureData ? '[saved]' : undefined 
        } : undefined
      }));
      localStorage.setItem('vinimap_orders', JSON.stringify(stripped));
    } catch (_) {}
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<string>('partners');
  const [selectedFreightPartnerId, setSelectedFreightPartnerId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);
  const [branding, setBranding] = useState<AppBranding>(() => getStoredBranding());
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrdersInDb, setTotalOrdersInDb] = useState<number>(0);
  const [isFullHistoryLoaded, setIsFullHistoryLoaded] = useState<boolean>(false);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState<boolean>(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [isAppShareOpen, setIsAppShareOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline'>('online');
  const [isBackendOffline, setIsBackendOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncTime, setSyncTime] = useState<string>(() => formatToBrasiliaTime(new Date(), true));

  // Synchronization local status diagnostics & offline logs
  const [syncErrors, setSyncErrors] = useState<{
    id: string;
    timestamp: string;
    errorType: string;
    message: string;
    details: string;
    endpoint?: string;
    severity: 'warning' | 'error' | 'info';
  }[]>([]);
  const [isSyncLogsExpanded, setIsSyncLogsExpanded] = useState<boolean>(false);
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; latency: number }[]>([]);
  const [partnerClients, setPartnerClients] = useState<PartnerClient[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [freightRules, setFreightRules] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('vinimap_freight_rules');
      return stored && JSON.parse(stored).length > 0 ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [isNewPageFilter] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('status');
    }
    return false;
  });
  const [dashboardFilterStatus, setDashboardFilterStatus] = useState<OrderStatus | 'all' | 'open' | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('status');
      if (s) return s as OrderStatus | 'all' | 'open';
    }
    return 'open';
  });
  const [dashboardFilterStart, setDashboardFilterStart] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('start');
      if (s) return s;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dashboardFilterEnd, setDashboardFilterEnd] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const e = params.get('end');
      if (e) return e;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dashboardFilterEnabled, setDashboardFilterEnabled] = useState<boolean>(true);
  const [regionDistribution, setRegionDistribution] = useState<RegionDistribution[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<Operator | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('vinimap_current_operator');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed) {
            if (parsed.role === 'driver') {
              const driverToken = window.localStorage.getItem('vinimap_driver_session_token');
              if (driverToken) {
                return parsed;
              }
            } else {
              return parsed;
            }
          }
        }
      }
    } catch (e) {
      console.error('Falha ao restaurar sessão de operador em useState inicial', e);
    }
    // Operador administrador padrão para acesso direto à tela principal
    const defaultAdmin: Operator = {
      id: 'usr-admin',
      name: 'Administrador Central',
      login: 'admin',
      role: 'admin',
      permissions: 'all'
    };
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vinimap_current_operator', JSON.stringify(defaultAdmin));
      }
    } catch (_) {}
    return defaultAdmin;
  });
  const [hubs, setHubs] = useState<HubCentral[]>(DEFAULT_HUBS);
  const [ocorrenciaAlerts, setOcorrenciaAlerts] = useState<{
    id: string;
    orderId: string;
    customerName: string;
    courierName: string;
    time: string;
    status: OrderStatus;
    region: string;
  }[]>([]);

  const [pushToasts, setPushToasts] = useState<{ id: string; title: string; body: string; type: string }[]>([]);

  const [syncToasts, setSyncToasts] = useState<{
    id: string;
    type: 'online' | 'offline';
    title: string;
    message: string;
    timestamp: string;
  }[]>([]);

  const playSyncStatusSound = (type: 'online' | 'offline') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'online') {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        gain1.gain.setValueAtTime(0.08, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.15);
        
        setTimeout(() => {
          try {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
            gain2.gain.setValueAtTime(0.08, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.2);
          } catch (_) {}
        }, 120);
      } else {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(329.63, ctx.currentTime);
        gain1.gain.setValueAtTime(0.1, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.2);
        
        setTimeout(() => {
          try {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(261.63, ctx.currentTime);
            gain2.gain.setValueAtTime(0.1, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.25);
          } catch (_) {}
        }, 150);
      }
    } catch (_) {}
  };

  const prevSyncStatusRef = React.useRef<'online' | 'offline'>(syncStatus);

  useEffect(() => {
    if (prevSyncStatusRef.current !== syncStatus) {
      const now = new Date();
      const timeStr = formatToBrasiliaTime(now, true);
      const id = `sync-toast-${Date.now()}`;
      
      playSyncStatusSound(syncStatus);

      if (syncStatus === 'offline') {
        setSyncToasts(prev => [
          {
            id,
            type: 'offline',
            title: 'Modo Offline Ativado',
            message: 'O servidor remoto está inacessível. Suas alterações serão salvas localmente e sincronizadas com a nuvem de forma transparente assim que restabelecido.',
            timestamp: timeStr
          },
          ...prev
        ]);
      } else {
        setSyncToasts(prev => [
          {
            id,
            type: 'online',
            title: 'Sincronização Ativa',
            message: 'A conexão com o servidor foi reestabelecida. Todos os dados foram sincronizados com a nuvem com sucesso.',
            timestamp: timeStr
          },
          ...prev
        ]);
      }
      
      setTimeout(() => {
        setSyncToasts(prev => prev.filter(t => t.id !== id));
      }, 7000);

      prevSyncStatusRef.current = syncStatus;
    }
  }, [syncStatus]);

  const playOcorrenciaSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(145, ctx.currentTime);
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.45);
      
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(125, ctx.currentTime);
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.45);
        } catch (_) {}
      }, 160);
    } catch (_) {}
  };

  // Real-time network latency monitoring effect
  useEffect(() => {
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const startTime = performance.now();
      try {
        const res = await fetch('/api/ping', { cache: 'no-store' });
        if (res.ok) {
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          
          setLatencyHistory(prev => {
            const nowStr = formatToBrasiliaTime(new Date(), true);
            const updated = [...prev, { time: nowStr, latency: duration }];
            if (updated.length > 20) {
              updated.shift();
            }
            return updated;
          });
        } else {
          throw new Error('Response not OK');
        }
      } catch (err) {
        console.warn('[Latency Monitor] Failed to measure latency:', err);
        setLatencyHistory(prev => {
          const nowStr = formatToBrasiliaTime(new Date(), true);
          const updated = [...prev, { time: nowStr, latency: 0 }];
          if (updated.length > 20) {
            updated.shift();
          }
          return updated;
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Sync operator login session on first mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('vinimap_current_operator');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed) {
            if (parsed.role === 'driver') {
              const driverToken = window.localStorage.getItem('vinimap_driver_session_token');
              if (driverToken) {
                setCurrentUser(parsed);
              }
            } else {
              setCurrentUser(parsed);
            }
          }
        } catch (e) {
          console.error('Falha ao restaurar sessão de operador', e);
        }
      }
    }
  }, []);

  // Validate and keep active driver session in sync with current backend couriers
  useEffect(() => {
    if (currentUser && currentUser.role === 'driver' && couriers.length > 0) {
      const userPhoneClean = (currentUser.phone || currentUser.login || '').replace(/\D/g, '');
      const verifiedCourier = couriers.find(c => 
        c.id === currentUser.id ||
        (userPhoneClean && c.phone && c.phone.replace(/\D/g, '') === userPhoneClean) ||
        (currentUser.name && c.name && c.name.toLowerCase() === currentUser.name.toLowerCase())
      );
      if (verifiedCourier) {
        const updatedUser = {
          ...currentUser,
          id: verifiedCourier.id,
          name: verifiedCourier.name,
          login: verifiedCourier.phone || verifiedCourier.id,
          phone: verifiedCourier.phone || currentUser.phone
        };
        if (currentUser.id !== verifiedCourier.id || currentUser.name !== verifiedCourier.name || currentUser.login !== verifiedCourier.phone) {
          setCurrentUser(updatedUser);
          localStorage.setItem('vinimap_current_operator', JSON.stringify(updatedUser));
        }
      }
    }
  }, [couriers, currentUser]);

  // Redirect to first allowed tab if current activeTab is restricted for the newly logged operator
  useEffect(() => {
    if (currentUser) {
      const perms = currentUser.permissions;
      if (perms !== 'all' && Array.isArray(perms) && !perms.includes(activeTab)) {
        if (perms.length > 0) {
          setActiveTab(perms[0]);
        }
      }
    }
  }, [currentUser, activeTab]);

  // Se o condutor não estiver com pedido em aberto (não concluídos / não cancelados), sincronizar status visualmente para livre ('online')
  useEffect(() => {
    if (!orders || orders.length === 0 || !couriers || couriers.length === 0) return;

    let hasChanges = false;
    const updated = couriers.map(c => {
      // Pedidos em aberto: atribuídos ao condutor, não concluídos (diferentes de delivered e cancelled) e não deletados
      const openOrders = orders.filter(o => 
        o.courierId === c.id && 
        o.status !== 'delivered' && 
        o.status !== 'cancelled' && 
        !o.isDeleted && 
        !o.deleted
      );

      // Se não há pedidos em aberto e o condutor estava marcado como 'busy', muda para 'online' (Livre)
      if (openOrders.length === 0 && c.status === 'busy') {
        hasChanges = true;
        return { ...c, status: 'online' as const };
      }
      return c;
    });

    if (hasChanges) {
      setCouriers(updated);
      try {
        localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
      } catch (_) {}
    }
  }, [orders, couriers]);

  const handleLogout = () => {
    try {
      window.localStorage.removeItem('vinimap_current_operator');
      window.localStorage.removeItem('vinimap_driver_session_token');
      window.localStorage.removeItem('vinimap_driver_id');
      window.localStorage.removeItem('vinimap_driver_device_id');
      window.localStorage.removeItem('vinimap_driver_login_time');
    } catch (_) {}
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleClearCache = async () => {
    try {
      const keysToClear = [
        'vinimap_orders',
        'vinimap_couriers',
        'vinimap_activities',
        'vinimap_partners',
        'vinimap_regions',
        'vinimap_hourly',
        'vinimap_hubs'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));
      
      await fetchDatabase();
      alert('Cache de contingência limpo com sucesso! Os coletores locais foram desalocados e sincronizados com o servidor primário.');
    } catch (err) {
      console.error('Erro ao limpar cache local:', err);
      alert('Falha ao redefinir cache operacional.');
    }
  };

  const handlePrintSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      alert('Seção selecionada para impressão rápida não pôde ser localizada!');
      return;
    }
    const originalId = el.id;
    el.id = 'printable-area';
    window.print();
    setTimeout(() => {
      el.id = originalId;
    }, 500);
  };

  // Helper to download recent synchronization logs as JSON
  const handleDownloadSyncLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(syncErrors, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vinimap-sync-errors-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Helper to load collections directly from Supabase client-side when the backend is offline or on Shard Cloud
  const fetchFromSupabaseDirectly = async (options?: { startDate?: string; endDate?: string; loadAll?: boolean; initialOnly?: boolean }) => {
    if (!supabase) throw new Error("Cliente Supabase não inicializado.");
    
    // 1. Orders (lazy loading: if loadAll is not specified, limit to recent/active orders)
    let ordQuery = supabase.from('orders').select('*');
    if (!options?.loadAll) {
      ordQuery = ordQuery.order('id', { ascending: false }).limit(250);
    }
    const { data: rawOrders, error: ordErr } = await ordQuery;
    if (ordErr) throw ordErr;

    const resOrders = (rawOrders || []).map((o: any) => ({
      id: String(o.id || o.pedido),
      pedido: String(o.pedido || o.id),
      customerName: o.customer_name || o.customerName || 'Cliente',
      address: o.address || '',
      cep: o.cep || '',
      status: (o.status as OrderStatus) || 'pending',
      amount: Number(o.amount || o.valor_frete || o.value || 0),
      value: Number(o.value || o.amount || 0),
      valorMercadoria: Number(o.valor_mercadoria ?? o.valorMercadoria ?? 0),
      valorRepasse: Number(o.valor_repasse ?? o.valorRepasse ?? 0),
      valorCondutor: Number(o.valor_condutor ?? o.valorCondutor ?? o.valor_repasse ?? 0),
      volumeTotal: Number(o.volume_total ?? o.volumeTotal ?? 1),
      pesoTotal: Number(o.peso_total ?? o.pesoTotal ?? 1),
      region: o.region || 'Centro-Paulista',
      courierId: o.courier_id || o.courierId || null,
      partnerId: o.partner_id || o.partnerId || null,
      driverName: o.driver_name || o.driverName || null,
      createdAt: o.created_at || o.createdAt || new Date().toISOString(),
      deliveredAt: o.delivered_at || o.deliveredAt || null,
      tentativasEntrega: Number(o.tentativas_entrega ?? o.tentativasEntrega ?? 0),
      trackingCode: o.tracking_code || o.trackingCode || null,
      priority: o.priority || 'medium',
      latitude: o.latitude !== null && o.latitude !== undefined ? Number(o.latitude) : -23.55052,
      longitude: o.longitude !== null && o.longitude !== undefined ? Number(o.longitude) : -46.633308,
      notes: o.notes || '',
      updatedAt: o.updated_at || o.updatedAt || new Date().toISOString(),
      codigoCliente: o.codigo_cliente || o.codigoCliente || '',
      dataSolicitacao: o.data_solicitacao || o.dataSolicitacao || '',
      procurarPor: o.procurar_por || o.procurarPor || '',
      telefone: o.telefone || '',
      detalhe: o.detalhe || '',
      email: o.email || '',
      complemento: o.complemento || '',
      dispositivoCondutor: o.dispositivo_condutor || o.dispositivoCondutor || '',
      horarioFinal: o.horario_final || o.horarioFinal || '',
      documentoEmpresa: o.documento_empresa || o.documentoEmpresa || '',
      tipoEntrega: o.tipo_entrega || o.tipoEntrega || '',
      chamado: o.chamado || '',
      danfe: o.danfe || '',
      dataLimite: o.data_limite || o.dataLimite || '',
      nomeFantasia: o.nome_fantasia || o.nomeFantasia || '',
      horarioInicio: o.horario_inicio || o.horarioInicio || '',
      dataAgendamento: o.data_agendamento || o.dataAgendamento || '',
      cidadeMunicipio: o.cidade_municipio || o.cidadeMunicipio || '',
      estado: o.estado || 'SP',
      valorNotaFiscal: Number(o.valor_nota_fiscal ?? o.valorNotaFiscal ?? 0),
      valorReceber: Number(o.valor_receber ?? o.valorReceber ?? 0),
      valorEntrega: Number(o.valor_entrega ?? o.valorEntrega ?? 0),
      destinatarioCnpjCpf: o.destinatario_cnpj_cpf || o.destinatarioCnpjCpf || '',
      statusSincronizado: o.status_sincronizado || o.statusSincronizado || o.status || 'pending',
      status_sincronizado: o.status_sincronizado || o.statusSincronizado || o.status || 'pending',
      deliveryProtocol: o.delivery_protocol || o.deliveryProtocol || null,
      history: Array.isArray(o.history) ? o.history : [],
      allocatedDate: o.allocated_date || o.allocatedDate || null,
      version: Number(o.version || 1),
      versionTimestamp: o.version_timestamp ? Number(o.version_timestamp) : (o.updated_at ? new Date(o.updated_at).getTime() : Date.now()),
    })).filter((o: any) => 
      o && 
      o.id !== 'CLI-001-100' && 
      !String(o.id).startsWith('MOCK-') &&
      !String(o.id).startsWith('TEST-')
    );

    // 2. Couriers
    const { data: rawCouriers } = await supabase.from('couriers').select('*');
    const resCouriers = (rawCouriers || []).map((c: any) => ({
      id: String(c.id),
      name: c.name || '',
      avatar: c.avatar || '',
      status: c.status || 'offline',
      rating: Number(c.rating) || 5.0,
      vehicle: c.vehicle || 'motorcycle',
      ordersCompleted: Number(c.orders_completed ?? c.ordersCompleted ?? 0),
      currentLat: Number(c.current_lat ?? c.currentLat ?? -23.55052),
      currentLng: Number(c.current_lng ?? c.currentLng ?? -46.633308),
      angle: Number(c.angle ?? 0),
      phone: c.phone || '',
      password: c.password ? String(c.password) : '123456',
      isActive: c.is_active ?? c.isActive ?? true,
      repasseTaxa: Number(c.repasse_taxa ?? c.repasseTaxa ?? 0),
      repasseFormato: c.repasse_formato || c.repasseFormato || 'tabela_cep',
      repassePorcentagem: Number(c.repasse_porcentagem ?? c.repassePorcentagem ?? 80),
      showDeliveryFee: c.show_delivery_fee ?? c.showDeliveryFee ?? false,
      region: c.region || null,
      plate: c.plate || null,
    }));

    // 3. Activities
    const { data: rawActivities } = await supabase.from('activities').select('*').order('id', { ascending: false }).limit(200);
    const resActivities = (rawActivities || []).map((a: any) => ({
      id: String(a.id),
      time: a.time || new Date().toISOString(),
      type: a.type || 'info',
      message: a.message || '',
      details: a.details || null,
    }));

    // 4. Partner Clients
    let rawPartners: any[] = [];
    const { data: directPC, error: pcErr } = await supabase.from('partner_clients').select('*');
    if (!pcErr && Array.isArray(directPC) && directPC.length > 0) {
      rawPartners = directPC;
    } else {
      const { data: directP } = await supabase.from('partners').select('*');
      if (Array.isArray(directP)) {
        rawPartners = directP;
      }
    }
    const resPartners = (rawPartners || []).map((p: any) => ({
      id: String(p.id),
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      cnpjCpf: p.cnpj_cpf || p.cnpjCpf || '',
      createdAt: p.created_at || p.createdAt || new Date().toISOString(),
      isActive: p.is_active ?? p.isActive ?? true,
    }));

    // 5. Hubs
    const { data: rawHubs } = await supabase.from('hub_centrals').select('*');
    const resHubs = (rawHubs && rawHubs.length > 0) ? rawHubs.map((h: any) => ({
      id: String(h.id),
      name: h.name || '',
      address: h.address || '',
      cep: h.cep || '',
      latitude: Number(h.latitude) || -23.530385,
      longitude: Number(h.longitude) || -46.702677,
      isActive: h.is_active ?? h.isActive ?? true,
      endRoutingType: h.end_routing_type || h.endRoutingType || 'farthest',
      manualEndAddress: h.manual_end_address || h.manualEndAddress || '',
    })) : DEFAULT_HUBS;

    // 6. Freight Rules
    const { data: rawRules } = await supabase.from('freight_rules').select('*');
    const resFreightRules = (rawRules || []).map((r: any) => ({
      id: String(r.id),
      partnerId: r.partner_id || r.partnerId || 'DEFAULT',
      codigoCliente: r.codigo_cliente || r.codigoCliente || null,
      cepMin: r.cep_min || r.cepMin || '',
      cepMax: r.cep_max || r.cepMax || '',
      value: Number(r.value) || 0,
      valorRepasse: Number(r.valor_repasse ?? r.valorRepasse ?? 0),
      prioridade: Number(r.prioridade ?? 0),
      regiao: r.regiao || null,
      prazoDias: Number(r.prazo_dias ?? r.prazoDias ?? 1),
      pesoMaximo: (r.peso_maximo !== undefined && r.peso_maximo !== null) ? Number(r.peso_maximo) : null,
      description: r.description || null,
      observacao: r.observacao || null,
    }));

    return {
      resOrders,
      resCouriers,
      resActivities,
      resPartners,
      resHubs,
      resFreightRules,
    };
  };

  // Helper to load collections directly from Firestore client-side when the backend is offline (e.g. Shard Cloud)
  const fetchFromFirestoreDirectly = async (options?: { startDate?: string; endDate?: string; loadAll?: boolean; initialOnly?: boolean }) => {
    if (!db) throw new Error("Banco Firestore não inicializado.");
    
    const loadCol = async (name: string, fallback: any[] = []) => {
      try {
        const colRef = collection(db, name);
        let snap;
        if (name === 'orders' && !options?.loadAll) {
          const q = query(colRef, limit(200));
          snap = await getDocs(q);
        } else {
          snap = await getDocs(colRef);
        }
        const list: any[] = [];
        snap.forEach(doc => {
          list.push(doc.data());
        });
        return list;
      } catch (err) {
        console.warn(`[Firestore Direct Read] Falha ao ler coleção ${name}:`, err);
        return fallback;
      }
    };

    const [resOrders, resCouriers, resActivities, resPartners, resRegions, resHourly, resHubs] = await Promise.all([
      loadCol('orders', []),
      loadCol('couriers', []),
      loadCol('activities', []),
      loadCol('partnerClients', []),
      loadCol('regionStats', []),
      loadCol('hourlyStats', []),
      loadCol('hubs', DEFAULT_HUBS)
    ]);

    return {
      resOrders,
      resCouriers,
      resActivities,
      resPartners,
      resRegions,
      resHourly,
      resHubs
    };
  };

  const ensureJsonResponse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error(`Resposta de API inválida ou não-JSON (status: ${res.status}, tipo: ${contentType})`);
    }
    return res.json().catch(() => ({}));
  };

// Persistent deleted order tracker to guarantee definitive deletion and prevent resurrection from caches or background listeners
const getDeletedOrderIds = (): Set<string> => {
  const s = new Set<string>();
  // 01005 is permanently deleted
  s.add('01005');
  s.add('PED-01005');

  try {
    const raw = localStorage.getItem('vinimap_deleted_order_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((item: string) => {
          if (!item) return;
          const str = String(item).trim();
          s.add(str);
          s.add(str.toUpperCase());
          const noPed = str.toUpperCase().replace(/^PED-/i, '');
          if (noPed) {
            s.add(noPed);
            s.add(`PED-${noPed}`);
          }
        });
      }
    }
  } catch (e) {}
  return s;
};

const isOrderDeleted = (orderOrId: any, customSet?: Set<string>): boolean => {
  if (!orderOrId) return false;
  const dSet = customSet || getDeletedOrderIds();
  if (typeof orderOrId === 'string') {
    const s = String(orderOrId).trim().toUpperCase();
    const noPed = s.replace(/^PED-/i, '');
    return s === '01005' || s === 'PED-01005' || noPed === '01005' || dSet.has(s) || (noPed ? dSet.has(noPed) : false) || dSet.has(`PED-${s}`);
  }
  const idUpper = String(orderOrId.id || '').trim().toUpperCase();
  const idNoPed = idUpper.replace(/^PED-/i, '');
  const pedUpper = orderOrId.pedido ? String(orderOrId.pedido).trim().toUpperCase() : '';
  const pedNoPed = pedUpper.replace(/^PED-/i, '');

  if (idUpper === '01005' || idUpper === 'PED-01005' || idNoPed === '01005' ||
      pedUpper === '01005' || pedUpper === 'PED-01005' || pedNoPed === '01005') {
    return true;
  }

  return (
    dSet.has(idUpper) ||
    (idNoPed ? dSet.has(idNoPed) : false) ||
    dSet.has(`PED-${idUpper}`) ||
    (pedUpper ? (dSet.has(pedUpper) || (pedNoPed ? dSet.has(pedNoPed) : false) || dSet.has(`PED-${pedUpper}`)) : false) ||
    orderOrId.status === 'deleted' ||
    orderOrId.isDeleted === true ||
    orderOrId.deleted === true
  );
};

const markOrderAsDeleted = (orderId: string) => {
  if (!orderId) return;
  try {
    const set = getDeletedOrderIds();
    const str = String(orderId).trim();
    const upper = str.toUpperCase();
    const noPed = upper.replace(/^PED-/i, '');
    const withPed = upper.startsWith('PED-') ? upper : `PED-${upper}`;

    set.add(str);
    set.add(upper);
    if (noPed) set.add(noPed);
    if (withPed) set.add(withPed);

    const arr = Array.from(set).slice(-3000);
    localStorage.setItem('vinimap_deleted_order_ids', JSON.stringify(arr));

    removeFromStore('orders', str).catch(() => {});
    removeFromStore('orders', upper).catch(() => {});
    if (noPed) removeFromStore('orders', noPed).catch(() => {});
    if (withPed) removeFromStore('orders', withPed).catch(() => {});
  } catch (e) {}
};

  // Helper to merge orders with version-timestamp checking and order preservation to prevent table jumping
  const mergeOrdersWithVersionTimestamp = (prevOrders: Order[], incomingOrders: Order[]): Order[] => {
    const deletedIds = getDeletedOrderIds();
    const validIncoming = (incomingOrders || []).filter(o => o && o.id && !isOrderDeleted(o, deletedIds));

    if (!prevOrders || prevOrders.length === 0) return validIncoming;
    
    // Map incoming strictly by exact id and standardized prefix (NO loose digit stripping to prevent collision)
    const incomingMap = new Map<string, Order>();
    validIncoming.forEach(o => {
      if (!o || !o.id) return;
      incomingMap.set(o.id, o);
      const upper = String(o.id).trim().toUpperCase();
      incomingMap.set(upper, o);
      if (upper.startsWith('PED-')) {
        const noPed = upper.replace(/^PED-/i, '');
        if (noPed) incomingMap.set(noPed, o);
      }
      if (o.pedido) {
        const pedStr = String(o.pedido).trim().toUpperCase();
        if (pedStr) incomingMap.set(pedStr, o);
      }
    });

    const processedIncomingIds = new Set<string>();
    let hasAnyChanges = false;

    // 1. Maintain the exact sequence of rows in prevOrders to guarantee rock-solid visual stability
    const merged: Order[] = [];

    for (let i = 0; i < prevOrders.length; i++) {
      const local = prevOrders[i];
      if (!local || !local.id || isOrderDeleted(local, deletedIds)) {
        hasAnyChanges = true;
        continue;
      }

      const upperLocalId = String(local.id).trim().toUpperCase();
      const noPedLocal = upperLocalId.startsWith('PED-') ? upperLocalId.replace(/^PED-/i, '') : undefined;
      const pedLocal = local.pedido ? String(local.pedido).trim().toUpperCase() : undefined;

      const incoming = incomingMap.get(local.id) ||
                       incomingMap.get(upperLocalId) ||
                       (noPedLocal ? incomingMap.get(noPedLocal) : undefined) ||
                       (pedLocal ? incomingMap.get(pedLocal) : undefined);

      if (!incoming) {
        // Order exists only in local memory/cache, keep it unchanged at this exact index
        merged.push(local);
        continue;
      }

      processedIncomingIds.add(incoming.id);

      const localTs = Number(local.versionTimestamp || local.updatedAt || local.statusUpdatedAt || 0);
      const incomingTs = Number(incoming.versionTimestamp || incoming.updatedAt || incoming.statusUpdatedAt || 0);
      const localVer = Number(local.version || 0);
      const incomingVer = Number(incoming.version || 0);

      const isLocalDelivered = local.status === 'delivered' || !!local.deliveryProtocol || !!local.proofPhotoUrl;
      const isIncomingDelivered = incoming.status === 'delivered' || !!incoming.deliveryProtocol || !!incoming.proofPhotoUrl;

      // STABLE COURIER ALLOCATION ENFORCEMENT:
      // Orders can ONLY be reallocated by manual Admin action or updated in status by the driver app.
      // An order that already has local.courierId MUST NEVER be wiped or reallocated by background sync!
      let resolvedCourierId = local.courierId;
      let resolvedValorCondutor = local.valorCondutor;
      let resolvedAllocatedDate = local.allocatedDate;
      let resolvedDispositivo = local.dispositivoCondutor;
      let resolvedCourierName = local.courierName || local.allocatedCourierName || local.nomeCondutor;

      if (incoming.courierId && incoming.courierId !== 'null' && incoming.courierId !== 'undefined') {
        if (!local.courierId) {
          // Local had no courier, incoming has courier -> adopt incoming assignment
          resolvedCourierId = incoming.courierId;
          resolvedValorCondutor = incoming.valorCondutor !== undefined ? incoming.valorCondutor : local.valorCondutor;
          resolvedAllocatedDate = incoming.allocatedDate || local.allocatedDate;
          resolvedDispositivo = incoming.dispositivoCondutor || local.dispositivoCondutor;
          resolvedCourierName = incoming.courierName || incoming.allocatedCourierName || incoming.nomeCondutor;
        } else if (local.courierId !== incoming.courierId) {
          // Both have different couriers. Only adopt incoming courier if incoming has a strictly newer version/timestamp (manual Admin reallocation)
          if (incomingVer > localVer || incomingTs > (localTs + 1500)) {
            resolvedCourierId = incoming.courierId;
            resolvedValorCondutor = incoming.valorCondutor !== undefined ? incoming.valorCondutor : local.valorCondutor;
            resolvedAllocatedDate = incoming.allocatedDate || local.allocatedDate;
            resolvedDispositivo = incoming.dispositivoCondutor || local.dispositivoCondutor;
            resolvedCourierName = incoming.courierName || incoming.allocatedCourierName || incoming.nomeCondutor;
          } else {
            // Retain existing local courier!
            resolvedCourierId = local.courierId;
          }
        }
      } else if (local.courierId) {
        // Incoming has NO courier, but local ALREADY HAS an assigned courier:
        // Do NOT deallocate! Retain local courier assignment!
        resolvedCourierId = local.courierId;
      }

      let resolved: Order;

      // 1. If local is delivered and incoming is not yet delivered, preserve local delivered
      if (isLocalDelivered && !isIncomingDelivered && incoming.status !== 'cancelled') {
        resolved = {
          ...incoming,
          ...local,
          id: incoming.id || local.id,
          status: 'delivered' as OrderStatus,
          statusSincronizado: 'delivered',
          status_sincronizado: 'delivered',
          versionTimestamp: Math.max(localTs, incomingTs, Date.now()),
          updatedAt: Math.max(localTs, incomingTs, Date.now()),
          version: Math.max(localVer, incomingVer) + 1,
          statusUpdatedAt: local.statusUpdatedAt || localTs,
          courierId: resolvedCourierId,
          valorCondutor: resolvedValorCondutor !== undefined ? resolvedValorCondutor : incoming.valorCondutor,
          allocatedDate: resolvedAllocatedDate,
          dispositivoCondutor: resolvedDispositivo,
          courierName: resolvedCourierName,
          allocatedCourierName: resolvedCourierName,
          nomeCondutor: resolvedCourierName,
          deliveryProtocol: local.deliveryProtocol || incoming.deliveryProtocol,
          proofPhotoUrl: local.proofPhotoUrl || incoming.proofPhotoUrl,
          signatureDataUrl: local.signatureDataUrl || incoming.signatureDataUrl,
          receiverName: local.receiverName || incoming.receiverName,
          receiverDoc: local.receiverDoc || incoming.receiverDoc,
          deliveredAt: local.deliveredAt || incoming.deliveredAt,
          history: (local.history && local.history.length >= (incoming.history?.length || 0)) ? local.history : incoming.history
        };
      } else if (isIncomingDelivered && !isLocalDelivered && local.status !== 'cancelled') {
        // 2. If incoming is delivered, incoming delivered wins
        resolved = {
          ...local,
          ...incoming,
          id: incoming.id || local.id,
          status: 'delivered' as OrderStatus,
          statusSincronizado: 'delivered',
          status_sincronizado: 'delivered',
          versionTimestamp: Math.max(localTs, incomingTs, Date.now()),
          updatedAt: Math.max(localTs, incomingTs, Date.now()),
          version: Math.max(localVer, incomingVer) + 1,
          statusUpdatedAt: incoming.statusUpdatedAt || incomingTs || Date.now(),
          courierId: resolvedCourierId,
          valorCondutor: resolvedValorCondutor !== undefined ? resolvedValorCondutor : incoming.valorCondutor,
          allocatedDate: resolvedAllocatedDate,
          dispositivoCondutor: resolvedDispositivo,
          courierName: resolvedCourierName,
          allocatedCourierName: resolvedCourierName,
          nomeCondutor: resolvedCourierName,
          deliveryProtocol: incoming.deliveryProtocol || local.deliveryProtocol,
          proofPhotoUrl: incoming.proofPhotoUrl || incoming.deliveryProtocol?.photoUrl || local.proofPhotoUrl,
          signatureDataUrl: incoming.signatureDataUrl || incoming.deliveryProtocol?.signatureData || local.signatureDataUrl,
          receiverName: incoming.receiverName || incoming.deliveryProtocol?.signedName || local.receiverName,
          receiverDoc: incoming.receiverDoc || incoming.deliveryProtocol?.signedDoc || local.receiverDoc,
          deliveredAt: incoming.deliveredAt || incoming.deliveryProtocol?.signedAt || local.deliveredAt,
          history: (incoming.history && incoming.history.length >= (local.history?.length || 0)) ? incoming.history : local.history
        };
      } else if (isLocalDelivered && isIncomingDelivered) {
        // 3. If both are delivered, merge preserving photo, signature, and protocol
        const isLocalNewer = (localTs >= incomingTs) || (localVer >= incomingVer);
        const primary = isLocalNewer ? local : incoming;
        const secondary = isLocalNewer ? incoming : local;

        const resolvedPhoto = primary.proofPhotoUrl || primary.deliveryProtocol?.photoUrl || secondary.proofPhotoUrl || secondary.deliveryProtocol?.photoUrl;
        const resolvedSig = primary.signatureDataUrl || primary.deliveryProtocol?.signatureData || secondary.signatureDataUrl || secondary.deliveryProtocol?.signatureData;
        const resolvedReceiverName = primary.receiverName || primary.deliveryProtocol?.signedName || secondary.receiverName || secondary.deliveryProtocol?.signedName;
        const resolvedReceiverDoc = primary.receiverDoc || primary.deliveryProtocol?.signedDoc || secondary.receiverDoc || secondary.deliveryProtocol?.signedDoc;
        const resolvedDeliveredAt = primary.deliveredAt || primary.deliveryProtocol?.signedAt || secondary.deliveredAt || secondary.deliveryProtocol?.signedAt;

        const finalProtocol: Order['deliveryProtocol'] = (primary.deliveryProtocol || secondary.deliveryProtocol) ? {
          signedName: resolvedReceiverName || 'Recebido no Destino',
          signedDoc: resolvedReceiverDoc || '',
          signatureData: resolvedSig || '',
          signedAt: resolvedDeliveredAt || new Date().toISOString(),
          photoUrl: resolvedPhoto || undefined,
          notes: primary.deliveryProtocol?.notes || secondary.deliveryProtocol?.notes || undefined,
          isUpdated: primary.deliveryProtocol?.isUpdated ?? secondary.deliveryProtocol?.isUpdated ?? true,
          updatedAt: primary.deliveryProtocol?.updatedAt || secondary.deliveryProtocol?.updatedAt || undefined,
          includeFinancialValues: primary.deliveryProtocol?.includeFinancialValues ?? secondary.deliveryProtocol?.includeFinancialValues
        } : undefined;

        resolved = {
          ...secondary,
          ...primary,
          id: incoming.id || local.id,
          status: 'delivered' as OrderStatus,
          statusSincronizado: 'delivered',
          status_sincronizado: 'delivered',
          versionTimestamp: Math.max(localTs, incomingTs, Date.now()),
          updatedAt: Math.max(localTs, incomingTs, Date.now()),
          version: Math.max(localVer, incomingVer) + 1,
          courierId: resolvedCourierId,
          valorCondutor: resolvedValorCondutor !== undefined ? resolvedValorCondutor : incoming.valorCondutor,
          allocatedDate: resolvedAllocatedDate,
          dispositivoCondutor: resolvedDispositivo,
          courierName: resolvedCourierName,
          allocatedCourierName: resolvedCourierName,
          nomeCondutor: resolvedCourierName,
          deliveryProtocol: finalProtocol,
          proofPhotoUrl: resolvedPhoto,
          signatureDataUrl: resolvedSig,
          receiverName: resolvedReceiverName,
          receiverDoc: resolvedReceiverDoc,
          deliveredAt: resolvedDeliveredAt,
          history: (primary.history && primary.history.length >= (secondary.history?.length || 0)) ? primary.history : secondary.history
        };
      } else if (
        localTs > incomingTs ||
        (localVer > incomingVer && localTs >= incomingTs) ||
        (local.courierId !== incoming.courierId && localTs >= incomingTs - 5000 && localVer >= incomingVer) ||
        (local.status === 'in_route' && incoming.status === 'pending') ||
        (local.status === 'failure' && incoming.status === 'pending')
      ) {
        resolved = {
          ...incoming,
          ...local,
          status: local.status as OrderStatus,
          statusSincronizado: local.status,
          status_sincronizado: local.status,
          versionTimestamp: Math.max(localTs, incomingTs),
          updatedAt: Math.max(localTs, incomingTs),
          version: Math.max(localVer, incomingVer),
          statusUpdatedAt: local.statusUpdatedAt || localTs,
          courierId: resolvedCourierId,
          valorCondutor: resolvedValorCondutor,
          allocatedDate: resolvedAllocatedDate,
          dispositivoCondutor: resolvedDispositivo,
          courierName: resolvedCourierName,
          allocatedCourierName: resolvedCourierName,
          nomeCondutor: resolvedCourierName,
          deliveryProtocol: local.deliveryProtocol || incoming.deliveryProtocol,
          proofPhotoUrl: local.proofPhotoUrl || incoming.proofPhotoUrl,
          signatureDataUrl: local.signatureDataUrl || incoming.signatureDataUrl,
          history: (local.history && local.history.length >= (incoming.history?.length || 0)) ? local.history : incoming.history
        };
      } else {
        resolved = {
          ...incoming,
          courierId: resolvedCourierId,
          valorCondutor: resolvedValorCondutor !== undefined ? resolvedValorCondutor : incoming.valorCondutor,
          allocatedDate: resolvedAllocatedDate,
          dispositivoCondutor: resolvedDispositivo,
          courierName: resolvedCourierName,
          allocatedCourierName: resolvedCourierName,
          nomeCondutor: resolvedCourierName
        };
      }

      // Check if resolved has actual changed data from local
      if (
        resolved.status !== local.status ||
        resolved.courierId !== local.courierId ||
        resolved.deliveredAt !== local.deliveredAt ||
        resolved.receiverName !== local.receiverName ||
        resolved.receiverDoc !== local.receiverDoc ||
        resolved.proofPhotoUrl !== local.proofPhotoUrl ||
        resolved.signatureDataUrl !== local.signatureDataUrl ||
        resolved.version !== local.version
      ) {
        hasAnyChanges = true;
        merged.push(resolved);
      } else {
        merged.push(local); // Retain identical object reference!
      }
    }

    // 2. Append any genuinely new incoming orders that were not already in prevOrders
    for (let j = 0; j < validIncoming.length; j++) {
      const inc = validIncoming[j];
      if (!processedIncomingIds.has(inc.id)) {
        const isObsolete = 
          inc.id === 'CLI-001-100' || 
          String(inc.id).startsWith('MOCK-') ||
          String(inc.id).startsWith('TEST-');
        if (!isObsolete) {
          hasAnyChanges = true;
          merged.push(inc);
        }
      }
    }

    // If completely identical to previous orders, return prevOrders unchanged to preserve React references
    if (!hasAnyChanges && merged.length === prevOrders.length) {
      return prevOrders;
    }

    return merged;
  };

  // Core API Synchronizer with local cache fallback for standalone resilience in case of offline/restart state
  const areSimpleListsEqual = (a: any[], b: any[]): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.id !== b[i]?.id) return false;
      if (a[i]?.status !== b[i]?.status) return false;
      if (a[i]?.ordersCompleted !== b[i]?.ordersCompleted) return false;
      if (a[i]?.updatedAt !== b[i]?.updatedAt) return false;
      if (a[i]?.name !== b[i]?.name) return false;
    }
    return true;
  };

  const fetchDatabase = async (
    isManual = false,
    options?: { startDate?: string; endDate?: string; loadAll?: boolean; initialOnly?: boolean }
  ) => {
    if (isManual) setIsSyncing(true);
    try {
      const today = getTodayISO();
      const hasActiveRange = Boolean(dashboardFilterStart && dashboardFilterStart !== today);
      const shouldLoadAll = options?.loadAll || isFullHistoryLoaded;
      const isInitial = options?.initialOnly ?? (!shouldLoadAll && !options?.startDate && !hasActiveRange);
      const start = shouldLoadAll ? '' : (options?.startDate || (hasActiveRange ? dashboardFilterStart : today));
      const end = shouldLoadAll ? '' : (options?.endDate || (hasActiveRange ? dashboardFilterEnd : today));

      const queryParams = new URLSearchParams();
      if (shouldLoadAll) {
        queryParams.set('loadAll', 'true');
      } else {
        if (isInitial) queryParams.set('initialOnly', 'true');
        if (start) queryParams.set('startDate', start);
        if (end) queryParams.set('endDate', end);
        queryParams.set('includeActive', 'true');
      }

      const resBootstrap = await fetch(`/api/bootstrap-db?${queryParams.toString()}`).then(r => {
        if (!r.ok) throw new Error(`API bootstrap error: ${r.status}`);
        return r.json();
      });

      if (Array.isArray(resBootstrap.deletedOrderIds)) {
        resBootstrap.deletedOrderIds.forEach((dId: string) => markOrderAsDeleted(dId));
      }

      const resOrders = (resBootstrap.orders || []).filter((o: any) => 
        o && 
        o.id !== 'CLI-001-100' && 
        !String(o.id).startsWith('MOCK-') &&
        !String(o.id).startsWith('TEST-') &&
        !isOrderDeleted(o)
      );
      if (typeof resBootstrap.totalOrdersInDb === 'number') {
        setTotalOrdersInDb(resBootstrap.totalOrdersInDb);
      }
      if (options?.loadAll || resBootstrap.hasMoreHistorical === false) {
        setIsFullHistoryLoaded(true);
      }
      const resCouriers = resBootstrap.couriers || [];
      const resActivities = resBootstrap.activities || [];
      const resPartners = resBootstrap.partnerClients || [];
      const resRegions = resBootstrap.regionDistribution || [];
      const resHourly = resBootstrap.hourlyStats || [];
      const resHubs = (resBootstrap.hubs && resBootstrap.hubs.length > 0) ? resBootstrap.hubs : DEFAULT_HUBS;
      const resFreightRules = resBootstrap.freightRules || [];

      // Maintain complete real database in master orders state
      setOrders(prevOrders => {
        const deletedIds = getDeletedOrderIds();
        const cleanedPrev = (prevOrders || []).filter(o => o && !isOrderDeleted(o, deletedIds));
        const merged = mergeOrdersWithVersionTimestamp(cleanedPrev, resOrders);
        if (prevOrders && prevOrders.length > 0) {
          merged.forEach((newOrder: Order) => {
            const oldOrder = prevOrders.find(o => o.id === newOrder.id);
            if (oldOrder) {
              const becameOcorrencia = 
                (newOrder.status === 'cancelled' || newOrder.status === 'failure') &&
                (oldOrder.status !== 'cancelled' && oldOrder.status !== 'failure');
              
              if (becameOcorrencia) {
                const courier = resCouriers.find((c: any) => c.id === newOrder.courierId);
                const courierName = courier ? courier.name : 'Entregador';
                
                const alertId = `alert-${Date.now()}-${newOrder.id}`;
                const timeStr = formatToBrasiliaTime(new Date(), true);
                
                setOcorrenciaAlerts(prevAlerts => {
                  if (prevAlerts.some(a => a.orderId === newOrder.id)) return prevAlerts;
                  playOcorrenciaSound();
                  return [{
                    id: alertId,
                    orderId: newOrder.id,
                    customerName: newOrder.customerName,
                    courierName: courierName,
                    time: timeStr,
                    status: newOrder.status,
                    region: newOrder.region
                  }, ...prevAlerts];
                });
                
                setNotifications(n => n + 1);
              }
            }
          });
        }
        return merged;
      });
      setCouriers(prev => areSimpleListsEqual(prev, resCouriers) ? prev : resCouriers);
      setActivities(prev => areSimpleListsEqual(prev, resActivities) ? prev : resActivities);
      setPartnerClients(prev => areSimpleListsEqual(prev, resPartners) ? prev : resPartners);
      setRegionDistribution(prev => areSimpleListsEqual(prev, resRegions) ? prev : resRegions);
      setHourlyStats(prev => areSimpleListsEqual(prev, resHourly) ? prev : resHourly);
      setHubs(prev => areSimpleListsEqual(prev, resHubs) ? prev : resHubs);
      if (resFreightRules && resFreightRules.length > 0) {
        setFreightRules(prev => areSimpleListsEqual(prev, resFreightRules) ? prev : resFreightRules);
      }
      setIsLoading(false);
      setIsBackendOffline(false);
      if (isManual) setIsSyncing(false);
      
      // Persist latest operational database to IndexedDB
      Promise.all([
        saveAllToStore('orders', resOrders),
        saveAllToStore('couriers', resCouriers),
        saveAllToStore('activities', resActivities),
        saveAllToStore('partners', resPartners),
        saveAllToStore('hubs', resHubs),
        setVal('vinimap_regions', resRegions),
        setVal('vinimap_hourly', resHourly),
        ...(resFreightRules && resFreightRules.length > 0 ? [setVal('vinimap_freight_rules', resFreightRules)] : [])
      ]).catch(e => console.error('[IndexedDB Sync Error]', e));
      
      // Update sync state successfully
      setSyncStatus('online');
      setSyncTime(formatToBrasiliaTime(new Date(), true));
    } catch (err) {
      if (isManual) setIsSyncing(false);
      setIsBackendOffline(true);
      console.warn('Servidor local /api/bootstrap-db inacessível (ambiente Shard Cloud ou servidor iniciando). Tentando carregar dados do Supabase diretamente pelo navegador...', err);
      
      try {
        const supabaseData = await fetchFromSupabaseDirectly();
        console.log('[Supabase Direct Sync] Sincronizado com sucesso diretamente com o Supabase REST via navegador!');
        
        setOrders(prevOrders => mergeOrdersWithVersionTimestamp(prevOrders, supabaseData.resOrders));
        setCouriers(supabaseData.resCouriers);
        setActivities(supabaseData.resActivities);
        setPartnerClients(supabaseData.resPartners);
        setHubs(supabaseData.resHubs);
        if (supabaseData.resFreightRules && supabaseData.resFreightRules.length > 0) {
          setFreightRules(supabaseData.resFreightRules);
        }

        // Persist latest Supabase records to IndexedDB
        Promise.all([
          saveAllToStore('orders', supabaseData.resOrders),
          saveAllToStore('couriers', supabaseData.resCouriers),
          saveAllToStore('activities', supabaseData.resActivities),
          saveAllToStore('partners', supabaseData.resPartners),
          saveAllToStore('hubs', supabaseData.resHubs),
          ...(supabaseData.resFreightRules && supabaseData.resFreightRules.length > 0 ? [setVal('vinimap_freight_rules', supabaseData.resFreightRules)] : [])
        ]).catch(e => console.error('[IndexedDB Supabase Sync Error]', e));

        setIsLoading(false);
        setSyncStatus('online'); // Online via direct Supabase REST
        setSyncTime(formatToBrasiliaTime(new Date(), true));
        return;
      } catch (supabaseErr) {
        console.warn('[Supabase Sync Fallback] Não foi possível ler diretamente do Supabase no cliente:', supabaseErr);
      }

      if (!isFirestoreQuotaExceeded()) {
        try {
          const firestoreData = await fetchFromFirestoreDirectly(options);
          console.log('[Firestore Sync] Sincronizado com sucesso diretamente com o Firestore em nuvem!');
          
          setOrders(firestoreData.resOrders);
          setCouriers(firestoreData.resCouriers);
          setActivities(firestoreData.resActivities);
          setPartnerClients(firestoreData.resPartners);
          setRegionDistribution(firestoreData.resRegions);
          setHourlyStats(firestoreData.resHourly);
          setHubs((firestoreData.resHubs && firestoreData.resHubs.length > 0) ? firestoreData.resHubs : DEFAULT_HUBS);
          
          // Persist latest Firestore records to IndexedDB
          Promise.all([
            saveAllToStore('orders', firestoreData.resOrders),
            saveAllToStore('couriers', firestoreData.resCouriers),
            saveAllToStore('activities', firestoreData.resActivities),
            saveAllToStore('partners', firestoreData.resPartners),
            saveAllToStore('hubs', firestoreData.resHubs),
            setVal('vinimap_regions', firestoreData.resRegions),
            setVal('vinimap_hourly', firestoreData.resHourly)
          ]).catch(e => console.error('[IndexedDB Firestore Sync Error]', e));

          setIsLoading(false);
          setSyncStatus('online'); // Since we connected to Firestore, we are online!
          setSyncTime(formatToBrasiliaTime(new Date(), true));
          
          return;
        } catch (firestoreErr) {
          console.error('[Firestore Sync Error] Falha crítica ao sincronizar com o Firestore diretamente:', firestoreErr);
        }
      }

      setSyncStatus('offline');
      
      const errMsg = err instanceof Error ? err.message : String(err);
      const newErr = {
        id: `sync-err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        errorType: 'CONNECTION_FAILURE',
        message: 'Falha na requisição de sincronização com o banco remoto',
        details: errMsg,
        endpoint: '/api/*',
        severity: 'error' as const
      };
      setSyncErrors(prev => [newErr, ...prev]);
      
      // Attempt to load from high-capacity IndexedDB cache as contingency fallback
      try {
        const [
          dbOrders, 
          dbCouriers, 
          dbActivities, 
          dbPartners, 
          dbHubs,
          dbRegions,
          dbHourly
        ] = await Promise.all([
          getAllFromStore<Order>('orders'),
          getAllFromStore<Courier>('couriers'),
          getAllFromStore<Activity>('activities'),
          getAllFromStore<PartnerClient>('partners'),
          getAllFromStore<any>('hubs'),
          getVal('vinimap_regions'),
          getVal('vinimap_hourly')
        ]);

        const deletedIds = getDeletedOrderIds();
        const nonDeletedOrders = (dbOrders || []).filter(o => o && !isOrderDeleted(o, deletedIds));
        setOrders(nonDeletedOrders);
        setCouriers(dbCouriers && dbCouriers.length > 0 ? dbCouriers : []);
        setActivities(dbActivities && dbActivities.length > 0 ? dbActivities : []);
        setPartnerClients(dbPartners && dbPartners.length > 0 ? dbPartners : []);
        setRegionDistribution((dbRegions as RegionDistribution[]) || []);
        setHourlyStats((dbHourly as HourlyStat[]) || []);
        setHubs(dbHubs && dbHubs.length > 0 ? dbHubs : DEFAULT_HUBS);
        
        setIsLoading(false);
      } catch (cacheErr) {
        console.error('Erro ao ler cache local de contingência de IndexedDB:', cacheErr);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Dynamic client-side stats calculation for offline/Shard Cloud environment
  const calculateClientStats = (currentOrders: Order[]) => {
    // 1. Region Distribution
    const regionColors: any = {
      "Centro-Paulista": "bg-blue-600",
      "Zona Sul": "bg-sky-500",
      "Zona Oeste": "bg-indigo-500",
      "Zona Norte": "bg-cyan-500",
      "Zona Leste": "bg-teal-500"
    };

    const liveCounts: any = {};
    currentOrders.forEach((o: any) => {
      if (o.status !== "cancelled") {
        const region = o.region || "Centro-Paulista";
        liveCounts[region] = (liveCounts[region] || 0) + 1;
      }
    });

    const computedDistribution = Object.keys(regionColors).map((regName) => {
      const currentCount = liveCounts[regName] || 0;

      return {
        name: regName,
        orders: currentCount,
        percentage: 0,
        color: regionColors[regName]
      };
    });

    const totalSum = computedDistribution.reduce((acc, curr) => acc + curr.orders, 0);
    computedDistribution.forEach((reg) => {
      reg.percentage = totalSum > 0 ? Math.round((reg.orders / totalSum) * 100) : 0;
    });

    // 2. Hourly Stats (calculated dynamically from real orders)
    const baseHours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    const hourlyCounts = baseHours.reduce((acc, h) => {
      acc[h] = { hour: h, created: 0, delivered: 0 };
      return acc;
    }, {} as Record<string, { hour: string, created: number, delivered: number }>);

    currentOrders.forEach((o: any) => {
      let hourStr = "12:00";
      if (o.time && typeof o.time === 'string' && o.time.includes(':')) {
        const parts = o.time.split(':');
        const hh = parts[0].trim().padStart(2, '0');
        hourStr = `${hh}:00`;
      }
      if (hourlyCounts[hourStr]) {
        hourlyCounts[hourStr].created++;
        if (o.status === "delivered") {
          hourlyCounts[hourStr].delivered++;
        }
      }
    });

    const enhancedHourlyStats = Object.values(hourlyCounts);

    return {
      regionDistribution: computedDistribution,
      hourlyStats: enhancedHourlyStats
    };
  };

  useEffect(() => {
    if (orders.length > 0) {
      const stats = calculateClientStats(orders);
      setRegionDistribution(stats.regionDistribution);
      setHourlyStats(stats.hourlyStats);
      try {
        localStorage.setItem('vinimap_regions', JSON.stringify(stats.regionDistribution));
        localStorage.setItem('vinimap_hourly', JSON.stringify(stats.hourlyStats));
      } catch (e) {}
    }
  }, [orders]);

  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded()) {
      return;
    }

    console.log("[Firestore Sync] Ativando ouvintes em tempo real para Firestore...");

    let isDetached = false;
    // Optimize Firestore reads: listen only to active orders to avoid pulling all historical orders on start
    const activeOrdersQuery = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'in_progress', 'in_route', 'failure'])
    );
    const unsubscribeOrders = onSnapshot(activeOrdersQuery, (snapshot) => {
      if (isDetached) return;
      const deletedIds = getDeletedOrderIds();
      const list: Order[] = [];
      snapshot.forEach(d => {
        const ord = d.data() as Order;
        if (
          ord && 
          !isOrderDeleted(ord, deletedIds) &&
          ord.id !== 'CLI-001-100' && 
          !String(ord.id).startsWith('MOCK-') &&
          !String(ord.id).startsWith('TEST-')
        ) {
          list.push(ord);
        }
      });
      setOrders(prevOrders => mergeOrdersWithVersionTimestamp(prevOrders, list));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'orders');
    });

    const unsubscribeCouriers = onSnapshot(collection(db, 'couriers'), (snapshot) => {
      if (isDetached) return;
      const list: Courier[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as Courier);
      });
      setCouriers(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'couriers');
    });

    const unsubscribeActivities = onSnapshot(collection(db, 'activities'), (snapshot) => {
      if (isDetached) return;
      const list: Activity[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as Activity);
      });
      list.sort((a, b) => b.id.localeCompare(a.id));
      setActivities(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'activities');
    });

    const unsubscribePartners = onSnapshot(collection(db, 'partnerClients'), (snapshot) => {
      if (isDetached) return;
      const list: PartnerClient[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as PartnerClient);
      });
      setPartnerClients(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'partnerClients');
    });

    const unsubscribeHubs = onSnapshot(collection(db, 'hubs'), (snapshot) => {
      if (isDetached) return;
      const list: HubCentral[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as HubCentral);
      });
      setHubs(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'hubs');
    });

    const unsubscribeFreightRules = onSnapshot(collection(db, 'freightRules'), (snapshot) => {
      if (isDetached) return;
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push(d.data());
      });
      setFreightRules(list);
      try {
        localStorage.setItem('vinimap_freight_rules', JSON.stringify(list));
      } catch (e) {}
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'freightRules');
    });

    const detachAll = () => {
      if (isDetached) return;
      isDetached = true;
      try { unsubscribeOrders(); } catch (_) {}
      try { unsubscribeCouriers(); } catch (_) {}
      try { unsubscribeActivities(); } catch (_) {}
      try { unsubscribePartners(); } catch (_) {}
      try { unsubscribeHubs(); } catch (_) {}
      try { unsubscribeFreightRules(); } catch (_) {}
    };

    const quotaUnsub = onFirestoreQuotaExceeded((exceeded) => {
      if (exceeded) {
        console.warn("[Firestore Sync] Cota diária do Firestore atingida. Desconectando ouvintes em tempo real do Firestore.");
        detachAll();
      }
    });

    return () => {
      detachAll();
      quotaUnsub();
    };
  }, [db]);

  useEffect(() => {
    // Proactively hydrate state from IndexedDB on startup
    const hydrateFromIndexedDB = async () => {
      try {
        const [
          dbOrders, 
          dbCouriers, 
          dbActivities, 
          dbPartners, 
          dbHubs,
          dbRegions,
          dbHourly
        ] = await Promise.all([
          getAllFromStore<Order>('orders'),
          getAllFromStore<Courier>('couriers'),
          getAllFromStore<Activity>('activities'),
          getAllFromStore<PartnerClient>('partners'),
          getAllFromStore<any>('hubs'),
          getVal('vinimap_regions'),
          getVal('vinimap_hourly')
        ]);

        if (dbOrders && dbOrders.length > 0) {
          const deletedIds = getDeletedOrderIds();
          // Iniciar o dia zerando os totais: carregar inicialmente apenas pedidos de hoje ou ativos/pendentes
          const todayIso = getTodayISO();
          const initialDbOrders = dbOrders.filter(o => {
            if (!o || isOrderDeleted(o, deletedIds)) return false;
            const isActive = o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route' || o.status === 'failure';
            const rawDateStr = o.dataSolicitacao || (typeof o.createdAt === 'string' ? o.createdAt : (typeof o.createdAt === 'number' ? formatToBrasiliaDate(new Date(o.createdAt)) : ''));
            const orderDate = parseToISODate(rawDateStr);
            return isActive || (orderDate === todayIso);
          });
          setOrders(initialDbOrders);
        }
        if (dbCouriers && dbCouriers.length > 0) setCouriers(dbCouriers);
        if (dbActivities && dbActivities.length > 0) setActivities(dbActivities);
        if (dbPartners && dbPartners.length > 0) setPartnerClients(dbPartners);
        if (dbHubs && dbHubs.length > 0) setHubs(dbHubs);
        if (dbRegions) setRegionDistribution(dbRegions as RegionDistribution[]);
        if (dbHourly) setHourlyStats(dbHourly as HourlyStat[]);
      } catch (err) {
        console.error('Erro ao pré-hidratar estado com IndexedDB:', err);
      }
    };
    hydrateFromIndexedDB();
  }, []);

  useEffect(() => {
    // Dynamic Supabase client configuration fetching
    const fetchSupabaseConfig = async () => {
      try {
        const response = await fetch('/api/supabase-config');
        if (response.ok) {
          const config = await response.json();
          if (config.supabaseUrl && config.supabaseAnonKey) {
            const success = updateSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
            if (success) {
              console.log("[Supabase Config] Supabase client updated with server configuration!");
            }
          }
        }
      } catch (err) {
        console.warn("[Supabase Config] Failed to fetch dynamic Supabase configuration from backend:", err);
      }
    };
    fetchSupabaseConfig();
  }, []);

  useEffect(() => {
    // Initial bootstrap: load initial state from database once on app start (today's orders + active)
    fetchDatabase(false, { initialOnly: true });

    // Register Push Notifications & SW
    registerPushNotifications().then(token => {
      console.log("[FCM Client] Registrado no Service Worker com token:", token);
    });

    // Foreground listener for genuine FCM Web-Push messages (shows real-time toast alerts)
    const unsubscribeFCM = onMessageReceived((payload) => {
      console.log("[FCM Client] Mensagem recebida em primeiro plano:", payload);
      const title = payload.notification?.title || payload.data?.title || "Atualização Logística";
      const body = payload.notification?.body || payload.data?.body || "Você tem uma atualização de campo.";
      const type = payload.data?.type || "general";

      // Do not show floating toast if the message is about delivery completion or allocation (despoluindo a tela do adm)
      const isDelivered = 
        type === 'order_delivered' ||
        type === 'delivered' ||
        (title && (title.toLowerCase().includes('concluido') || title.toLowerCase().includes('concluído') || title.toLowerCase().includes('entregue') || title.toLowerCase().includes('delivered'))) ||
        (body && (body.toLowerCase().includes('concluido') || body.toLowerCase().includes('concluído') || body.toLowerCase().includes('entregue') || body.toLowerCase().includes('delivered')));

      const isAllocation =
        type === 'order_assigned' ||
        type === 'assigned' ||
        type === 'allocation' ||
        (title && (
          title.toLowerCase().includes('atribuído') || 
          title.toLowerCase().includes('atribuido') || 
          title.toLowerCase().includes('alocaç') || 
          title.toLowerCase().includes('alocac') || 
          title.toLowerCase().includes('alocado') || 
          title.toLowerCase().includes('nova rota')
        )) ||
        (body && (
          body.toLowerCase().includes('atribuído') || 
          body.toLowerCase().includes('atribuido') || 
          body.toLowerCase().includes('alocaç') || 
          body.toLowerCase().includes('alocac') || 
          body.toLowerCase().includes('alocado') || 
          body.toLowerCase().includes('nova rota')
        ));

      if (!isDelivered && !isAllocation) {
        setPushToasts(prev => [{
          id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title,
          body,
          type
        }, ...prev]);

        playOcorrenciaSound();
      }
    });

    return () => {
      unsubscribeFCM();
    };
  }, []);

  // Lazy load orders for a specific date range when selected by the administrator
  const lazyLoadPeriod = async (startDate: string, endDate: string) => {
    if (isFullHistoryLoaded) return;
    setIsLoadingPeriod(true);
    try {
      const queryParams = new URLSearchParams({
        startDate,
        endDate,
        includeActive: 'true'
      });
      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newOrders = Array.isArray(data) ? data : (data.orders || []);
        const validOrders = newOrders.filter((o: any) => 
          o && 
          o.id !== 'CLI-001-100' && 
          !String(o.id).startsWith('MOCK-') &&
          !String(o.id).startsWith('TEST-')
        );
        setOrders(prev => mergeOrdersWithVersionTimestamp(prev, validOrders));
        if (typeof data.totalOrdersInDb === 'number') {
          setTotalOrdersInDb(data.totalOrdersInDb);
        }
        if (data.hasMoreHistorical === false) {
          setIsFullHistoryLoaded(true);
        }
      }
    } catch (err) {
      console.warn('[Lazy Load Period] Falha ao carregar período:', err);
    } finally {
      setIsLoadingPeriod(false);
    }
  };

  // Lazy load all historical orders on demand when requested
  const lazyLoadFullHistory = async () => {
    if (isFullHistoryLoaded) return;
    setIsLoadingPeriod(true);
    try {
      const res = await fetch('/api/orders?loadAll=true');
      if (res.ok) {
        const data = await res.json();
        const newOrders = Array.isArray(data) ? data : (data.orders || []);
        const validOrders = newOrders.filter((o: any) => 
          o && 
          o.id !== 'CLI-001-100' && 
          !String(o.id).startsWith('MOCK-') &&
          !String(o.id).startsWith('TEST-')
        );
        setOrders(prev => mergeOrdersWithVersionTimestamp(prev, validOrders));
        setIsFullHistoryLoaded(true);
        if (typeof data.totalOrdersInDb === 'number') {
          setTotalOrdersInDb(data.totalOrdersInDb);
        }
      }
    } catch (err) {
      console.warn('[Lazy Load Full History] Falha ao carregar histórico completo:', err);
    } finally {
      setIsLoadingPeriod(false);
    }
  };

  const handleDateFilterChange = useCallback((enabled: boolean, startDate: string, endDate: string) => {
    setDashboardFilterEnabled(enabled);
    setDashboardFilterStart(startDate);
    setDashboardFilterEnd(endDate);
  }, []);

  // Sync state: When a courier is selected, find if they have an active order in route
  useEffect(() => {
    if (selectedCourierId) {
      // Auto-focus active order search or highlight
      const activeOrder = orders.find(o => o.courierId === selectedCourierId && o.status === 'in_route');
      console.log('Foco no entregador selecionado no mapa:', selectedCourierId, activeOrder);
    }
  }, [selectedCourierId, orders]);

  // Handler for adding a new partner client
  const handleAddPartner = async (newPartnerData: Omit<PartnerClient, 'id' | 'createdAt'>) => {
    console.log('[DEBUG SHARD CLOUD] Iniciando cadastro de cliente parceiro:', newPartnerData);
    try {
      const res = await fetch('/api/partner-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPartnerData)
      });
      
      console.log(`[DEBUG SHARD CLOUD] Resposta HTTP de parceiros recebida: Status ${res.status} (${res.statusText})`);
      const contentType = res.headers.get('content-type') || '';
      console.log(`[DEBUG SHARD CLOUD] Headers content-type: ${contentType}`);

      if (res.ok && contentType.includes('application/json')) {
        const textData = await res.clone().text().catch(() => '');
        console.log('[DEBUG SHARD CLOUD] Corpo da resposta de sucesso:', textData);
        await fetchDatabase();
        setNotifications(prev => prev + 1);
        return;
      }
      
      const errorText = await res.text().catch(() => 'Não foi possível ler o texto da resposta');
      console.error('[DEBUG SHARD CLOUD ERRO] Resposta de falha de cadastro do cliente parceiro!');
      console.error('[DEBUG SHARD CLOUD ERRO] Status:', res.status, res.statusText);
      console.error('[DEBUG SHARD CLOUD ERRO] Corpo da resposta:', errorText);

      let apiError = 'Falha ao cadastrar no servidor.';
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(errorText);
          apiError = parsed.error || apiError;
        } catch (e) {}
      } else {
        apiError = `Erro ${res.status}: ${res.statusText || 'Resposta não-JSON ou offline'}`;
      }
      throw new Error(apiError);
    } catch (err) {
      console.error('[DEBUG SHARD CLOUD CATCH] Erro capturado no handleAddPartner:', err);
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Usando armazenamento local e nuvem direta:', err);
      
      const ids = partnerClients.map((p: any) => {
        if (!p || !p.id || typeof p.id !== "string") return 0;
        const match = p.id.match(/CLI-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextIdNum = Math.max(...ids, 0) + 1;
      const newId = `CLI-${String(nextIdNum).padStart(3, "0")}`;
      
      const newPartner: PartnerClient = {
        ...newPartnerData,
        id: newId,
        createdAt: formatToBrasiliaDate(new Date())
      };

      // Real Cloud Sync direct-write if Firestore is initialized
      if (db) {
        try {
          await setDoc(doc(db, 'partnerClients', newId), newPartner);
          console.log('[Firestore Direct Write] Parceiro salvo diretamente no Firestore com sucesso:', newId);
        } catch (fsErr) {
          console.error('[Firestore Direct Write Error] Falha ao salvar parceiro diretamente no Firestore:', fsErr);
        }
      }

      setPartnerClients(prev => {
        const updated = [...prev, newPartner];
        localStorage.setItem('vinimap_partners', JSON.stringify(updated));
        return updated;
      });

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: timeStr,
        type: "courier_status",
        message: `Novo Cliente Parceiro cadastrado: ${newPartner.name}`,
        details: `Código associado: ${newId} • Sincronizado na Nuvem`
      };

      // Sync activity to cloud
      if (db) {
        try {
          await setDoc(doc(db, 'activities', newActivity.id), newActivity);
        } catch (fsErr) {}
      }

      setActivities(prev => {
        const updated = [newActivity, ...prev];
        localStorage.setItem('vinimap_activities', JSON.stringify(updated));
        return updated;
      });

      setNotifications(prev => prev + 1);
    }
  };

  const handleUpdatePartner = async (id: string, updatedData: Partial<PartnerClient>) => {
    try {
      const res = await fetch(`/api/partner-clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
      return;
    } catch (err) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Atualizando localmente e na nuvem:', err);
      setPartnerClients(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, ...updatedData } : p);
        localStorage.setItem('vinimap_partners', JSON.stringify(updated));
        
        // Save direct-write to Firestore
        if (db) {
          const updatedDoc = updated.find(p => p.id === id);
          if (updatedDoc) {
            setDoc(doc(db, 'partnerClients', id), updatedDoc).catch(fsErr => {
              console.error('[Firestore Direct Update Error] Falha ao atualizar parceiro no Firestore:', fsErr);
            });
          }
        }
        return updated;
      });
    }
  };

  const handleDeletePartner = async (id: string) => {
    try {
      const res = await fetch(`/api/partner-clients/${id}`, {
        method: 'DELETE'
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
      return;
    } catch (err) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Excluindo localmente e na nuvem:', err);
      setPartnerClients(prev => {
        const updated = prev.filter(p => p.id !== id);
        localStorage.setItem('vinimap_partners', JSON.stringify(updated));
        
        // Delete directly from Firestore
        if (db) {
          deleteDoc(doc(db, 'partnerClients', id)).catch(fsErr => {
            console.error('[Firestore Direct Delete Error] Falha ao deletar parceiro no Firestore:', fsErr);
          });
        }
        return updated;
      });
    }
  };

  // Handler for registering a new Courier
  const handleAddCourier = async (newCourierData: Omit<Courier, 'id' | 'ordersCompleted' | 'currentLat' | 'currentLng' | 'avatar' | 'status' | 'rating'>) => {
    console.log('[DEBUG SHARD CLOUD] Iniciando cadastro de condutor/entregador:', newCourierData);
    
    // Prevent client-side duplicate registrations by phone
    const cleanPhone = String(newCourierData.phone || '').replace(/\D/g, '');
    if (cleanPhone) {
      const existing = couriers.find(c => c && c.phone && String(c.phone).replace(/\D/g, '') === cleanPhone);
      if (existing) {
        throw new Error(`Já existe um entregador cadastrado sob este telefone: ${existing.name}`);
      }
    }

    try {
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourierData)
      });
      
      console.log(`[DEBUG SHARD CLOUD] Resposta HTTP de condutores recebida: Status ${res.status} (${res.statusText})`);
      const contentType = res.headers.get('content-type') || '';
      console.log(`[DEBUG SHARD CLOUD] Headers content-type: ${contentType}`);

      if (res.ok && contentType.includes('application/json')) {
        const textData = await res.clone().text().catch(() => '');
        console.log('[DEBUG SHARD CLOUD] Corpo da resposta de sucesso:', textData);
        
        // Also ensure direct write to Supabase from browser client for guaranteed Shard Cloud persistence
        try {
          const { supabase } = await import('./lib/supabase');
          if (supabase) {
            const parsed = JSON.parse(textData);
            const savedCur = parsed.courier || newCourierData;
            await supabase.from('couriers').upsert({
              id: savedCur.id,
              name: savedCur.name,
              avatar: savedCur.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
              status: savedCur.status || "online",
              rating: 5.0,
              vehicle: savedCur.vehicle || "motorcycle",
              phone: savedCur.phone,
              password: savedCur.password ? String(savedCur.password) : null,
              is_active: savedCur.isActive !== false,
              repasse_taxa: Number(savedCur.repasseTaxa) || 9.50,
              repasse_formato: savedCur.repasseFormato || 'tabela_cep',
              repasse_porcentagem: Number(savedCur.repassePorcentagem) || 80
            });
            console.log('[Supabase Direct Sync] Condutor persistido diretamente no Supabase!');
          }
        } catch (sbErr) {
          console.warn('[Supabase Direct Sync Warning]', sbErr);
        }

        await fetchDatabase();
        setNotifications(prev => prev + 1);
        return;
      }
      
      const errorText = await res.text().catch(() => 'Não foi possível ler o texto da resposta');
      console.error('[DEBUG SHARD CLOUD ERRO] Resposta de falha de cadastro de condutor!');
      console.error('[DEBUG SHARD CLOUD ERRO] Status:', res.status, res.statusText);
      console.error('[DEBUG SHARD CLOUD ERRO] Corpo da resposta:', errorText);

      let apiError = 'Falha ao cadastrar no servidor.';
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(errorText);
          apiError = parsed.error || apiError;
        } catch (e) {}
      } else {
        apiError = `Erro ${res.status}: ${res.statusText || 'Resposta não-JSON ou offline'}`;
      }
      throw new Error(apiError);
    } catch (err: any) {
      // Re-throw validation errors to display immediately to user
      if (err.message && err.message.includes('Já existe um entregador')) {
        throw err;
      }

      console.error('[DEBUG SHARD CLOUD CATCH] Erro capturado no handleAddCourier:', err);
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Cadastrando entregador localmente e na nuvem:', err);
      
      const ids = couriers.map((c: any) => {
        if (!c || !c.id || typeof c.id !== "string") return 0;
        const parts = c.id.split("-");
        return parseInt(parts[1] || parts[0]) || 0;
      });
      const nextIdNum = Math.max(...ids, 0) + 1;
      const newId = `ent-${nextIdNum}`;

      const newCourier: Courier = {
        ...newCourierData,
        id: newId,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
        status: "online",
        rating: 5.0,
        ordersCompleted: 0,
        currentLat: -23.530385 + (Math.random() - 0.5) * 0.02,
        currentLng: -46.702677 + (Math.random() - 0.5) * 0.02
      };

      // Real Cloud Sync direct-write if Firestore is initialized
      if (db) {
        try {
          await setDoc(doc(db, 'couriers', newId), newCourier);
          console.log('[Firestore Direct Write] Entregador salvo diretamente no Firestore com sucesso:', newId);
        } catch (fsErr) {
          console.error('[Firestore Direct Write Error] Falha ao salvar entregador diretamente no Firestore:', fsErr);
        }
      }

      // Real Cloud Sync direct-write to Supabase
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          await supabase.from('couriers').upsert({
            id: newId,
            name: newCourier.name,
            avatar: newCourier.avatar,
            status: 'online',
            rating: 5.0,
            vehicle: newCourier.vehicle,
            phone: newCourier.phone,
            password: newCourier.password ? String(newCourier.password) : null,
            is_active: newCourier.isActive !== false,
            repasse_taxa: Number(newCourier.repasseTaxa) || 9.50,
            repasse_formato: newCourier.repasseFormato || 'tabela_cep',
            repasse_porcentagem: Number(newCourier.repassePorcentagem) || 80
          });
          console.log('[Supabase Direct Write] Entregador salvo diretamente no Supabase com sucesso:', newId);
        }
      } catch (sbErr) {
        console.warn('[Supabase Direct Write Error] Falha ao salvar no Supabase:', sbErr);
      }

      setCouriers(prev => {
        const updated = [...prev, newCourier];
        localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
        return updated;
      });

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        time: timeStr,
        type: "courier_status",
        message: `Novo Entregador Credenciado: ${newCourier.name}`,
        details: `Login de acesso: ${newCourier.phone} • Sincronizado na Nuvem`
      };

      // Sync activity to cloud
      if (db) {
        try {
          await setDoc(doc(db, 'activities', newActivity.id), newActivity);
        } catch (fsErr) {}
      }

      setActivities(prev => {
        const updated = [newActivity, ...prev];
        localStorage.setItem('vinimap_activities', JSON.stringify(updated));
        return updated;
      });

      setNotifications(prev => prev + 1);
    }
  };

  const handleUpdateCourier = async (id: string, updatedData: Partial<Courier>) => {
    let mergedCourier: Courier | undefined;
    // 1. Optimistic UI update immediately
    setCouriers(prev => {
      const updated = prev.map(c => {
        if (c.id === id) {
          mergedCourier = { ...c, ...updatedData };
          return mergedCourier;
        }
        return c;
      });
      localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
      return updated;
    });

    // 2. Direct Firestore update if available with guaranteed merged data
    if (db) {
      const dataToSave = mergedCourier || { id, ...updatedData };
      setDoc(doc(db, 'couriers', id), dataToSave, { merge: true }).catch(fsErr => {
        console.error('[Firestore Direct Update Error] Falha ao atualizar condutor no Firestore:', fsErr);
      });
    }

    // 3. Backend PUT call
    try {
      const res = await fetch(`/api/couriers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.warn('Backend offline ou erro ao atualizar entregador no servidor:', err);
    }
  };

  const handleDeleteCourier = async (id: string) => {
    const courier = couriers.find(c => c.id === id);
    const cleanPhone = courier?.phone ? String(courier.phone).replace(/\D/g, '') : '';
    
    // Regra de Negócio: se houver pedidos no histórico do condutor, ele NÃO pode ser excluído, somente inativado!
    const hasOrders = orders.some(o => 
      o && (
        o.courierId === id || 
        (o as any).courier_id === id || 
        (cleanPhone && o.dispositivoCondutor && String(o.dispositivoCondutor).replace(/\D/g, '') === cleanPhone)
      )
    );

    if (hasOrders) {
      const confirmInactivate = window.confirm(
        `O condutor "${courier?.name || id}" possui histórico de pedidos vinculado às operações e NÃO pode ser excluído permanentemente, somente inativado.\n\nDeseja INATIVAR o condutor agora? O administrador poderá reativá-lo ou inativá-lo a qualquer momento.`
      );
      if (confirmInactivate) {
        await handleUpdateCourier(id, { isActive: false });
        alert(`O condutor "${courier?.name || id}" foi inativado com sucesso.`);
      }
      return;
    }

    try {
      const res = await fetch(`/api/couriers/${id}`, {
        method: 'DELETE'
      });
      await ensureJsonResponse(res);

      // Direct Supabase delete if active
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          await supabase.from('couriers').delete().eq('id', id);
        }
      } catch (sbErr) {
        console.warn('[Supabase Direct Delete Error]', sbErr);
      }

      await fetchDatabase();
      return;
    } catch (err: any) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Excluindo entregador localmente e na nuvem:', err);
      
      // Direct Supabase delete
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          await supabase.from('couriers').delete().eq('id', id);
        }
      } catch (sbErr) {}

      setCouriers(prev => {
        const updated = prev.filter(c => c.id !== id);
        localStorage.setItem('vinimap_couriers', JSON.stringify(updated));

        // Delete directly from Firestore
        if (db) {
          deleteDoc(doc(db, 'couriers', id)).catch(fsErr => {
            console.error('[Firestore Direct Delete Error] Falha ao deletar condutor no Firestore:', fsErr);
          });
        }
        return updated;
      });
    }
  };

  // Handlers for HUB Central configuration
  const handleAddHub = async (newHubData: Omit<HubCentral, 'id'>) => {
    try {
      const res = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHubData)
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
      setNotifications(prev => prev + 1);
    } catch (err) {
      console.error('Erro ao cadastrar HUB, usando nuvem direta e local:', err);
      const newId = `hub-${Date.now()}`;
      const newHub: HubCentral = {
        ...newHubData,
        id: newId
      };
      
      if (db) {
        try {
          await setDoc(doc(db, 'hubs', newId), newHub);
          console.log('[Firestore Direct Write] HUB salvo diretamente no Firestore:', newId);
        } catch (fsErr) {
          console.error('[Firestore Direct Write Error] Falha ao salvar HUB no Firestore:', fsErr);
        }
      }

      setHubs(prev => {
        const updated = [...prev, newHub];
        localStorage.setItem('vinimap_hubs', JSON.stringify(updated));
        return updated;
      });
      setNotifications(prev => prev + 1);
    }
  };

  const handleUpdateHub = async (id: string, updatedData: Partial<HubCentral>) => {
    try {
      const res = await fetch(`/api/hubs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.error('Erro ao atualizar HUB, usando nuvem direta e local:', err);
      setHubs(prev => {
        const updated = prev.map(h => h.id === id ? { ...h, ...updatedData } : h);
        localStorage.setItem('vinimap_hubs', JSON.stringify(updated));
        if (db) {
          const updatedDoc = updated.find(h => h.id === id);
          if (updatedDoc) {
            setDoc(doc(db, 'hubs', id), updatedDoc).catch(fsErr => {
              console.error('[Firestore Direct Update Error] Falha ao atualizar HUB no Firestore:', fsErr);
            });
          }
        }
        return updated;
      });
    }
  };

  const handleDeleteHub = async (id: string) => {
    try {
      const res = await fetch(`/api/hubs/${id}`, {
        method: 'DELETE'
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.error('Erro ao excluir HUB, usando nuvem direta e local:', err);
      setHubs(prev => {
        const updated = prev.filter(h => h.id !== id);
        localStorage.setItem('vinimap_hubs', JSON.stringify(updated));
        if (db) {
          deleteDoc(doc(db, 'hubs', id)).catch(fsErr => {
            console.error('[Firestore Direct Delete Error] Falha ao deletar HUB no Firestore:', fsErr);
          });
        }
        return updated;
      });
    }
  };

  const handleSetActiveHub = async (id: string) => {
    try {
      const res = await fetch(`/api/hubs/${id}/set-active`, {
        method: 'POST'
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.error('Erro ao ativar HUB, usando nuvem direta e local:', err);
      setHubs(prev => {
        const updated = prev.map(h => ({
          ...h,
          isActive: h.id === id
        }));
        localStorage.setItem('vinimap_hubs', JSON.stringify(updated));
        
        if (db) {
          updated.forEach(h => {
            setDoc(doc(db, 'hubs', h.id), h).catch(() => {});
          });
        }
        return updated;
      });
    }
  };

  // Branding handler
  const handleSaveBranding = (newBranding: AppBranding) => {
    setBranding(newBranding);
    saveStoredBranding(newBranding);
    
    // Also broadcast activity
    const newAct: Activity = {
      id: `act-${Date.now()}`,
      time: formatToBrasiliaTime(new Date()),
      type: 'courier_status',
      message: `Identidade visual da empresa atualizada: "${newBranding.appName}"`,
      details: 'Logotipo e marca sincronizados com todo o ecossistema e app do condutor'
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Handler for bulk importing validated orders
  const handleImportOrders = async (newOrders: Order[]) => {
    // Attempt to calculate freight optimistically using cached rules to prevent visual lag
    let cachedRules: any[] = [];
    try {
      const stored = localStorage.getItem('vinimap_freight_rules');
      if (stored) {
        cachedRules = JSON.parse(stored);
      }
    } catch (e) {}

    const processedOrders = newOrders.map(order => {
      const orderCep = order.cep || "";
      const orderClientCode = order.codigoCliente || "";
      if (!orderCep || !orderClientCode || cachedRules.length === 0) return order;

      const cleanOrderCep = orderCep.replace(/\D/g, "");
      if (!cleanOrderCep) return order;

      const cepNum = parseInt(cleanOrderCep, 10);
      if (isNaN(cepNum)) return order;

      const matchedPartner = partnerClients.find(p => matchClientCode(p, orderClientCode));
      if (!matchedPartner) return order;

      const matchedRule = cachedRules.find((rule: any) => {
        if (rule.partnerId !== matchedPartner.id) return false;
        
        const minCep = (rule.cepMin || "").replace(/\D/g, "");
        const maxCep = (rule.cepMax || "").replace(/\D/g, "");
        if (!minCep || !maxCep) return false;
        
        const minNum = parseInt(minCep, 10);
        const maxNum = parseInt(maxCep, 10);
        
        return cepNum >= minNum && cepNum <= maxNum;
      });

      let returnOrder = { ...order };
      if (matchedRule) {
        const computedFreight = Number(matchedRule.value) || 0;
        returnOrder = {
          ...returnOrder,
          valorEntrega: computedFreight,
          value: computedFreight
        };
      }
      return {
        ...returnOrder,
        courierId: undefined,
        status: 'pending' as OrderStatus,
        statusSincronizado: 'pending',
        status_sincronizado: 'pending'
      } as Order;
    });

    // Optimistically update local React state and localStorage cache immediately to eliminate delays/lag
    setOrders(prev => {
      const updated = [...prev];
      processedOrders.forEach(o => {
        const idx = updated.findIndex(existing => {
          if (existing.id && o.id && existing.id === o.id) return true;
          if (
            existing.pedido && 
            o.pedido && 
            existing.pedido.trim().toLowerCase() === o.pedido.trim().toLowerCase() && 
            matchClientCode(existing.codigoCliente, o.codigoCliente)
          ) {
            return true;
          }
          if (
            existing.codigoCliente && existing.pedido && 
            o.id && 
            `${existing.codigoCliente}-${existing.pedido}`.toLowerCase() === o.id.toLowerCase()
          ) {
            return true;
          }
          if (
            o.codigoCliente && o.pedido && 
            existing.id && 
            `${o.codigoCliente}-${o.pedido}`.toLowerCase() === existing.id.toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (idx !== -1) {
          const existing = updated[idx];
          const activeStatus = existing.status && existing.status !== 'pending' ? existing.status : o.status;
          const activeCourier = existing.courierId || o.courierId;
          const activeHistory = (existing.history && existing.history.length > 0) ? existing.history : o.history;

          updated[idx] = { 
            ...existing, 
            ...o,
            status: activeStatus,
            courierId: activeCourier,
            history: activeHistory,
            deliveryProtocol: existing.deliveryProtocol || o.deliveryProtocol
          };
        } else {
          updated.unshift(o);
        }
      });
      try {
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setNotifications(prev => prev + processedOrders.length);

    try {
      const res = await fetch('/api/orders/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedOrders)
      });
      if (res.ok) {
        // Run database sync silently in the background
        fetchDatabase().catch(err => console.warn('Background database sync warning:', err));
      } else {
        throw new Error('Falha na resposta do servidor para importação em massa');
      }
    } catch (err) {
      console.warn('Erro ao importar pedidos para o servidor, registrando no Supabase (Primário) e Firestore:', err);
      
      // Direct upsert to Supabase
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          const supabaseRows = processedOrders.map((order: any) => ({
            id: order.id,
            pedido: order.pedido || order.id,
            customer_name: order.customerName || order.cliente || 'Cliente',
            address: order.address || '',
            cep: order.cep || '',
            status: order.status || 'pending',
            amount: Number(order.amount || order.value || 0),
            valor_mercadoria: Number(order.valorMercadoria || 0),
            valor_repasse: Number(order.valorRepasse || 0),
            region: order.region || 'Centro-Paulista',
            courier_id: order.courierId || null,
            partner_id: order.partnerId || null,
            driver_name: order.courierName || null,
            created_at: order.createdAt || new Date().toISOString(),
            latitude: Number(order.latitude) || -23.55052,
            longitude: Number(order.longitude) || -46.633308,
            priority: order.priority || 'medium',
            notes: order.notes || ''
          }));
          for (let i = 0; i < supabaseRows.length; i += 50) {
            const chunk = supabaseRows.slice(i, i + 50);
            await supabase.from('orders').upsert(chunk, { onConflict: 'id' });
          }
          console.log('[Supabase Direct Import] Pedidos importados no Supabase com sucesso:', processedOrders.length);
        }
      } catch (sbErr) {
        console.warn('[Supabase Direct Import Error]:', sbErr);
      }

      // Safe Firestore sync in paced chunks only if quota not exceeded
      if (db && !isFirestoreQuotaExceeded()) {
        try {
          for (let i = 0; i < processedOrders.length; i += 10) {
            if (isFirestoreQuotaExceeded()) break;
            const chunk = processedOrders.slice(i, i + 10);
            await Promise.all(chunk.map(order => setDoc(doc(db, 'orders', order.id), order)));
            await new Promise(r => setTimeout(r, 60));
          }
          console.log('[Firestore Direct Import] Lote de pedidos importado com sucesso no Firestore:', processedOrders.length);
        } catch (fsErr) {
          handleFirestoreError(fsErr, 'write', 'orders');
        }
      }
    }
  };

  // Handler for adding a new order manually
  const handleAddOrder = async (newOrderData: Omit<Order, 'id' | 'time'>) => {
    if (currentUser && currentUser.canCreate === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Cadastrar novos pedidos.");
      return;
    }

    // Prepare temporary optimistic order and update state immediately to eliminate latency
    const nextIdNum = orders.length + 1;
    const newId = `PED-${String(nextIdNum).padStart(5, '0')}`;
    const now = new Date();
    const timeStr = formatToBrasiliaTime(now);
    
    const newOrder: Order = {
      ...newOrderData,
      id: newId,
      time: timeStr,
      dataSolicitacao: newOrderData.dataSolicitacao || formatToBrasiliaDate(now),
      statusSincronizado: newOrderData.status,
      status_sincronizado: newOrderData.status
    } as Order;

    setOrders(prev => {
      const updated = [newOrder, ...prev];
      try {
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setNotifications(prev => prev + 1);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrderData)
      });
      await ensureJsonResponse(res);
      // Run database sync silently in the background
      fetchDatabase().catch(err => console.warn('Background database sync warning:', err));
    } catch (err) {
      console.warn('Erro ao adicionar pedido ao servidor, registrando no Supabase (Primário) e Firestore:', err);
      
      // Save directly to Supabase
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          const oAny = newOrder as any;
          await supabase.from('orders').upsert({
            id: newOrder.id,
            pedido: newOrder.pedido || newOrder.id,
            customer_name: newOrder.customerName || 'Cliente',
            address: newOrder.address || '',
            cep: newOrder.cep || '',
            status: newOrder.status || 'pending',
            amount: Number(oAny.amount || newOrder.value || 0),
            valor_mercadoria: Number(oAny.valorMercadoria || 0),
            valor_repasse: Number(oAny.valorRepasse || 0),
            region: newOrder.region || 'Centro-Paulista',
            courier_id: newOrder.courierId || null,
            partner_id: oAny.partnerId || null,
            driver_name: newOrder.courierName || null,
            created_at: newOrder.createdAt || new Date().toISOString(),
            latitude: Number(newOrder.latitude) || -23.55052,
            longitude: Number(newOrder.longitude) || -46.633308,
            priority: oAny.priority || 'medium',
            notes: oAny.notes || ''
          }, { onConflict: 'id' });
          console.log('[Supabase Direct Write] Pedido salvo diretamente no Supabase:', newId);
        }
      } catch (sbErr) {
        console.warn('[Supabase Direct Write Error]:', sbErr);
      }

      if (db && !isFirestoreQuotaExceeded()) {
        try {
          await setDoc(doc(db, 'orders', newId), newOrder);
          console.log('[Firestore Direct Write] Pedido criado diretamente no Firestore:', newId);
        } catch (fsErr) {
          handleFirestoreError(fsErr, 'write', 'orders');
        }
      }
    }
  };

  // Handler for transitioning order lifecycles interactively
  const handleUpdateOrderStatus = async (
    orderId: string, 
    nextStatus: OrderStatus,
    protocol?: any
  ) => {
    const isDriver = currentUser?.role === 'driver';
    if (currentUser && currentUser.canAlter === false && !isDriver) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Alterar ou atualizar status de pedidos.");
      return;
    }

    // Optimistic local state update for instantaneous, flicker-free feedback
    const now = new Date();
    const optTimestamp = `${formatToBrasiliaDate(now)} ${formatToBrasiliaTime(now, true)}`;
    
    // Extract digital protocol / POD fields safely
    let deliveryProtocolObj: any = undefined;
    let proofPhotoUrl: string | undefined = undefined;
    let signatureDataUrl: string | undefined = undefined;
    let receiverName: string | undefined = undefined;
    let receiverDoc: string | undefined = undefined;
    let deliveredAt: string | undefined = undefined;
    let detalhe: string | undefined = undefined;

    if (protocol) {
      proofPhotoUrl = protocol.proofPhotoUrl || protocol.photoUrl || protocol.deliveryProtocol?.photoUrl;
      signatureDataUrl = protocol.signatureDataUrl || protocol.signatureData || protocol.deliveryProtocol?.signatureData;
      receiverName = protocol.receiverName || protocol.signedName || protocol.deliveryProtocol?.signedName;
      receiverDoc = protocol.receiverDoc || protocol.signedDoc || protocol.deliveryProtocol?.signedDoc;
      deliveredAt = protocol.deliveredAt || protocol.signedAt || protocol.deliveryProtocol?.signedAt || optTimestamp;
      detalhe = protocol.note || protocol.detalhe;

      const sourceProto = protocol.deliveryProtocol || protocol;
      deliveryProtocolObj = {
        ...sourceProto,
        signedName: receiverName || sourceProto.signedName || '',
        signedDoc: receiverDoc || sourceProto.signedDoc || '',
        signatureData: signatureDataUrl || sourceProto.signatureData || '',
        signedAt: deliveredAt || sourceProto.signedAt || optTimestamp,
        photoUrl: proofPhotoUrl || sourceProto.photoUrl,
        notes: sourceProto.notes !== undefined ? sourceProto.notes : protocol.notes,
        includeFinancialValues: sourceProto.includeFinancialValues !== undefined ? sourceProto.includeFinancialValues : protocol.includeFinancialValues,
        isUpdated: sourceProto.isUpdated !== undefined ? sourceProto.isUpdated : protocol.isUpdated,
        updatedAt: sourceProto.updatedAt || protocol.updatedAt || optTimestamp
      };
    }

    if (nextStatus === 'delivered') {
      if (!deliveredAt) deliveredAt = optTimestamp;
      if (!deliveryProtocolObj) {
        deliveryProtocolObj = {
          signedName: receiverName || 'Recebido no Destino',
          signedDoc: receiverDoc || '',
          signatureData: signatureDataUrl || '',
          signedAt: deliveredAt,
          photoUrl: proofPhotoUrl
        };
      } else {
        deliveryProtocolObj.signedAt = deliveryProtocolObj.signedAt || deliveredAt;
      }
    }

    const optHistoryNote = 
      nextStatus === 'delivered' 
        ? `Pedido concluído e entregue com sucesso${receiverName ? ` para ${receiverName}` : ''}.`
        : (nextStatus === 'failure' 
            ? `Ocorrência registrada no campo: ${detalhe || 'Insucesso na entrega'}`
            : (detalhe ? `${detalhe}` : `Status do pedido atualizado para: ${nextStatus}`));

    const optHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: optTimestamp,
      status: nextStatus,
      note: optHistoryNote
    };

    const nowTimestamp = Date.now();

    const matchesOrder = (o: Order | any): boolean => {
      if (!o) return false;
      if (o.id === orderId) return true;
      if (o.pedido && String(o.pedido) === String(orderId)) return true;
      const cleanO = String(o.id || '').trim().toUpperCase();
      const cleanParam = String(orderId || '').trim().toUpperCase();
      if (cleanO === cleanParam) return true;
      const noPedO = cleanO.replace(/^PED-/i, '');
      const noPedParam = cleanParam.replace(/^PED-/i, '');
      if (noPedO && noPedParam && noPedO === noPedParam) return true;
      const digitsO = cleanO.replace(/\D/g, '').replace(/^0+/, '');
      const digitsParam = cleanParam.replace(/\D/g, '').replace(/^0+/, '');
      if (digitsO && digitsParam && digitsO === digitsParam) return true;
      return false;
    };

    const targetOrder = orders.find(matchesOrder);
    const actualOrderId = targetOrder?.id || (String(orderId).startsWith('PED-') ? orderId : `PED-${String(orderId).padStart(5, '0')}`);

    if (proofPhotoUrl) {
      saveOrderPhoto(actualOrderId, proofPhotoUrl);
    }

    setOrders(prevOrders => {
      const updated = prevOrders.map(o => 
        (matchesOrder(o) || o.id === actualOrderId)
          ? { 
              ...o, 
              status: nextStatus, 
              statusSincronizado: nextStatus,
              status_sincronizado: nextStatus,
              versionTimestamp: nowTimestamp,
              updatedAt: nowTimestamp,
              version: (Number(o.version) || 0) + 1,
              statusUpdatedAt: nowTimestamp,
              history: [...(o.history || []), optHistoryEntry],
              ...(nextStatus === 'cancelled' ? { courierId: undefined, valorCondutor: 0 } : {}),
              ...(deliveryProtocolObj ? { deliveryProtocol: deliveryProtocolObj } : {}),
              ...(proofPhotoUrl ? { proofPhotoUrl } : {}),
              ...(signatureDataUrl ? { signatureDataUrl } : {}),
              ...(receiverName ? { receiverName } : {}),
              ...(receiverDoc ? { receiverDoc } : {}),
              ...(deliveredAt ? { deliveredAt } : {}),
              ...(detalhe ? { detalhe } : {})
            } 
          : o
      );
      try {
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      } catch (e) {
        try {
          const stripped = updated.map(item => ({
            ...item,
            proofPhotoUrl: item.proofPhotoUrl ? '[saved]' : undefined,
            deliveryProtocol: item.deliveryProtocol ? { ...item.deliveryProtocol, photoUrl: '[saved]' } : undefined
          }));
          localStorage.setItem('vinimap_orders', JSON.stringify(stripped));
        } catch (_) {}
      }
      return updated;
    });

    try {
      const activeOrder = targetOrder || orders.find(matchesOrder);
      const nextOrderVer = (Number(activeOrder?.version) || 0) + 1;

      const body: any = { 
        status: nextStatus,
        statusSincronizado: nextStatus,
        status_sincronizado: nextStatus,
        versionTimestamp: nowTimestamp,
        updatedAt: nowTimestamp,
        version: nextOrderVer,
        statusUpdatedAt: nowTimestamp
      };

      if (nextStatus === 'cancelled') {
        body.courierId = null;
        body.valorCondutor = 0;
      }

      if (deliveryProtocolObj) body.deliveryProtocol = deliveryProtocolObj;
      if (proofPhotoUrl) body.proofPhotoUrl = proofPhotoUrl;
      if (signatureDataUrl) body.signatureDataUrl = signatureDataUrl;
      if (receiverName) body.receiverName = receiverName;
      if (receiverDoc) body.receiverDoc = receiverDoc;
      if (deliveredAt) body.deliveredAt = deliveredAt;
      if (detalhe) body.detalhe = detalhe;

      // Gestão e reconciliação de status do condutor (Livre / Ocupado)
      const assignedCourierId: string | undefined = activeOrder?.courierId;
      const courierToCheckId = activeOrder?.courierId || assignedCourierId;
      if (courierToCheckId) {
        if (nextStatus === 'in_route') {
          body.courierId = courierToCheckId;
        } else if (nextStatus === 'cancelled') {
          body.valorCondutor = 0;
        }

        // Determinar se o condutor tem pedidos em aberto (não concluídos / não cancelados)
        const otherOpenOrders = orders.filter(o => 
          !matchesOrder(o) && o.id !== actualOrderId &&
          o.courierId === courierToCheckId && 
          o.status !== 'delivered' && 
          o.status !== 'cancelled' &&
          !o.isDeleted &&
          !o.deleted
        );
        const willThisOrderBeOpen = nextStatus !== 'delivered' && nextStatus !== 'cancelled';
        const totalOpenOrders = otherOpenOrders.length + (willThisOrderBeOpen ? 1 : 0);
        const nextCourierStatus = totalOpenOrders === 0 ? 'online' : 'busy';

        const courierObj = couriers.find(c => c.id === courierToCheckId);
        const completedCount = nextStatus === 'delivered' ? ((courierObj?.ordersCompleted || 0) + 1) : courierObj?.ordersCompleted;

        setCouriers(prevCouriers => prevCouriers.map(c => 
          c.id === courierToCheckId 
            ? { 
                ...c, 
                status: nextCourierStatus,
                ...(completedCount !== undefined ? { ordersCompleted: completedCount } : {})
              } 
            : c
        ));

        const courierPayload: any = { status: nextCourierStatus };
        if (completedCount !== undefined) courierPayload.ordersCompleted = completedCount;

        try {
          const rCou = await fetch(`/api/couriers/${courierToCheckId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courierPayload)
          });
          await ensureJsonResponse(rCou);
        } catch (cErr) {
          console.debug('[Courier Reconcile] Aviso ao sincronizar status do condutor:', cErr);
        }
      }

      const rOrd = await fetch(`/api/orders/${encodeURIComponent(actualOrderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await ensureJsonResponse(rOrd);

      // Cloud Firestore Direct Update for multi-device real-time sync
      if (db) {
        try {
          const fsUpdatedOrder: any = {
            ...(activeOrder || {}),
            id: actualOrderId,
            status: nextStatus,
            statusSincronizado: nextStatus,
            status_sincronizado: nextStatus,
            versionTimestamp: nowTimestamp,
            updatedAt: nowTimestamp,
            version: nextOrderVer,
            statusUpdatedAt: nowTimestamp,
            history: [...((activeOrder?.history) || []), optHistoryEntry],
            ...(nextStatus === 'cancelled' ? { courierId: null, valorCondutor: 0 } : (assignedCourierId ? { courierId: assignedCourierId } : {})),
            ...(deliveryProtocolObj ? { deliveryProtocol: deliveryProtocolObj } : {}),
            ...(proofPhotoUrl ? { proofPhotoUrl } : {}),
            ...(signatureDataUrl ? { signatureDataUrl } : {}),
            ...(receiverName ? { receiverName } : {}),
            ...(receiverDoc ? { receiverDoc } : {}),
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(detalhe ? { detalhe } : {})
          };
          const cleanFsOrder: any = {};
          for (const [key, val] of Object.entries(fsUpdatedOrder)) {
            if (val !== undefined) cleanFsOrder[key] = val;
          }
          await setDoc(doc(db, 'orders', actualOrderId), cleanFsOrder, { merge: true });
        } catch (fsErr) {
          console.debug('[Firestore Mirror Update]', fsErr);
        }
      }

      // Supabase Direct Update for Shard Cloud persistence
      try {
        const { supabase } = await import('./lib/supabase');
        if (supabase) {
          const sbUpdatePayload: any = {
            status: nextStatus,
            status_sincronizado: nextStatus,
            updated_at: new Date(nowTimestamp).toISOString(),
            version: nextOrderVer,
            version_timestamp: nowTimestamp
          };
          if (nextStatus === 'cancelled') {
            sbUpdatePayload.courier_id = null;
            sbUpdatePayload.valor_condutor = 0;
          } else if (assignedCourierId) {
            sbUpdatePayload.courier_id = assignedCourierId;
          }
          if (detalhe) sbUpdatePayload.detalhe = detalhe;
          await supabase.from('orders').update(sbUpdatePayload).eq('id', actualOrderId);
        }
      } catch (sbErr) {
        console.debug('[Supabase Mirror Update]', sbErr);
      }

      // Log activity
      let message = '';
      let details = '';
      let actType: Activity['type'] = 'courier_status';

      if (nextStatus === 'in_route') {
        const courierName = couriers.find(c => c.id === assignedCourierId)?.name || 'um portador livre';
        message = `Pedido ${actualOrderId} despachado`;
        details = `Atribuído ao entregador ${courierName} • Avise via SMS`;
        actType = 'order_assigned';
      } else if (nextStatus === 'delivered') {
        message = `Pedido ${actualOrderId} concluído com sucesso`;
        details = `Entregue para ${activeOrder?.customerName || receiverName || 'Destinatário'} • Recebido sem ressalvas`;
        actType = 'order_delivered';
      }

      if (message) {
        const rAct = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: actType, message, details })
        });
        await ensureJsonResponse(rAct);
      }

      if (nextStatus === 'cancelled' || nextStatus === 'failure') {
        const courier = couriers.find(c => c.id === targetOrder.courierId);
        const courierName = courier ? courier.name : 'Entregador';
        
        const alertId = `alert-${Date.now()}-${orderId}`;
        const timeStr = formatToBrasiliaTime(new Date(), true);
        
        setOcorrenciaAlerts(prevAlerts => {
          if (prevAlerts.some(a => a.orderId === orderId)) return prevAlerts;
          playOcorrenciaSound();
          return [{
            id: alertId,
            orderId: orderId,
            customerName: targetOrder.customerName,
            courierName: courierName,
            time: timeStr,
            status: nextStatus,
            region: targetOrder.region
          }, ...prevAlerts];
        });
        
        setNotifications(n => n + 1);
      }

      await fetchDatabase();
    } catch (err) {
      console.error('Erro ao atualizar status do pedido na API. Sincronizando diretamente com Firestore e local:', err);
      
      const targetOrder = orders.find(o => o.id === orderId);
      if (targetOrder) {
        let assignedCourierId = targetOrder.courierId;
        const courierStatusUpdates: { id: string, status: string, ordersCompleted?: number }[] = [];
        
        if (nextStatus === 'in_route') {
          if (!assignedCourierId) {
            const freeCourier = couriers.find(c => c.status === 'online');
            if (freeCourier) {
              assignedCourierId = freeCourier.id;
              courierStatusUpdates.push({ id: freeCourier.id, status: 'busy' });
            }
          } else {
            courierStatusUpdates.push({ id: assignedCourierId, status: 'busy' });
          }
        }
        
        if (nextStatus === 'delivered' && targetOrder.courierId) {
          const courierObj = couriers.find(c => c.id === targetOrder.courierId);
          const completedCount = courierObj ? (courierObj.ordersCompleted + 1) : 1;
          const otherActiveOrders = orders.filter(o => 
            o.id !== orderId && 
            o.courierId === targetOrder.courierId && 
            (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
          );
          const nextCourierStatus = otherActiveOrders.length === 0 ? 'online' : 'busy';
          courierStatusUpdates.push({ id: targetOrder.courierId, status: nextCourierStatus, ordersCompleted: completedCount });
        }

        if (nextStatus === 'cancelled' && targetOrder.courierId) {
          const otherActiveOrders = orders.filter(o => 
            o.id !== orderId && 
            o.courierId === targetOrder.courierId && 
            (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
          );
          const nextCourierStatus = otherActiveOrders.length === 0 ? 'online' : 'busy';
          courierStatusUpdates.push({ id: targetOrder.courierId, status: nextCourierStatus });
        }
        
        // Build updated order object
        const updatedOrder: Order = {
          ...targetOrder,
          status: nextStatus,
          statusSincronizado: nextStatus,
          status_sincronizado: nextStatus,
          ...(nextStatus === 'cancelled' ? { courierId: undefined, valorCondutor: 0 } : (assignedCourierId ? { courierId: assignedCourierId } : {})),
          ...(protocol ? { deliveryProtocol: protocol } : {})
        };
        
        // Apply direct-writes to Firestore
        if (db) {
          try {
            await setDoc(doc(db, 'orders', orderId), updatedOrder);
            
            for (const cUpdate of courierStatusUpdates) {
              const originalCourier = couriers.find(c => c.id === cUpdate.id);
              if (originalCourier) {
                const updatedCourierObj = {
                  ...originalCourier,
                  status: cUpdate.status as any,
                  ...(cUpdate.ordersCompleted !== undefined ? { ordersCompleted: cUpdate.ordersCompleted } : {})
                };
                await setDoc(doc(db, 'couriers', cUpdate.id), updatedCourierObj);
              }
            }
            console.log('[Firestore Direct Update] Status do pedido e entregadores sincronizados na nuvem:', orderId);
          } catch (fsErr) {
            console.error('[Firestore Direct Update Error] Falha ao atualizar na nuvem diretamente:', fsErr);
          }
        }

        // Apply local state updates for the couriers if they were changed
        if (courierStatusUpdates.length > 0) {
          setCouriers(prev => {
            const updated = prev.map(c => {
              const u = courierStatusUpdates.find(up => up.id === c.id);
              if (u) {
                return {
                  ...c,
                  status: u.status as any,
                  ...(u.ordersCompleted !== undefined ? { ordersCompleted: u.ordersCompleted } : {})
                };
              }
              return c;
            });
            localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
            return updated;
          });
        }

        // Log direct activity to Firestore
        let message = '';
        let details = '';
        let actType: Activity['type'] = 'courier_status';

        if (nextStatus === 'in_route') {
          const courierName = couriers.find(c => c.id === assignedCourierId)?.name || 'um portador livre';
          message = `Pedido ${orderId} despachado`;
          details = `Atribuído ao entregador ${courierName} • Sincronizado na nuvem`;
          actType = 'order_assigned';
        } else if (nextStatus === 'delivered') {
          message = `Pedido ${orderId} concluído com sucesso`;
          details = `Entregue para ${targetOrder.customerName} • Sincronizado na nuvem`;
          actType = 'order_delivered';
        }

        if (message) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const newActivity: Activity = {
            id: `act-${Date.now()}`,
            time: timeStr,
            type: actType,
            message,
            details
          };
          if (db) {
            setDoc(doc(db, 'activities', newActivity.id), newActivity).catch(() => {});
          }
          setActivities(prev => {
            const updated = [newActivity, ...prev];
            localStorage.setItem('vinimap_activities', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }
  };

  // Optimize Routes CTA
  const handleOptimizeRoutes = async () => {
    setActiveTab('route_optimizer');
  };

  const calculateRepasseForOrder = (order: Order, rules: any[], courierObj?: Courier): number => {
    if (order.status === 'cancelled') return 0;
    const formato = courierObj?.repasseFormato || 'tabela_cep';
    const defaultRate = courierObj?.repasseTaxa !== undefined && courierObj?.repasseTaxa !== null ? Number(courierObj.repasseTaxa) : 9.50;

    if (formato === 'porcentagem') {
      const pct = courierObj?.repassePorcentagem !== undefined && courierObj?.repassePorcentagem !== null ? Number(courierObj.repassePorcentagem) : 80;
      const freightVal = Number(order.valorEntrega) || Number(order.value) || 0;
      return Math.round((freightVal * (pct / 100)) * 100) / 100;
    }

    if (formato === 'fixo') {
      return defaultRate;
    }

    const orderCep = order.cep || "";
    const orderClientCode = order.codigoCliente || "";
    if (!orderCep) return defaultRate;
    const cleanOrderCep = orderCep.replace(/\D/g, "");
    if (!cleanOrderCep) return defaultRate;
    const cepNum = parseInt(cleanOrderCep, 10);
    if (isNaN(cepNum)) return defaultRate;

    const matchedPartner = partnerClients.find(p => matchClientCode(p.id, orderClientCode) || matchClientCode(p.name, orderClientCode));
    const partnerId = matchedPartner?.id || orderClientCode;

    const matchedRule = rules.find((rule: any) => {
      const isPartnerMatch = rule.partnerId === partnerId || rule.codigoCliente === partnerId || matchClientCode(partnerId, rule.partnerId) || matchClientCode(partnerId, rule.codigoCliente);
      if (!isPartnerMatch) return false;
      const minCep = (rule.cepMin || "").replace(/\D/g, "");
      const maxCep = (rule.cepMax || "").replace(/\D/g, "");
      if (!minCep || !maxCep) return false;
      return cepNum >= parseInt(minCep, 10) && cepNum <= parseInt(maxCep, 10);
    });

    if (matchedRule) {
      const repasseVal = matchedRule.valorRepasse !== undefined && matchedRule.valorRepasse !== null && matchedRule.valorRepasse !== ""
        ? Number(matchedRule.valorRepasse)
        : (matchedRule.repasseRegra !== undefined ? Number(matchedRule.repasseRegra) : 0);
      if (repasseVal > 0) return repasseVal;
    }
    return defaultRate;
  };

  const handleAllocateCourier = async (orderId: string, courierId: string) => {
    if (currentUser && currentUser.canAlter === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Alterar ou Alocar condutores.");
      return;
    }
    const cleanOrderId = String(orderId || '').trim();
    const cleanCourierId = String(courierId || '').trim();
    if (!cleanOrderId || !cleanCourierId) return;

    const nowTimestamp = Date.now();
    const targetOrder = orders.find(o => o.id === cleanOrderId);
    const oldCourierId = targetOrder?.courierId;
    const assignedCourier = couriers.find(c => c.id === cleanCourierId);
    const ruleRate = targetOrder ? calculateRepasseForOrder(targetOrder, freightRules, assignedCourier) : (assignedCourier?.repasseTaxa !== undefined && assignedCourier?.repasseTaxa !== null ? Number(assignedCourier.repasseTaxa) : 9.50);

    // Explicit check and disassociation if previous courier existed
    if (oldCourierId && oldCourierId !== cleanCourierId) {
      console.log(`[Courier Allocation] Desvinculando pedido ${cleanOrderId} do condutor anterior ${oldCourierId} para vincular ao novo ${cleanCourierId}`);
    }

    // Optimistic local update with explicit courierId and device binding
    if (targetOrder) {
      const brasiliaToday = formatToBrasiliaISODate(new Date());
      const updatedOrder: Order = {
        ...targetOrder,
        courierId: cleanCourierId,
        dispositivoCondutor: assignedCourier?.phone || '',
        courierName: assignedCourier?.name || '',
        allocatedCourierName: assignedCourier?.name || '',
        nomeCondutor: assignedCourier?.name || '',
        allocatedDate: brasiliaToday,
        valorCondutor: ruleRate,
        status: 'pending',
        statusSincronizado: 'pending',
        status_sincronizado: 'pending',
        versionTimestamp: nowTimestamp,
        updatedAt: nowTimestamp,
        version: (Number(targetOrder.version) || 0) + 1
      };

      setOrders(prev => {
        const updated = prev.map(o => o.id === cleanOrderId ? updatedOrder : o);
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
        if (db) {
          setDoc(doc(db, 'orders', cleanOrderId), updatedOrder, { merge: true }).catch((err) => {
            console.error('[Firestore Allocation Error]', err);
          });
        }
        return updated;
      });

      setCouriers(prev => {
        const updated = prev.map(c => {
          if (c.id === cleanCourierId) return { ...c, status: 'busy' as any };
          if (oldCourierId && c.id === oldCourierId) {
            const hasOtherActive = orders.some(o => o.id !== cleanOrderId && o.courierId === oldCourierId && (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route'));
            if (!hasOtherActive) return { ...c, status: 'online' as any };
          }
          return c;
        });
        localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
        if (db) {
          const courierObj = prev.find(c => c.id === cleanCourierId);
          if (courierObj) {
            setDoc(doc(db, 'couriers', cleanCourierId), { ...courierObj, status: 'busy' }, { merge: true }).catch(() => {});
          }
          if (oldCourierId && oldCourierId !== cleanCourierId) {
            const oldCurObj = prev.find(c => c.id === oldCourierId);
            const hasOther = orders.some(o => o.id !== cleanOrderId && o.courierId === oldCourierId && (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route'));
            if (oldCurObj && !hasOther) {
              setDoc(doc(db, 'couriers', oldCourierId), { ...oldCurObj, status: 'online' }, { merge: true }).catch(() => {});
            }
          }
        }
        return updated;
      });
    }

    // Direct write to Supabase for Shard Cloud persistence strictly scoped by orderId
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        const nowIso = new Date(nowTimestamp).toISOString();
        const nextVer = (Number(targetOrder?.version) || 0) + 1;
        const brasiliaToday = formatToBrasiliaISODate(new Date());
        
        await supabase.from('orders').update({
          courier_id: cleanCourierId,
          dispositivo_condutor: assignedCourier?.phone || '',
          valor_condutor: ruleRate,
          valor_repasse: ruleRate,
          status: 'pending',
          status_sincronizado: 'pending',
          allocated_date: brasiliaToday,
          updated_at: nowIso,
          version: nextVer,
          version_timestamp: nowTimestamp
        }).eq('id', cleanOrderId);

        await supabase.from('couriers').update({ status: 'busy' }).eq('id', cleanCourierId);
        if (oldCourierId && oldCourierId !== cleanCourierId) {
          const hasOther = orders.some(o => o.id !== cleanOrderId && o.courierId === oldCourierId && (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route'));
          if (!hasOther) {
            await supabase.from('couriers').update({ status: 'online' }).eq('id', oldCourierId);
          }
        }
        console.log(`[Supabase Direct] Pedido ${cleanOrderId} alocado com sucesso para condutor ${cleanCourierId}`);
      }
    } catch (sbErr) {
      console.warn('[Supabase Direct Error] Erro ao sincronizar alocação no Supabase:', sbErr);
    }

    try {
      await fetch(`/api/orders/${cleanOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          courierId: cleanCourierId, 
          dispositivoCondutor: assignedCourier?.phone || '',
          valorCondutor: ruleRate, 
          status: 'pending',
          versionTimestamp: nowTimestamp,
          updatedAt: nowTimestamp,
          version: (Number(targetOrder?.version) || 0) + 1
        })
      });
      await fetch(`/api/couriers/${cleanCourierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'busy' })
      });
      if (oldCourierId && oldCourierId !== cleanCourierId) {
        const hasOther = orders.some(o => o.id !== cleanOrderId && o.courierId === oldCourierId && (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route'));
        if (!hasOther) {
          fetch(`/api/couriers/${oldCourierId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'online' })
          }).catch(() => {});
        }
      }

      const oName = targetOrder?.customerName || 'Cliente';
      const cName = assignedCourier?.name || 'Entregador';
      
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_assigned',
          message: `Pedido ${cleanOrderId} alocado para ${cName}`,
          details: `Destinatário: ${oName}`
        })
      });

      await fetchDatabase();
    } catch (err) {
      console.error('Erro ao alocar entregador:', err);
    }
  };

  const handleDeallocateCourier = async (orderId: string) => {
    if (currentUser && currentUser.canAlter === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Alterar ou Desalocar condutores.");
      return;
    }
    const nowTimestamp = Date.now();
    const targetOrder = orders.find(o => o.id === orderId);
    const oldCourierId = targetOrder?.courierId;

    if (targetOrder) {
      const updatedOrder: Order = {
        ...targetOrder,
        courierId: undefined,
        allocatedDate: undefined,
        valorCondutor: 0,
        status: 'pending',
        statusSincronizado: 'pending',
        status_sincronizado: 'pending',
        versionTimestamp: nowTimestamp,
        updatedAt: nowTimestamp,
        version: (Number(targetOrder.version) || 0) + 1
      };

      setOrders(prev => {
        const updated = prev.map(o => o.id === orderId ? updatedOrder : o);
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
        if (db) {
          setDoc(doc(db, 'orders', orderId), updatedOrder).catch(() => {});
        }
        return updated;
      });

      if (oldCourierId) {
        const hasOtherActive = orders.some(o => 
          o.id !== orderId && 
          o.courierId === oldCourierId && 
          (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
        );
        const nextCourierStatus = hasOtherActive ? 'busy' : 'online';

        setCouriers(prev => {
          const updated = prev.map(c => c.id === oldCourierId ? { ...c, status: nextCourierStatus as any } : c);
          localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
          if (db) {
            const originalCourier = prev.find(c => c.id === oldCourierId);
            if (originalCourier) {
              setDoc(doc(db, 'couriers', oldCourierId), { ...originalCourier, status: nextCourierStatus }).catch(() => {});
            }
          }
          return updated;
        });
      }
    }

    // Direct write to Supabase for Shard Cloud persistence
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        const nowIso = new Date(nowTimestamp).toISOString();
        const nextVer = (Number(targetOrder?.version) || 0) + 1;

        await supabase.from('orders').update({
          courier_id: null,
          valor_condutor: 0,
          valor_repasse: 0,
          status: 'pending',
          status_sincronizado: 'pending',
          allocated_date: null,
          updated_at: nowIso,
          version: nextVer,
          version_timestamp: nowTimestamp
        }).eq('id', orderId);

        if (oldCourierId) {
          const hasOtherActive = orders.some(o => 
            o.id !== orderId && 
            o.courierId === oldCourierId && 
            (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
          );
          await supabase.from('couriers').update({ status: hasOtherActive ? 'busy' : 'online' }).eq('id', oldCourierId);
        }
        console.log(`[Supabase Direct] Pedido ${orderId} desalocado no Supabase`);
      }
    } catch (sbErr) {
      console.warn('[Supabase Direct Error] Erro ao desalocar no Supabase:', sbErr);
    }

    try {
      const rOrd = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          courierId: null, 
          valorCondutor: 0, 
          status: 'pending',
          versionTimestamp: nowTimestamp,
          updatedAt: nowTimestamp,
          version: (Number(targetOrder?.version) || 0) + 1
        })
      });
      await ensureJsonResponse(rOrd);

      if (oldCourierId) {
        const hasOtherActive = orders.some(o => 
          o.id !== orderId && 
          o.courierId === oldCourierId && 
          (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
        );
        const rCou = await fetch(`/api/couriers/${oldCourierId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: hasOtherActive ? 'busy' : 'online' })
        });
        await ensureJsonResponse(rCou);
      }

      const rAct = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'courier_status',
          message: `Pedido ${orderId} desalocado`,
          details: `Retornado para a fila de pendentes`
        })
      });
      await ensureJsonResponse(rAct);

      await fetchDatabase();
    } catch (err) {
      console.warn('Erro ao desalocar entregador via backend:', err);
    }
  };

  const handleBulkAllocateCourier = async (orderIds: string[], courierId: string) => {
    if (currentUser && currentUser.canAlter === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Alterar ou Alocar condutores.");
      return;
    }
    const nowTimestamp = Date.now();
    const assignedCourier = couriers.find(c => c.id === courierId);

    // Optimistic update
    const brasiliaToday = formatToBrasiliaISODate(new Date());
    setOrders(prev => {
      const updated = prev.map(o => {
        if (!orderIds.includes(o.id)) return o;
        const ruleRate = calculateRepasseForOrder(o, freightRules, assignedCourier);
        return {
          ...o,
          courierId,
          dispositivoCondutor: assignedCourier?.phone || '',
          courierName: assignedCourier?.name || '',
          allocatedCourierName: assignedCourier?.name || '',
          nomeCondutor: assignedCourier?.name || '',
          allocatedDate: brasiliaToday,
          valorCondutor: ruleRate,
          status: 'pending' as OrderStatus,
          statusSincronizado: 'pending' as OrderStatus,
          status_sincronizado: 'pending' as OrderStatus,
          versionTimestamp: nowTimestamp,
          updatedAt: nowTimestamp,
          version: (Number(o.version) || 0) + 1
        };
      });
      localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      if (db) {
        orderIds.forEach(id => {
          const ord = updated.find(o => o.id === id);
          if (ord) {
            setDoc(doc(db, 'orders', id), ord).catch(() => {});
          }
        });
      }
      return updated;
    });

    setCouriers(prev => {
      const updated = prev.map(c => c.id === courierId ? { ...c, status: 'busy' as any } : c);
      localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
      if (db) {
        const courierObj = prev.find(c => c.id === courierId);
        if (courierObj) {
          setDoc(doc(db, 'couriers', courierId), { ...courierObj, status: 'busy' }).catch(() => {});
        }
      }
      return updated;
    });

    // Direct write to Supabase for Shard Cloud persistence
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        const nowIso = new Date(nowTimestamp).toISOString();
        const brasiliaToday = formatToBrasiliaISODate(new Date());

        await supabase.from('orders').update({
          courier_id: courierId,
          status: 'pending',
          status_sincronizado: 'pending',
          allocated_date: brasiliaToday,
          updated_at: nowIso,
          version_timestamp: nowTimestamp
        }).in('id', orderIds);

        await supabase.from('couriers').update({ status: 'busy' }).eq('id', courierId);
        console.log(`[Supabase Direct] ${orderIds.length} pedidos alocados com sucesso para condutor ${courierId}`);
      }
    } catch (sbErr) {
      console.warn('[Supabase Direct Error] Erro ao alocar em lote no Supabase:', sbErr);
    }

    try {
      const res = await fetch('/api/orders/bulk-allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, courierId })
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.warn('Erro ao alocar entregador em lote via backend:', err);
    }
  };

  const handleEditOrder = async (updatedOrder: Order) => {
    if (currentUser && currentUser.canAlter === false) {
      console.warn("Operação restrita: Seu perfil de operador não possui permissão para Alterar ou Editar pedidos.");
      return;
    }

    const nowTimestamp = Date.now();
    const orderWithVersion = {
      ...updatedOrder,
      versionTimestamp: nowTimestamp,
      updatedAt: nowTimestamp,
      version: (Number(updatedOrder.version) || 0) + 1
    };

    const matchesTargetOrder = (o: Order): boolean => {
      if (!o) return false;
      if (o.id === orderWithVersion.id) return true;
      if (o.pedido && (String(o.pedido) === String(orderWithVersion.pedido) || String(o.pedido) === String(orderWithVersion.id))) return true;
      if (orderWithVersion.pedido && String(o.id) === String(orderWithVersion.pedido)) return true;
      const cleanO = String(o.id || '').trim().toUpperCase().replace(/^PED-/i, '');
      const cleanTarget = String(orderWithVersion.id || '').trim().toUpperCase().replace(/^PED-/i, '');
      if (cleanO && cleanTarget && cleanO === cleanTarget) return true;
      const digitsO = String(o.id || '').replace(/\D/g, '').replace(/^0+/, '');
      const digitsTarget = String(orderWithVersion.id || '').replace(/\D/g, '').replace(/^0+/, '');
      if (digitsO && digitsTarget && digitsO === digitsTarget) return true;
      return false;
    };

    // 1. Immediate optimistic UI & local storage update
    setOrders(prev => {
      let matched = false;
      const updated = prev.map(o => {
        if (matchesTargetOrder(o)) {
          matched = true;
          return { ...o, ...orderWithVersion };
        }
        return o;
      });
      if (!matched) {
        updated.unshift(orderWithVersion);
      }
      safeSaveOrdersToLocalStorage(updated);
      return updated;
    });

    // 2. Direct Firestore update for real-time cloud multi-device sync
    if (db) {
      setDoc(doc(db, 'orders', orderWithVersion.id), orderWithVersion, { merge: true }).catch(fsErr => {
        console.error('[Firestore Direct Update Error] Falha ao editar pedido no Firestore:', fsErr);
      });
    }

    // Direct write to Supabase for Shard Cloud persistence
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        await supabase.from('orders').upsert({
          id: orderWithVersion.id,
          customer_name: orderWithVersion.customerName,
          address: orderWithVersion.address,
          cep: orderWithVersion.cep,
          status: orderWithVersion.status,
          status_sincronizado: orderWithVersion.status,
          courier_id: orderWithVersion.courierId || null,
          valor_condutor: Number(orderWithVersion.valorCondutor) || 0,
          valor_repasse: Number(orderWithVersion.valorCondutor) || 0,
          notes: orderWithVersion.notes || '',
          delivery_protocol: orderWithVersion.deliveryProtocol || null,
          receiver_name: orderWithVersion.receiverName || orderWithVersion.deliveryProtocol?.signedName || null,
          receiver_doc: orderWithVersion.receiverDoc || orderWithVersion.deliveryProtocol?.signedDoc || null,
          delivered_at: orderWithVersion.deliveredAt || orderWithVersion.deliveryProtocol?.signedAt || null,
          updated_at: new Date(nowTimestamp).toISOString(),
          version: orderWithVersion.version,
          version_timestamp: nowTimestamp
        });
        console.log(`[Supabase Direct] Pedido ${orderWithVersion.id} editado no Supabase`);
      }
    } catch (sbErr) {
      console.warn('[Supabase Direct Error] Erro ao editar no Supabase:', sbErr);
    }

    // 3. Backend PUT persistence
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderWithVersion.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderWithVersion)
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Pedido persistido localmente e na nuvem:', err);
    }
  };

  const handleRecalculateOrdersFreight = async (partnerId: string, updatedRules: any[]) => {
    const matchClientCode = (partnerId: string, orderCode?: string): boolean => {
      if (!orderCode) return false;
      const cleanOrder = orderCode.trim().toLowerCase();
      const cleanPartner = partnerId.trim().toLowerCase();
      
      if (cleanOrder === cleanPartner) return true;
      
      const normOrder = cleanOrder.replace(/[^a-z0-9]/g, '');
      const normPartner = cleanPartner.replace(/[^a-z0-9]/g, '');
      if (normOrder === normPartner) return true;

      const getDigits = (str: string) => str.replace(/\D/g, '');
      const orderDigits = getDigits(cleanOrder);
      const partnerDigits = getDigits(cleanPartner);
      
      if (orderDigits && partnerDigits && parseInt(orderDigits, 10) === parseInt(partnerDigits, 10)) {
        const isOrderCL = cleanOrder.startsWith('c') || cleanOrder.startsWith('cli');
        const isPartnerCL = cleanPartner.startsWith('c') || cleanPartner.startsWith('cli');
        if (isOrderCL && isPartnerCL) {
          return true;
        }
      }
      return false;
    };

    const calculateFreightForOrder = (order: Order, rules: any[]): number => {
      const orderCep = order.cep || "";
      const orderClientCode = order.codigoCliente || "";
      
      if (!orderCep || !matchClientCode(partnerId, orderClientCode)) {
        return Number(order.valorEntrega) || Number(order.value) || 0;
      }
      
      const cleanOrderCep = orderCep.replace(/\D/g, "");
      if (!cleanOrderCep) {
        return Number(order.valorEntrega) || Number(order.value) || 0;
      }
      
      const cepNum = parseInt(cleanOrderCep, 10);
      if (isNaN(cepNum)) {
        return Number(order.valorEntrega) || Number(order.value) || 0;
      }
      
      const matchedRule = rules.find((rule: any) => {
        if (rule.partnerId !== partnerId) return false;
        
        const minCep = (rule.cepMin || "").replace(/\D/g, "");
        const maxCep = (rule.cepMax || "").replace(/\D/g, "");
        if (!minCep || !maxCep) return false;
        
        const minNum = parseInt(minCep, 10);
        const maxNum = parseInt(maxCep, 10);
        
        return cepNum >= minNum && cepNum <= maxNum;
      });
      
      if (matchedRule) {
        const orderAny = order as any;
        const orderPriorityText = [
          orderAny.prioridade,
          order.tipoEntrega,
          order.detalhe,
          order.procurarPor,
          order.pedido,
          orderAny.observacao,
          orderAny.obs
        ].filter(Boolean).map(s => String(s)).join(" ");

        const isExpress = /expresso/i.test(orderPriorityText) || orderAny.prioridade === true || orderAny.isExpress === true;

        const priorityRate = matchedRule.prioridade !== undefined && matchedRule.prioridade !== null && matchedRule.prioridade !== "" 
          ? Number(matchedRule.prioridade) 
          : (matchedRule.valorPrioridade !== undefined ? Number(matchedRule.valorPrioridade) : 0);

        if (isExpress && priorityRate > 0) {
          return priorityRate;
        }

        return Number(matchedRule.value) || 0;
      }
      
      return Number(order.valorEntrega) || Number(order.value) || 0;
    };

    const calculateRepasseForOrder = (order: Order, rules: any[], courierObj?: Courier): number => {
      if (order.status === 'cancelled') return 0;
      const formato = courierObj?.repasseFormato || 'tabela_cep';
      const defaultRate = courierObj?.repasseTaxa !== undefined && courierObj?.repasseTaxa !== null ? Number(courierObj.repasseTaxa) : 9.50;

      if (formato === 'porcentagem') {
        const pct = courierObj?.repassePorcentagem !== undefined && courierObj?.repassePorcentagem !== null ? Number(courierObj.repassePorcentagem) : 80;
        const freightVal = Number(order.valorEntrega) || Number(order.value) || 0;
        return Math.round((freightVal * (pct / 100)) * 100) / 100;
      }

      if (formato === 'fixo') {
        return defaultRate;
      }

      const orderCep = order.cep || "";
      const orderClientCode = order.codigoCliente || "";
      if (!orderCep) return defaultRate;
      const cleanOrderCep = orderCep.replace(/\D/g, "");
      if (!cleanOrderCep) return defaultRate;
      const cepNum = parseInt(cleanOrderCep, 10);
      if (isNaN(cepNum)) return defaultRate;

      const matchedRule = rules.find((rule: any) => {
        const isPartnerMatch = rule.partnerId === partnerId || rule.codigoCliente === partnerId || matchClientCode(partnerId, rule.partnerId) || matchClientCode(partnerId, rule.codigoCliente);
        if (!isPartnerMatch) return false;
        const minCep = (rule.cepMin || "").replace(/\D/g, "");
        const maxCep = (rule.cepMax || "").replace(/\D/g, "");
        if (!minCep || !maxCep) return false;
        return cepNum >= parseInt(minCep, 10) && cepNum <= parseInt(maxCep, 10);
      });

      if (matchedRule) {
        const repasseVal = matchedRule.valorRepasse !== undefined && matchedRule.valorRepasse !== null && matchedRule.valorRepasse !== ""
          ? Number(matchedRule.valorRepasse)
          : (matchedRule.repasseRegra !== undefined ? Number(matchedRule.repasseRegra) : 0);
        if (repasseVal > 0) return repasseVal;
      }
      return defaultRate;
    };

    let updateCount = 0;

    setOrders(prev => {
      const updated = prev.map(order => {
        const isCompleted = (order.status as string) === 'completed' || order.status === 'delivered' || (order.status as string) === 'entregue' || order.status === 'cancelled';
        const isPending = order.status === 'pending' || order.status === 'in_progress' || order.status === 'in_route';

        // STRICT REQUIREMENT: Completed orders preserve their existing calculated rates
        if (!isCompleted && isPending && matchClientCode(partnerId, order.codigoCliente)) {
          const newVal = calculateFreightForOrder(order, updatedRules);
          let newCondutor = order.valorCondutor;
          if (order.courierId) {
            const courierObj = couriers.find(c => c.id === order.courierId);
            newCondutor = calculateRepasseForOrder(order, updatedRules, courierObj);
          }

          if (newVal !== order.valorEntrega || newVal !== order.value || (order.courierId && newCondutor !== order.valorCondutor)) {
            updateCount++;
            const updatedOrder = { 
              ...order, 
              valorEntrega: newVal, 
              value: newVal,
              ...(order.courierId ? { valorCondutor: newCondutor } : {})
            };
            
            if (db) {
              setDoc(doc(db, 'orders', order.id), updatedOrder).catch((e: any) => {
                console.error('[Recalc Freight Firestore Error]', e);
              });
            }
            return updatedOrder;
          }
        }
        return order;
      });

      if (updateCount > 0) {
        localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      }
      return updated;
    });

    console.log(`[Recalcular Frete] Atualizados ${updateCount} pedidos para o parceiro ${partnerId}.`);
  };

  const handleBulkUpdateStatus = async (orderIds: string[], nextStatus: OrderStatus) => {
    if (currentUser && currentUser.canAlter === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Alterar status em lote.");
      return;
    }
    const nowTimestamp = Date.now();
    const nowIso = new Date(nowTimestamp).toISOString();

    // 1. Optimistic UI and local cache update
    setOrders(prev => {
      const updated = prev.map(o => orderIds.includes(o.id) ? { 
        ...o, 
        status: nextStatus, 
        statusSincronizado: nextStatus, 
        status_sincronizado: nextStatus,
        versionTimestamp: nowTimestamp,
        updatedAt: nowTimestamp,
        version: (Number(o.version) || 0) + 1,
        ...(nextStatus === 'cancelled' ? { courierId: undefined, valorCondutor: 0 } : {})
      } : o);
      localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      if (db) {
        orderIds.forEach(id => {
          const ord = updated.find(o => o.id === id);
          if (ord) {
            setDoc(doc(db, 'orders', id), ord).catch(fsErr => {
              console.error('[Firestore Direct Update Error] Falha ao atualizar pedido em lote no Firestore:', fsErr);
            });
          }
        });
      }
      return updated;
    });

    // 2. Update couriers if status is delivered or cancelled
    if (nextStatus === 'delivered' || nextStatus === 'cancelled') {
      const affectedCouriersMap: Record<string, number> = {};
      orders.forEach(o => {
        if (orderIds.includes(o.id) && o.courierId) {
          affectedCouriersMap[o.courierId] = (affectedCouriersMap[o.courierId] || 0) + 1;
        }
      });

      const affectedIds = Object.keys(affectedCouriersMap);
      if (affectedIds.length > 0) {
        setCouriers(prev => {
          const updated = prev.map(c => {
            if (!affectedIds.includes(c.id)) return c;
            const inc = nextStatus === 'delivered' ? (affectedCouriersMap[c.id] || 0) : 0;
            const hasOtherActive = orders.some(o => 
              !orderIds.includes(o.id) && 
              o.courierId === c.id && 
              o.status !== 'delivered' && 
              o.status !== 'cancelled' && 
              !o.isDeleted && 
              !o.deleted
            );
            return {
              ...c,
              ordersCompleted: (c.ordersCompleted || 0) + inc,
              status: (hasOtherActive ? 'busy' : 'online') as any
            };
          });
          localStorage.setItem('vinimap_couriers', JSON.stringify(updated));
          return updated;
        });
      }
    }

    // 3. Direct Supabase write for Shard Cloud persistence
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        const updatePayload: any = {
          status: nextStatus,
          status_sincronizado: nextStatus,
          updated_at: nowIso,
          version_timestamp: nowTimestamp
        };
        if (nextStatus === 'cancelled') {
          updatePayload.courier_id = null;
          updatePayload.valor_condutor = 0;
          updatePayload.valor_repasse = 0;
        }
        await supabase.from('orders').update(updatePayload).in('id', orderIds);
        console.log(`[Supabase Direct] Status de ${orderIds.length} pedidos atualizado para ${nextStatus}`);
      }
    } catch (sbErr) {
      console.warn('[Supabase Direct Error] Erro ao atualizar status em lote no Supabase:', sbErr);
    }

    // 4. Backend API call
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, status: nextStatus })
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Status mantido com sucesso local e no Supabase:', err);
    }
  };

  const handleDeleteOrder = async (orderId: string): Promise<void> => {
    if (currentUser && currentUser.canAlter === false) {
      alert("Operação restrita: Seu perfil de operador não possui permissão para Excluir pedidos.");
      throw new Error("Permissão negada");
    }

    // 1. Tombstone in localStorage so background listeners, cache, or older snapshots NEVER re-insert it
    markOrderAsDeleted(orderId);

    // 2. Immediately expunge from React state and localStorage cache
    setOrders(prev => {
      const updated = prev.filter(o => !isOrderDeleted(o));
      localStorage.setItem('vinimap_orders', JSON.stringify(updated));
      return updated;
    });

    const cleanId = String(orderId).replace(/^PED-/i, '');
    removeFromStore('orders', orderId).catch(() => {});
    removeFromStore('orders', cleanId).catch(() => {});
    removeFromStore('orders', `PED-${cleanId}`).catch(() => {});

    // 3. Immediately delete from Firestore directly
    if (db) {
      firestoreDeleteDoc(doc(db, 'orders', orderId)).catch(() => {});
      firestoreDeleteDoc(doc(db, 'orders', cleanId)).catch(() => {});
      firestoreDeleteDoc(doc(db, 'orders', `PED-${cleanId}`)).catch(() => {});
    }

    // 4. Delete from Supabase client if available
    try {
      const { supabase } = await import('./lib/supabase');
      if (supabase) {
        supabase.from('orders').delete().in('id', [orderId, cleanId, `PED-${cleanId}`]).then(() => {
          console.log(`[Supabase Client] Pedido ${orderId} deletado definitivamente.`);
        }).catch((sbErr: any) => {
          console.error('[Supabase Client Error] Falha ao deletar pedido:', sbErr);
        });
      }
    } catch (e) {}

    // 5. Delete on backend server and refresh bootstrap
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      });
      await ensureJsonResponse(res);
      await fetchDatabase();
    } catch (err) {
      console.warn('Backend offline ou ambiente Shard Cloud estático detectado. Exclusão garantida localmente e na nuvem:', err);
    }
  };


  // Render individual tabs views to make entire navigation fully active
  const renderActiveView = () => {
    if (currentUser && currentUser.canConsult === false && currentUser.role !== 'driver') {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-xl mx-auto bg-white border border-slate-150 rounded-2xl shadow-xl mt-12 animate-fade-in">
          <div className="h-14 w-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Acesso para Consulta Restrito</h3>
          <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
            Seu perfil de operador está configurado com a permissão de <span className="text-rose-600 font-bold">Consulta suspensa</span>. 
            Você não possui privilégios para visualizar tabelas de pedidos, KPIs ou mapas de entrega neste momento.
          </p>
          <div className="mt-6 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 font-semibold w-full">
            ⚠️ Entre em contato com o administrador para habilitar "Consultar" nas suas permissões de nível de operação.
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'diary':
        return (
          <DiaryTab currentUser={currentUser} />
        );

      case 'orders':
        return (
          <div className="space-y-6" id="print-orders-tab">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Gerenciador de Pedidos</h2>
                <p className="text-xs text-slate-500 font-medium">Fluxo operacional integrado para despacho, monitoramento e relatórios</p>
              </div>
              <button
                onClick={() => handlePrintSection('print-orders-tab')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                title="Impressão rápida apenas com foco na tabela de dados daquela aba"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Impressão Rápida</span>
              </button>
            </div>

            <OrdersTable 
              orders={orders} 
              onUpdateStatus={handleUpdateOrderStatus} 
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkAllocateCourier={handleBulkAllocateCourier}
              searchTerm={searchTerm} 
              onSearchTermChange={setSearchTerm}
              onResetDashboardFilterStatus={() => {
                setDashboardFilterStatus(null);
                setDashboardFilterStart(undefined);
                setDashboardFilterEnd(undefined);
              }}
              partnerClients={partnerClients}
              couriers={couriers}
              hubs={hubs}
              freightRules={freightRules}
              onAllocateCourier={handleAllocateCourier}
              onDeallocateCourier={handleDeallocateCourier}
              onEditOrder={handleEditOrder}
              onDeleteOrder={handleDeleteOrder}
              onAddOrder={handleAddOrder}
              currentUser={currentUser}
              selectedCourierId={selectedCourierId}
              setSelectedCourierId={(courierId) => {
                setSelectedCourierId(courierId);
              }}
              onDateFilterChange={handleDateFilterChange}
              initialEnableDateFilter={dashboardFilterEnabled !== undefined ? dashboardFilterEnabled : true}
              initialStartDate={dashboardFilterStart}
              initialEndDate={dashboardFilterEnd}
              statusFilter={dashboardFilterStatus || undefined}
              onRefetchDatabase={(options) => fetchDatabase(true, options)}
              isSyncing={isSyncing}
              onLoadPeriod={lazyLoadPeriod}
              onLoadFullHistory={lazyLoadFullHistory}
              isFullHistoryLoaded={isFullHistoryLoaded}
              totalOrdersInDb={totalOrdersInDb}
              isLoadingPeriod={isLoadingPeriod}
            />
          </div>
        );

      case 'allocation':
        return (
          <AllocationTab 
            orders={orders}
            couriers={couriers}
            partnerClients={partnerClients}
            onAllocateCourier={handleAllocateCourier}
            onBulkAllocateCourier={handleBulkAllocateCourier}
            currentUser={currentUser}
          />
        );

      case 'route_optimizer':
        return (
          <RouteOptimizerTab
            orders={orders}
            couriers={couriers}
            hubs={hubs}
            onUpdateOrderSequence={async (orderId, sequencia) => {
              const existing = orders.find(o => o.id === orderId);
              if (existing) {
                await handleEditOrder({ ...existing, sequencia });
              } else {
                try {
                  await fetch(`/api/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sequencia })
                  });
                } catch (_) {}
              }
            }}
            onAllocateCourier={handleAllocateCourier}
          />
        );

      case 'driver_device':
        return (
          <DriverDeviceSimulator 
            orders={orders}
            couriers={couriers}
            partnerClients={partnerClients}
            branding={branding}
            onUpdateStatus={handleUpdateOrderStatus}
            onUpdateCourier={handleUpdateCourier}
            onReorderOrders={fetchDatabase}
          />
        );

      case 'driver_gps':
        return (
          <DriverGpsTab 
            couriers={couriers}
            hubs={hubs}
            onRefetchDatabase={fetchDatabase}
          />
        );

      case 'couriers':
        return (
          <CouriersTab
            couriers={couriers}
            onAddCourier={handleAddCourier}
            onUpdateCourier={handleUpdateCourier}
            onDeleteCourier={handleDeleteCourier}
            selectedCourierId={selectedCourierId}
            setSelectedCourierId={setSelectedCourierId}
            searchTerm={searchTerm}
            orders={orders}
          />
        );

      case 'partners':
        return (
          <PartnersTab 
            partnerClients={partnerClients} 
            onAddPartner={handleAddPartner} 
            onUpdatePartner={handleUpdatePartner}
            onDeletePartner={handleDeletePartner}
            globalSearchTerm={searchTerm}
            onConfigureFreight={(partnerId) => {
              setSelectedFreightPartnerId(partnerId);
              setActiveTab('freight_config');
            }}
          />
        );

      case 'hubs':
        return (
          <HubsTab 
            hubs={hubs}
            onAddHub={handleAddHub}
            onUpdateHub={handleUpdateHub}
            onDeleteHub={handleDeleteHub}
            onSetActiveHub={handleSetActiveHub}
          />
        );

      case 'freight_config':
        return (
          <FreightConfigTab 
            partnerClients={partnerClients} 
            currentUser={currentUser}
            initialSelectedPartnerId={selectedFreightPartnerId}
            onSelectPartnerId={setSelectedFreightPartnerId}
            onRefetchDatabase={fetchDatabase}
            onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
            orders={orders}
            freightRules={freightRules}
            onUpdateFreightRules={(updated) => {
              setFreightRules(updated);
              localStorage.setItem('vinimap_freight_rules', JSON.stringify(updated));
            }}
          />
        );

      case 'volume_calculator':
      case 'calculo_volumes':
      case 'correios':
        return (
          <VolumeCalculatorCorreiosTab
            orders={orders}
            onAddOrder={handleAddOrder}
            partnerClients={partnerClients}
            currentUser={currentUser}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        );

      case 'operators':
        return (
          <OperatorsTab currentUser={currentUser} />
        );

      case 'sync_logs':
        return (
          <SyncLogsTab 
            orders={orders}
            partnerClients={partnerClients}
            freightRules={freightRules}
            onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
            onUpdateOrder={handleEditOrder}
            onNavigateToFreightConfig={(partnerId) => {
              setSelectedFreightPartnerId(partnerId);
              setActiveTab('freight_config');
            }}
          />
        );

      case 'environment':
      case 'env_config':
        return (
          <EnvironmentConfigTab />
        );

      case 'import_spreadsheet':
        return (
          <div className="space-y-6" id="print-import-tab">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Importação de Planilha Eletrônica</h2>
                <p className="text-xs text-slate-500 font-medium">Carregue ou cole os dados tabulares do Excel/CSV para criação e sincronização em lote</p>
              </div>
              <button
                onClick={() => handlePrintSection('print-import-tab')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                title="Impressão rápida apenas com foco na tabela de dados daquela aba"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Impressão Rápida</span>
              </button>
            </div>
            
            <ImportSpreadsheet 
              orders={orders} 
              partnerClients={partnerClients} 
              freightRules={freightRules}
              onImportOrders={(newOrders) => {
                handleImportOrders(newOrders);
                setActiveTab('orders'); // Redirect gracefully to orders list to review imported items!
              }} 
            />
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-6" id="print-admin-tab">
            {/* Header section with refined typography and visual rhythm */}
            <div className="pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ShieldCheck className="h-5 w-5" /></span>
                  Painel de Administração
                </h2>
                <p className="text-xs text-slate-500 font-medium">Controles consolidados de condutores, parceiros comerciais e análises estratégicas de volume</p>
              </div>
              <button
                onClick={() => handlePrintSection('print-admin-tab')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                title="Impressão rápida apenas com foco na tabela de dados daquela aba"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                <span>Impressão Rápida</span>
              </button>
            </div>

            {/* Elegant Administration Modules Bento-Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full no-print">
              {[
                { id: 'partners', name: 'Clientes Parceiros', count: partnerClients.length, info: 'Faturamento & Contratos' },
                { id: 'freight_config', name: 'Configuração de Frete', info: 'Tabela de tarifas por CEP' },
                { id: 'volume_calculator', name: 'Cálculo de Volumes Correios', info: 'Cubagem, PAC/SEDEX e pedidos instantâneos' },
                { id: 'couriers', name: 'Cadastro de Condutores', count: couriers.length, info: 'Fila ativa & Licenças' },
                { id: 'hubs', name: 'Cadastro de HUBs', count: hubs.length, info: 'Fronteira & HUB Central' },
                { id: 'partner_dashboard', name: 'Métricas do Parceiro', info: 'Painel consolidador' },
                { id: 'billing', name: 'Relatórios de Notas', info: 'Faturamento & Fechamento' },
                { id: 'reports', name: 'Relatórios Estratégicos', info: 'Sazonalidade & Indicadores' },
                { id: 'operators', name: 'Controle de Operadores', info: 'Segurança & Credenciais' },
                { id: 'sync_logs', name: 'Logs de Sincronização', info: 'Falhas de CEPs e tarifas de parceiros' },
                { id: 'env_config', name: 'Configuração de Ambiente', info: 'Status de conexão Firebase & Supabase' },
                { id: 'supabase_sql_gen', name: 'Exportar SQL Supabase', info: 'Gerador de tabelas DDL prontas' },
              ].map((sub) => {
                const isSubActive = adminSubTab === sub.id;
                
                // Determine icon
                let subIcon = <ShieldCheck className="h-5 w-5" />;
                if (sub.id === 'partners') subIcon = <Users className="h-5 w-5" />;
                if (sub.id === 'freight_config') subIcon = <Wallet className="h-5 w-5" />;
                if (sub.id === 'volume_calculator') subIcon = <Box className="h-5 w-5" />;
                if (sub.id === 'couriers') subIcon = <Truck className="h-5 w-5" />;
                if (sub.id === 'hubs') subIcon = <MapPin className="h-5 w-5" />;
                if (sub.id === 'partner_dashboard') subIcon = <BarChart3 className="h-5 w-5" />;
                if (sub.id === 'billing') subIcon = <FileText className="h-5 w-5" />;
                if (sub.id === 'reports') subIcon = <TrendingUp className="h-5 w-5" />;
                if (sub.id === 'operators') subIcon = <ShieldCheck className="h-5 w-5" />;
                if (sub.id === 'sync_logs') subIcon = <ActivityIcon className="h-5 w-5" />;
                if (sub.id === 'env_config') subIcon = <Settings className="h-5 w-5" />;
                if (sub.id === 'supabase_sql_gen') subIcon = <Database className="h-5 w-5" />;

                return (
                  <button
                    key={sub.id}
                    onClick={() => setAdminSubTab(sub.id)}
                    className={`group relative text-left p-4.5 rounded-2xl transition-all duration-300 border cursor-pointer flex flex-col justify-between min-h-[110px] ${
                      isSubActive
                        ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white border-indigo-950 shadow-md shadow-indigo-100 scale-[1.01]'
                        : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-800 shadow-xs hover:translate-y-[-2px] hover:shadow-md'
                    }`}
                  >
                    {/* Top decoration active accent line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-all duration-300 ${
                      isSubActive ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500' : 'bg-transparent group-hover:bg-slate-200'
                    }`} />

                    <div className="flex items-start justify-between gap-2.5 w-full">
                      {/* Icon container */}
                      <span className={`p-2.5 rounded-xl transition-colors duration-300 ${
                        isSubActive 
                          ? 'bg-white/10 text-cyan-300' 
                          : 'bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        {React.cloneElement(subIcon, { 
                          className: `h-5 w-5 transition-transform duration-300 group-hover:scale-110` 
                        })}
                      </span>

                      {/* Optional Badge total */}
                      {sub.count !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold transition-all duration-200 ${
                          isSubActive 
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/20' 
                            : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
                        }`}>
                          {sub.count} ativos
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-1">
                      <h4 className={`text-xs font-extrabold tracking-tight transition-colors duration-200 ${isSubActive ? 'text-white' : 'text-slate-800'}`}>
                        {sub.name}
                      </h4>
                      <p className={`text-[10px] mt-1 font-medium leading-normal transition-colors duration-200 ${isSubActive ? 'text-slate-300/80' : 'text-slate-400'}`}>
                        {sub.info}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sub-view Area */}
            <div className="p-1 bg-transparent transition-all duration-300">
              {adminSubTab === 'partners' && (
                <PartnersTab 
                  partnerClients={partnerClients} 
                  onAddPartner={handleAddPartner} 
                  onUpdatePartner={handleUpdatePartner}
                  onDeletePartner={handleDeletePartner}
                  globalSearchTerm={searchTerm}
                  onConfigureFreight={(partnerId) => {
                    setSelectedFreightPartnerId(partnerId);
                    setAdminSubTab('freight_config');
                  }}
                />
              )}
              {adminSubTab === 'freight_config' && (
                <FreightConfigTab 
                  partnerClients={partnerClients} 
                  currentUser={currentUser}
                  initialSelectedPartnerId={selectedFreightPartnerId}
                  onSelectPartnerId={setSelectedFreightPartnerId}
                  onRefetchDatabase={fetchDatabase}
                  onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
                  orders={orders}
                  freightRules={freightRules}
                  onUpdateFreightRules={(updated) => {
                    setFreightRules(updated);
                    localStorage.setItem('vinimap_freight_rules', JSON.stringify(updated));
                  }}
                />
              )}
              {adminSubTab === 'volume_calculator' && (
                <VolumeCalculatorCorreiosTab
                  orders={orders}
                  onAddOrder={handleAddOrder}
                  partnerClients={partnerClients}
                  currentUser={currentUser}
                  onNavigateToTab={(tab) => {
                    if (tab === 'orders') {
                      setActiveTab('orders');
                    } else {
                      setAdminSubTab(tab);
                    }
                  }}
                />
              )}
              {adminSubTab === 'couriers' && (
                <CouriersTab
                  couriers={couriers}
                  onAddCourier={handleAddCourier}
                  onUpdateCourier={handleUpdateCourier}
                  onDeleteCourier={handleDeleteCourier}
                  selectedCourierId={selectedCourierId}
                  setSelectedCourierId={setSelectedCourierId}
                  searchTerm={searchTerm}
                  orders={orders}
                />
              )}
              {adminSubTab === 'hubs' && (
                <HubsTab 
                  hubs={hubs}
                  onAddHub={handleAddHub}
                  onUpdateHub={handleUpdateHub}
                  onDeleteHub={handleDeleteHub}
                  onSetActiveHub={handleSetActiveHub}
                />
              )}
              {adminSubTab === 'partner_dashboard' && (
                <PartnerDashboardTab 
                  orders={orders} 
                  partnerClients={partnerClients} 
                  onUpdateStatus={handleUpdateOrderStatus}
                />
              )}
              {adminSubTab === 'billing' && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Faturamento & Relatórios de Notas</h3>
                    <p className="text-[11px] text-slate-400">Gere e exporte planilhas oficiais de fechamento e faturamento de parceiros comerciais</p>
                  </div>
                  <BillingExportPanel 
                    orders={orders} 
                    partnerClients={partnerClients} 
                  />
                </div>
              )}
              {adminSubTab === 'reports' && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Relatórios Estratégicos & Desempenho</h3>
                    <p className="text-[11px] text-slate-400">Detecção de sazonalidades, volumes regionais de despachos e fretes de condutores</p>
                  </div>
                  <SVGCharts hourlyStats={hourlyStats} regionDistribution={regionDistribution} orders={orders} />
                </div>
              )}
              {adminSubTab === 'operators' && (
                <OperatorsTab currentUser={currentUser} />
              )}
              {adminSubTab === 'sync_logs' && (
                <SyncLogsTab 
                  orders={orders}
                  partnerClients={partnerClients}
                  freightRules={freightRules}
                  onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
                  onUpdateOrder={handleEditOrder}
                  onNavigateToFreightConfig={(partnerId) => {
                    setSelectedFreightPartnerId(partnerId);
                    setAdminSubTab('freight_config');
                  }}
                />
              )}
              {adminSubTab === 'env_config' && (
                <EnvironmentConfigTab />
              )}
              {adminSubTab === 'supabase_sql_gen' && (
                <SupabaseSqlGenTab />
              )}
            </div>
          </div>
        );

      case 'map':
        return (
          <div className="space-y-6">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Painel de Monitoramento Amplo</h2>
              <p className="text-xs text-slate-500">Rastreamento de geolocalizações GPS em tela cheia</p>
            </div>
            <LiveMap 
              couriers={couriers} 
              orders={orders} 
              selectedCourierId={selectedCourierId} 
              setSelectedCourierId={setSelectedCourierId} 
              hubs={hubs}
            />
          </div>
        );

      case 'routes':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Otimizador de Rotas Inteligentes</h2>
                <p className="text-xs text-slate-500">Definições de menores distâncias geográficas de frota</p>
              </div>
              <button
                onClick={handleOptimizeRoutes}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                <span>Otimizar Agora</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-850 text-sm mb-4">Centros de Carga & Hubs</h3>
                <div className="space-y-4">
                  {hubs.map((h) => (
                    <div 
                      key={h.id} 
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        h.isActive 
                          ? 'bg-blue-50/50 border-blue-105 ring-1 ring-blue-100' 
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="space-y-1.5 pr-4">
                        <h4 className={`text-xs font-bold ${h.isActive ? 'text-slate-800' : 'text-slate-700'}`}>{h.name}</h4>
                        <p className="text-[10px] text-slate-400 font-sans leading-relaxed">{h.address} <span className="font-mono text-[9px]">({h.cep})</span></p>
                        <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                          Regra fim de rota: {h.endRoutingType === 'farthest' ? 'Última Mais Distante' : h.endRoutingType === 'hub' ? 'Retornar ao HUB' : `Personalizado: ${h.manualEndAddress || h.address}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${h.isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-650'}`}>
                        {h.isActive ? 'Ativo' : 'Aguardando'}
                      </span>
                    </div>
                  ))}
                  {hubs.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Nenhum HUB Central cadastrado. Vá em Painel Admin {`>`} Cadastro de HUBs para criar.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-850 text-sm mb-4">Métricas de Otimização & Trajeto</h3>
                  {selectedCourierId ? (
                    (() => {
                      const selectedCourier = couriers.find(c => c.id === selectedCourierId);
                      const activeCourierOrders = orders.filter(o => 
                        o.courierId === selectedCourierId && 
                        (o.status === 'pending' || o.status === 'in_progress' || o.status === 'in_route')
                      );
                      
                      // Resolve active hub base
                      const activeHub = hubs.find(h => h.isActive) || {
                        latitude: -23.530385,
                        longitude: -46.702677
                      };

                      // Helper to get order coordinate %
                      const getOrderCoordsLocal = (order: Order) => {
                        if (order.latitude !== undefined && order.longitude !== undefined) {
                          const lat = order.latitude;
                          const lng = order.longitude;
                          if (lat < 0 && lng < 0) {
                            const pctLat = 15 + ((lat - -23.4) / (-23.7 - -23.4)) * 70;
                            const pctLng = 15 + ((lng - -46.4) / (-46.8 - -46.4)) * 70;
                            return {
                              lat: Math.min(Math.max(pctLat, 15), 85),
                              lng: Math.min(Math.max(pctLng, 15), 85)
                            };
                          }
                        }
                        let baseLat = 50;
                        let baseLng = 50;
                        switch (order.region) {
                          case 'Centro-Paulista': baseLat = 46; baseLng = 48; break;
                          case 'Zona Sul': baseLat = 74; baseLng = 52; break;
                          case 'Zona Oeste': baseLat = 45; baseLng = 26; break;
                          case 'Zona Leste': baseLat = 52; baseLng = 78; break;
                          case 'Zona Norte': baseLat = 24; baseLng = 42; break;
                        }
                        const numId = parseInt(order.id.replace(/\D/g, '')) || 0;
                        const scatterY = ((numId % 8) - 4) * 3.5;
                        const scatterX = (((numId + 3) % 8) - 4) * 3.5;
                        return {
                          lat: Math.min(Math.max(baseLat + scatterY, 15), 85),
                          lng: Math.min(Math.max(baseLng + scatterX, 15), 85)
                        };
                      };

                      // Helper to convert logical back to real GPS
                      const convertToRealGPSLocal = (latPct: number, lngPct: number) => {
                        const baseLat = activeHub.latitude;
                        const baseLng = activeHub.longitude;
                        const rLat = baseLat + (50 - latPct) * 0.0018;
                        const rLng = baseLng + (lngPct - 50) * 0.0022;
                        return [rLat, rLng];
                      };

                      const calculateGpsDistanceLocal = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                        const R = 6371; // km
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLon = (lon2 - lon1) * Math.PI / 180;
                        const a = 
                          Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        return R * c; // in km
                      };

                      // Sum up sequential distances
                      let totalDist = 0;
                      const sortedJobs = [...activeCourierOrders].sort((a, b) => {
                        const sA = parseInt(a.sequencia ?? '0', 10) || 0;
                        const sB = parseInt(b.sequencia ?? '0', 10) || 0;
                        return sA - sB;
                      });

                      const routeGpsPoints: [number, number][] = [[activeHub.latitude, activeHub.longitude]];
                      sortedJobs.forEach(o => {
                        let realLat = o.latitude;
                        let realLng = o.longitude;
                        if (!realLat || !realLng || realLat >= 0 || realLng >= 0) {
                          const vectorCoords = getOrderCoordsLocal(o);
                          const coords = convertToRealGPSLocal(vectorCoords.lat, vectorCoords.lng);
                          realLat = coords[0];
                          realLng = coords[1];
                        }
                        routeGpsPoints.push([realLat, realLng]);
                      });

                      for (let i = 0; i < routeGpsPoints.length - 1; i++) {
                        totalDist += calculateGpsDistanceLocal(
                          routeGpsPoints[i][0], routeGpsPoints[i][1],
                          routeGpsPoints[i+1][0], routeGpsPoints[i+1][1]
                        );
                      }

                      // Apply 1.35x real-street winding multiplier
                      const totalEstimatedDist = totalDist * 1.35;
                      const speedKmh = selectedCourier?.vehicle === 'motorcycle' ? 28 : 22;
                      const travelTimeMinutes = (totalEstimatedDist / speedKmh) * 60 + (sortedJobs.length * 3);

                      return (
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-2.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                            {selectedCourier?.avatar && (
                              <img src={selectedCourier.avatar} className="h-9 w-9 rounded-full object-cover border" referrerPolicy="no-referrer" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-snug">{selectedCourier?.name || 'Condutor em trânsito'}</p>
                              <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">Veículo: {selectedCourier?.vehicle === 'motorcycle' ? 'Moto' : 'Utilitário'} • {selectedCourier?.phone}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distância da Rota</p>
                              <p className="text-xl font-bold text-blue-600 mt-1 font-mono">{totalEstimatedDist.toFixed(1)} km</p>
                              <span className="text-[9px] text-slate-400 font-medium leading-none">Distância real por ruas</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempo Estimado</p>
                              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">{Math.round(travelTimeMinutes)} min</p>
                              <span className="text-[9px] text-slate-400 font-medium leading-none">Previsão com tráfego</span>
                            </div>
                          </div>

                          <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2 flex items-center justify-between text-[11px] text-amber-800">
                            <span className="font-medium">Paradas sequenciadas nesta rota:</span>
                            <span className="font-bold font-mono">{sortedJobs.length} entregas</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-500">Média de Economia</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">32%</p>
                          <span className="text-[9px] text-slate-400 font-medium">De tempo em trânsito</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-500">Previsão Acumulada</p>
                          <p className="text-2xl font-bold text-emerald-600 mt-1">16.4 min</p>
                          <span className="text-[9px] text-slate-400 font-medium">Para entregas urbanas</span>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-slate-400 font-medium text-center">💡 Selecione um entregador no mapa abaixo para detalhar o trajeto dele em tempo real e visualizar a estimativa de tempo e distância da rota.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <LiveMap 
              couriers={couriers} 
              orders={orders} 
              selectedCourierId={selectedCourierId} 
              setSelectedCourierId={setSelectedCourierId} 
              hubs={hubs}
            />
          </div>
        );

      case 'finance':
        return (
          <FinanceTab 
            orders={orders}
            partnerClients={partnerClients}
            couriers={couriers}
            onRefetchDatabase={fetchDatabase}
          />
        );

      case 'integracoes':
      case 'intelipost':
        return (
          <IntegracoesTab 
            orders={orders}
            onAddOrder={handleAddOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        );

      case 'backup':
        return (
          <BackupTab 
            orders={orders}
            onImportOrders={handleImportOrders}
          />
        );

      case 'firebase':
      case 'firebase_control':
        return (
          <FirebaseControlCenter 
            onNotify={(msg, type) => {
              console.log(`[${type.toUpperCase()}] ${msg}`);
              if (type === 'error') {
                alert(`Erro: ${msg}`);
              } else {
                // Gentle log entry
                const newAct: Activity = {
                  id: `act-${Date.now()}`,
                  time: formatToBrasiliaTime(new Date()),
                  type: 'alert',
                  message: `Firebase: ${msg}`,
                  details: 'Integrador e sincronizador ativo no ViniMap'
                };
                setActivities(prev => [newAct, ...prev]);
              }
            }}
          />
        );

      case 'github':
        return (
          <GithubTab />
        );

      case 'sql_export':
      case 'supabase_sql':
        return (
          <SupabaseSqlGenTab />
        );

      case 'activities':
        return (
          <div className="space-y-6" id="print-activities-tab">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between no-print">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Feed de Atividades Operacionais</h2>
                <p className="text-xs text-slate-500 font-medium">Histórico abrangente e monitoramento em tempo real de todas as ações e eventos no ViniMap</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintSection('print-activities-tab')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-205 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] no-print"
                  title="Impressão rápida apenas com foco na tabela de dados daquela aba"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>Impressão Rápida</span>
                </button>
                <span className="text-[10px] bg-blue-105 bg-blue-50 text-blue-700 font-extrabold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-wider animate-pulse select-none">
                  Monitoramento Vivo
                </span>
              </div>
            </div>

            <div className="w-full bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[500px]">
              <ActivityFeed activities={activities} />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            {/* Real-time Ocorrência Notifications Alert Box (Visible when count > 0) */}
            {ocorrenciaAlerts.length > 0 && (
              <div id="active-ocorrencias-alert-box" className="bg-rose-50/90 border-2 border-rose-200 rounded-3xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 left-0 h-1.5 w-full bg-rose-500 animate-pulse"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-rose-500 text-white rounded-xl shadow-md flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 animate-bounce" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-rose-900 tracking-tight flex items-center gap-2">
                        <span>Central de Alertas: Ocorrências de Campo</span>
                        <span className="text-[10px] bg-rose-200 text-rose-800 font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                          {ocorrenciaAlerts.length} pendente{ocorrenciaAlerts.length > 1 ? 's' : ''}
                        </span>
                      </h3>
                      <p className="text-[10px] text-rose-600 font-bold mt-0.5">Pendências críticas registradas pelos condutores em rota. Atuação imediata requerida.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setOcorrenciaAlerts([]);
                    }}
                    className="text-[10.5px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold px-3 py-1.5 rounded-xl cursor-pointer shadow-md shadow-rose-650/10 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Ignorar todas as ocorrências</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[220px] overflow-y-auto pr-1">
                  {ocorrenciaAlerts.map(alertItem => {
                    // Pre-calculate status-specific thematic styling for high-fidelity response matching user colors
                    let borderClass = "border-l-4 border-l-orange-500 border-orange-150";
                    let idBadgeClass = "bg-orange-50 border-orange-150 text-orange-700";
                    let pulseDotClass = "bg-orange-500";
                    let badgeLabel = "Pendente";
                    let badgeStyles = "bg-orange-100 text-orange-800 border-orange-205";

                    if (alertItem.status === 'failure') {
                      borderClass = "border-l-4 border-l-red-500 border-red-150";
                      idBadgeClass = "bg-red-50 border-red-150 text-red-755";
                      pulseDotClass = "bg-red-500";
                      badgeLabel = "Falha";
                      badgeStyles = "bg-red-100 text-red-800 border-red-205";
                    } else if (alertItem.status === 'cancelled') {
                      borderClass = "border-l-4 border-l-amber-500 border-amber-150";
                      idBadgeClass = "bg-amber-50 border-amber-150 text-amber-705";
                      pulseDotClass = "bg-amber-500";
                      badgeLabel = "Cancelado";
                      badgeStyles = "bg-amber-100 text-amber-800 border-amber-205";
                    }

                    return (
                      <div key={alertItem.id} className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow relative flex flex-col justify-between transition-all duration-200 ${borderClass}`}>
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border font-mono tracking-tight flex items-center gap-1 ${idBadgeClass}`}>
                                <span className={`h-1.5 w-1.5 rounded-full animate-ping ${pulseDotClass}`}></span>
                                {alertItem.orderId}
                              </span>
                              <span className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border tracking-wider font-sans ${badgeStyles}`}>
                                {badgeLabel}
                              </span>
                            </div>
                            <span className="text-[9.5px] text-slate-400 font-semibold font-mono flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {alertItem.time}
                            </span>
                          </div>
                          <p className="text-xs font-black text-slate-800 leading-snug line-clamp-1">{alertItem.customerName}</p>
                          <p className="text-[10.5px] text-slate-550 font-medium leading-normal mt-1.5">
                            Condutor: <span className="font-bold text-slate-700">{alertItem.courierName}</span>
                          </p>
                          <p className="text-[10.5px] text-slate-550 font-medium leading-normal">
                            Região: <span className="font-bold text-slate-700">{alertItem.region}</span>
                          </p>

                        {/* Reagendamento automático */}
                        <div className="mt-2.5 text-[9px] bg-rose-50/50 p-2 rounded-xl border border-rose-100/80 flex flex-col gap-1.5">
                          <span className="font-extrabold text-rose-800 uppercase tracking-wider block">Reagendar Entrega</span>
                          <div className="flex gap-1.5">
                            <input
                              type="date"
                              id={`reschedule-date-${alertItem.id}`}
                              className="text-[10px] px-2 py-1 bg-white border border-rose-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans cursor-pointer flex-1"
                              defaultValue={new Date().toISOString().split('T')[0]}
                            />
                            <button
                              onClick={async () => {
                                const dateInput = document.getElementById(`reschedule-date-${alertItem.id}`) as HTMLInputElement;
                                if (!dateInput) return;
                                const rawDate = dateInput.value;
                                if (!rawDate) {
                                  window.alert('Por favor, selecione uma data para o reagendamento.');
                                  return;
                                }

                                const parts = rawDate.split('-');
                                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

                                try {
                                  const orderRes = await fetch(`/api/orders/${alertItem.orderId}`);
                                  if (orderRes.ok) {
                                    const orderData = await orderRes.json();
                                    
                                    const updateRes = await fetch(`/api/orders/${alertItem.orderId}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        ...orderData,
                                        dataAgendamento: formattedDate,
                                        status: 'pending',
                                        detalhe: `${orderData.detalhe || ''} • Reagendado automaticamente para ${formattedDate} via Central de Alertas de Ocorrência.`
                                      })
                                    });

                                    if (updateRes.ok) {
                                      setOcorrenciaAlerts(prev => prev.filter(a => a.id !== alertItem.id));
                                      await fetchDatabase();
                                      window.alert(`Pedido ${alertItem.orderId} reagendado com sucesso para ${formattedDate}!`);
                                    } else {
                                      window.alert('Houve um erro ao atualizar o pedido.');
                                    }
                                  } else {
                                    window.alert('Não foi possível carregar os dados do pedido.');
                                  }
                                } catch (err) {
                                  console.error(err);
                                  window.alert('Erro ao realizar o reagendamento.');
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>

                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => {
                            const courier = couriers.find(c => c.name === alertItem.courierName);
                            if (courier) {
                              setSelectedCourierId(courier.id);
                              const mapEl = document.getElementById('search-orders-couriers') || document.getElementById('header-main');
                              mapEl?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-black rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Rastrear no Mapa
                        </button>
                        <button
                          onClick={() => {
                            const phone = couriers.find(c => c.name === alertItem.courierName)?.phone || '';
                            if (phone) window.open(`tel:${phone}`);
                          }}
                          className="py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-black rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                          title="Telefonar para o Condutor"
                        >
                          <PhoneCall className="h-3 w-3 text-slate-500" />
                          <span>Ligar</span>
                        </button>
                        <button
                          onClick={() => {
                            setOcorrenciaAlerts(prev => prev.filter(a => a.id !== alertItem.id));
                          }}
                          className="py-1.5 px-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-black rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Resolver
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* Real-time database synchronization status panel with expandable diagnostics and offline logs export */}
            <div id="local-db-sync-panel" className="bg-white border border-slate-100 rounded-2xl shadow-sm mb-6 transition-all duration-200 overflow-hidden">
              {/* Main Summary Panel Bar */}
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${
                    syncStatus === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {syncStatus === 'online' ? (
                      <Wifi className="h-5 w-5 animate-pulse" />
                    ) : (
                      <WifiOff className="h-5 w-5 animate-bounce" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800 tracking-wide uppercase">Sincronização com o Servidor</h4>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        syncStatus === 'online' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          syncStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        {syncStatus === 'online' ? 'Ativa' : 'Offline / Cache local'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      {syncStatus === 'online' 
                        ? 'O banco de dados local está totalmente integrado em tempo real.' 
                        : 'Detectamos instabilidade operacional. Operando sob cache local com redundância.'
                      }
                      <span className="font-mono text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.2 rounded ml-1.5 select-none text-[9.5px]">
                        Último Sync: {syncTime || '--:--:--'}
                      </span>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {/* Toggle Debug Logs Button */}
                  <button
                    onClick={() => setIsSyncLogsExpanded(!isSyncLogsExpanded)}
                    className={`text-[11px] font-bold px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSyncLogsExpanded 
                        ? 'bg-slate-100 text-slate-800 border-slate-300' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60'
                    }`}
                    title="Exibir painel de logs e diagnósticos de sincronia"
                  >
                    <Bug className="h-3.5 w-3.5 text-slate-500" />
                    <span>Ver Logs de Erro ({syncErrors.length})</span>
                    {isSyncLogsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await fetchDatabase(true);
                      } catch (e) {
                        console.error('Erro de sincronização manual:', e);
                      }
                    }}
                    disabled={isSyncing}
                    className={`text-[11.5px] font-bold px-4 py-2 border rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 shrink-0 ${
                      isSyncing 
                        ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed animate-pulse' 
                        : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200 active:scale-[0.98]'
                    }`}
                    title="Forçar recalibração e atualização direta do terminal com o servidor central"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                  </button>
                </div>
              </div>

              {/* Expandable Debug/Diagnostic Logs Section */}
              {isSyncLogsExpanded && (
                <div className="bg-slate-50/70 border-t border-slate-100/85 p-4 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Diagnostics logs (2/3 width on desktop) */}
                    <div className="lg:col-span-2 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-slate-200/80">
                          <div>
                            <h5 className="text-[11px] font-black uppercase text-slate-600 tracking-wider">Histórico Recente de Erros de Sincronia</h5>
                            <p className="text-[10px] text-slate-400 font-semibold">Erros e advertências de tráfego de rede e acesso a APIs para suporte técnico e depuração offline.</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download logs as JSON */}
                            <button
                              onClick={handleDownloadSyncLogs}
                              disabled={syncErrors.length === 0}
                              className={`text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm border transition-all ${
                                syncErrors.length > 0
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 cursor-pointer hover:scale-[1.02]'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              }`}
                              title="Baixar arquivo JSON contendo todos os logs listados para depuração e auditoria"
                            >
                              <Download className="h-3 w-3" />
                              <span>Baixar JSON de Logs</span>
                            </button>

                            {/* Clear logs list */}
                            <button
                              onClick={() => {
                                if (confirm('Deseja realmente limpar a listagem atual de logs de erro de sincronização?')) {
                                  setSyncErrors([]);
                                }
                              }}
                              disabled={syncErrors.length === 0}
                              className={`text-[10px] font-black p-1.5 rounded-lg border transition-all ${
                                syncErrors.length > 0
                                  ? 'bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border-slate-250 text-slate-600 cursor-pointer'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              }`}
                              title="Limpar todos os logs de sincronização"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {syncErrors.length === 0 ? (
                          <div className="text-center py-6 bg-white/65 border border-slate-200 border-dashed rounded-xl">
                            <AlertTriangle className="h-5 w-5 text-slate-400 mx-auto mb-1.5 opacity-65" />
                            <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Nenhum log de erro registrado</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Todas as conexões e atualizações com a central estão ocorrendo em perfeito estado de comunicação.</p>
                          </div>
                        ) : (
                          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {syncErrors.map((log) => (
                              <div 
                                key={log.id} 
                                className={`p-2.5 rounded-xl border text-[10.5px] transition-all flex items-start gap-2.5 ${
                                  log.severity === 'error'
                                    ? 'bg-rose-50/50 border-rose-100 text-rose-950'
                                    : 'bg-amber-50/50 border-amber-100 text-amber-950'
                                }`}
                              >
                                <div className={`p-1 rounded-md shrink-0 mt-0.5 ${
                                  log.severity === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold uppercase text-[9px] px-1 bg-white border border-slate-200/80 rounded text-slate-700 tracking-wide font-mono">
                                        {log.errorType}
                                      </span>
                                      {log.endpoint && (
                                        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[160px]" title={log.endpoint}>
                                          {log.endpoint}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[9px] text-slate-400 font-medium shrink-0">
                                      {formatToBrasiliaTime(new Date(log.timestamp), true)}
                                    </span>
                                  </div>

                                  <p className="font-bold mt-1 text-slate-800">{log.message}</p>
                                  <p className="text-[9.5px] text-slate-500 font-medium leading-relaxed bg-white/80 px-2 py-1 rounded border border-slate-150 font-mono mt-1.5 whitespace-pre-wrap select-all">
                                    {log.details}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Real-time Latency Line Chart (1/3 width on desktop) */}
                    <div id="sync-latency-monitor-panel" className="lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex flex-col justify-between min-h-[250px]">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h5 className="text-[11px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                            <ActivityIcon className="h-4 w-4 text-blue-550 animate-pulse" />
                            <span>Latência em Tempo Real</span>
                          </h5>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-extrabold border ${
                            latencyHistory[latencyHistory.length - 1]?.latency === 0
                              ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                              : latencyHistory[latencyHistory.length - 1]?.latency > 150
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {latencyHistory[latencyHistory.length - 1]?.latency === 0 ? 'TIMEOUT' : `${latencyHistory[latencyHistory.length - 1]?.latency} ms`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                          Monitoramento contínuo de ping ICMP-like para o servidor principal de banco de dados para evitar gargalos.
                        </p>
                      </div>

                      <div className="h-32 w-full mt-4" id="network-latency-chart-stage">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={latencyHistory} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                              dataKey="time" 
                              tickFormatter={(val) => {
                                // show every 3rd tick or slice to MM:SS
                                try {
                                  return val.substring(3); // return mm:ss
                                } catch (_) {
                                  return val;
                                }
                              }}
                              stroke="#94a3b8" 
                              fontSize={8} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              stroke="#94a3b8" 
                              fontSize={8} 
                              tickLine={false} 
                              axisLine={false}
                              unit="ms"
                            />
                            <RechartsTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl text-[9.5px] font-mono shadow-xl leading-relaxed">
                                      <p className="font-extrabold border-b border-slate-800 pb-1 mb-1 text-slate-400">{data.time}</p>
                                      <p className="flex items-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${data.latency === 0 ? 'bg-rose-500' : 'bg-emerald-400'}`}></span>
                                        <span>Latência: </span>
                                        <span className={`font-black ${data.latency === 0 ? 'text-rose-450' : 'text-emerald-400'}`}>
                                          {data.latency === 0 ? 'Erro de Link / Timeout' : `${data.latency} ms`}
                                        </span>
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="latency" 
                              stroke="#2563eb" 
                              strokeWidth={2} 
                              dot={false}
                              activeDot={{ r: 4, stroke: '#2563eb', strokeWidth: 1, fill: '#ffffff' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          Estável (Central)
                        </span>
                        <span className="font-mono text-[8.5px] font-semibold lowercase">
                          ping frequente @ 4s
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Visual Operational Banner */}
            <Banner 
              onNewOrderClick={() => setIsNewOrderModalOpen(true)}
              onOptimizeRoutes={handleOptimizeRoutes}
              ordersCount={orders.length}
              activeCouriersCount={couriers.filter(c => c.status !== 'offline').length}
            />

            {/* KPIs Totalizadores */}
            <div className="w-full">
              <KPIs 
                orders={orders} 
                couriers={couriers}
                partnerClients={partnerClients}
                selectedCourierId={selectedCourierId}
                onSelectCourier={(courierId) => {
                  setSelectedCourierId(courierId);
                }}
                selectedPartnerId={selectedPartnerId}
                onSelectPartner={(partnerId) => {
                  setSelectedPartnerId(partnerId);
                }}
                startDate={dashboardFilterStart}
                endDate={dashboardFilterEnd}
                onDateChange={(start, end) => {
                  setDashboardFilterStart(start);
                  setDashboardFilterEnd(end);
                  setDashboardFilterEnabled(true);
                }}
                activeStatus={dashboardFilterStatus || 'open'}
                onCardClick={(status, startDate, endDate) => {
                  setDashboardFilterStatus(status);
                  setDashboardFilterStart(startDate);
                  setDashboardFilterEnd(endDate);
                  setDashboardFilterEnabled(true);
                }}
              />
            </div>

            {/* Inventory table (Full Screen) & Activities block below */}
            <div className="space-y-6">
              <div className="w-full">
                <OrdersTable 
                  orders={orders} 
                  onUpdateStatus={handleUpdateOrderStatus} 
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkAllocateCourier={handleBulkAllocateCourier}
                  searchTerm={searchTerm} 
                  onSearchTermChange={setSearchTerm}
                  onResetDashboardFilterStatus={() => {
                    setDashboardFilterStatus('open');
                    setDashboardFilterStart(undefined);
                    setDashboardFilterEnd(undefined);
                    setSelectedPartnerId('all');
                    setSelectedCourierId(null);
                  }}
                  partnerClients={partnerClients}
                  selectedPartnerId={selectedPartnerId}
                  onSelectPartner={(partnerId) => {
                    setSelectedPartnerId(partnerId);
                  }}
                  couriers={couriers}
                  hubs={hubs}
                  freightRules={freightRules}
                  onAllocateCourier={handleAllocateCourier}
                  onDeallocateCourier={handleDeallocateCourier}
                  onEditOrder={handleEditOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onAddOrder={handleAddOrder}
                  currentUser={currentUser}
                  selectedCourierId={selectedCourierId}
                  setSelectedCourierId={(courierId) => {
                    setSelectedCourierId(courierId);
                  }}
                  onDateFilterChange={handleDateFilterChange}
                  initialEnableDateFilter={dashboardFilterEnabled !== undefined ? dashboardFilterEnabled : true}
                  initialStartDate={dashboardFilterStart}
                  initialEndDate={dashboardFilterEnd}
                  statusFilter={dashboardFilterStatus || undefined}
                  onRefetchDatabase={(options) => fetchDatabase(true, options)}
                  isSyncing={isSyncing}
                  onLoadPeriod={lazyLoadPeriod}
                  onLoadFullHistory={lazyLoadFullHistory}
                  isFullHistoryLoaded={isFullHistoryLoaded}
                  totalOrdersInDb={totalOrdersInDb}
                  isLoadingPeriod={isLoadingPeriod}
                />
              </div>
            </div>
          </div>
        );
    }
  };


  // Standalone full screen orders status report view
  if (isNewPageFilter && dashboardFilterStatus) {
    const getTodayISO = (): string => formatToBrasiliaISODate(new Date());

    const getYesterdayISO = (): string => {
      const d = getBrasiliaDate();
      d.setDate(d.getDate() - 1);
      return formatToBrasiliaISODate(d);
    };

    const todayISO = getTodayISO();
    const yesterdayISO = getYesterdayISO();

    const parseToISODateInApp = (str: string | undefined): string => {
      return parseToISODate(str, yesterdayISO);
    };

    const filteredDashboardOrders = orders.filter(o => {
      if (!dashboardFilterStatus) return false;
      const isStatusMatch = dashboardFilterStatus === 'all' ? true : o.status === dashboardFilterStatus;
      if (!isStatusMatch) return false;

      let transitionDateISO: string | null = null;
      const statusToCheck = (dashboardFilterStatus !== 'all') ? dashboardFilterStatus : (o.status === 'delivered' ? 'delivered' : null);
      if (statusToCheck && o.history && Array.isArray(o.history)) {
        const entry = [...o.history].reverse().find(h => h && h.status === statusToCheck);
        if (entry && entry.time) {
          const parts = entry.time.split(' ');
          const datePart = parts[0];
          if (datePart) {
            transitionDateISO = parseToISODateInApp(datePart);
          }
        }
      }
      const launchDateISO = parseToISODateInApp(o.dataSolicitacao);
      const effectiveDateISO = transitionDateISO || launchDateISO;
      const allocatedDateISO = o.allocatedDate ? parseToISODateInApp(o.allocatedDate) : null;

      const matchesLaunchDate = launchDateISO >= dashboardFilterStart && launchDateISO <= dashboardFilterEnd;
      const matchesEffectiveDate = effectiveDateISO >= dashboardFilterStart && effectiveDateISO <= dashboardFilterEnd;
      const matchesAllocatedDate = Boolean(allocatedDateISO && allocatedDateISO >= dashboardFilterStart && allocatedDateISO <= dashboardFilterEnd);

      const isActionStatus = ['delivered', 'cancelled', 'failure'].includes(dashboardFilterStatus);
      if (isActionStatus) {
        return matchesEffectiveDate;
      }
      return matchesLaunchDate || matchesEffectiveDate || matchesAllocatedDate;
    });

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 overflow-y-auto print:p-0 print:bg-white animate-fade-in select-text">
        {/* Header bar (hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-2xl text-indigo-600">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-indigo-150 text-indigo-800 px-2.5 py-0.5 rounded-full select-none">
                  Filtro Standalone por Status
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {filteredDashboardOrders.length} {filteredDashboardOrders.length === 1 ? 'pedido localizado' : 'pedidos localizados'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mt-1">
                Pedidos: {
                  dashboardFilterStatus === 'all' ? 'Todos os Pedidos' :
                  dashboardFilterStatus === 'pending' ? 'Não Iniciado' :
                  dashboardFilterStatus === 'in_progress' ? 'Em Andamento' :
                  dashboardFilterStatus === 'in_route' ? 'Entregando' :
                  dashboardFilterStatus === 'failure' ? 'Ocorrência' :
                  dashboardFilterStatus === 'delivered' ? 'Concluído' : 'Cancelado'
                }
              </h2>
              <p className="text-[11px] text-slate-450 font-semibold mt-0.5">
                Ref. Período de Solicitação de <span className="font-mono text-slate-600 font-bold">{dashboardFilterStart.split('-').reverse().join('/')}</span> até <span className="font-mono text-slate-600 font-bold">{dashboardFilterEnd.split('-').reverse().join('/')}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Printing button */}
            <button
              type="button"
              onClick={() => {
                setTimeout(() => {
                  window.print();
                }, 150);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Exportar para Impressão (A4)</span>
            </button>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={() => exportOrdersToCSV(filteredDashboardOrders, partnerClients)}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FileText className="h-4 w-4 text-emerald-500" />
              <span>Exportar CSV / Planilha</span>
            </button>

            {/* Close overlay button */}
            <button
              type="button"
              onClick={() => {
                try {
                  window.close();
                } catch (e) {}
                // fallback: go to main app by clearing URL search parameters
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <X className="h-4 w-4" />
              <span>Voltar ao Sistema</span>
            </button>
          </div>
        </div>

        {/* Main interactive Table wrapper (hidden during print) */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex-1 shadow-md print:hidden">
          {filteredDashboardOrders.length > 0 ? (
            <OrdersTable 
              orders={filteredDashboardOrders} 
              onUpdateStatus={handleUpdateOrderStatus} 
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkAllocateCourier={handleBulkAllocateCourier}
              searchTerm={searchTerm} 
              onSearchTermChange={setSearchTerm}
              onResetDashboardFilterStatus={() => {
                setDashboardFilterStatus(null);
                setDashboardFilterStart(undefined);
                setDashboardFilterEnd(undefined);
              }}
              partnerClients={partnerClients}
              couriers={couriers}
              hubs={hubs}
              freightRules={freightRules}
              onAllocateCourier={handleAllocateCourier}
              onDeallocateCourier={handleDeallocateCourier}
              onEditOrder={handleEditOrder}
              onDeleteOrder={handleDeleteOrder}
              onAddOrder={handleAddOrder}
              initialEnableDateFilter={true}
              initialStartDate={dashboardFilterStart}
              initialEndDate={dashboardFilterEnd}
              currentUser={currentUser}
              selectedCourierId={selectedCourierId}
              setSelectedCourierId={setSelectedCourierId}
              onDateFilterChange={handleDateFilterChange}
              onRefetchDatabase={(options) => fetchDatabase(true, options)}
              isSyncing={isSyncing}
              onLoadPeriod={lazyLoadPeriod}
              onLoadFullHistory={lazyLoadFullHistory}
              isFullHistoryLoaded={isFullHistoryLoaded}
              totalOrdersInDb={totalOrdersInDb}
              isLoadingPeriod={isLoadingPeriod}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardCheck className="h-12 w-12 text-slate-305 stroke-[1.5] mb-2 animate-bounce" />
              <h4 className="text-sm font-bold text-slate-705">Nenhum registro para este período</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">Nenhum pedido foi encontrado neste status no intervalo selecionado.</p>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.close();
                  } catch (e) {}
                  window.location.href = window.location.origin + window.location.pathname;
                }}
                className="mt-4 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Voltar ao Painel Principal
              </button>
            </div>
          )}
        </div>

        {/* Hidden print layout wrapper (only active during print via visibility styles) */}
        <div id="printable-area" className="hidden print:block text-slate-950 bg-white p-6 font-sans w-full">
          <div className="flex justify-between items-start border-b-2 border-slate-950 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-black uppercase text-slate-950 tracking-tight">Relatório Despacho de Entregas</h1>
              <p className="text-xs text-slate-600 mt-1">
                Status Filtro: <span className="font-extrabold uppercase text-slate-950 text-indigo-800">
                  {
                    dashboardFilterStatus === 'all' ? 'Todos os Pedidos' :
                    dashboardFilterStatus === 'pending' ? 'Não Iniciado' :
                    dashboardFilterStatus === 'in_progress' ? 'Em Andamento' :
                    dashboardFilterStatus === 'in_route' ? 'Entregando' :
                    dashboardFilterStatus === 'failure' ? 'Ocorrência' :
                    dashboardFilterStatus === 'delivered' ? 'Concluído' : 'Cancelado'
                  }
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Período: <span className="font-mono font-bold text-slate-800">{dashboardFilterStart.split('-').reverse().join('/')} até {dashboardFilterEnd.split('-').reverse().join('/')}</span>
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">ViniMap Logística</h2>
              <p className="text-[9px] text-slate-500 mt-0.5">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <div className="mb-4 text-[10px] font-bold text-slate-800 grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>Total de Pedidos: <span className="font-mono font-black">{filteredDashboardOrders.length}</span></div>
            <div>Faturamento no Filtro: <span className="font-mono font-black">R$ {filteredDashboardOrders.reduce((acc, o) => acc + (o.value || 0), 0).toFixed(2).replace('.', ',')}</span></div>
            <div>Condutores Engajados: <span className="font-mono font-black">{Array.from(new Set(filteredDashboardOrders.filter(o => o.courierId).map(o => o.courierId))).length}</span></div>
          </div>

          <table className="w-full text-[9px] text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-950 font-bold uppercase border-b border-slate-300 font-mono">
                <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[10%]">Código Pedido</th>
                <th className="py-1.5 px-1 border-r border-slate-300 w-[12%]">Procurar Por</th>
                <th className="py-1.5 px-1 border-r border-slate-300 w-[12%]">Destinatário Final</th>
                <th className="py-1.5 px-1 border-r border-slate-300 w-[26%]">Endereço Completo</th>
                <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[10%]">CEP</th>
                <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[12%]">Parceiro</th>
                <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[8%]">Valor Frete</th>
                <th className="py-1.5 px-1 text-center w-[10%]">Condutor</th>
              </tr>
            </thead>
            <tbody>
              {filteredDashboardOrders.map((order, idx) => {
                const partnerName = resolvePartnerName(order, partnerClients);
                const docCourier = couriers.find(c => c.id === order.courierId)?.name || 'Não alocado';
                return (
                  <tr key={order.id || idx} className="border-b border-slate-300">
                    <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-bold">{order.id}</td>
                    <td className="py-1.5 px-1 border-r border-slate-300 truncate max-w-[100px]">{order.procurarPor || '-'}</td>
                    <td className="py-1.5 px-1 border-r border-slate-300 truncate max-w-[100px]">{resolveRecipientName(order, partnerClients)}</td>
                    <td className="py-1.5 px-1 border-r border-slate-300 leading-tight">{order.address} {order.complemento ? `(${order.complemento})` : ''}</td>
                    <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono">{order.cep || '-'}</td>
                    <td className="py-1.5 px-1 text-center border-r border-slate-300">{partnerName}</td>
                    <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-bold">R$ {(order.value || 0).toFixed(2).replace('.', ',')}</td>
                    <td className="py-1.5 px-1 text-center font-bold font-mono">{docCourier}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-16 pt-8 border-t border-dashed border-slate-400 flex justify-between gap-12 text-center text-[9px] font-bold text-slate-500">
            <div className="flex-1">
              <div className="border-b border-slate-400 h-8 mb-1"></div>
              Assinatura Operador de Expedição
            </div>
            <div className="flex-1">
              <div className="border-b border-slate-400 h-8 mb-1"></div>
              Carimbo do Despacho Logístico
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    const isDriverLink = typeof window !== 'undefined' && (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('role') === 'driver' || 
             params.has('driverId') || 
             params.has('courierId') || 
             params.get('app') === 'driver' || 
             window.location.pathname.includes('/driver') ||
             window.location.pathname.includes('/condutor') ||
             window.location.hash.includes('driver');
    })();

    const initialDriverIdFromUrl = typeof window !== 'undefined' ? (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('driverId') || params.get('courierId') || null;
    })() : null;

    return (
      <LoginScreen 
        onLoginSuccess={setCurrentUser} 
        couriers={couriers}
        branding={branding}
        hideAdminTab={Boolean(isDriverLink)}
        initialRole={isDriverLink ? 'driver' : null}
        initialDriverId={initialDriverIdFromUrl}
      />
    );
  }

  // Check if current user is an individual condutor/driver
  // Redirect to standalone fullscreen PWA experience immediately
  if (currentUser.role === 'driver') {
    return (
      <DriverDeviceSimulator 
        orders={orders}
        couriers={couriers}
        partnerClients={partnerClients}
        branding={branding}
        onUpdateStatus={handleUpdateOrderStatus}
        onUpdateCourier={handleUpdateCourier}
        isStandalone={true}
        standaloneCourierId={currentUser.id}
        onLogoutStandalone={handleLogout}
        onReorderOrders={fetchDatabase}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 overflow-x-hidden antialiased select-text font-sans flex font-sans">
      {/* 1. Sidebar Nav */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
        activities={activities}
        onClearCache={handleClearCache}
        ordersCount={orders.length}
        branding={branding}
        onOpenLogoModal={() => setIsLogoModalOpen(true)}
      />

      {/* 2. Main Workstation */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 w-full`}>
        {/* Top Header Controls bar */}
        <Header 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          onNewOrderClick={() => setIsNewOrderModalOpen(true)}
          onShareClick={() => setIsAppShareOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          notificationCount={notifications}
          branding={branding}
          onOpenLogoModal={() => setIsLogoModalOpen(true)}
        />

        {/* Primary Scrollable Stage area */}
        <main className="p-3 sm:p-6 w-full flex-1 transition-all duration-300 max-w-none px-3 sm:px-6 md:px-8 overflow-x-hidden">
          <FirebaseDiagnosticsBanner />
          {renderActiveView()}
        </main>
      </div>

      {/* 3. New Order Registration Dialog Modals */}
      {isNewOrderModalOpen && (
        <NewOrderModal 
          onClose={() => setIsNewOrderModalOpen(false)} 
          onAddOrder={handleAddOrder} 
          partnerClients={partnerClients}
        />
      )}

      {/* App Launch & QR Sharing Modal */}
      <AppShareModal 
        isOpen={isAppShareOpen} 
        onClose={() => setIsAppShareOpen(false)} 
        couriers={couriers} 
      />

      {/* Custom Brand Logo Manager Modal */}
      <LogoManagerModal 
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        branding={branding}
        onSaveBranding={handleSaveBranding}
      />

      {/* Real-time Ocorrência Floating Global Toaster Notification Drawer */}
      {ocorrenciaAlerts.length > 0 && (
        <div id="global-ocorrencias-toaster" className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-3xl border border-slate-850 shadow-2xl p-4 animate-fade-in-up flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 px-1.5 bg-rose-600 rounded-lg animate-pulse flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-white" />
              </span>
              <div>
                <p className="text-[10px] font-black tracking-wider text-rose-400 uppercase">Atenção Crítica</p>
                <h4 className="text-xs font-black text-white">{ocorrenciaAlerts.length} Ocorrência{ocorrenciaAlerts.length > 1 ? 's' : ''} em Campo</h4>
              </div>
            </div>
            <button 
              onClick={() => setOcorrenciaAlerts([])}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="mt-3 border-t border-slate-850 pt-3 max-h-40 overflow-y-auto space-y-2">
            {ocorrenciaAlerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className="text-[11px] bg-slate-850 p-2.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between font-mono text-[9px] text-rose-400 mb-1">
                  <span className="font-bold">{alert.orderId}</span>
                  <span>{alert.time}</span>
                </div>
                <p className="font-bold truncate text-slate-100">{alert.customerName}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  Condutor: <span className="text-slate-300 font-semibold">{alert.courierName}</span>
                </p>
              </div>
            ))}
            {ocorrenciaAlerts.length > 2 && (
              <p className="text-[10px] text-slate-550 font-semibold text-center">+ {ocorrenciaAlerts.length - 2} ocorrências registradas</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-3.5 pt-2 border-t border-slate-850">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setTimeout(() => {
                  const el = document.getElementById('active-ocorrencias-alert-box');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl text-center cursor-pointer transition-colors"
            >
              Ver Central de Alertas
            </button>
            <button
              onClick={() => setOcorrenciaAlerts([])}
              className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-305 hover:text-white font-semibold text-[11px] rounded-xl text-center cursor-pointer transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* 4. Dashboard Category Filter Full Screen Overlay */}
      {dashboardFilterStatus && (() => {
        const getTodayISO = (): string => formatToBrasiliaISODate(new Date());

        const getYesterdayISO = (): string => {
          const d = getBrasiliaDate();
          d.setDate(d.getDate() - 1);
          return formatToBrasiliaISODate(d);
        };

        const todayISO = getTodayISO();
        const yesterdayISO = getYesterdayISO();

        const parseToISODateInApp = (str: string | undefined): string => {
          return parseToISODate(str, yesterdayISO);
        };

        const filteredDashboardOrders = orders.filter(o => {
          if (!dashboardFilterStatus) return false;
          const isStatusMatch = dashboardFilterStatus === 'all' ? true : o.status === dashboardFilterStatus;
          if (!isStatusMatch) return false;

          let transitionDateISO: string | null = null;
          const statusToCheck = (dashboardFilterStatus !== 'all') ? dashboardFilterStatus : (o.status === 'delivered' ? 'delivered' : null);
          if (statusToCheck && o.history && Array.isArray(o.history)) {
            const entry = [...o.history].reverse().find(h => h && h.status === statusToCheck);
            if (entry && entry.time) {
              const parts = entry.time.split(' ');
              const datePart = parts[0];
              if (datePart) {
                transitionDateISO = parseToISODateInApp(datePart);
              }
            }
          }
          const launchDateISO = parseToISODateInApp(o.dataSolicitacao);
          const effectiveDateISO = transitionDateISO || launchDateISO;
          const allocatedDateISO = o.allocatedDate ? parseToISODateInApp(o.allocatedDate) : null;

          const matchesLaunchDate = launchDateISO >= dashboardFilterStart && launchDateISO <= dashboardFilterEnd;
          const matchesEffectiveDate = effectiveDateISO >= dashboardFilterStart && effectiveDateISO <= dashboardFilterEnd;
          const matchesAllocatedDate = Boolean(allocatedDateISO && allocatedDateISO >= dashboardFilterStart && allocatedDateISO <= dashboardFilterEnd);

          const isActionStatus = ['delivered', 'cancelled', 'failure'].includes(dashboardFilterStatus);
          if (isActionStatus) {
            return matchesEffectiveDate;
          }
          return matchesLaunchDate || matchesEffectiveDate || matchesAllocatedDate;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col p-6 overflow-y-auto print:p-0 print:bg-white animate-fade-in select-text">
            {/* Header bar (hidden during print) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-2xl text-indigo-600">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-indigo-150 text-indigo-800 px-2.5 py-0.5 rounded-full select-none">
                      Filtrado por Status
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {filteredDashboardOrders.length} {filteredDashboardOrders.length === 1 ? 'pedido localizado' : 'pedidos localizados'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mt-1">
                    Pedidos: {
                      dashboardFilterStatus === 'all' ? 'Todos os Pedidos' :
                      dashboardFilterStatus === 'pending' ? 'Não Iniciado' :
                      dashboardFilterStatus === 'in_progress' ? 'Em Andamento' :
                      dashboardFilterStatus === 'in_route' ? 'Entregando' :
                      dashboardFilterStatus === 'failure' ? 'Ocorrência' :
                      dashboardFilterStatus === 'delivered' ? 'Concluído' : 'Cancelado'
                    }
                  </h2>
                  <p className="text-[11px] text-slate-450 font-semibold mt-0.5">
                    Ref. Período de Solicitação de <span className="font-mono text-slate-600 font-bold">{dashboardFilterStart.split('-').reverse().join('/')}</span> até <span className="font-mono text-slate-600 font-bold">{dashboardFilterEnd.split('-').reverse().join('/')}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Printing button */}
                <button
                  type="button"
                  onClick={() => {
                    setTimeout(() => {
                      window.print();
                    }, 150);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>Exportar para Impressão (A4)</span>
                </button>

                {/* Export CSV button */}
                <button
                  type="button"
                  onClick={() => exportOrdersToCSV(filteredDashboardOrders, partnerClients)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <span>Exportar CSV / Planilha</span>
                </button>

                {/* Close overlay button */}
                <button
                  type="button"
                  onClick={() => setDashboardFilterStatus(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <X className="h-4 w-4" />
                  <span>Fechar Visualização</span>
                </button>
              </div>
            </div>

            {/* Main interactive Table wrapper (hidden during print) */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 flex-1 shadow-md print:hidden">
              {filteredDashboardOrders.length > 0 ? (
                <OrdersTable 
                  orders={filteredDashboardOrders} 
                  onUpdateStatus={handleUpdateOrderStatus} 
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkAllocateCourier={handleBulkAllocateCourier}
                  searchTerm={searchTerm} 
                  onSearchTermChange={setSearchTerm}
                  onResetDashboardFilterStatus={() => {
                    setDashboardFilterStatus(null);
                    setDashboardFilterStart(undefined);
                    setDashboardFilterEnd(undefined);
                  }}
                  partnerClients={partnerClients}
                  couriers={couriers}
                  hubs={hubs}
                  freightRules={freightRules}
                  onAllocateCourier={handleAllocateCourier}
                  onDeallocateCourier={handleDeallocateCourier}
                  onEditOrder={handleEditOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onAddOrder={handleAddOrder}
                  initialEnableDateFilter={true}
                  initialStartDate={dashboardFilterStart}
                  initialEndDate={dashboardFilterEnd}
                  currentUser={currentUser}
                  selectedCourierId={selectedCourierId}
                  setSelectedCourierId={setSelectedCourierId}
                  onDateFilterChange={handleDateFilterChange}
                  onRefetchDatabase={(options) => fetchDatabase(true, options)}
                  isSyncing={isSyncing}
                  onLoadPeriod={lazyLoadPeriod}
                  onLoadFullHistory={lazyLoadFullHistory}
                  isFullHistoryLoaded={isFullHistoryLoaded}
                  totalOrdersInDb={totalOrdersInDb}
                  isLoadingPeriod={isLoadingPeriod}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ClipboardCheck className="h-12 w-12 text-slate-305 stroke-[1.5] mb-2 animate-bounce" />
                  <h4 className="text-sm font-bold text-slate-705">Nenhum registro para este período</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">Nenhum pedido foi encontrado neste status no intervalo selecionado.</p>
                  <button
                    type="button"
                    onClick={() => setDashboardFilterStatus(null)}
                    className="mt-4 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Voltar ao Painel
                  </button>
                </div>
              )}
            </div>

            {/* Hidden print layout wrapper (only active during print via visibility styles) */}
            <div id="printable-area" className="hidden print:block text-slate-950 bg-white p-6 font-sans w-full">
              <div className="flex justify-between items-start border-b-2 border-slate-950 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-black uppercase text-slate-950 tracking-tight">Relatório Despacho de Entregas</h1>
                  <p className="text-xs text-slate-600 mt-1">
                    Status Filtro: <span className="font-extrabold uppercase text-slate-950 text-indigo-800">
                      {
                        dashboardFilterStatus === 'all' ? 'Todos os Pedidos' :
                        dashboardFilterStatus === 'pending' ? 'Não Iniciado' :
                        dashboardFilterStatus === 'in_progress' ? 'Em Andamento' :
                        dashboardFilterStatus === 'in_route' ? 'Entregando' :
                        dashboardFilterStatus === 'failure' ? 'Ocorrência' :
                        dashboardFilterStatus === 'delivered' ? 'Concluído' : 'Cancelado'
                      }
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Período: <span className="font-mono font-bold text-slate-800">{dashboardFilterStart.split('-').reverse().join('/')} até {dashboardFilterEnd.split('-').reverse().join('/')}</span>
                  </p>
                </div>
                <div className="text-right">
                  <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">ViniMap Logística</h2>
                  <p className="text-[9px] text-slate-500 mt-0.5">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="mb-4 text-[10px] font-bold text-slate-800 grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>Total de Pedidos: <span className="font-mono font-black">{filteredDashboardOrders.length}</span></div>
                <div>Faturamento no Filtro: <span className="font-mono font-black">R$ {filteredDashboardOrders.reduce((acc, o) => acc + (o.value || 0), 0).toFixed(2).replace('.', ',')}</span></div>
                <div>Condutores Engajados: <span className="font-mono font-black">{Array.from(new Set(filteredDashboardOrders.filter(o => o.courierId).map(o => o.courierId))).length}</span></div>
              </div>

              <table className="w-full text-[9px] text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-950 font-bold uppercase border-b border-slate-300 font-mono">
                    <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[10%]">Código Pedido</th>
                    <th className="py-1.5 px-1 border-r border-slate-300 w-[12%]">Procurar Por</th>
                    <th className="py-1.5 px-1 border-r border-slate-300 w-[12%]">Destinatário Final</th>
                    <th className="py-1.5 px-1 border-r border-slate-300 w-[26%]">Endereço Completo</th>
                    <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[10%]">CEP</th>
                    <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[12%]">Parceiro</th>
                    <th className="py-1.5 px-1 text-center border-r border-slate-300 w-[8%]">Valor Frete</th>
                    <th className="py-1.5 px-1 text-center w-[10%]">Condutor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDashboardOrders.map((order, idx) => {
                    const partnerName = resolvePartnerName(order, partnerClients);
                    const docCourier = couriers.find(c => c.id === order.courierId)?.name || 'Não alocado';
                    return (
                      <tr key={order.id || idx} className="border-b border-slate-300">
                        <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-bold">{order.id}</td>
                        <td className="py-1.5 px-1 border-r border-slate-300 truncate max-w-[100px]">{order.procurarPor || '-'}</td>
                        <td className="py-1.5 px-1 border-r border-slate-300 truncate max-w-[100px]">{resolveRecipientName(order, partnerClients)}</td>
                        <td className="py-1.5 px-1 border-r border-slate-300 leading-tight">{order.address} {order.complemento ? `(${order.complemento})` : ''}</td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono">{order.cep || '-'}</td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-300">{partnerName}</td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-bold">R$ {(order.value || 0).toFixed(2).replace('.', ',')}</td>
                        <td className="py-1.5 px-1 text-center font-bold font-mono">{docCourier}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-16 pt-8 border-t border-dashed border-slate-400 flex justify-between gap-12 text-center text-[9px] font-bold text-slate-500">
                <div className="flex-1">
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  Assinatura Operador de Expedição
                </div>
                <div className="flex-1">
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  Carimbo do Despacho Logístico
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Push Notifications & Sync State Toast overlays */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {syncToasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden transition-all duration-300"
            style={{
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)"
            }}
          >
            {/* Visual glow indicator: orange/amber for offline, green/emerald for online */}
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
              toast.type === 'offline' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`} />
            
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
              {toast.type === 'offline' ? (
                <WifiOff className="h-4 w-4 text-amber-500" />
              ) : (
                <Wifi className="h-4 w-4 text-emerald-500 animate-bounce" />
              )}
            </div>

            <div className="flex-1 pl-1">
              <h5 className="text-[9px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>🔄 Status de Sincronização</span>
              </h5>
              <h4 className="text-xs font-extrabold text-white mt-1 flex items-center gap-1.5">
                {toast.title}
                <span className="text-[9px] font-normal text-slate-500">({toast.timestamp})</span>
              </h4>
              <p className="text-[10px] text-slate-300 mt-1 leading-snug">{toast.message}</p>
            </div>

            <button
              type="button"
              onClick={() => setSyncToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-500 hover:text-white p-1 hover:bg-slate-850 rounded-lg cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {pushToasts
          .filter(toast => {
            if (toast.type === 'order_assigned' || toast.type === 'assigned' || toast.type === 'allocation') return false;
            const t = (toast.title || '').toLowerCase();
            const b = (toast.body || '').toLowerCase();
            if (t.includes('atribuído') || t.includes('atribuido') || t.includes('alocaç') || t.includes('alocac') || t.includes('alocado') || t.includes('nova rota')) return false;
            if (b.includes('atribuído') || b.includes('atribuido') || b.includes('alocaç') || b.includes('alocac') || b.includes('alocado') || b.includes('nova rota')) return false;
            return true;
          })
          .map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full bg-slate-900/95 backdrop-blur-md border border-slate-850 rounded-xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden transition-all duration-300"
            style={{
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)"
            }}
          >
            {/* Visual glow indicator based on message type */}
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
              toast.type === 'alert' ? 'bg-rose-500' :
              toast.type === 'order_assigned' ? 'bg-amber-500' : 'bg-indigo-500'
            }`} />
            
            <div className="flex-1 pl-1">
              <h5 className="text-[9px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                {toast.type === 'alert' ? '🚨 Alerta de Ocorrência' :
                 toast.type === 'order_assigned' ? '🚲 Nova Rota / Atribuição' : '📢 Notificação Push'}
              </h5>
              <h4 className="text-xs font-extrabold text-white mt-1">{toast.title}</h4>
              <p className="text-[10px] text-slate-300 mt-1 leading-snug">{toast.body}</p>
            </div>

            <button
              type="button"
              onClick={() => setPushToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
