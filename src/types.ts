export interface Courier {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'busy' | 'offline';
  rating: number;
  vehicle: 'motorcycle' | 'bicycle' | 'car' | 'van';
  ordersCompleted: number;
  currentLat: number; // For map visualization (scaled coordinates 0 to 100)
  currentLng: number;
  angle?: number;
  phone: string;
  email?: string;
  password?: string; // Numeric password for login
  isActive?: boolean;
  allowPeriodHistory?: boolean;
  repasseTaxa?: number;
  repasseFormato?: 'tabela_cep' | 'fixo' | 'porcentagem';
  repassePorcentagem?: number;
  showDeliveryFee?: boolean;
  region?: string;
  plate?: string;
  activeSessionToken?: string;
  activeDeviceId?: string;
  lastLoginAt?: string;
  lastLoginDevice?: string;
}

export interface PartnerClient {
  id: string; // System-generated sequential ID (e.g., CLI-001)
  name: string; // Full client name
  codigoCliente?: string; // Explicit partner client code (e.g., CLI-001, CL001, 1002) linked to CEP table
  phone?: string;
  email?: string;
  cnpjCpf?: string;
  createdAt: string;
  isActive?: boolean;
  cepSpreadsheetUrl?: string;
}

export type OrderStatus = 'pending' | 'in_progress' | 'in_route' | 'failure' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customerName: string;
  address: string;
  courierId?: string;
  status: OrderStatus;
  isDeleted?: boolean;
  deleted?: boolean;
  value: number;
  time: string;
  region: string;
  
  // 30 spreadsheets columns/associated fields for advanced tracking
  sequencia?: string;
  codigoCliente?: string;      // * Required
  dataSolicitacao?: string;    // * Required
  pedido?: string;
  procurarPor?: string;        // * Required
  cep?: string;                // * Required
  telefone?: string;
  detalhe?: string;
  email?: string;
  numero?: string;
  complemento?: string;
  dispositivoCondutor?: string;
  horarioFinal?: string;
  documentoEmpresa?: string;
  tipoEntrega?: string;
  prioridade?: string;
  priority?: string;
  notes?: string;
  chamado?: string;
  danfe?: string;
  dataLimite?: string;
  nomeFantasia?: string;
  horarioInicio?: string;
  dataAgendamento?: string;
  cidadeMunicipio?: string;
  estado?: string;
  valorNotaFiscal?: number;
  valorReceber?: number;
  valorEntrega?: number;
  latitude?: number;
  longitude?: number;
  destinatarioCnpjCpf?: string;
  valorCondutor?: number;
  cliente?: string;
  volume?: string;
  statusText?: string;
  weight?: number;
  observacao?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  tipoServico?: string;
  courierName?: string;
  allocatedCourierName?: string;
  nomeCondutor?: string;
  isImported?: boolean;
  statusSincronizado?: string;
  status_sincronizado?: string;
  allocatedDate?: string;
  createdAt?: string;
  documento?: string;
  phone?: string;
  versionTimestamp?: number;
  updatedAt?: number;
  version?: number;
  statusUpdatedAt?: number;
  deliveryProtocol?: {
    signedName: string;
    signedDoc: string;
    signatureData: string;
    signedAt: string;
    photoUrl?: string;
    notes?: string;
    isUpdated?: boolean;
    updatedAt?: string;
    includeFinancialValues?: boolean;
  };
  proofPhotoUrl?: string;
  signatureDataUrl?: string;
  receiverName?: string;
  receiverDoc?: string;
  deliveredAt?: string;
  history?: {
    id: string;
    time: string;
    status: string;
    note: string;
    user?: string;
  }[];
}

export interface Activity {
  id: string;
  time: string;
  timestamp?: string;
  type: 'order_created' | 'order_assigned' | 'order_delivered' | 'courier_status' | 'alert' | 'github_push' | 'github_pull_request';
  message: string;
  details?: string;
  courierName?: string;
  orderId?: string;
  user?: string;
}

export interface KPI {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  iconName: string;
}

export interface RegionDistribution {
  name: string;
  orders: number;
  percentage: number;
  color: string;
}

export interface HourlyStat {
  hour: string;
  created: number;
  delivered: number;
}

export interface Operator {
  id: string;
  name: string;
  login: string;
  phone?: string;
  password?: string;
  permissions: string[] | string; // List of tab IDs like ['dashboard', 'orders'] or "all"
  role?: string;
  canConsult?: boolean;
  canAlter?: boolean;
  canCreate?: boolean;
}

