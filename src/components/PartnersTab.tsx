import React, { useState } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard, 
  Calendar,
  X,
  Sparkles,
  Users,
  Edit2,
  Trash2,
  Power,
  FileSpreadsheet,
  ExternalLink
} from 'lucide-react';
import { PartnerClient } from '../types';

interface PartnersTabProps {
  partnerClients: PartnerClient[];
  onAddPartner: (partner: Omit<PartnerClient, 'id' | 'createdAt'>) => Promise<any>;
  onUpdatePartner: (id: string, partner: Partial<PartnerClient>) => Promise<any>;
  onDeletePartner: (id: string) => Promise<any>;
  globalSearchTerm?: string;
  onConfigureFreight?: (partnerId: string) => void;
}

export default function PartnersTab({ 
  partnerClients, 
  onAddPartner,
  onUpdatePartner,
  onDeletePartner,
  globalSearchTerm = '',
  onConfigureFreight
}: PartnersTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerClient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [codigoCliente, setCodigoCliente] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [cepSpreadsheetUrl, setCepSpreadsheetUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  // Auto-calculate next sequential ID
  const getNextSequentialId = () => {
    if (partnerClients.length === 0) return 'CLI-001';
    const ids = partnerClients.map(p => {
      const match = p.id.match(/CLI-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const maxIdNum = Math.max(...ids, 0);
    return `CLI-${String(maxIdNum + 1).padStart(3, '0')}`;
  };

  const currentNextId = getNextSequentialId();

  const handleOpenEdit = (partner: PartnerClient) => {
    setEditingPartner(partner);
    setName(partner.name);
    setCodigoCliente(partner.codigoCliente || partner.id);
    setPhone(partner.phone || '');
    setEmail(partner.email || '');
    setCnpjCpf(partner.cnpjCpf || '');
    setCepSpreadsheetUrl(partner.cepSpreadsheetUrl || '');
    setIsActive(partner.isActive !== false);
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingPartner(null);
    setName('');
    setCodigoCliente('');
    setPhone('');
    setEmail('');
    setCnpjCpf('');
    setCepSpreadsheetUrl('');
    setIsActive(true);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o Nome do Cliente Parceiro.');
      return;
    }
    
    try {
      const payload = {
        name,
        codigoCliente: codigoCliente.trim() || undefined,
        phone: phone || undefined,
        email: email || undefined,
        cnpjCpf: cnpjCpf || undefined,
        cepSpreadsheetUrl: cepSpreadsheetUrl || undefined,
        isActive: isActive,
      };

      if (editingPartner) {
        await onUpdatePartner(editingPartner.id, payload);
      } else {
        await onAddPartner(payload);
      }

      // Reset and close
      setName('');
      setCodigoCliente('');
      setPhone('');
      setEmail('');
      setCnpjCpf('');
      setCepSpreadsheetUrl('');
      setIsActive(true);
      setError('');
      setEditingPartner(null);
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cliente parceiro.');
    }
  };

  const activeSearch = searchTerm || globalSearchTerm || '';
  const filteredPartners = partnerClients.filter(p => 
    p.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    p.id.toLowerCase().includes(activeSearch.toLowerCase()) ||
    (p.codigoCliente && p.codigoCliente.toLowerCase().includes(activeSearch.toLowerCase())) ||
    (p.cnpjCpf && p.cnpjCpf.includes(activeSearch))
  );

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Clientes Parceiros</h2>
          <p className="text-xs text-slate-500">Mapeamento de Códigos de Clientes para Sincronização Logística</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Parceiro</span>
        </button>
      </div>

      {/* Grid KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total de Clientes</p>
            <p className="text-xl font-bold text-slate-800">{partnerClients.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Próximo ID do Sistema</p>
            <p className="text-xl font-bold font-mono text-indigo-600">{currentNextId}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Último Integrado</p>
            <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
              {partnerClients.length > 0 ? partnerClients[partnerClients.length - 1].name : 'Nenhum'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Client Table card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Base Sincronizada</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Sincroniza automaticamente a coluna CodigoCliente das planilhas importadas</p>
          </div>

          {/* Search box within tab */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={globalSearchTerm ? `Filtrado por: ${globalSearchTerm}` : "Buscar por ID, Nome, CNPJ..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-750"
            />
            {globalSearchTerm && !searchTerm && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">
                Filtro Global
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-50/50">
                <th className="py-2.5 px-4">Código Interno (ID)</th>
                <th className="py-2.5 px-4">Código do Cliente (CEP)</th>
                <th className="py-2.5 px-4">Nome por Extenso</th>
                <th className="py-2.5 px-4">CNPJ / CPF</th>
                <th className="py-2.5 px-4">Telefone</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Data Cadastro</th>
                <th className="py-2.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum cliente parceiro cadastrado com esses termos.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-55/40 transition-all">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{partner.id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                        <FileSpreadsheet className="h-3 w-3 text-indigo-600" />
                        <span>{partner.codigoCliente || partner.id}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{partner.name}</div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {partner.email && (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {partner.email}
                          </span>
                        )}
                        {partner.cepSpreadsheetUrl && (
                          <a
                            href={partner.cepSpreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold w-fit"
                            title="Abrir planilha externa de CEPs para edição direta"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Planilha Externa de CEPs</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{partner.cnpjCpf || 'Não Informado'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{partner.phone || 'Não Informado'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        partner.isActive !== false 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${partner.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <span>{partner.isActive !== false ? 'Ativo' : 'Inativo'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{partner.createdAt}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onConfigureFreight?.(partner.id)}
                          title="Planilha Atual de CEP (Editar Frete)"
                          className="p-1 px-2.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                        >
                          <FileSpreadsheet className="h-3 w-3" />
                          <span>Planilha CEP</span>
                        </button>
                        <button
                          onClick={async () => {
                            const nextState = partner.isActive === false;
                            try {
                              await onUpdatePartner(partner.id, { isActive: nextState });
                            } catch (err: any) {
                              alert(err.message || 'Erro ao alterar status');
                            }
                          }}
                          title={partner.isActive !== false ? 'Inativar Parceiro' : 'Ativar Parceiro'}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            partner.isActive !== false 
                              ? 'text-amber-500 hover:bg-amber-50' 
                              : 'text-emerald-500 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(partner)}
                          title="Editar"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Excluir permanentemente o cliente ${partner.name}? Isso apagará também suas regras de cálculo de frete.`)) {
                              try {
                                await onDeletePartner(partner.id);
                              } catch (err: any) {
                                alert(err.message || "Erro ao excluir parceiro");
                              }
                            }
                          }}
                          title="Excluir"
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Partner Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto border border-slate-200">
            {/* Sticky Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    {editingPartner ? 'Editar Cliente Parceiro' : 'Novo Cliente Parceiro'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Configuração cadastral e tabela de CEP</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1 custom-scrollbar">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-medium">
                    {error}
                  </div>
                )}

                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 flex justify-between items-center">
                  <span className="font-semibold text-blue-800">
                    {editingPartner ? 'ID do Sistema:' : 'ID Sequencial Gerado:'}
                  </span>
                  <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-xs sm:text-sm">
                    {editingPartner ? editingPartner.id : currentNextId}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 font-semibold">Código do Cliente (Link da Tabela de CEP) *</label>
                  <input
                    type="text"
                    placeholder={`EX: ${editingPartner?.id || currentNextId}`}
                    value={codigoCliente}
                    onChange={(e) => setCodigoCliente(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-indigo-700 font-bold bg-slate-50 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Código de identificação exclusivo para vincular com a tabela de CEP de fretes e arquivos de pedidos.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 font-semibold">Nome por Extenso *</label>
                  <input
                    type="text"
                    required
                    placeholder="EX: Mercado Municipal De Alimentos Ltda"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-750 bg-slate-50 focus:bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-600 font-semibold">Telefone (Contato)</label>
                    <input
                      type="text"
                      placeholder="EX: (11) 99999-5555"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-750 bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-600 font-semibold">Email de Faturamento</label>
                    <input
                      type="email"
                      placeholder="EX: financeiro@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-750 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 font-semibold">CNPJ ou CPF (Controle Bruto)</label>
                  <input
                    type="text"
                    placeholder="EX: 12.345.678/0001-99"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-750 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-600 font-semibold">Link da Planilha de CEPs (Google Sheets, OneDrive, etc.)</label>
                  <input
                    type="url"
                    placeholder="EX: https://docs.google.com/spreadsheets/d/..."
                    value={cepSpreadsheetUrl}
                    onChange={(e) => setCepSpreadsheetUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-750 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2.5 py-2.5 px-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="partner-is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="partner-is-active" className="text-xs text-slate-700 font-semibold select-none cursor-pointer">
                    Cliente Parceiro Ativo (Habilitar Sincronização)
                  </label>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl cursor-pointer text-xs shadow-md shadow-blue-600/20"
                >
                  {editingPartner ? 'Salvar Alterações' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
