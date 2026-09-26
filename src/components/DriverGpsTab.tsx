import React from 'react';
import { Courier, HubCentral } from '../types';
import { Navigation, MapPin, RefreshCw, Smartphone } from 'lucide-react';

interface DriverGpsTabProps {
  couriers: Courier[];
  hubs: HubCentral[];
  onRefetchDatabase?: () => void;
}

export const DriverGpsTab: React.FC<DriverGpsTabProps> = ({
  couriers = [],
  hubs = [],
  onRefetchDatabase
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Telemetria GPS e Posição dos Condutores</h3>
          <p className="text-xs text-slate-500">Monitoramento em tempo real do sinal dos dispositivos de campo</p>
        </div>
        {onRefetchDatabase && (
          <button
            onClick={onRefetchDatabase}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw size={14} />
            <span>Atualizar Posições</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {couriers.map(courier => (
          <div key={courier.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={courier.avatar} alt={courier.name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
              <div>
                <h4 className="font-bold text-sm text-slate-800">{courier.name}</h4>
                <p className="text-xs text-slate-500">{courier.phone} • {courier.vehicle}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-1">
                  <Navigation size={12} />
                  <span>Lat: {courier.currentLat?.toFixed(4)}, Lng: {courier.currentLng?.toFixed(4)}</span>
                </div>
              </div>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverGpsTab;
