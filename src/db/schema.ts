import { pgTable, text, integer, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  cliente: text("cliente"),
  customerName: text("customerName"),
  address: text("address"),
  value: real("value"),
  status: text("status"),
  statusText: text("statusText"),
  dataSolicitacao: text("dataSolicitacao"),
  dataFinalizacao: text("dataFinalizacao"),
  region: text("region"),
  courierId: text("courierId"),
  courierName: text("courierName"),
  volume: text("volume"),
  weight: real("weight"),
  observacao: text("observacao"),
  sequencia: text("sequencia"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  uf: text("uf"),
  cep: text("cep"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  tipoServico: text("tipoServico"),
  comprovanteUrl: text("comprovanteUrl"),
  notaFiscal: text("notaFiscal"),
  valorCondutor: real("valorCondutor"),
  history: jsonb("history"),
  time: text("time"),
  codigoCliente: text("codigoCliente"),
  createdAt: text("createdAt"),
  pedido: text("pedido"),
  procurarPor: text("procurarPor"),
  telefone: text("telefone"),
  detalhe: text("detalhe"),
  email: text("email"),
  numero: text("numero"),
  complemento: text("complemento"),
  dispositivoCondutor: text("dispositivoCondutor"),
  horarioFinal: text("horarioFinal"),
  documentoEmpresa: text("documentoEmpresa"),
  tipoEntrega: text("tipoEntrega"),
  prioridade: text("prioridade"),
  chamado: text("chamado"),
  danfe: text("danfe"),
  dataLimite: text("dataLimite"),
  nomeFantasia: text("nomeFantasia"),
  horarioInicio: text("horarioInicio"),
  dataAgendamento: text("dataAgendamento"),
  cidadeMunicipio: text("cidadeMunicipio"),
  estado: text("estado"),
  valorNotaFiscal: real("valorNotaFiscal"),
  valorReceber: real("valorReceber"),
  valorEntrega: real("valorEntrega"),
  destinatarioCnpjCpf: text("destinatarioCnpjCpf"),
  isImported: boolean("isImported"),
  statusSincronizado: text("statusSincronizado"),
  status_sincronizado: text("status_sincronizado"),
  deliveryProtocol: text("deliveryProtocol"),
  proofPhotoUrl: text("proofPhotoUrl"),
  signatureDataUrl: text("signatureDataUrl"),
  receiverName: text("receiverName"),
  receiverDoc: text("receiverDoc"),
  deliveredAt: text("deliveredAt"),
  version: integer("version"),
  versionTimestamp: real("versionTimestamp"),
  updatedAt: real("updatedAt"),
  allocatedDate: text("allocatedDate"),
  isDeleted: boolean("isDeleted"),
  created_at: timestamp("created_at").defaultNow()
});

export const couriers = pgTable("couriers", {
  id: text("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  vehicle: text("vehicle"),
  plate: text("plate"),
  region: text("region"),
  status: text("status"),
  avatar: text("avatar"),
  ordersCompleted: integer("ordersCompleted"),
  rating: real("rating"),
  currentLat: real("currentLat"),
  currentLng: real("currentLng"),
  angle: real("angle"),
  password: text("password"),
  isActive: boolean("isActive"),
  repasseTaxa: real("repasseTaxa"),
  repasseFormato: text("repasseFormato"),
  repassePorcentagem: real("repassePorcentagem"),
  showDeliveryFee: boolean("showDeliveryFee"),
  activeSessionToken: text("activeSessionToken"),
  activeDeviceId: text("activeDeviceId"),
  lastLoginAt: text("lastLoginAt"),
  lastLoginDevice: text("lastLoginDevice"),
  created_at: timestamp("created_at").defaultNow()
});

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  type: text("type"),
  message: text("message"),
  time: text("time"),
  timestamp: text("timestamp"),
  courierName: text("courierName"),
  orderId: text("orderId"),
  user: text("user"),
  details: text("details"),
  created_at: timestamp("created_at").defaultNow()
});

