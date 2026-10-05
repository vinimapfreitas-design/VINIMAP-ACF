import React from 'react';
import { Sparkles, Plus, Navigation } from 'lucide-react';

interface BannerProps {
  onNewOrderClick: () => void;
  onOptimizeRoutes: () => void;
  ordersCount: number;
  activeCouriersCount: number;
}

export const Banner: React.FC<BannerProps> = ({
  onNewOrderClick,
  onOptimizeRoutes,
  ordersCount,
  activeCouriersCount
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-3 md:p-4 text-white shadow-md mb-2.5 relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-semibold text-blue-200 border border-white/10">
              <Sparkles size={11} className="text-amber-300" />
              ViniMap Fleet Intelligence Engine
            </span>
            <span className="text-[11px] font-bold text-blue-200 flex items-center gap-1.5">
              <span>•</span>
              <strong className="text-white font-mono">{ordersCount}</strong> Pedidos Ativos
              <span>•</span>
              <strong className="text-white font-mono">{activeCouriersCount}</strong> Condutores Online
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-white leading-tight">
            Painel Central de Operações
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={onOptimizeRoutes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl transition-all border border-white/20 backdrop-blur-md cursor-pointer"
          >
            <Navigation size={13} />
            <span>Otimizar Rotas</span>
          </button>
          <button
            onClick={onNewOrderClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs rounded-xl transition-all shadow-md shadow-black/10 cursor-pointer"
          >
            <Plus size={15} />
            <span>Novo Pedido</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Banner;
