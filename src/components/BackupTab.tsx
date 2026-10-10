import React from 'react';
import { Order } from '../types';
import { Download, Upload, Database, CheckCircle2 } from 'lucide-react';

interface BackupTabProps {
  orders: Order[];
  onImportOrders?: (imported: Order[]) => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({ orders = [], onImportOrders }) => {
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vinimap_backup_orders_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">Backup & Restauração de Dados</h3>
        <p className="text-xs text-slate-500">Exporte ou restaure o estado da aplicação em formato JSON seguro</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3">
              <Download size={20} />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Exportar Backup Atual</h4>
            <p className="text-xs text-slate-500 mt-1">Baixe um arquivo JSON contendo {orders.length} pedidos e seu histórico completo.</p>
          </div>
          <button
            onClick={handleExportJSON}
            className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            Download Backup JSON
          </button>
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-3">
              <Upload size={20} />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Restaurar Backup</h4>
            <p className="text-xs text-slate-500 mt-1">Importe um arquivo de backup previamente salvo no ViniMap Fleet.</p>
          </div>
          <label className="mt-6 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md text-center cursor-pointer transition-colors">
            Selecionar Arquivo JSON
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const parsed = JSON.parse(event.target?.result as string);
                      if (Array.isArray(parsed)) {
                        onImportOrders?.(parsed);
                        alert(`Restauração efetuada com sucesso: ${parsed.length} pedidos importados.`);
                      }
                    } catch (err) {
                      alert("Erro ao ler o arquivo de backup.");
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default BackupTab;
