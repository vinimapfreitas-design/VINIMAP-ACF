import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Phone, 
  Key, 
  User, 
  Truck, 
  Star, 
  Bike, 
  Car, 
  Zap, 
  LogIn, 
  CheckCircle, 
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  X,
  Power,
  DollarSign,
  Smartphone,
  Share2,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Courier } from '../types';
import CouriersList from './CouriersList';
import LiveMap from './LiveMap';
import AppShareModal from './AppShareModal';

interface CouriersTabProps {
  couriers: Courier[];
  onAddCourier: (courier: Omit<Courier, 'id' | 'ordersCompleted' | 'currentLat' | 'currentLng' | 'avatar' | 'status' | 'rating'>) => Promise<any>;
  onUpdateCourier: (id: string, courier: Partial<Courier>) => Promise<any>;
  onDeleteCourier: (id: string) => Promise<any>;
  selectedCourierId: string | null;
  setSelectedCourierId: (id: string | null) => void;
  searchTerm: string;
  orders: any[];
  freightRules?: any[];
  partnerClients?: any[];
}

export default function CouriersTab({
  couriers,
  onAddCourier,
  onUpdateCourier,
  onDeleteCourier,
  selectedCourierId,
  setSelectedCourierId,
  searchTerm,
  orders,
  freightRules,
  partnerClients
}: CouriersTabProps) {
  // Form State for Registration
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicle, setVehicle] = useState<'motorcycle' | 'bicycle' | 'car' | 'van'>('motorcycle');
  const [isActive, setIsActive] = useState(true);
  const [allowPeriodHistory, setAllowPeriodHistory] = useState(false);
  const [showDeliveryFee, setShowDeliveryFee] = useState(false);
  const [repasseTaxa, setRepasseTaxa] = useState('9.50');
  const [repasseFormato, setRepasseFormato] = useState<'tabela_cep' | 'fixo' | 'porcentagem'>('tabela_cep');
  const [repassePorcentagem, setRepassePorcentagem] = useState('80');
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Sheet State
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);

  // Login Simulator & App Share State
  const [simPhone, setSimPhone] = useState('');
  const [simPassword, setSimPassword] = useState('');
  const [loginResult, setLoginResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCourierId, setShareCourierId] = useState<string | null>(null);

  const handleStartEdit = (courier: Courier, openModal = false) => {
    setEditingCourier(courier);
    setName(courier.name);
    setPhone(courier.phone);
    setPassword(courier.password || '');
    setVehicle(courier.vehicle);
    setIsActive(courier.isActive !== false);
    setAllowPeriodHistory(!!courier.allowPeriodHistory);
    setShowDeliveryFee(!!courier.showDeliveryFee);
    setRepasseTaxa(courier.repasseTaxa !== undefined ? String(courier.repasseTaxa) : '9.50');
    setRepasseFormato(courier.repasseFormato || 'tabela_cep');
    setRepassePorcentagem(courier.repassePorcentagem !== undefined ? String(courier.repassePorcentagem) : '80');
    setRegError('');
    setRegSuccess('');

    if (openModal) {
      setIsFichaModalOpen(true);
    }
  };

  const handleCancelEdit = () => {
    setEditingCourier(null);
    setName('');
    setPhone('');
    setPassword('');
    setVehicle('motorcycle');
    setIsActive(true);
    setAllowPeriodHistory(false);
    setShowDeliveryFee(false);
    setRepasseTaxa('9.50');
    setRepasseFormato('tabela_cep');
    setRepassePorcentagem('80');
    setRegError('');
    setRegSuccess('');
    setIsFichaModalOpen(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setRegError('');
    setRegSuccess('');

    const cleanInputPhone = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setRegError('Por favor, digite o Nome.');
      return;
    }
    if (!cleanInputPhone) {
      setRegError('Por favor, digite o Telefone (Login).');
      return;
    }
    if (!password.trim()) {
      setRegError('Por favor, defina a Senha numérica.');
      return;
    }
    if (!/^\d+$/.test(password)) {
      setRegError('A Senha deve conter apenas algarismos numéricos (0-9).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCourier) {
        const exists = couriers.some(c => c.id !== editingCourier.id && c.phone.replace(/\D/g, '') === cleanInputPhone);
        if (exists) {
          setRegError('Já existe outro entregador cadastrado sob este telefone (login).');
          setIsSubmitting(false);
          return;
        }

        await onUpdateCourier(editingCourier.id, {
          name,
          phone,
          password,
          vehicle,
          isActive,
          allowPeriodHistory,
          repasseTaxa: parseFloat(repasseTaxa) || 9.50,
          repasseFormato,
          repassePorcentagem: parseFloat(repassePorcentagem) || 80,
          showDeliveryFee
        });

        setRegSuccess(`Entregador "${name}" atualizado com sucesso!`);
        if (isFichaModalOpen) {
          setTimeout(() => {
            setIsFichaModalOpen(false);
          }, 800);
        }
        handleCancelEdit();
      } else {
        const exists = couriers.some(c => c.phone.replace(/\D/g, '') === cleanInputPhone);
        if (exists) {
          setRegError('Já existe um entregador cadastrado sob este telefone (login).');
          setIsSubmitting(false);
          return;
        }

        await onAddCourier({
          name,
          phone,
          password,
          vehicle,
          isActive,
          allowPeriodHistory,
          repasseTaxa: parseFloat(repasseTaxa) || 9.50,
          repasseFormato,
          repassePorcentagem: parseFloat(repassePorcentagem) || 80,
          showDeliveryFee
        });

        setRegSuccess(`Entregador "${name}" cadastrado com login de telefone e senha!`);
        if (isFichaModalOpen) {
          setTimeout(() => {
            setIsFichaModalOpen(false);
          }, 800);
        }
        setName('');
        setPhone('');
        setPassword('');
        setVehicle('motorcycle');
        setIsActive(true);
        setAllowPeriodHistory(false);
        setShowDeliveryFee(false);
      }
    } catch (err: any) {
      setRegError(err.message || 'Erro ao salvar entregador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginResult(null);

    if (!simPhone.trim() || !simPassword.trim()) {
      setLoginResult({ success: false, msg: 'Por favor, preencha o login (telefone) e a senha numérica.' });
      return;
    }

    const cleanSimPhone = simPhone.replace(/\D/g, '');
    const matchedCourier = couriers.find(c => {
      const cleanPhone = c.phone.replace(/\D/g, '');
      return cleanPhone === cleanSimPhone && c.password === simPassword;
    });

    if (matchedCourier) {
      setLoginResult({
        success: true,
        msg: `Autenticado! Bem-vindo(a), ${matchedCourier.name}. Veículo: ${matchedCourier.vehicle.toUpperCase()} • Status: ${matchedCourier.status.toUpperCase()}`
      });
    } else {
      setLoginResult({
        success: false,
        msg: 'Acesso Recusado: Telefone não cadastrado ou senha numérica incorreta.'
      });
    }
  };

  const togglePasswordVisibility = (courierId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [courierId]: !prev[courierId]
    }));
  };

  // Reusable fields sub-component to keep clean code
  const renderFormFields = (isModal = false) => (
    <div className={`space-y-4 text-xs ${isModal ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 space-y-0' : ''}`}>
      {/* 1. Personal & Contact */}
      <div className={isModal ? 'space-y-3.5' : 'space-y-3.5'}>
        <div>
          <label className="block text-slate-700 font-bold mb-1">Nome Completo do Condutor *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              required
              placeholder="Ex: João Carlos Silva Júnior"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-slate-50 focus:bg-white font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Telefone (Login) *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                required
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Senha Numérica (0-9) *</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="password"
                pattern="\d*"
                required
                maxLength={10}
                placeholder="Ex: 4321 ou 8590"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-slate-50 focus:bg-white font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-bold mb-1">Tipo de Veículo</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'motorcycle', name: 'Moto' },
              { id: 'bicycle', name: 'Bike' },
              { id: 'car', name: 'Carro' },
              { id: 'van', name: 'Van' }
            ].map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVehicle(v.id as any)}
                className={`py-2 px-2 border rounded-xl text-center font-bold text-xs cursor-pointer transition-colors ${
                  vehicle === v.id 
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Repasse Financeiro & Permissões */}
      <div className="space-y-3.5">
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <label className="block text-slate-700 font-bold">Formato de Repasse Financeiro *</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setRepasseFormato('tabela_cep')}
              className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                repasseFormato === 'tabela_cep'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              📍 Tabela CEP
            </button>
            <button
              type="button"
              onClick={() => setRepasseFormato('fixo')}
              className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                repasseFormato === 'fixo'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              💵 Valor Fixo
            </button>
            <button
              type="button"
              onClick={() => setRepasseFormato('porcentagem')}
              className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                repasseFormato === 'porcentagem'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              % Porcentagem
            </button>
          </div>

          {repasseFormato === 'porcentagem' && (
            <div>
              <label className="block text-slate-600 font-semibold mb-1">% Porcentagem sobre o Frete</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  required
                  placeholder="EX: 80"
                  value={repassePorcentagem}
                  onChange={(e) => setRepassePorcentagem(e.target.value)}
                  className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-800 bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {repasseFormato === 'tabela_cep' 
                ? 'Taxa Base Padronizada (R$) * (Se não houver regra de CEP)' 
                : (repasseFormato === 'fixo' ? 'Valor Fixo por Corrida (R$) *' : 'Taxa Mínima por Corrida (R$) *')}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                placeholder="EX: 9.50"
                value={repasseTaxa}
                onChange={(e) => setRepasseTaxa(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 font-bold bg-white"
              />
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 select-none">
              Condutor Ativo (Habilitado para Entregas)
            </span>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={allowPeriodHistory}
              onChange={(e) => setAllowPeriodHistory(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 select-none">
              Ver e totalizar histórico de pedidos no App
            </span>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={showDeliveryFee}
              onChange={(e) => setShowDeliveryFee(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700 select-none">
              Exibir taxa de entrega no aplicativo do condutor
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header tab banner */}
      <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gerenciamento Integrado de Entregadores</h2>
          <p className="text-xs text-slate-500">Cadastre motoboys, audite senhas de login e simule o acesso dos condutores</p>
        </div>

        <button
          onClick={() => {
            handleCancelEdit();
            setIsFichaModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer transition-all active:scale-98"
        >
          <Plus size={16} />
          <span>Ficha de Cadastro Completa</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Registration & Login Sim Column */}
        <div className="xl:col-span-1 space-y-6">
          {/* Card 1: Registration Form */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingCourier ? 'Editar Condutor' : 'Novo Cadastro Rápido'}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsFichaModalOpen(true)}
                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Expandir em Janela Completa"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Expandir</span>
                </button>
                {editingCourier && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Cancelar Edição"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{regSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsShareModalOpen(true);
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Enviar App e Senha pelo WhatsApp</span>
                </button>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              {renderFormFields(false)}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                {editingCourier && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin mr-1">⏳</span>
                  ) : editingCourier ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Salvando cadastro...'
                      : editingCourier
                      ? 'Salvar Alterações'
                      : 'Salvar Cadastro'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Login Simulator */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 shadow-lg space-y-4 border border-slate-950">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <LogIn className="h-4.5 w-4.5 text-blue-400" />
              <h3 className="font-bold text-sm text-white">Simulador de Login do Condutor</h3>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Verifique se o login do entregador está funcionando corretamente informando o seu telefone e a senha numérica cadastrados.
            </p>

            <form onSubmit={handleSimulateLogin} className="space-y-3.5 text-xs text-slate-300">
              <div className="space-y-1">
                <label className="block font-medium text-slate-400">Telefone / Login</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-slate-400">Senha Numérica</label>
                <input
                  type="password"
                  placeholder="Seu código de acesso"
                  value={simPassword}
                  onChange={(e) => setSimPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
              >
                Autenticar no Aplicativo
              </button>
            </form>

            {loginResult !== null && (
              <div className={`p-3 rounded-xl text-[11px] font-semibold flex items-start gap-2 border ${
                loginResult.success 
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}>
                {loginResult.success ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{loginResult.msg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Courier List and Map View */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-[480px] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Lista de Credenciais / Senhas</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Controle de Segurança</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleCancelEdit();
                      setIsFichaModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[10.5px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                    title="Abrir Ficha de Cadastro em Tela Cheia"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-600" />
                    <span>Novo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShareCourierId(null);
                      setIsShareModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                    title="Enviar link de instalação do aplicativo do condutor por WhatsApp ou SMS"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Enviar App</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs custom-scrollbar">
                {couriers.filter(c => {
                  if (!searchTerm) return true;
                  const q = searchTerm.toLowerCase();
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.vehicle && c.vehicle.toLowerCase().includes(q)) ||
                    (c.phone && c.phone.includes(q))
                  );
                }).map(c => {
                  const isShow = showPasswords[c.id];
                  return (
                    <div key={c.id} className={`p-2 px-3 rounded-xl border flex items-center justify-between ${
                      c.isActive !== false 
                        ? 'border-slate-50 bg-slate-50/50' 
                        : 'border-rose-100 bg-rose-50/20 opacity-85'
                    }`}>
                      <div>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.isActive === false && (
                            <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold border border-rose-200">
                              Inativo
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>Login: {c.phone}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5">
                            Repasse: R$ {(c.repasseTaxa !== undefined ? c.repasseTaxa : 9.50).toFixed(2).replace('.', ',')}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[11px] bg-white border border-slate-150 px-1.5 py-0.5 rounded text-indigo-700 font-bold flex items-center gap-1 shadow-xs">
                          <Lock className="h-3 w-3 text-slate-400" />
                          <span>{isShow ? c.password || '____' : '••••'}</span>
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(c.id)}
                          title="Mostrar/Ocultar Senha"
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                        >
                          {isShow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setShareCourierId(c.id);
                            setIsShareModalOpen(true);
                          }}
                          title={`Enviar link de instalação do App no telefone (${c.phone}) de ${c.name}`}
                          className="p-1 hover:bg-emerald-50 text-emerald-600 rounded transition-colors cursor-pointer"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const nextState = c.isActive === false;
                            try {
                              await onUpdateCourier(c.id, { isActive: nextState });
                            } catch (err: any) {
                              alert(err.message || 'Erro ao alterar status');
                            }
                          }}
                          title={c.isActive !== false ? 'Inativar Entregador' : 'Ativar Entregador'}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            c.isActive !== false 
                              ? 'text-amber-500 hover:bg-amber-50' 
                              : 'text-emerald-500 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(c, true)}
                          title="Editar Ficha de Cadastro Completa"
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const cleanCPhone = c.phone ? String(c.phone).replace(/\D/g, '') : '';
                            const hasOrders = orders.some(o => 
                              o && (
                                o.courierId === c.id || 
                                o.courier_id === c.id || 
                                (cleanCPhone && o.dispositivoCondutor && String(o.dispositivoCondutor).replace(/\D/g, '') === cleanCPhone)
                              )
                            );

                            if (hasOrders) {
                              const confirmInact = confirm(
                                `O condutor "${c.name}" possui pedidos registrados em seu histórico operacional e NÃO pode ser excluído permanentemente, somente inativado para manter a integridade fiscal e de histórico.\n\nDeseja INATIVAR este condutor agora? O administrador poderá reativá-lo a qualquer momento usando o botão de status.`
                              );
                              if (confirmInact) {
                                try {
                                  await onUpdateCourier(c.id, { isActive: false });
                                  setRegSuccess(`Condutor "${c.name}" inativado com sucesso.`);
                                } catch (err: any) {
                                  alert(err.message || 'Erro ao inativar condutor');
                                }
                              }
                              return;
                            }

                            if (confirm(`Excluir o cadastro e credenciais do condutor "${c.name}"?`)) {
                              try {
                                await onDeleteCourier(c.id);
                                setRegSuccess(`Condutor "${c.name}" excluído.`);
                              } catch (err: any) {
                                alert(err.message || "Erro ao excluir condutor");
                              }
                            }
                          }}
                          title="Excluir ou Inativar Condutor"
                          className="p-1 hover:bg-rose-50 text-rose-500 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <CouriersList
              couriers={couriers}
              selectedCourierId={selectedCourierId}
              setSelectedCourierId={setSelectedCourierId}
              searchTerm={searchTerm}
              orders={orders}
              freightRules={freightRules}
              partnerClients={partnerClients}
              onUpdateCourier={onUpdateCourier}
              onOpenShareForCourier={(id) => {
                setShareCourierId(id);
                setIsShareModalOpen(true);
              }}
            />
          </div>

          <LiveMap
            couriers={couriers}
            orders={orders}
            selectedCourierId={selectedCourierId}
            setSelectedCourierId={setSelectedCourierId}
          />
        </div>
      </div>

      {/* MODAL COMPLETO: FICHA DE CADASTRO DO CONDUTOR */}
      {isFichaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden my-auto animate-scale-up">
            {/* Sticky Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white">
                    {editingCourier ? 'Ficha de Cadastro do Condutor' : 'Nova Ficha de Cadastro do Condutor'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acesso, dados de login, repasse financeiro e regras de visualização do app
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsFichaModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleRegister} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 sm:p-7 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                {regError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                {renderFormFields(true)}
              </div>

              {/* Sticky Footer with Save button always visible */}
              <div className="p-4 sm:px-7 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 ${
                      isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="inline-block animate-spin mr-1">⏳</span>
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>
                      {isSubmitting
                        ? 'Salvando condutor...'
                        : editingCourier
                        ? 'Salvar Alterações da Ficha'
                        : 'Concluir Cadastro do Condutor'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Share & Installation Link Modal */}
      <AppShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        couriers={couriers}
        initialCourierId={shareCourierId || undefined}
      />
    </div>
  );
}