export const hubs = pgTable("hubs", {
  id: text("id").primaryKey(),
  name: text("name"),
  address: text("address"),
  cep: text("cep"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  isActive: boolean("isActive").default(true),
  endRoutingType: text("endRoutingType"),
  manualEndAddress: text("manualEndAddress"),
  created_at: timestamp("created_at").defaultNow()
});

export const hubCentrals = hubs;

export const operators = pgTable("operators", {
  id: text("id").primaryKey(),
  name: text("name"),
  login: text("login"),
  email: text("email"),
  password: text("password"),
  permissions: jsonb("permissions"),
  role: text("role"),
  canConsult: boolean("canConsult"),
  canAlter: boolean("canAlter"),
  canCreate: boolean("canCreate"),
  created_at: timestamp("created_at").defaultNow()
});

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  cnpjCpf: text("cnpjCpf"),
  codigoCliente: text("codigoCliente"),
  createdAt: text("createdAt"),
  isActive: boolean("isActive"),
  cepSpreadsheetUrl: text("cepSpreadsheetUrl"),
  created_at: timestamp("created_at").defaultNow()
});

export const partnerClients = partners;

export const financeTransactions = pgTable("finance_transactions", {
  id: text("id").primaryKey(),
  description: text("description"),
  type: text("type"),
  amount: real("amount"),
  date: text("date"),
  category: text("category"),
  status: text("status"),
  paymentMethod: text("paymentMethod"),
  expenseNature: text("expenseNature"),
  isRecurring: boolean("isRecurring"),
  recurrentGroupId: text("recurrentGroupId"),
  installmentNumber: integer("installmentNumber"),
  totalInstallments: integer("totalInstallments"),
  created_at: timestamp("created_at").defaultNow()
});

export const freightRules = pgTable("freight_rules", {
  id: text("id").primaryKey(),
  partnerId: text("partnerId"),
  codigoCliente: text("codigoCliente"),
  cepMin: text("cepMin"),
  cepMax: text("cepMax"),
  value: real("value"),
  valorRepasse: real("valorRepasse"),
  prioridade: real("prioridade"),
  regiao: text("regiao"),
  prazoDias: integer("prazoDias"),
  pesoMaximo: real("pesoMaximo"),
  description: text("description"),
  observacao: text("observacao"),
  lastUpdated: text("lastUpdated"),
  lastUpdatedBy: text("lastUpdatedBy"),
  created_at: timestamp("created_at").defaultNow()
});

export const freightImportHistory = pgTable("freight_import_history", {
  id: text("id").primaryKey(),
  partnerId: text("partnerId"),
  partnerName: text("partnerName"),
  importedAt: text("importedAt"),
  fileName: text("fileName"),
  rulesCount: integer("rulesCount"),
  mode: text("mode"),
  status: text("status"),
  details: text("details"),
  importedBy: text("importedBy"),
  created_at: timestamp("created_at").defaultNow()
});

export const diaryEntries = pgTable("diary_entries", {
  id: text("id").primaryKey(),
  title: text("title"),
  content: text("content"),
  category: text("category"),
  color: text("color"),
  authorId: text("authorId"),
  authorName: text("authorName"),
  isPinned: boolean("isPinned"),
  tags: jsonb("tags"),
  createdAt: text("createdAt"),
  updatedAt: text("updatedAt")
});

export const appBranding = pgTable("app_branding", {
  id: text("id").primaryKey(),
  appName: text("appName"),
  appSubtitle: text("appSubtitle"),
  logoUrl: text("logoUrl"),
  logoIconType: text("logoIconType"),
  primaryColor: text("primaryColor"),
  secondaryColor: text("secondaryColor"),
  updated_at: timestamp("updated_at").defaultNow()
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  courierId: text("courierId"),
  subscription: jsonb("subscription"),
  created_at: timestamp("created_at").defaultNow()
});


