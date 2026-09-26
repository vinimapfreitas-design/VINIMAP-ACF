-- ==============================================================================
-- MIGRAÇÃO SUPABASE: 0001_initial_schema.sql
-- Projeto: ViniMap Logística & Fleet
-- Descrição: Criação das tabelas centrais do sistema com tipos e restrições
-- ==============================================================================

-- Habilita extensões úteis do PostgreSQL se não existirem
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA: activities (Feed de Atividades e Logs Operacionais)
CREATE TABLE IF NOT EXISTS "activities" (
  "id" text PRIMARY KEY NOT NULL,
  "time" text NOT NULL,
  "timestamp" text,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "details" text,
  "courier_name" text,
  "order_id" text,
  "user" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 2. TABELA: couriers (Condutores, Motoristas e Motoboys)
CREATE TABLE IF NOT EXISTS "couriers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "avatar" text NOT NULL,
  "status" text DEFAULT 'offline' NOT NULL,
  "rating" real DEFAULT 5.0 NOT NULL,
  "vehicle" text DEFAULT 'motorcycle' NOT NULL,
  "orders_completed" integer DEFAULT 0 NOT NULL,
  "current_lat" real DEFAULT -23.55052 NOT NULL,
  "current_lng" real DEFAULT -46.633308 NOT NULL,
  "angle" real DEFAULT 0,
  "phone" text NOT NULL,
  "email" text,
  "password" text,
  "is_active" boolean DEFAULT true,
  "repasse_taxa" real DEFAULT 9.5,
  "repasse_formato" text DEFAULT 'tabela_cep',
  "repasse_porcentagem" real DEFAULT 0,
  "show_delivery_fee" boolean DEFAULT true,
  "region" text,
  "plate" text,
  "active_session_token" text,
  "active_device_id" text,
  "last_login_at" text,
  "last_login_device" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 3. TABELA: partner_clients (Parceiros e Clientes Faturados)
CREATE TABLE IF NOT EXISTS "partner_clients" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "codigo_cliente" text,
  "phone" text,
  "email" text,
  "cnpj_cpf" text,
  "created_at" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "cep_spreadsheet_url" text
);

-- 4. TABELA: hub_centrals (Bases Operacionais / Hubs de Distribuição)
CREATE TABLE IF NOT EXISTS "hub_centrals" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "address" text NOT NULL,
  "city" text,
  "state" text,
  "cep" text NOT NULL,
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "coverage_radius_km" real DEFAULT 30,
  "manager_name" text,
  "contact_phone" text,
  "contact_email" text,
  "color" text DEFAULT '#2563EB',
  "end_routing_type" text DEFAULT 'farthest' NOT NULL,
  "manual_end_address" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 5. TABELA: operators (Usuários e Operadores de Sistema)
CREATE TABLE IF NOT EXISTS "operators" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "login" text NOT NULL,
  "phone" text,
  "password" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "role" text DEFAULT 'operator',
  "can_consult" boolean DEFAULT true,
  "can_alter" boolean DEFAULT false,
  "can_create" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "operators_login_unique" UNIQUE("login")
);

-- 6. TABELA: orders (Remessas, Pedidos e Entregas)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_name" text NOT NULL,
  "address" text NOT NULL,
  "courier_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "value" real DEFAULT 0 NOT NULL,
  "time" text NOT NULL,
  "region" text NOT NULL,
  "sequencia" text,
  "codigo_cliente" text,
  "data_solicitacao" text,
  "pedido" text,
  "procurar_por" text,
  "cep" text,
  "telefone" text,
  "detalhe" text,
  "email" text,
  "complemento" text,
  "dispositivo_condutor" text,
  "horario_final" text,
  "documento_empresa" text,
  "tipo_entrega" text,
  "prioridade" text,
  "chamado" text,
  "danfe" text,
  "data_limite" text,
  "nome_fantasia" text,
  "horario_inicio" text,
  "data_agendamento" text,
  "cidade_municipio" text,
  "estado" text,
  "bairro" text,
  "cidade" text,
  "uf" text,
  "valor_nota_fiscal" real DEFAULT 0,
  "valor_receber" real DEFAULT 0,
  "valor_entrega" real DEFAULT 0,
  "latitude" real,
  "longitude" real,
  "destinatario_cnpj_cpf" text,
  "valor_condutor" real DEFAULT 0,
  "is_imported" boolean DEFAULT false,
  "status_sincronizado" text,
  "status_sincronizado_legacy" text,
  "delivery_protocol" jsonb,
  "proof_photo_url" text,
  "signature_data_url" text,
  "receiver_name" text,
  "receiver_doc" text,
  "delivered_at" text,
  "history" jsonb DEFAULT '[]'::jsonb,
  "version" integer DEFAULT 1,
  "version_timestamp" bigint DEFAULT 0,
  "updated_at" bigint DEFAULT 0,
  "allocated_date" text,
  "weight" real,
  "volume" text,
  "observacao" text,
  "tipo_servico" text,
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 7. TABELA: freight_rules (Regras de Frete e Tabela de Faixas de CEP)
CREATE TABLE IF NOT EXISTS "freight_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "partner_id" text NOT NULL,
  "codigo_cliente" text,
  "cep_min" text NOT NULL,
  "cep_max" text NOT NULL,
  "value" real DEFAULT 0 NOT NULL,
  "valor_repasse" real DEFAULT 0,
  "prioridade" real DEFAULT 0,
  "regiao" text,
  "prazo_dias" integer DEFAULT 1,
  "peso_maximo" real,
  "description" text,
  "observacao" text,
  "last_updated" text,
  "last_updated_by" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 8. TABELA: freight_import_history (Histórico de Uploads de Planilhas de Frete)
CREATE TABLE IF NOT EXISTS "freight_import_history" (
  "id" text PRIMARY KEY NOT NULL,
  "partner_id" text,
  "partner_name" text,
  "imported_at" text NOT NULL,
  "file_name" text NOT NULL,
  "rules_count" integer DEFAULT 0,
  "mode" text DEFAULT 'replace',
  "status" text DEFAULT 'success',
  "details" text,
  "imported_by" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 9. TABELA: finance_transactions (Transações Financeiras de Contas a Pagar/Receber)
CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "amount" real NOT NULL,
  "date" text NOT NULL,
  "category" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payment_method" text,
  "expense_nature" text,
  "is_recurring" boolean DEFAULT false,
  "recurrent_group_id" text,
  "installment_number" integer,
  "total_installments" integer,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 10. TABELA: diary_entries (Diário de Bordo e Bloco de Notas Operacionais)
CREATE TABLE IF NOT EXISTS "diary_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "category" text DEFAULT 'Nota' NOT NULL,
  "color" text DEFAULT '#2563EB',
  "author_id" text,
  "author_name" text,
  "is_pinned" boolean DEFAULT false,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "created_at" text NOT NULL,
  "updated_at" text
);

-- 11. TABELA: app_branding (Identidade Visual e Configurações Gerais)
CREATE TABLE IF NOT EXISTS "app_branding" (
  "id" text PRIMARY KEY NOT NULL DEFAULT 'default',
  "app_name" text NOT NULL DEFAULT 'ViniMap Logística',
  "app_subtitle" text,
  "logo_url" text,
  "logo_icon_type" text DEFAULT 'truck',
  "primary_color" text DEFAULT '#2563EB',
  "secondary_color" text DEFAULT '#4F46E5',
  "updated_at" timestamp with time zone DEFAULT now()
);

-- 12. TABELA: push_subscriptions (Notificações Push PWA para Celulares dos Condutores)
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "courier_id" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
