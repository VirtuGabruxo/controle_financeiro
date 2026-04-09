-- =====================================================
-- MIGRATION: Adicionar data_inicio à tabela assinaturas
-- Motivo: Controlar quando a recorrência começa a gerar despesas.
-- Executar no SQL Editor do Supabase.
-- =====================================================

-- 1. Adicionar coluna (idempotente)
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS data_inicio DATE DEFAULT CURRENT_DATE;

-- 2. Backfill: assinaturas já existentes assumem criado_em como data de início
UPDATE assinaturas SET data_inicio = criado_em::date WHERE data_inicio IS NULL;
