import React, { useState, useEffect, useRef } from 'react';
import { X, Package, MapPin, Search, CheckCircle2, Loader2, AlertCircle, Building, Sparkles, Phone, Mail, Hash } from 'lucide-react';
import { PartnerClient, Order } from '../types';
import { fetchAddressByCep, searchCepByAddress, formatCep, cleanCepDigits, AddressIndexResult } from '../utils/cepUtils';

interface NewOrderModalProps {
  onClose: () => void;
  onAddOrder?: (order: Partial<Order>) => void;
  partnerClients?: PartnerClient[];
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  onClose,
  onAddOrder,
  partnerClients = []
}) => {
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [uf, setUf] = useState('SP');
  const [cep, setCep] = useState('');
  const [region, setRegion] = useState('Centro-Paulista');
  const [value, setValue] = useState('150.00');
  const [codigoCliente, setCodigoCliente] = useState(partnerClients[0]?.codigoCliente || 'CLI-001');

  // Indexing and feedback states
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressIndexResult[]>([]);
  const [indexFeedback, setIndexFeedback] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const addressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const numeroInputRef = useRef<HTMLInputElement | null>(null);

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (indexFeedback) {
      const t = setTimeout(() => setIndexFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [indexFeedback]);

  // Phone input mask / format handler
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      setTelefone(digits);
    } else if (digits.length <= 6) {
      setTelefone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    } else if (digits.length <= 10) {
      setTelefone(`(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`);
    } else {
      setTelefone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
    }
  };

  // 1. CEP -> Address Indexing
  const handleCepChange = (enteredCep: string) => {
    let cleaned = enteredCep.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

    let formatted = cleaned;
    if (cleaned.length > 5) {
      formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    setCep(formatted);

    // If completed 8 digits, auto-index address
    if (cleaned.length === 8) {
      performCepLookup(cleaned);
    }
  };

  const performCepLookup = async (digits: string) => {
    setIsCepLoading(true);
    setIndexFeedback(null);
    try {
      const res = await fetchAddressByCep(digits);
      if (res && !res.erro) {
        let fullStreet = res.logradouro || '';
        if (res.bairro && !fullStreet.toLowerCase().includes(res.bairro.toLowerCase())) {
          fullStreet = fullStreet ? `${fullStreet}, ${res.bairro}` : res.bairro;
        }

        setAddress(fullStreet || res.logradouro || '');
        setBairro(res.bairro || '');
        setCidade(res.cidade || res.localidade || 'São Paulo');
        setUf(res.uf || 'SP');
        if (res.region) setRegion(res.region);
        if (res.complemento && !complemento) setComplemento(res.complemento);

        setIndexFeedback({
          type: 'success',
          text: `Endereço indexado via CEP: ${res.logradouro || 'Logradouro'} - ${res.bairro || ''} (${res.localidade || 'São Paulo'}/${res.uf || 'SP'})`
        });

        // Auto-focus numero input for ultra-fast manual creation
        setTimeout(() => {
          numeroInputRef.current?.focus();
        }, 150);
      } else {
        setIndexFeedback({
          type: 'error',
          text: 'CEP não localizado nas bases dos Correios. Verifique o número digitado.'
        });
      }
    } catch (err) {
      console.warn('Falha na indexação por CEP:', err);
      setIndexFeedback({
        type: 'error',
        text: 'Erro ao consultar base de CEPs.'
      });
    } finally {
      setIsCepLoading(false);
    }
  };

  // 2. Address -> CEP Indexing (Bidirectional)
  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
    setIndexFeedback(null);

    // If user pasted or typed a text containing a CEP (e.g. "Av Paulista, 1000 - CEP 01310-100")
    const cepMatch = newAddress.match(/(?:cep\s*[:.-]?\s*)?(\b\d{5}[-\s]?\d{3}\b|\b\d{8}\b)/i);
    if (cepMatch) {
      const digits = cleanCepDigits(cepMatch[1]);
      if (digits.length === 8) {
        setCep(`${digits.slice(0, 5)}-${digits.slice(5)}`);
        performCepLookup(digits);
        return;
      }
    }

    // Auto-search CEP by address with 600ms debounce when text has at least 4 characters
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (newAddress.trim().length >= 4) {
      addressDebounceRef.current = setTimeout(() => {
        performAddressToCepSearch(newAddress, false);
      }, 700);
    } else {
      setAddressSuggestions([]);
    }
  };

  const performAddressToCepSearch = async (queryText: string, manualClick: boolean = false) => {
    const q = queryText.trim();
    if (q.length < 3) {
      if (manualClick) {
        setIndexFeedback({
          type: 'info',
          text: 'Digite pelo menos o nome da rua ou avenida para buscar o CEP.'
        });
      }
      return;
    }

    setIsAddressSearching(true);
    try {
      const matches = await searchCepByAddress(q, { city: cidade, state: uf });
      if (matches && matches.length > 0) {
        // If exact single match or user clicked explicitly, can pre-fill
        if (matches.length === 1) {
          applyAddressMatch(matches[0]);
          setAddressSuggestions([]);
          setIndexFeedback({
            type: 'success',
            text: `CEP indexado com sucesso: ${matches[0].cep} (${matches[0].logradouro}, ${matches[0].bairro})`
          });
        } else {
          // Multiple candidate CEPs (e.g. long avenues with multiple sections)
          setAddressSuggestions(matches);
          setIndexFeedback({
            type: 'info',
            text: `Encontrados ${matches.length} CEPs para este logradouro. Clique na sugestão desejada abaixo.`
          });
        }
      } else if (manualClick) {
        setAddressSuggestions([]);
        setIndexFeedback({
          type: 'error',
          text: 'Nenhum CEP encontrado para o endereço informado. Tente especificar rua e bairro.'
        });
      }
    } catch (err) {
      console.warn('Falha na indexação endereço -> CEP:', err);
    } finally {
      setIsAddressSearching(false);
    }
  };

  const applyAddressMatch = (item: AddressIndexResult) => {
    setCep(item.cep);
    if (item.logradouro) {
      setAddress(item.logradouro);
    }
    if (item.bairro) setBairro(item.bairro);
    if (item.cidade || item.localidade) setCidade(item.cidade || item.localidade);
    if (item.uf) setUf(item.uf);
    if (item.region) setRegion(item.region);
    if (item.complemento && !complemento) setComplemento(item.complemento);
    setAddressSuggestions([]);

    setTimeout(() => {
      numeroInputRef.current?.focus();
    }, 150);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !address.trim()) return;

    const cleanNum = numero.trim();
    const cleanCompl = complemento.trim();
    let finalAddress = address.trim();
    if (cleanNum && !finalAddress.includes(cleanNum)) {
      finalAddress = `${finalAddress}, ${cleanNum}`;
    }
    if (cleanCompl && !finalAddress.toLowerCase().includes(cleanCompl.toLowerCase())) {
      finalAddress = `${finalAddress} - ${cleanCompl}`;
    }

    onAddOrder?.({
      id: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName.trim(),
      procurarPor: customerName.trim(),
      address: finalAddress,
      numero: cleanNum || undefined,
      complemento: cleanCompl || undefined,
      telefone: telefone.trim() || undefined,
      phone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      bairro: bairro.trim() || undefined,
      cidadeMunicipio: cidade || 'São Paulo',
      cidade: cidade || 'São Paulo',
      estado: uf || 'SP',
      uf: uf || 'SP',
      cep: cep.trim(),
      region,
      value: parseFloat(value) || 0,
      status: 'pending',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      codigoCliente
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[94vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden my-auto animate-scale-up">
        {/* Sticky Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Registrar Novo Pedido</h3>
                <span className="text-[10px] bg-blue-500/30 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/30 flex items-center gap-1">
                  <Sparkles size={10} /> Indexação Bidirecional de CEP
                </span>
              </div>
              <p className="text-xs text-slate-400">Preenchimento automático inteligente entre CEP e Endereço</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Status Feedback Alert */}
        {indexFeedback && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 border-b animate-in fade-in slide-in-from-top-1 ${
            indexFeedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : indexFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {indexFeedback.type === 'success' ? (
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-blue-600 shrink-0" />
              )}
              <span>{indexFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setIndexFeedback(null)}
              className="text-slate-400 hover:text-slate-700 text-xs px-1.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cliente Parceiro</label>
              <select
                value={codigoCliente}
                onChange={(e) => setCodigoCliente(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
              >
                {partnerClients.map(p => (
                  <option key={p.id} value={p.codigoCliente || p.id}>{p.name} ({p.codigoCliente || p.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Cliente / Destinatário *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Farmácia Droga Raia - Unidade Paulista"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-medium"
              />
            </div>

            {/* Contato do Cliente: Telefone e Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-600" />
                  <span>Telefone / WhatsApp</span>
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-emerald-500 font-mono font-medium text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Usado para ligar ou enviar WhatsApp no app do condutor</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail size={13} className="text-blue-600" />
                  <span>E-mail de Notificação</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@empresa.com"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 text-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Para rastreio e envio de comprovantes digitais</span>
              </div>
            </div>

            {/* CEP and Region Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">CEP de Destino</label>
                  {isCepLoading && (
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 animate-pulse">
                      <Loader2 size={10} className="animate-spin" /> Buscando endereço...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="01310-100"
                    maxLength={9}
                    className="w-full px-3.5 py-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-mono font-bold"
                  />
                  <button
                    type="button"
                    title="Buscar endereço por este CEP"
                    onClick={() => performCepLookup(cleanCepDigits(cep))}
                    disabled={cleanCepDigits(cep).length !== 8 || isCepLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Search size={14} />
                  </button>
                </div>
                <span className="text-[10px] text-slate-650 mt-0.5 block">Digite o CEP para auto-completar rua, bairro e cidade</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Região Operacional</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-semibold"
                >
                  <option value="Centro-Paulista">Centro-Paulista</option>
                  <option value="Zona Sul">Zona Sul</option>
                  <option value="Zona Oeste">Zona Oeste</option>
                  <option value="Zona Norte">Zona Norte</option>
                  <option value="Zona Leste">Zona Leste</option>
                  <option value="Grande SP (Oeste)">Grande SP (Oeste)</option>
                  <option value="Grande SP (Norte)">Grande SP (Norte)</option>
                  <option value="Grande SP (Leste)">Grande SP (Leste)</option>
                  <option value="Grande SP (ABC)">Grande SP (ABC)</option>
                  <option value="Interior / Litoral SP">Interior / Litoral SP</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            {/* Address Field with Bidirectional CEP Lookup */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Endereço (Rua / Avenida / Logradouro) *</label>
                <div className="flex items-center gap-2">
                  {isAddressSearching && (
                    <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 animate-pulse">
                      <Loader2 size={10} className="animate-spin" /> Indexando CEP...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => performAddressToCepSearch(address, true)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Search size={10} /> Buscar CEP pelo endereço
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Ex: Av. Paulista ou Rua Augusta"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
                {isAddressSearching ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => performAddressToCepSearch(address, true)}
                    title="Indexar CEP a partir deste endereço"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    <MapPin size={14} />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-650 mt-0.5 block">Digite o nome da rua para sugerir e indexar o CEP automaticamente</span>

              {/* Suggestions Dropdown when multiple CEPs match the address - Formato Menor e Compacto */}
              {addressSuggestions.length > 0 && (
                <div className="mt-1.5 bg-white border border-blue-200/90 rounded-xl p-1.5 shadow-md max-h-36 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95">
                  <div className="text-[9px] font-bold text-slate-500 uppercase px-1.5 py-0.5 flex items-center justify-between border-b border-slate-100 pb-1 mb-0.5">
                    <span className="flex items-center gap-1 text-blue-600">
                      <Sparkles size={10} />
                      Sugestões de CEP encontradas ({addressSuggestions.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddressSuggestions([])}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="Fechar sugestões"
                    >
                      ✕
                    </button>
                  </div>
                  {addressSuggestions.map((item, idx) => (
                    <button
                      key={`${item.cleanCep}-${idx}`}
                      type="button"
                      onClick={() => applyAddressMatch(item)}
                      className="w-full text-left px-2 py-1 hover:bg-blue-50/80 rounded-lg transition-colors flex items-center justify-between gap-2 text-xs group cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-[11px] group-hover:text-blue-700 truncate leading-tight">
                          {item.logradouro} {item.complemento ? `(${item.complemento})` : ''}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate leading-tight">
                          {item.bairro} - {item.cidade}/{item.uf} • {item.region}
                        </div>
                      </div>
                      <div className="shrink-0 px-1.5 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-[10px] rounded border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {item.cep}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Número e Complemento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Hash size={12} className="text-blue-600" />
                  <span>Número *</span>
                </label>
                <input
                  ref={numeroInputRef}
                  type="text"
                  required
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 1234 ou S/N"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Complemento / Referência</label>
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Ex: Apto 102, Bloco C, Fundos"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
              </div>
            </div>

            {/* City, State and Neighborhood Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Bela Vista"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  maxLength={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valor Declarado (R$)</label>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800 font-bold"
              />
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-650 flex items-center gap-1">
              <Sparkles size={12} className="text-blue-500" />
              Indexação de endereço e CEP ativa
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Salvar Pedido</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewOrderModal;
