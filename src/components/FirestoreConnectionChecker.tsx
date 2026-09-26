import React, { useState, useEffect } from 'react';
import { isLiveFirebase, isFirestoreQuotaExceeded, onFirestoreQuotaExceeded } from '../lib/firebase';
import { Database, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';

export const FirestoreConnectionChecker: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(isFirestoreQuotaExceeded());

  useEffect(() => {
    return onFirestoreQuotaExceeded((exceeded) => {
      setQuotaExceeded(exceeded);
    });
  }, []);

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-blue-600 shrink-0" />
        <span className="font-bold text-slate-800">Status Firestore:</span>
        {quotaExceeded ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
            <ShieldAlert size={12} className="text-amber-600" />
            Cota Diária Gratuita Atingida (Circuit Breaker Ativo)
          </span>
        ) : (
          <span className={isLiveFirebase ? "text-emerald-600 font-semibold flex items-center gap-1" : "text-amber-600 font-semibold flex items-center gap-1"}>
            {isLiveFirebase ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {isLiveFirebase ? "Online e Conectado" : "Offline / Armazenamento Local"}
          </span>
        )}
      </div>

      {quotaExceeded && (
        <span className="text-[11px] text-slate-500">
          Operações redirecionadas para o <strong>Supabase (Banco Primário)</strong> com total integridade.
        </span>
      )}
    </div>
  );
};

export default FirestoreConnectionChecker;
