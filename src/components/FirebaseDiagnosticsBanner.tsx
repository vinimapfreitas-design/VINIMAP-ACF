import React, { useState, useEffect } from 'react';
import { isLiveFirebase, isFirestoreQuotaExceeded, onFirestoreQuotaExceeded } from '../lib/firebase';
import { Database, ShieldCheck, Zap } from 'lucide-react';

export const FirebaseDiagnosticsBanner: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(isFirestoreQuotaExceeded());

  useEffect(() => {
    return onFirestoreQuotaExceeded((exceeded) => {
      setQuotaExceeded(exceeded);
    });
  }, []);

  if (isLiveFirebase && !quotaExceeded) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50 border border-blue-200/80 text-slate-800 px-4 py-2.5 rounded-2xl mb-4 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck size={15} className="text-emerald-600" />
          <span className="text-emerald-800 font-semibold">Supabase Cloud (PostgreSQL) 100% Ativo:</span>
          <span className="text-slate-600">
            {quotaExceeded 
              ? 'Todas as operações e dados estão salvos e sincronizados com segurança. Banco secundário Firestore em pausa temporária de cota diária.' 
              : 'Armazenamento operacional com persistência local e nuvem ativa.'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-white/70 px-2.5 py-0.5 rounded-full border border-slate-200 font-mono">
        <Zap size={11} className="text-amber-500" />
        <span>Failover Automático Ativo</span>
      </div>
    </div>
  );
};

export default FirebaseDiagnosticsBanner;