// Resilient helper to match client codes across different systems and imports
// e.g. "CLI-005" matches "CL-005", "cl005", "5", etc.
export const matchClientCode = (partner: string | any, orderCode?: string): boolean => {
  if (!orderCode) return false;
  const cleanOrder = orderCode.trim().toLowerCase();
  
  let partnerId = "";
  let partnerName = "";
  let partnerCnpj = "";
  let partnerCodigoCliente = "";
  
  if (partner && typeof partner === 'object') {
    partnerId = partner.id || "";
    partnerName = partner.name || "";
    partnerCnpj = partner.cnpjCpf || "";
    partnerCodigoCliente = partner.codigoCliente || "";
  } else {
    partnerId = String(partner || "");
  }
  
  const cleanPartnerId = partnerId.trim().toLowerCase();
  const cleanPartnerCode = partnerCodigoCliente.trim().toLowerCase();
  
  // 1. Direct exact or lowercase match against ID or codigoCliente
  if (cleanOrder === cleanPartnerId || (cleanPartnerCode && cleanOrder === cleanPartnerCode)) return true;
  
  // 2. Extra spaces or dash variations (e.g., CLI005 vs CLI-005 vs CL005)
  const normOrder = cleanOrder.replace(/[^a-z0-9]/g, '');
  const normPartnerId = cleanPartnerId.replace(/[^a-z0-9]/g, '');
  const normPartnerCode = cleanPartnerCode.replace(/[^a-z0-9]/g, '');
  if (normOrder === normPartnerId || (normPartnerCode && normOrder === normPartnerCode)) return true;

  // 3. Match by CNPJ/CPF (removing non-digits)
  if (partnerCnpj) {
    const cleanCnpj = partnerCnpj.replace(/\D/g, '');
    const cleanOrderDigits = orderCode.replace(/\D/g, '');
    if (cleanCnpj && cleanOrderDigits && cleanCnpj === cleanOrderDigits) {
      return true;
    }
  }

  // 4. Match by Name (normalized)
  if (partnerName) {
    const normName = partnerName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normOrder === normName) return true;
    
    // Substring checks for robustness (e.g., "ESTACAO DOS GRAOS" vs "ESTACAO DOS GRAOS ")
    if (normOrder.length > 3 && normName.length > 3) {
      if (normName.includes(normOrder) || normOrder.includes(normName)) {
        return true;
      }
    }
  }

  // 5. Prefix mismatch check: "CLI-NNN" vs "CL-NNN" vs "NNN"
  const getDigits = (str: string) => str.replace(/\D/g, '');
  const orderDigits = getDigits(cleanOrder);
  const partnerDigits = getDigits(cleanPartnerId) || (cleanPartnerCode ? getDigits(cleanPartnerCode) : '');
  
  if (orderDigits && partnerDigits && parseInt(orderDigits, 10) === parseInt(partnerDigits, 10)) {
    const isOrderCL = cleanOrder.startsWith('c') || cleanOrder.startsWith('cli') || !isNaN(Number(cleanOrder));
    const isPartnerCL = cleanPartnerId.startsWith('c') || cleanPartnerId.startsWith('cli') || (cleanPartnerCode && (cleanPartnerCode.startsWith('c') || cleanPartnerCode.startsWith('cli')));
    if (isOrderCL && isPartnerCL) {
      return true;
    }
  }
  
  return false;
};

export interface HubCentral {
  id: string;
  name: string;
  code?: string;
  address: string;
  city?: string;
  state?: string;
  cep: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  coverageRadiusKm?: number;
  managerName?: string;
  contactPhone?: string;
  contactEmail?: string;
  color?: string;
  endRoutingType: 'farthest' | 'manual' | 'hub'; // last delivery (farthest), manual address input, or back to starting hub
  manualEndAddress?: string;
  notes?: string;
}

export interface AppBranding {
  appName: string;
  appSubtitle?: string;
  logoUrl?: string; // Base64 data URL or external URL
  logoIconType?: 'truck' | 'building' | 'navigation' | 'box' | 'map' | 'shield';
  primaryColor?: string; // Brand primary color
  secondaryColor?: string;
}

export interface FinanceTransaction {
  id: string;
  description: string;
  type: 'receivable' | 'payable';
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  status: 'pending' | 'paid';
  paymentMethod?: string;
  expenseNature?: 'fixed' | 'variable';
  isRecurring?: boolean;
  recurrentGroupId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  category: 'Ideia' | 'Nota' | 'Tarefa' | 'Lembrete' | 'Outro';
  color?: string; // Hex or tailwind class
  createdAt: string; // ISO datetime
  updatedAt?: string; // ISO datetime
  authorId?: string;
  authorName?: string;
  isPinned?: boolean;
  tags?: string[];
}

export interface FreightRule {
  id: string;
  partnerId: string;
  codigoCliente?: string;
  cepMin: string;
  cepMax: string;
  value: number; // Valor da entrega cobrado do cliente
  valorRepasse?: number; // Valor repassado ao condutor/entregador
  prioridade?: number; // Taxa de entrega expressa / prioritária
  regiao?: string; // e.g. "Centro-Paulista", "Zona Sul", "Grande SP"
  prazoDias?: number; // Prazo estimado em dias úteis
  pesoMaximo?: number; // Peso máximo em kg
  description?: string;
  observacao?: string;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}

export interface FreightImportHistory {
  id: string;
  partnerId: string;
  partnerName: string;
  importedAt: string;
  fileName: string;
  rulesCount: number;
  mode: 'replace' | 'merge';
  status: 'success' | 'warning' | 'error';
  details?: string;
  importedBy?: string;
}

export type HubLocation = HubCentral;
export type OperatorUser = Operator;

export interface FinancialReport {
  id: string;
  type: 'partner' | 'courier';
  targetId: string; // partnerId or courierId
  targetName: string;
  targetDocument?: string; // CNPJ / CPF
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalOrders: number;
  totalFreight: number;
  totalAuxiliary: number; // For partners: valorReceber; for couriers: bonus/ajustes
  totalAmount: number; // Gross for partner; Net to pay for courier
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled';
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}




