-- ==============================================================================
-- MIGRAÇÃO SUPABASE: 0002_indexes_and_performance.sql
-- Projeto: ViniMap Logística & Fleet
-- Descrição: Criação de índices de alta performance para pesquisas, filtros e mapas
-- ==============================================================================

-- Índices para tabela ORDERS (Pedidos)
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_orders_courier_id" ON "orders" ("courier_id");
CREATE INDEX IF NOT EXISTS "idx_orders_codigo_cliente" ON "orders" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_orders_region" ON "orders" ("region");
CREATE INDEX IF NOT EXISTS "idx_orders_data_solicitacao" ON "orders" ("data_solicitacao");
CREATE INDEX IF NOT EXISTS "idx_orders_cep" ON "orders" ("cep");
CREATE INDEX IF NOT EXISTS "idx_orders_version_timestamp" ON "orders" ("version_timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_updated_at" ON "orders" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_status_sincronizado" ON "orders" ("status_sincronizado");

-- Índices para tabela COURIERS (Condutores)
CREATE INDEX IF NOT EXISTS "idx_couriers_status" ON "couriers" ("status");
CREATE INDEX IF NOT EXISTS "idx_couriers_phone" ON "couriers" ("phone");
CREATE INDEX IF NOT EXISTS "idx_couriers_is_active" ON "couriers" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_couriers_region" ON "couriers" ("region");

-- Índices para tabela PARTNER_CLIENTS (Parceiros)
CREATE INDEX IF NOT EXISTS "idx_partner_clients_codigo" ON "partner_clients" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_partner_clients_cnpj_cpf" ON "partner_clients" ("cnpj_cpf");
CREATE INDEX IF NOT EXISTS "idx_partner_clients_is_active" ON "partner_clients" ("is_active");

-- Índices para tabela FREIGHT_RULES (Regras de Frete)
CREATE INDEX IF NOT EXISTS "idx_freight_rules_partner_id" ON "freight_rules" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_codigo_cliente" ON "freight_rules" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_cep_range" ON "freight_rules" ("cep_min", "cep_max");

-- Índices para tabela ACTIVITIES (Feed de Atividades)
CREATE INDEX IF NOT EXISTS "idx_activities_order_id" ON "activities" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_activities_type" ON "activities" ("type");
CREATE INDEX IF NOT EXISTS "idx_activities_created_at" ON "activities" ("created_at" DESC);

-- Índices para tabela FINANCE_TRANSACTIONS (Transações)
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_date" ON "finance_transactions" ("date");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_type" ON "finance_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_status" ON "finance_transactions" ("status");

-- Índices para tabela DIARY_ENTRIES (Diário)
CREATE INDEX IF NOT EXISTS "idx_diary_entries_created_at" ON "diary_entries" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_diary_entries_is_pinned" ON "diary_entries" ("is_pinned");

-- Índices para PUSH_SUBSCRIPTIONS
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_courier_id" ON "push_subscriptions" ("courier_id");
