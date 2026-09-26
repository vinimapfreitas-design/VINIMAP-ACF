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
    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-6 relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 mb-3 border border-white/10">
            <Sparkles size={14} className="text-amber-300" />
            ViniMap Fleet Intelligence Engine
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
            Painel Central de Operações
          </h2>
          <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
            Monitoramento em tempo real da frota, atribuição dinâmica de entregas por agrupamento de CEP e roteirização inteligente.
          </p>
          <div className="flex items-center gap-6 mt-4 text-xs font-medium text-blue-200">
            <div>
              <span className="text-white font-bold text-base">{ordersCount}</span> Pedidos Ativos
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <div>
              <span className="text-white font-bold text-base">{activeCouriersCount}</span> Condutores Online
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={onOptimizeRoutes}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm rounded-2xl transition-all border border-white/20 backdrop-blur-md"
          >
            <Navigation size={16} />
            <span>Otimizar Rotas</span>
          </button>
          <button
            onClick={onNewOrderClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-sm rounded-2xl transition-all shadow-lg shadow-black/10"
          >
            <Plus size={18} />
            <span>Novo Pedido</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Banner;
