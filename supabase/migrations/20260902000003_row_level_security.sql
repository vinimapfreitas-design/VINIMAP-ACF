-- ==============================================================================
-- MIGRAÇÃO SUPABASE: 0003_row_level_security.sql
-- Projeto: ViniMap Logística & Fleet
-- Descrição: Políticas de Segurança (Row-Level Security - RLS) para todas as tabelas
-- ==============================================================================

-- 1. Tabela: activities
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total activities" ON "activities";
CREATE POLICY "Permitir acesso público total activities" ON "activities" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Tabela: couriers
ALTER TABLE "couriers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total couriers" ON "couriers";
CREATE POLICY "Permitir acesso público total couriers" ON "couriers" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Tabela: partner_clients
ALTER TABLE "partner_clients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total partner_clients" ON "partner_clients";
CREATE POLICY "Permitir acesso público total partner_clients" ON "partner_clients" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Tabela: hub_centrals
ALTER TABLE "hub_centrals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total hub_centrals" ON "hub_centrals";
CREATE POLICY "Permitir acesso público total hub_centrals" ON "hub_centrals" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Tabela: operators
ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total operators" ON "operators";
CREATE POLICY "Permitir acesso público total operators" ON "operators" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Tabela: orders
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total orders" ON "orders";
CREATE POLICY "Permitir acesso público total orders" ON "orders" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Tabela: freight_rules
ALTER TABLE "freight_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total freight_rules" ON "freight_rules";
CREATE POLICY "Permitir acesso público total freight_rules" ON "freight_rules" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. Tabela: freight_import_history
ALTER TABLE "freight_import_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total freight_import_history" ON "freight_import_history";
CREATE POLICY "Permitir acesso público total freight_import_history" ON "freight_import_history" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 9. Tabela: finance_transactions
ALTER TABLE "finance_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total finance_transactions" ON "finance_transactions";
CREATE POLICY "Permitir acesso público total finance_transactions" ON "finance_transactions" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 10. Tabela: diary_entries
ALTER TABLE "diary_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total diary_entries" ON "diary_entries";
CREATE POLICY "Permitir acesso público total diary_entries" ON "diary_entries" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 11. Tabela: app_branding
ALTER TABLE "app_branding" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total app_branding" ON "app_branding";
CREATE POLICY "Permitir acesso público total app_branding" ON "app_branding" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 12. Tabela: push_subscriptions
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso público total push_subscriptions" ON "push_subscriptions";
CREATE POLICY "Permitir acesso público total push_subscriptions" ON "push_subscriptions" 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- RECARREGA O CACHE DA API REST (POSTGREST) DO SUPABASE
NOTIFY pgrst, 'reload schema';
