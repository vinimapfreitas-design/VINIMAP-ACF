-- ==============================================================================
-- MIGRAÇÃO SUPABASE: 0004_realtime_and_storage.sql
-- Projeto: ViniMap Logística & Fleet
-- Descrição: Configuração de publicação Realtime (Supabase WebSockets) e Buckets de Armazenamento
-- ==============================================================================

-- 1. HABILITAR REALTIME NAS TABELAS CRÍTICAS (Para sincronização em tempo real com celular do condutor e dashboard)
DO $$
BEGIN
  -- Cria a publicação supabase_realtime se ela não existir
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Adiciona as tabelas operacionais à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "orders";
ALTER PUBLICATION supabase_realtime ADD TABLE "couriers";
ALTER PUBLICATION supabase_realtime ADD TABLE "activities";
ALTER PUBLICATION supabase_realtime ADD TABLE "hub_centrals";
ALTER PUBLICATION supabase_realtime ADD TABLE "partner_clients";
ALTER PUBLICATION supabase_realtime ADD TABLE "freight_rules";
ALTER PUBLICATION supabase_realtime ADD TABLE "finance_transactions";
ALTER PUBLICATION supabase_realtime ADD TABLE "diary_entries";

-- 2. REPLICA IDENTITY FULL (Permite receber os valores antigos em eventos de UPDATE/DELETE via Realtime)
ALTER TABLE "orders" REPLICA IDENTITY FULL;
ALTER TABLE "couriers" REPLICA IDENTITY FULL;
ALTER TABLE "activities" REPLICA IDENTITY FULL;

-- 3. BUCKET DE ARMAZENAMENTO PARA COMPROVANTES E ASSINATURAS (Supabase Storage)
-- Cria o bucket 'delivery-protocols' para fotos de entrega e assinaturas digitais
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-protocols', 'delivery-protocols', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso público para o bucket delivery-protocols
DO $$
BEGIN
  -- Leitura pública dos comprovantes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Permitir leitura pública de comprovantes'
  ) THEN
    CREATE POLICY "Permitir leitura pública de comprovantes"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'delivery-protocols');
  END IF;

  -- Upload público de comprovantes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Permitir upload público de comprovantes'
  ) THEN
    CREATE POLICY "Permitir upload público de comprovantes"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'delivery-protocols');
  END IF;
END $$;

-- Notifica PostgREST para atualização de esquemas
NOTIFY pgrst, 'reload schema';
