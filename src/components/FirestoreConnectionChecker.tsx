import React, { useState, useEffect } from 'react';
import { isLiveFirebase, isFirestoreQuotaExceeded, onFirestoreQuotaExceeded, resetFirestoreCircuit, testFirestoreConnection } from '../lib/firebase';
import { Database, CheckCircle, AlertCircle, ShieldAlert, RefreshCw } from 'lucide-react';

export const FirestoreConnectionChecker: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(isFirestoreQuotaExceeded());
  const [isTesting, setIsTesting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    return onFirestoreQuotaExceeded((exceeded) => {
      setQuotaExceeded(exceeded);
    });
  }, []);

  const handleTestOrReconnect = async () => {
    setIsTesting(true);
    setResultMsg(null);
    try {
      const res = await testFirestoreConnection();
      if (res.success) {
        setResultMsg(res.message);
        setQuotaExceeded(false);
      } else {
        setResultMsg(res.message);
      }
    } catch (err: any) {
      setResultMsg(err?.message || 'Erro ao verificar Firestore');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <Database size={16} className="text-blue-600 shrink-0" />
        <span className="font-bold text-slate-800">Status Firestore:</span>
        {quotaExceeded ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
            <ShieldAlert size={12} className="text-amber-600" />
            Cota Diária Temporária (Pausa)
          </span>
        ) : (
          <span className={isLiveFirebase ? "text-emerald-600 font-semibold flex items-center gap-1" : "text-amber-600 font-semibold flex items-center gap-1"}>
            {isLiveFirebase ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {isLiveFirebase ? "Online e Conectado" : "Offline / Aguardando Conexão"}
          </span>
        )}
        {resultMsg && (
          <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
            {resultMsg}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleTestOrReconnect}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-[11px] shadow-2xs cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={isTesting ? "animate-spin" : ""} />
          <span>{isTesting ? "Testando..." : quotaExceeded ? "Retomar Conexão" : "Testar Conexão"}</span>
        </button>

        {quotaExceeded && (
          <span className="text-[11px] text-slate-500">
            Operando via <strong>Shard Cloud</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default FirestoreConnectionChecker;
