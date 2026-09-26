import React from 'react';
import { HourlyStat, RegionDistribution, Order } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SVGChartsProps {
  hourlyStats: HourlyStat[];
  regionDistribution: RegionDistribution[];
  orders: Order[];
}

export const SVGCharts: React.FC<SVGChartsProps> = ({
  hourlyStats = [],
  regionDistribution = [],
  orders = []
}) => {
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
      {/* Chart 1: Volume de Pedidos por Horário */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-1">Fluxo Horário de Pedidos</h3>
        <p className="text-xs text-slate-500 mb-4">Volume de solicitações e entregas ao longo do dia</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyStats}>
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} />
              <Bar dataKey="created" name="Registrados" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="delivered" name="Entregues" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Distribuição por Região */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-1">Distribuição por Região</h3>
        <p className="text-xs text-slate-500 mb-4">Percentual de entregas divididas por setores estratégicos</p>
        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={regionDistribution}
                dataKey="orders"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={4}
              >
                {regionDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SVGCharts;
