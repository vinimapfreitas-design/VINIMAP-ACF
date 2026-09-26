import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Navigation, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Users, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Target,
  Flag,
  Globe,
  Radio,
  FileSpreadsheet
} from 'lucide-react';
import { HubCentral } from '../types';

interface HubsTabProps {
  hubs: HubCentral[];
  onAddHub?: (hub: Omit<HubCentral, 'id'>) => void;
  onUpdateHub?: (id: string, hub: Partial<HubCentral>) => void;
  onDeleteHub?: (id: string) => void;
  onSetActiveHub?: (id: string) => void;
}

export const HubsTab: React.FC<HubsTabProps> = ({
  hubs = [],
  onAddHub,
  onUpdateHub,
  onDeleteHub,
  onSetActiveHub
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<HubCentral | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    cep: string;
    latitude: number;
    longitude: number;
    coverageRadiusKm: number;
    managerName: string;
    contactPhone: string;
    contactEmail: string;
    isActive: boolean;
    color: string;
    endRoutingType: 'farthest' | 'manual' | 'hub';
    manualEndAddress: string;
    notes: string;
  }>({
    name: '',
    code: '',
    address: '',
    city: 'São Paulo',
    state: 'SP',
    cep: '',
    latitude: -23.530385,
    longitude: -46.702677,
    coverageRadiusKm: 15,
    managerName: '',
    contactPhone: '',
    contactEmail: '',
    isActive: true,
    color: '#059669',
    endRoutingType: 'hub',
    manualEndAddress: '',
    notes: '',
  });

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Search filter
  const filteredHubs = hubs.filter(hub => {
    const term = searchTerm.toLowerCase();
    return (
      hub.name?.toLowerCase().includes(term) ||
      hub.code?.toLowerCase().includes(term) ||
      hub.address?.toLowerCase().includes(term) ||
      hub.city?.toLowerCase().includes(term) ||
      hub.cep?.toLowerCase().includes(term) ||
      (hub.managerName && hub.managerName.toLowerCase().includes(term))
    );
  });

  const handleOpenCreateModal = () => {
    setEditingHub(null);
    setFormData({
      name: '',
      code: `HUB-${Math.floor(100 + Math.random() * 900)}`,
      address: '',
      city: 'São Paulo',
      state: 'SP',
      cep: '',
      latitude: -23.530385 + (Math.random() - 0.5) * 0.05,
      longitude: -46.702677 + (Math.random() - 0.5) * 0.05,
      coverageRadiusKm: 20,
      managerName: '',
      contactPhone: '',
      contactEmail: '',
      isActive: true,
      color: '#059669',
      endRoutingType: 'hub',
      manualEndAddress: '',
      notes: '',
    });
    setCepError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (hub: HubCentral) => {
    setEditingHub(hub);
    setFormData({
      name: hub.name || '',
      code: hub.code || `HUB-${hub.id}`,
      address: hub.address || '',
      city: hub.city || 'São Paulo',
      state: hub.state || 'SP',
      cep: hub.cep || '',
      latitude: hub.latitude || -23.530385,
      longitude: hub.longitude || -46.702677,
      coverageRadiusKm: hub.coverageRadiusKm || 15,
      managerName: hub.managerName || '',
      contactPhone: hub.contactPhone || '',
      contactEmail: hub.contactEmail || '',
      isActive: hub.isActive !== false,
      color: hub.color || '#059669',
      endRoutingType: hub.endRoutingType || 'hub',
      manualEndAddress: hub.manualEndAddress || '',
      notes: hub.notes || '',
    });
    setCepError(null);
    setIsModalOpen(true);
  };

  // ViaCEP integration to autocomplete address
  const handleCepLookup = async (cepInput: string) => {
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    setCepError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepError('CEP não encontrado na base dos Correios.');
      } else {
        const fullAddress = `${data.logradouro || ''}, ${data.bairro || ''} - ${data.localidade || ''}/${data.uf || ''}`;
        setFormData(prev => ({
          ...prev,
          address: fullAddress,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
          cep: cleanCep
        }));

        // Try geocoding with OpenStreetMap Nominatim
        try {
          const query = encodeURIComponent(`${data.logradouro}, ${data.localidade}, Brasil`);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            setFormData(prev => ({
              ...prev,
              latitude: parseFloat(geoData[0].lat),
              longitude: parseFloat(geoData[0].lon)
            }));
          }
        } catch (_) {}
      }
    } catch (e) {
      setCepError('Falha ao consultar CEP.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      alert('Por favor, preencha o Nome e o Endereço do Hub.');
      return;
    }

    if (editingHub) {
      onUpdateHub?.(editingHub.id, formData);
    } else {
      onAddHub?.(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover a base / HUB "${name}"?`)) {
      onDeleteHub?.(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in my-6">
      {/* Top Banner & Title */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <Building2 size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Hubs & Bases Operacionais</h2>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {hubs.length} {hubs.length === 1 ? 'Base' : 'Bases'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cadastro e gestão de centros de triagem, pontos de partida, retorno e cálculo de raio de despacho
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Cadastrar Novo Hub</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar base por nome, código, cidade, CEP ou responsável..."
          className="w-full text-xs sm:text-sm bg-transparent border-none focus:outline-none text-slate-800 placeholder:text-slate-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Hubs Cards Grid */}
      {filteredHubs.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <Building2 size={40} className="mx-auto text-slate-300" />
          <h4 className="font-bold text-slate-700">Nenhum Hub encontrado</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm 
              ? 'Nenhum centro de distribuição corresponde aos filtros pesquisados.' 
              : 'Cadastre sua primeira base operacional ou centro de distribuição para iniciar as rotas.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
          >
            <Plus size={14} />
            <span>Adicionar Base Hub</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHubs.map(hub => {
            const isSelectedActive = hub.isActive;
            const hubColor = hub.color || '#f59e0b';

            return (
              <div 
                key={hub.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 space-y-4 relative flex flex-col justify-between overflow-hidden group"
              >
                {/* Top decorative stripe */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5 transition-all"
                  style={{ backgroundColor: hubColor }}
                />

                <div className="space-y-3 pt-1">
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-slate-800 group-hover:text-emerald-700 transition-colors">
                          {hub.name}
                        </h3>
                        {hub.code && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                            {hub.code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span>{hub.city || 'São Paulo'} - {hub.state || 'SP'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => onSetActiveHub?.(hub.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 cursor-pointer transition-all ${
                        isSelectedActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' 
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={isSelectedActive ? 'Base padrão de despacho ativa' : 'Clique para definir como Base Padrão'}
                    >
                      {isSelectedActive ? <CheckCircle2 size={12} className="text-emerald-600" /> : <XCircle size={12} />}
                      <span>{isSelectedActive ? 'Base Padrão' : 'Secundária'}</span>
                    </button>
                  </div>

                  {/* Address box */}
                  <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/70 text-xs space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Endereço Completo:</span>
                      <p className="text-slate-700 font-medium line-clamp-2 mt-0.5">
                        {hub.address}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500 font-mono">
                      <span>CEP: {hub.cep || '00000-000'}</span>
                      <span className="text-slate-400">
                        {hub.latitude?.toFixed(4)}, {hub.longitude?.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Routing Rules & Radius */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Raio Operacional</span>
                      <span className="font-extrabold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Compass size={13} className="text-emerald-600" />
                        {hub.coverageRadiusKm || 15} km
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Retorno Rota</span>
                      <span className="font-extrabold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                        <Target size={13} className="text-blue-600 shrink-0" />
                        {hub.endRoutingType === 'hub' ? 'Voltar ao Hub' : hub.endRoutingType === 'manual' ? 'End. Manual' : 'Última Entrega'}
                      </span>
                    </div>
                  </div>

                  {/* Contact / Manager */}
                  {(hub.managerName || hub.contactPhone || hub.contactEmail) && (
                    <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                      {hub.managerName && (
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-slate-400" />
                          <span>Gerente: <strong className="text-slate-700">{hub.managerName}</strong></span>
                        </div>
                      )}
                      {hub.contactPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{hub.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${hub.latitude},${hub.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    <span>Ver no Mapa</span>
                  </a>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(hub)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Editar dados da base"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(hub.id, hub.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Excluir base"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Sticky Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {editingHub ? 'Editar Base Hub' : 'Novo Centro de Distribuição / Hub'}
                  </h3>
                  <p className="text-xs text-slate-500">Configuração de coordenadas, CEP e raios</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome da Base / Hub *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Hub Central Vila Leopoldina"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código de Identificação
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Ex: HUB-SP-01"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* CEP Lookup */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>CEP *</span>
                      {isLoadingCep && <span className="text-[10px] text-blue-600 font-bold">Buscando...</span>}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.cep}
                      onChange={(e) => {
                        setFormData({ ...formData, cep: e.target.value });
                        if (e.target.value.replace(/\D/g, '').length === 8) {
                          handleCepLookup(e.target.value);
                        }
                      }}
                      placeholder="00000-000"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Endereço / Logradouro Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Ex: Rua Cerro Corá, 385 - Vila Romana"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {cepError && (
                  <p className="text-[11px] text-rose-500 font-bold">{cepError}</p>
                )}

                {/* City and State */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      UF / Estado
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                {/* Coordinates & Radius */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Latitude GPS
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Longitude GPS
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Raio de Cobertura (KM)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.coverageRadiusKm}
                      onChange={(e) => setFormData({ ...formData, coverageRadiusKm: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                </div>

                {/* End Routing Strategy */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ponto de Conclusão / Retorno da Rota
                  </label>
                  <select
                    value={formData.endRoutingType}
                    onChange={(e: any) => setFormData({ ...formData, endRoutingType: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                  >
                    <option value="hub">Retornar obrigatoriamente a este Hub Central</option>
                    <option value="farthest">Finalizar na entrega mais distante (Sem retorno)</option>
                    <option value="manual">Definir endereço manual específico de término</option>
                  </select>
                </div>

                {formData.endRoutingType === 'manual' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Endereço de Término Manual
                    </label>
                    <input
                      type="text"
                      value={formData.manualEndAddress}
                      onChange={(e) => setFormData({ ...formData, manualEndAddress: e.target.value })}
                      placeholder="Ex: Garagem Central / Av. Brasil, 500"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                {/* Manager & Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Responsável
                    </label>
                    <input
                      type="text"
                      value={formData.managerName}
                      onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                      placeholder="Ex: Carlos Silva"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefone de Contato
                    </label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cor de Identificação
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-10 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer with Save Button Always Visible */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>{editingHub ? 'Salvar Alterações' : 'Cadastrar Hub'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubsTab;
