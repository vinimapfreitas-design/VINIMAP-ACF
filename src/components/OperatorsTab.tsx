import React, { useState } from 'react';
import { UserCheck, Plus, Shield, Key } from 'lucide-react';
import { Operator } from '../types';

interface OperatorsTabProps {
  currentUser?: any;
}

export const OperatorsTab: React.FC<OperatorsTabProps> = ({ currentUser }) => {
  const [operators, setOperators] = useState<Operator[]>([
    {
      id: 'ope-1',
      name: 'Administrador Central',
      login: 'admin',
      permissions: ['all'],
      role: 'Gerente'
    }
  ]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Operadores & Permissões</h3>
            <p className="text-xs text-slate-500">Gestão de acessos à plataforma ViniMap Fleet</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {operators.map(op => (
          <div key={op.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-800">{op.name}</h4>
              <p className="text-xs text-slate-500">Login: <span className="font-mono text-slate-700">{op.login}</span> • Permissões: All</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              {op.role || 'Operador'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OperatorsTab;
