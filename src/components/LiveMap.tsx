import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Truck, User, Building2, CheckCircle2, Shield, Wifi, WifiOff, HardDrive, RefreshCw } from 'lucide-react';
import { Courier, Order, HubCentral } from '../types';

interface LiveMapProps {
  couriers: Courier[];
  orders: Order[];
  selectedCourierId?: string;
  setSelectedCourierId?: (id: string) => void;
  hubs?: HubCentral[];
}

export const LiveMap: React.FC<LiveMapProps> = ({
  couriers = [],
  orders = [],
  selectedCourierId,
  setSelectedCourierId,
  hubs = []
}) => {
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [forceOfflineMode, setForceOfflineMode] = useState<boolean>(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);
  const [cachedCouriers, setCachedCouriers] = useState<Courier[]>([]);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [cachedHubs, setCachedHubs] = useState<HubCentral[]>([]);

  // Detect online/offline network changes
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync to local cache whenever props are non-empty
  useEffect(() => {
    if (couriers.length > 0 || orders.length > 0 || hubs.length > 0) {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      try {
        if (couriers.length > 0) localStorage.setItem('livemap_cached_couriers', JSON.stringify(couriers));
        if (orders.length > 0) localStorage.setItem('livemap_cached_orders', JSON.stringify(orders));
        if (hubs.length > 0) localStorage.setItem('livemap_cached_hubs', JSON.stringify(hubs));
        localStorage.setItem('livemap_cached_at', now);
        setCachedTime(now);
      } catch (e) {
        console.warn('Erro ao salvar cache do mapa:', e);
      }
    }
  }, [couriers, orders, hubs]);

  // Clean up legacy mock data cache from previous sessions on mount
  useEffect(() => {
    try {
      localStorage.removeItem('livemap_cached_couriers');
      localStorage.removeItem('livemap_cached_orders');
    } catch (e) {
      // ignore storage error
    }
  }, []);

  const activeOffline = isOffline || forceOfflineMode;
  
  // Filter couriers and orders by selected region if applicable
  const filteredCouriers = couriers.filter(c => filterRegion === 'all' || c.region === filterRegion);
  const filteredOrders = orders.filter(o => filterRegion === 'all' || o.region === filterRegion);

  const displayCouriers = filteredCouriers;
  const displayOrders = filteredOrders;
  const displayHubs = hubs;
  const isUsingCache = activeOffline;

  const selectedCourier = displayCouriers.find(c => c.id === selectedCourierId);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px] relative">
      {/* Map Control Toolbar Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${activeOffline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <div>
            <span className="font-bold text-sm block md:inline">Mapa Interativo de Entregas & Rastreio</span>
            <span className="text-xs text-slate-400 font-normal ml-0 md:ml-2">
              ({displayCouriers.length} motoristas, {displayOrders.length} pedidos)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline Cache Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
            isUsingCache
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {isUsingCache ? <WifiOff size={14} className="text-amber-400" /> : <Wifi size={14} className="text-emerald-400" />}
            <span>
              {isUsingCache
                ? `Cache Offline (${cachedTime || 'Salvo'})`
                : 'Sincronizado'}
            </span>
          </div>

          <button
            onClick={() => setForceOfflineMode(!forceOfflineMode)}
            title={forceOfflineMode ? "Desativar teste de modo offline" : "Testar navegação offline com cache local"}
            className={`p-1.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1 ${
              forceOfflineMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <HardDrive size={14} />
            <span className="hidden sm:inline">{forceOfflineMode ? 'Modo Offline ON' : 'Testar Offline'}</span>
          </button>

          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none"
          >
            <option value="all">Todas as Regiões</option>
            <option value="Centro-Paulista">Centro-Paulista</option>
            <option value="Zona Sul">Zona Sul</option>
            <option value="Zona Oeste">Zona Oeste</option>
            <option value="Zona Norte">Zona Norte</option>
          </select>
        </div>
      </div>

      {/* Offline Alert Banner if using local cache */}
      {isUsingCache && (
        <div className="bg-amber-500/90 text-slate-950 px-4 py-1.5 text-xs font-semibold flex items-center justify-between border-b border-amber-600 shadow-inner z-20">
          <div className="flex items-center gap-2">
            <WifiOff size={14} />
            <span>Exibindo última rota sincronizada e localizações salvas em cache local ({cachedTime || 'Recente'}).</span>
          </div>
          <span className="text-[10px] bg-slate-950/20 px-2 py-0.5 rounded font-mono">Modo Offline Ativo</span>
        </div>
      )}

      {/* Simulated Live Visual Canvas */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-6">
        {/* Decorative Grid Lines to look like map */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Hub Markers */}
        {displayHubs.map((hub, idx) => (
          <div
            key={hub.id || idx}
            className="absolute flex flex-col items-center group cursor-pointer z-10"
            style={{
              top: `${30 + (idx * 15) % 40}%`,
              left: `${40 + (idx * 20) % 40}%`
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg font-bold border-2 border-amber-300">
              <Building2 size={20} />
            </div>
            <span className="text-[10px] bg-slate-900/90 text-amber-300 px-2 py-0.5 rounded-md font-semibold mt-1 border border-amber-500/30 whitespace-nowrap">
              {hub.name}
            </span>
          </div>
        ))}

        {/* Courier Pin Markers */}
        {displayCouriers.map((courier, idx) => {
          const isSelected = courier.id === selectedCourierId;
          const topPos = 20 + ((idx * 37) % 60);
          const leftPos = 15 + ((idx * 29) % 70);

          return (
            <button
              key={courier.id}
              onClick={() => setSelectedCourierId?.(courier.id)}
              className={`absolute flex flex-col items-center group transition-all duration-300 z-10 ${
                isSelected ? 'scale-125 z-20' : 'hover:scale-110'
              }`}
              style={{ top: `${topPos}%`, left: `${leftPos}%` }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-xl ${
                courier.status === 'online'
                  ? 'bg-emerald-500 border-white text-white'
                  : 'bg-blue-600 border-white text-white'
              }`}>
                <Truck size={18} />
              </div>
              <div className="bg-slate-900/95 text-white px-2 py-1 rounded-lg text-xs font-semibold shadow-md mt-1 border border-slate-700 whitespace-nowrap">
                {courier.name}
              </div>
            </button>
          );
        })}

        {/* Empty State Banner when no couriers/orders */}
        {displayCouriers.length === 0 && displayOrders.length === 0 && (
          <div className="z-10 text-center p-6 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-md backdrop-blur-sm">
            <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Navigation size={22} className="animate-pulse text-blue-400" />
            </div>
            <h4 className="text-white font-bold text-sm">Base Operacional Conectada</h4>
            <p className="text-xs text-slate-400 mt-1">
              Nenhum condutor ou pedido ativo no momento. Os marcadores de GPS e trajetos serão plotados automaticamente em tempo real conforme forem cadastrados.
            </p>
          </div>
        )}

        {/* Order Destination Pins */}
        {displayOrders.slice(0, 8).map((order, idx) => {
          const topPos = 15 + ((idx * 43) % 70);
          const leftPos = 25 + ((idx * 31) % 65);
          return (
            <div
              key={order.id}
              className="absolute flex flex-col items-center opacity-75 hover:opacity-100"
              style={{ top: `${topPos}%`, left: `${leftPos}%` }}
            >
              <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold border border-white shadow-md">
                <MapPin size={12} />
              </div>
              <span className="text-[9px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                {order.id}
              </span>
            </div>
          );
        })}

        {/* Selection Details Floating Card */}
        {selectedCourier && (
          <div className="absolute bottom-4 left-4 bg-slate-900/95 text-white p-4 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full backdrop-blur-md z-30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <img src={selectedCourier.avatar} alt={selectedCourier.name} className="w-10 h-10 rounded-full object-cover border border-slate-600" />
                <div>
                  <h4 className="font-bold text-sm text-white">{selectedCourier.name}</h4>
                  <p className="text-xs text-slate-400">{selectedCourier.vehicle} • {selectedCourier.phone}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {selectedCourier.status}
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-1 mt-3 pt-2 border-t border-slate-800">
              <p>📍 Região: <span className="text-white font-medium">{selectedCourier.region}</span></p>
              <p>📦 Concluídos: <span className="text-white font-medium">{selectedCourier.ordersCompleted} pedidos</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMap;

