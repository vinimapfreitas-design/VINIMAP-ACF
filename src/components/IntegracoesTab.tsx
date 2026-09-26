import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Key, 
  Globe, 
  Copy, 
  Check, 
  Send, 
  Truck, 
  PackageCheck, 
  Search, 
  AlertTriangle, 
  Calculator, 
  ShieldCheck, 
  ListFilter, 
  Trash2, 
  ExternalLink,
  Sliders,
  Radio,
  FileCode,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react';
import { Order } from '../types';
import { 
  getIntelipostConfig, 
  saveIntelipostConfig, 
  testIntelipostConnection, 
  getIntelipostLogs, 
  clearIntelipostLogs, 
  calculateIntelipostFreight, 
  updateIntelipostOrderStatus, 
  IntelipostConfig, 
  IntelipostLog, 
  IntelipostDeliveryOption 
} from '../lib/intelipost';

interface IntegracoesTabProps {
  orders: Order[];
  onAddOrder?: (newOrder: Order) => void;
  onUpdateOrderStatus?: (orderId: string, status: any) => void;
}

export const IntegracoesTab: React.FC<IntegracoesTabProps> = ({
  orders = [],
  onAddOrder,
  onUpdateOrderStatus,
}) => {
  const [config, setConfig] = useState<IntelipostConfig>(getIntelipostConfig());
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [logs, setLogs] = useState<IntelipostLog[]>([]);

  // Testing & Calculator States
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Freight Calc State
  const [calcOriginCep, setCalcOriginCep] = useState('01001-000');
  const [calcDestCep, setCalcDestCep] = useState('01310-200');
  const [calcWeight, setCalcWeight] = useState('1.5');
  const [calcValue, setCalcValue] = useState('150.00');
  const [isCalculating, setIsCalculating] = useState(false);
  const [freightResults, setFreightResults] = useState<IntelipostDeliveryOption[] | null>(null);

  // Manual Status Sync Test State
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const [syncOrderResult, setSyncOrderResult] = useState<string | null>(null);

  // Save feedback state
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Intelipost Allocation Panel States
  const [allocationFilter, setAllocationFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getIntelipostConfig());
    setLogs(getIntelipostLogs());
    if (orders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders]);

  const refreshLogs = () => {
    setLogs(getIntelipostLogs());
  };

  // Filter Intelipost Orders
  const intelipostOrders = orders.filter(
    (o) => o.id.startsWith('intelipost_') || o.codigoCliente === 'INTELIPOST' || o.detalhe?.includes('Intelipost')
  );

  const filteredIntelipostOrders = intelipostOrders.filter((order) => {
    if (allocationFilter === 'pending') return order.status === 'pending';
    if (allocationFilter === 'accepted') return order.status === 'in_progress' || order.status === 'in_route' || order.status === 'delivered';
    if (allocationFilter === 'rejected') return order.status === 'cancelled' || order.status === 'failure';
    return true;
  });

  const handleAcceptOrder = async (order: Order) => {
    setActionLoadingId(order.id);
    try {
      if (onUpdateOrderStatus) {
        onUpdateOrderStatus(order.id, 'in_progress');
      }
      await updateIntelipostOrderStatus(order.pedido || order.id, 'in_progress');
      refreshLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectOrder = async (order: Order) => {
    if (!confirm(`Deseja realmente rejeitar a alocação do pedido Intelipost #${order.pedido || order.id}?`)) return;
    setActionLoadingId(order.id);
    try {
      if (onUpdateOrderStatus) {
        onUpdateOrderStatus(order.id, 'cancelled');
      }
      await updateIntelipostOrderStatus(order.pedido || order.id, 'cancelled', {
        failureReason: 'Alocação recusada no painel ViniMap Fleet',
      });
      refreshLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveIntelipostConfig(config);
    setConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    refreshLogs();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testIntelipostConnection(config.apiKey, config.apiUrl);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Erro ao conectar à API da Intelipost' });
    } finally {
      setIsTesting(false);
      refreshLogs();
    }
  };

  const handleCalculateFreight = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculating(true);
    setFreightResults(null);
    try {
      const res = await calculateIntelipostFreight({
        originZipCode: calcOriginCep,
        destinationZipCode: calcDestCep,
        volumes: [
          {
            weight: parseFloat(calcWeight) || 1,
            costValue: parseFloat(calcValue) || 100,
            width: 15,
            height: 15,
            length: 15,
          },
        ],
        invoiceValue: parseFloat(calcValue) || 100,
      });
      setFreightResults(res.options || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalculating(false);
      refreshLogs();
    }
  };

  const handleManualStatusSync = async () => {
    if (!selectedOrderId) return;
    const targetOrder = orders.find((o) => o.id === selectedOrderId);
    if (!targetOrder) return;

    setIsSyncingOrder(true);
    setSyncOrderResult(null);
    try {
      const res = await updateIntelipostOrderStatus(
        targetOrder.pedido || targetOrder.id,
        targetOrder.status,
        {
          courierName: targetOrder.courierName,
          deliveredAt: targetOrder.deliveredAt,
          receiverName: targetOrder.receiverName,
        }
      );
      setSyncOrderResult(res.message);
    } catch (e: any) {
      setSyncOrderResult('Erro na notificação de status');
    } finally {
      setIsSyncingOrder(false);
      refreshLogs();
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/intelipost/webhook`
    : 'https://vinimap-fleet.app/api/intelipost/webhook';

  const copyToClipboard = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Deseja realmente limpar os logs de integração da Intelipost?')) {
      clearIntelipostLogs();
      setLogs([]);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Zap size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-white tracking-tight">Integração Intelipost</h1>
                <span className="text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Radio size={12} className="animate-pulse" /> API Aberta Direct
                </span>
                {config.apiKey ? (
                  <span className="text-xs bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> Chave Configurada
                  </span>
                ) : (
                  <span className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={12} /> Aguardando API Key
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Central de sincronização para recebimento de pedidos da Intelipost, alocação de entregadores e atualização de status em tempo real.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* API Credentials Configuration (Left Column - 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Key className="text-emerald-400" size={20} />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Credenciais & Conexão Intelipost</h2>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}>
                {testResult.success ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-blue-950/60 border border-blue-800 text-blue-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Configurações salvas com sucesso!</span>
              </div>
            )}

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Chave da API (api_key Intelipost) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder="Ex: 8f72a19b4e5c6d3f2a1b0e9d"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg"
                  >
                    {showApiKey ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Obtenha no painel Intelipost em: <strong>Configurações &gt; Chaves de API</strong>.
                </p>
              </div>

              {/* API Environment URL */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Ambiente da API Intelipost</label>
                <select
                  value={config.apiUrl}
                  onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="https://api.intelipost.com.br/v1">Produção (https://api.intelipost.com.br/v1)</option>
                  <option value="https://api-sandbox.intelipost.com.br/v1">Sandbox / Testes (https://api-sandbox.intelipost.com.br/v1)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Platform Name Header */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Identificador de Plataforma</label>
                  <input
                    type="text"
                    value={config.platformName}
                    onChange={(e) => setConfig({ ...config, platformName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Origin CEP */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">CEP de Origem Padrão</label>
                  <input
                    type="text"
                    value={config.originCep}
                    onChange={(e) => setConfig({ ...config, originCep: e.target.value })}
                    placeholder="01001-000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 space-y-3 border-t border-slate-800/80">
                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-xs font-bold text-white block">Sincronização Automática de Status</span>
                    <span className="text-[11px] text-slate-400">
                      Notifica a Intelipost automaticamente a cada mudança de status da entrega no app do motorista.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.statusSyncEnabled}
                    onChange={(e) => setConfig({ ...config, statusSyncEnabled: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-xs font-bold text-white block">Auto-Alocação de Pedidos Importados</span>
                    <span className="text-[11px] text-slate-400">
                      Entregas recebidas via webhook Intelipost entram automaticamente no algoritmo de roteirização.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoAllocationEnabled}
                    onChange={(e) => setConfig({ ...config, autoAllocationEnabled: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-colors cursor-pointer"
            >
              Salvar Configuração Intelipost
            </button>
          </form>

          {/* Freight Calculator Sandbox */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Calculator className="text-blue-400" size={18} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Simulador de Cotação de Frete (Intelipost API)</h3>
            </div>

            <form onSubmit={handleCalculateFreight} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">CEP Origem</label>
                  <input
                    type="text"
                    value={calcOriginCep}
                    onChange={(e) => setCalcOriginCep(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">CEP Destino</label>
                  <input
                    type="text"
                    value={calcDestCep}
                    onChange={(e) => setCalcDestCep(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Peso (kg)</label>
                  <input
                    type="text"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Valor NF (R$)</label>
                  <input
                    type="text"
                    value={calcValue}
                    onChange={(e) => setCalcValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCalculating}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Calculator size={14} />
                <span>{isCalculating ? 'Calculando Cotação...' : 'Calcular Frete na Intelipost'}</span>
              </button>
            </form>

            {freightResults && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Opções de Frete Retornadas:</span>
                {freightResults.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma opção de entrega encontrada para a rota.</p>
                ) : (
                  freightResults.map((opt, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-extrabold text-white">{opt.deliveryMethodName}</p>
                        <p className="text-[11px] text-slate-400">{opt.logisticProviderName} • Prazo: {opt.deliveryTime} dia(s)</p>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        R$ {opt.finalDeliveryCost.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Webhook Setup & Direct Order Sync Test (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Webhook Endpoint Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Globe className="text-emerald-400" size={18} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">URL do Webhook (Recebimento)</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Cole a URL abaixo nas configurações de <strong>Webhooks</strong> do painel da Intelipost para receber novos pedidos e atualizações de entrega instantaneamente.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase block">Endpoint HTTP POST</label>
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-2.5 rounded-2xl font-mono text-xs text-emerald-300 truncate">
                <span className="truncate flex-1">{webhookUrl}</span>
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Copiar URL"
                >
                  {copiedWebhookUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase block">Chave do Segredo (Secret Key)</label>
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-2.5 rounded-2xl font-mono text-xs text-amber-300 truncate">
                <span className="truncate flex-1">{config.webhookSecret}</span>
                <button
                  onClick={() => copyToClipboard(config.webhookSecret, 'secret')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Copiar Secret"
                >
                  {copiedSecret ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 space-y-1">
              <p className="font-bold text-slate-300">📌 Eventos Suportados:</p>
              <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px] text-emerald-400/90">
                <li>CREATED (Novo Pedido)</li>
                <li>READY_FOR_SHIPPING (Aguardando Alocação)</li>
                <li>SHIPPED / IN_TRANSIT (Em Rota)</li>
              </ul>
            </div>
          </div>

          {/* Order Status Notification Test */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Send className="text-blue-400" size={18} />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Testar Envio de Status para Intelipost</h3>
            </div>

            <p className="text-xs text-slate-300">
              Selecione um pedido existente para disparar a notificação manual de status para a API da Intelipost:
            </p>

            <div className="space-y-3">
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {orders.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    #{ord.pedido || ord.id} - {ord.customerName} ({ord.status.toUpperCase()})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleManualStatusSync}
                disabled={isSyncingOrder || !selectedOrderId}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Send size={14} />
                <span>{isSyncingOrder ? 'Enviando Notificação...' : 'Disparar Atualização Intelipost'}</span>
              </button>

              {syncOrderResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 text-emerald-300 rounded-xl text-xs font-mono">
                  ✓ {syncOrderResult}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Intelipost Orders Allocation Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Painel de Alocação de Pedidos Intelipost
                </h2>
                <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                  {intelipostOrders.length} {intelipostOrders.length === 1 ? 'Pedido' : 'Pedidos'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gerencie e decida o aceite ou rejeição das entregas recebidas automaticamente da Intelipost.
              </p>
            </div>
          </div>

          {/* Allocation Filters */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setAllocationFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                allocationFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({intelipostOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setAllocationFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                allocationFilter === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Clock size={12} />
              <span>Pendentes ({intelipostOrders.filter(o => o.status === 'pending').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAllocationFilter('accepted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                allocationFilter === 'accepted'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Aceitos ({intelipostOrders.filter(o => o.status === 'in_progress' || o.status === 'in_route' || o.status === 'delivered').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAllocationFilter('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                allocationFilter === 'rejected'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <XCircle size={12} />
              <span>Rejeitados ({intelipostOrders.filter(o => o.status === 'cancelled' || o.status === 'failure').length})</span>
            </button>
          </div>
        </div>

        {filteredIntelipostOrders.length === 0 ? (
          <div className="p-8 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-center space-y-3">
            <PackageCheck size={36} className="mx-auto text-slate-600" />
            <p className="text-xs font-bold text-slate-300">
              Nenhum pedido Intelipost encontrado no filtro selecionado ({allocationFilter.toUpperCase()}).
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Quando novos pedidos forem recebidos via Webhook POST na URL configurada, eles aparecerão aqui para sua aprovação.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIntelipostOrders.map((ord) => {
              const isPending = ord.status === 'pending';
              const isAccepted = ord.status === 'in_progress' || ord.status === 'in_route' || ord.status === 'delivered';
              const isRejected = ord.status === 'cancelled' || ord.status === 'failure';
              const isLoading = actionLoadingId === ord.id;

              return (
                <div
                  key={ord.id}
                  className={`bg-slate-950 border rounded-2xl p-4 space-y-3 transition-all relative overflow-hidden ${
                    isPending
                      ? 'border-amber-500/40 shadow-amber-500/5 shadow-md'
                      : isAccepted
                      ? 'border-emerald-500/30'
                      : 'border-rose-500/30 opacity-75'
                  }`}
                >
                  {/* Order Header Info */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-white">#{ord.pedido || ord.id}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {ord.nomeFantasia || 'Intelipost'}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-emerald-400 mt-0.5">{ord.customerName}</p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock size={11} /> Aguardando Decisão
                        </span>
                      )}
                      {isAccepted && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Aceito / Alocado
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                          <XCircle size={11} /> Rejeitado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address & Details */}
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p className="flex items-start gap-1.5 leading-snug">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{ord.address} — <strong className="text-slate-200">{ord.bairro || ord.region} ({ord.cidadeMunicipio || 'SP'})</strong></span>
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                      <span>CEP: <strong>{ord.cep}</strong></span>
                      <span>DANFE: <strong>{ord.danfe || 'N/A'}</strong></span>
                      <span className="text-emerald-300 font-bold">R$ {(ord.valorEntrega || ord.value || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      Sync: <strong className="text-slate-300">{ord.statusSincronizado || 'Intelipost'}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRejectOrder(ord)}
                        disabled={isLoading || isRejected}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          isRejected
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 shadow-xs'
                        }`}
                      >
                        <XCircle size={14} />
                        <span>{isLoading ? '...' : isRejected ? 'Rejeitado' : 'Rejeitar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAcceptOrder(ord)}
                        disabled={isLoading || isAccepted}
                        className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          isAccepted
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>{isLoading ? 'Processando...' : isAccepted ? 'Aceito' : 'Aceitar Alocação'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Webhooks & API History Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ListFilter className="text-emerald-400" size={20} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Histórico de Sincronizações &amp; Webhooks ({logs.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshLogs}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Atualizar</span>
            </button>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-bold rounded-xl border border-rose-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Clock size={32} className="mx-auto text-slate-600" />
            <p className="text-xs font-medium">Nenhum evento registrado até o momento.</p>
            <p className="text-[11px] text-slate-400">
              Utilize o botão &quot;Simular Pedido Intelipost&quot; ou &quot;Testar Conexão&quot; para testar a comunicação.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="p-3 rounded-l-xl">Data / Hora</th>
                  <th className="p-3">Tipo de Evento</th>
                  <th className="p-3">Título / Descrição</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 rounded-r-xl">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono text-[10px] font-bold uppercase">
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3 text-white font-bold">{log.title}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 text-[11px] max-w-xs truncate">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default IntegracoesTab;
