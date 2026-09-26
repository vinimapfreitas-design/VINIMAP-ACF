-- ==============================================================================
-- VINIMAP LOGÍSTICA & FLEET - MIGRAÇÃO COMPLETA SUPABASE (ALL-IN-ONE)
-- Versão: 2.0.0
-- Data: 2026-09-02
-- Instruções: Copie este script inteiro e cole no SQL Editor do painel Supabase,
-- depois clique em "RUN". Todas as 12 tabelas, índices, RLS e Realtime serão criados!
-- ==============================================================================

-- Habilita extensões úteis do PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PARTE 1: CRIAÇÃO DE TABELAS (DDL)
-- ==============================================================================

-- 1. Tabela: activities
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

-- 2. Tabela: couriers
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

-- 3. Tabela: partner_clients
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

-- 4. Tabela: hub_centrals
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

-- 5. Tabela: operators
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

-- 6. Tabela: orders
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

-- Garante compatibilidade de colunas adicionais caso a tabela orders já existisse
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "version_timestamp" bigint DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" bigint DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "allocated_date" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "proof_photo_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "signature_data_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "receiver_name" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "receiver_doc" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "valor_condutor" real DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status_sincronizado" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status_sincronizado_legacy" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_protocol" jsonb;

-- Garante colunas adicionais na tabela couriers
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "repasse_taxa" real DEFAULT 9.5;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "repasse_formato" text DEFAULT 'tabela_cep';
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "repasse_porcentagem" real DEFAULT 0;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "show_delivery_fee" boolean DEFAULT true;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "active_session_token" text;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "active_device_id" text;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "last_login_at" text;
ALTER TABLE "couriers" ADD COLUMN IF NOT EXISTS "last_login_device" text;

-- 7. Tabela: freight_rules
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

-- 8. Tabela: freight_import_history
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

-- 9. Tabela: finance_transactions
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

-- 10. Tabela: diary_entries
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

-- 11. Tabela: app_branding
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

-- 12. Tabela: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "courier_id" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- PARTE 2: ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_orders_courier_id" ON "orders" ("courier_id");
CREATE INDEX IF NOT EXISTS "idx_orders_codigo_cliente" ON "orders" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_orders_region" ON "orders" ("region");
CREATE INDEX IF NOT EXISTS "idx_orders_data_solicitacao" ON "orders" ("data_solicitacao");
CREATE INDEX IF NOT EXISTS "idx_orders_cep" ON "orders" ("cep");
CREATE INDEX IF NOT EXISTS "idx_orders_version_timestamp" ON "orders" ("version_timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_updated_at" ON "orders" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_status_sincronizado" ON "orders" ("status_sincronizado");

CREATE INDEX IF NOT EXISTS "idx_couriers_status" ON "couriers" ("status");
CREATE INDEX IF NOT EXISTS "idx_couriers_phone" ON "couriers" ("phone");
CREATE INDEX IF NOT EXISTS "idx_couriers_is_active" ON "couriers" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_couriers_region" ON "couriers" ("region");

CREATE INDEX IF NOT EXISTS "idx_partner_clients_codigo" ON "partner_clients" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_partner_clients_cnpj_cpf" ON "partner_clients" ("cnpj_cpf");
CREATE INDEX IF NOT EXISTS "idx_partner_clients_is_active" ON "partner_clients" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_freight_rules_partner_id" ON "freight_rules" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_codigo_cliente" ON "freight_rules" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_cep_range" ON "freight_rules" ("cep_min", "cep_max");

CREATE INDEX IF NOT EXISTS "idx_activities_order_id" ON "activities" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_activities_type" ON "activities" ("type");
CREATE INDEX IF NOT EXISTS "idx_activities_created_at" ON "activities" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_finance_transactions_date" ON "finance_transactions" ("date");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_type" ON "finance_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_status" ON "finance_transactions" ("status");

CREATE INDEX IF NOT EXISTS "idx_diary_entries_created_at" ON "diary_entries" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_diary_entries_is_pinned" ON "diary_entries" ("is_pinned");

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_courier_id" ON "push_subscriptions" ("courier_id");

-- ==============================================================================
-- PARTE 3: POLÍTICAS DE ROW-LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total activities" ON "activities";
CREATE POLICY "Permitir acesso público total activities" ON "activities" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "couriers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total couriers" ON "couriers";
CREATE POLICY "Permitir acesso público total couriers" ON "couriers" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "partner_clients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total partner_clients" ON "partner_clients";
CREATE POLICY "Permitir acesso público total partner_clients" ON "partner_clients" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "hub_centrals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total hub_centrals" ON "hub_centrals";
CREATE POLICY "Permitir acesso público total hub_centrals" ON "hub_centrals" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total operators" ON "operators";
CREATE POLICY "Permitir acesso público total operators" ON "operators" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total orders" ON "orders";
CREATE POLICY "Permitir acesso público total orders" ON "orders" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "freight_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total freight_rules" ON "freight_rules";
CREATE POLICY "Permitir acesso público total freight_rules" ON "freight_rules" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "freight_import_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total freight_import_history" ON "freight_import_history";
CREATE POLICY "Permitir acesso público total freight_import_history" ON "freight_import_history" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "finance_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total finance_transactions" ON "finance_transactions";
CREATE POLICY "Permitir acesso público total finance_transactions" ON "finance_transactions" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "diary_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total diary_entries" ON "diary_entries";
CREATE POLICY "Permitir acesso público total diary_entries" ON "diary_entries" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "app_branding" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total app_branding" ON "app_branding";
CREATE POLICY "Permitir acesso público total app_branding" ON "app_branding" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total push_subscriptions" ON "push_subscriptions";
CREATE POLICY "Permitir acesso público total push_subscriptions" ON "push_subscriptions" FOR ALL TO public USING (true) WITH CHECK (true);

-- ==============================================================================
-- PARTE 4: PUBLICAÇÃO REALTIME (SUPABASE WEBSOCKETS)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE "orders";
ALTER PUBLICATION supabase_realtime ADD TABLE "couriers";
ALTER PUBLICATION supabase_realtime ADD TABLE "activities";
ALTER PUBLICATION supabase_realtime ADD TABLE "hub_centrals";
ALTER PUBLICATION supabase_realtime ADD TABLE "partner_clients";
ALTER PUBLICATION supabase_realtime ADD TABLE "freight_rules";
ALTER PUBLICATION supabase_realtime ADD TABLE "finance_transactions";
ALTER PUBLICATION supabase_realtime ADD TABLE "diary_entries";

ALTER TABLE "orders" REPLICA IDENTITY FULL;
ALTER TABLE "couriers" REPLICA IDENTITY FULL;
ALTER TABLE "activities" REPLICA IDENTITY FULL;

-- Recarrega o cache PostgREST
NOTIFY pgrst, 'reload schema';
