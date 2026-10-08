import React, { useState, useEffect } from 'react';
import { isLiveFirebase, isFirestoreQuotaExceeded, onFirestoreQuotaExceeded, resetFirestoreCircuit } from '../lib/firebase';
import { ShieldCheck, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';

export const FirebaseDiagnosticsBanner: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(isFirestoreQuotaExceeded());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectMsg, setReconnectMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onFirestoreQuotaExceeded((exceeded) => {
      setQuotaExceeded(exceeded);
    });

    // Auto-attempt unpausing on mount if previously flagged
    if (isFirestoreQuotaExceeded()) {
      resetFirestoreCircuit(false).then((res) => {
        if (res.success) {
          setQuotaExceeded(false);
        }
      }).catch(() => {});
    }

    return () => unsub();
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectMsg(null);
    try {
      const res = await resetFirestoreCircuit(true);
      if (res.success) {
        setQuotaExceeded(false);
        setReconnectMsg('Firestore reconectado com sucesso!');
        setTimeout(() => setReconnectMsg(null), 3000);
      } else {
        setReconnectMsg(res.message);
      }
    } catch (e: any) {
      setReconnectMsg('Erro ao tentar reconectar');
    } finally {
      setIsReconnecting(false);
    }
  };

  if (isLiveFirebase && !quotaExceeded && !reconnectMsg) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50 border border-blue-200/80 text-slate-800 px-4 py-2.5 rounded-2xl mb-4 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs transition-all">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div className="flex items-center gap-1.5 font-medium flex-wrap">
          <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-800 font-semibold">Shard Cloud (PostgreSQL) 100% Ativo:</span>
          <span className="text-slate-600">
            {reconnectMsg ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} /> {reconnectMsg}
              </span>
            ) : quotaExceeded ? (
              'Todas as operações estão salvas no Shard Cloud. Banco secundário Firestore estava em pausa de cota diária.'
            ) : (
              'Armazenamento operacional com persistência em nuvem e Firestore ativo.'
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {quotaExceeded && (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer transition-all disabled:opacity-50"
            title="Verificar e restabelecer conexão direta com o Cloud Firestore"
          >
            <RefreshCw size={11} className={isReconnecting ? "animate-spin" : ""} />
            <span>{isReconnecting ? "Verificando..." : "Retomar Firestore"}</span>
          </button>
        )}
        <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-white/70 px-2.5 py-1 rounded-full border border-slate-200 font-mono">
          <Zap size={11} className="text-amber-500" />
          <span>Failover Ativo</span>
        </div>
      </div>
    </div>
  );
};

export default FirebaseDiagnosticsBanner;
