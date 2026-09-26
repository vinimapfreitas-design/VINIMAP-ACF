import React from 'react';
import { Activity } from '../types';
import { Activity as ActivityIcon, CheckCircle2, AlertCircle, Truck, PackagePlus } from 'lucide-react';

interface ActivityFeedProps {
  activities: Activity[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities = [] }) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ActivityIcon className="text-blue-600" size={20} />
          <h3 className="font-bold text-base text-slate-800">Feed de Atividades do Sistema</h3>
        </div>
        <span className="text-xs text-slate-400">{activities.length} eventos registrados</span>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma atividade recente.</p>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-colors flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                {act.type === 'order_created' ? <PackagePlus size={16} /> : <Truck size={16} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-800">{act.message}</p>
                  <span className="text-[10px] text-slate-400 font-mono">{act.time || act.timestamp}</span>
                </div>
                {act.details && <p className="text-[11px] text-slate-500 mt-0.5">{act.details}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
