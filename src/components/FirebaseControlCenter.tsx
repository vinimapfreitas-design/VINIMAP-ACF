import React, { useState } from 'react';
import { Database, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Key } from 'lucide-react';
import { isFirebaseConfigured, isLiveFirebase, testFirestoreConnection } from '../lib/firebase';

export interface FirebaseControlCenterProps {
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const FirebaseControlCenter: React.FC<FirebaseControlCenterProps> = ({ onNotify }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testFirestoreConnection();
      setTestResult(res);
      if (res.success) {
        onNotify?.(res.message, 'success');
      } else {
        onNotify?.(res.message, 'error');
      }
    } catch (err: any) {
      const msg = err?.message || 'Erro inesperado ao testar banco de dados.';
      setTestResult({ success: false, message: msg });
      onNotify?.(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Firebase & Firestore Control Center</h3>
            <p className="text-xs text-slate-500">Diagnóstico, latência e status de sincronização em tempo real</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
          isLiveFirebase
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isLiveFirebase ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isLiveFirebase ? 'Firestore Conectado Live' : 'Modo Backup Local Ativo'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className="text-slate-600" />
            <p className="text-xs font-bold text-slate-700">Chaves do Firebase (.env)</p>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            {isFirebaseConfigured ? 'VITE_FIREBASE_* Detectadas' : 'Ausentes (Fallback IndexedDB)'}
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-slate-600" />
            <p className="text-xs font-bold text-slate-700">Status do Listener Realtime</p>
          </div>
          <p className="text-xs text-slate-500">
            {isLiveFirebase ? 'Escutando mudanças na nuvem em tempo real' : 'Inativo (Modo local)'}
          </p>
        </div>
      </div>

      {/* Action and Test Result Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            <span>{testing ? 'Testando Conexão Firestore...' : 'Testar Conexão Firebase'}</span>
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {testResult.success ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{testResult.message}</p>
              {testResult.latencyMs !== undefined && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
                  <Clock size={12} />
                  <span>Tempo de resposta do cluster: {testResult.latencyMs} ms</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirebaseControlCenter;
