CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"message" text,
	"time" text,
	"timestamp" text,
	"courierName" text,
	"orderId" text,
	"user" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_branding" (
	"id" text PRIMARY KEY NOT NULL,
	"appName" text,
	"appSubtitle" text,
	"logoUrl" text,
	"logoIconType" text,
	"primaryColor" text,
	"secondaryColor" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"vehicle" text,
	"plate" text,
	"region" text,
	"status" text,
	"avatar" text,
	"ordersCompleted" integer,
	"rating" real,
	"currentLat" real,
	"currentLng" real,
	"angle" real,
	"password" text,
	"isActive" boolean,
	"repasseTaxa" real,
	"repasseFormato" text,
	"repassePorcentagem" real,
	"showDeliveryFee" boolean,
	"activeSessionToken" text,
	"activeDeviceId" text,
	"lastLoginAt" text,
	"lastLoginDevice" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"category" text,
	"color" text,
	"authorId" text,
	"authorName" text,
	"isPinned" boolean,
	"tags" jsonb,
	"createdAt" text,
	"updatedAt" text
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text,
	"type" text,
	"amount" real,
	"date" text,
	"category" text,
	"status" text,
	"paymentMethod" text,
	"expenseNature" text,
	"isRecurring" boolean,
	"recurrentGroupId" text,
	"installmentNumber" integer,
	"totalInstallments" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freight_import_history" (
	"id" text PRIMARY KEY NOT NULL,
	"partnerId" text,
	"partnerName" text,
	"importedAt" text,
	"fileName" text,
	"rulesCount" integer,
	"mode" text,
	"status" text,
	"details" text,
	"importedBy" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freight_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"partnerId" text,
	"codigoCliente" text,
	"cepMin" text,
	"cepMax" text,
	"value" real,
	"valorRepasse" real,
	"prioridade" real,
	"regiao" text,
	"prazoDias" integer,
	"pesoMaximo" real,
	"description" text,
	"observacao" text,
	"lastUpdated" text,
	"lastUpdatedBy" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hubs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"address" text,
	"cep" text,
	"latitude" real,
	"longitude" real,
	"isActive" boolean DEFAULT true,
	"endRoutingType" text,
	"manualEndAddress" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"login" text,
	"email" text,
	"password" text,
	"permissions" jsonb,
	"role" text,
	"canConsult" boolean,
	"canAlter" boolean,
	"canCreate" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"cliente" text,
	"customerName" text,
	"address" text,
	"value" real,
	"status" text,
	"statusText" text,
	"dataSolicitacao" text,
	"dataFinalizacao" text,
	"region" text,
	"courierId" text,
	"courierName" text,
	"volume" text,
	"weight" real,
	"observacao" text,
	"sequencia" text,
	"bairro" text,
	"cidade" text,
	"uf" text,
	"cep" text,
	"latitude" real,
	"longitude" real,
	"tipoServico" text,
	"comprovanteUrl" text,
	"notaFiscal" text,
	"valorCondutor" real,
	"history" jsonb,
	"time" text,
	"codigoCliente" text,
	"createdAt" text,
	"pedido" text,
	"procurarPor" text,
	"telefone" text,
	"detalhe" text,
	"email" text,
	"complemento" text,
	"dispositivoCondutor" text,
	"horarioFinal" text,
	"documentoEmpresa" text,
	"tipoEntrega" text,
	"prioridade" text,
	"chamado" text,
	"danfe" text,
	"dataLimite" text,
	"nomeFantasia" text,
	"horarioInicio" text,
	"dataAgendamento" text,
	"cidadeMunicipio" text,
	"estado" text,
	"valorNotaFiscal" real,
	"valorReceber" real,
	"valorEntrega" real,
	"destinatarioCnpjCpf" text,
	"isImported" boolean,
	"statusSincronizado" text,
	"status_sincronizado" text,
	"deliveryProtocol" text,
	"proofPhotoUrl" text,
	"signatureDataUrl" text,
	"receiverName" text,
	"receiverDoc" text,
	"deliveredAt" text,
	"version" integer,
	"versionTimestamp" real,
	"updatedAt" real,
	"allocatedDate" text,
	"isDeleted" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"cnpjCpf" text,
	"codigoCliente" text,
	"createdAt" text,
	"isActive" boolean,
	"cepSpreadsheetUrl" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"courierId" text,
	"subscription" jsonb,
	"created_at" timestamp DEFAULT now()
);
