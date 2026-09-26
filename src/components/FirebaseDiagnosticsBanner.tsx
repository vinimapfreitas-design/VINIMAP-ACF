import React from 'react';
import { isLiveFirebase } from '../lib/firebase';
import { Database } from 'lucide-react';

export const FirebaseDiagnosticsBanner: React.FC = () => {
  if (isLiveFirebase) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-2xl mb-4 text-xs flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-amber-600" />
        <span><strong>Modo Local (IndexedDB) Ativo:</strong> As alterações estão sendo armazenadas no seu navegador.</span>
      </div>
    </div>
  );
};

export default FirebaseDiagnosticsBanner;
