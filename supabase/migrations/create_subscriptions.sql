-- =====================================================
-- TABELA: assinaturas (Recorrências / Subscriptions)
-- Versão: 2.0 — Com RLS completo (SELECT, INSERT, UPDATE, DELETE)
-- =====================================================

-- 1. Tabela Principal
CREATE TABLE IF NOT EXISTS assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES grupos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  nome text NOT NULL,
  valor decimal(10,2) NOT NULL,
  categoria_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  cartao_id uuid REFERENCES cards(id) ON DELETE SET NULL,
  dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativa boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 2. Vincular despesas a assinaturas (idempotente)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS assinatura_id uuid REFERENCES assinaturas(id) ON DELETE SET NULL;

-- 3. Ativar RLS
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS — baseadas em pertencer ao grupo via membros_grupo
-- Dropar políticas existentes para evitar conflito em re-execução
DROP POLICY IF EXISTS "assinaturas_select" ON assinaturas;
DROP POLICY IF EXISTS "assinaturas_insert" ON assinaturas;
DROP POLICY IF EXISTS "assinaturas_update" ON assinaturas;
DROP POLICY IF EXISTS "assinaturas_delete" ON assinaturas;
-- Limpar política antiga se existir
DROP POLICY IF EXISTS "Usuários podem ver assinaturas do seu grupo" ON assinaturas;

-- SELECT: Membros do grupo podem visualizar
CREATE POLICY "assinaturas_select"
ON assinaturas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM membros_grupo
    WHERE membros_grupo.grupo_id = assinaturas.grupo_id
      AND membros_grupo.user_id = auth.uid()
  )
);

-- INSERT: Membros do grupo podem criar
CREATE POLICY "assinaturas_insert"
ON assinaturas FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM membros_grupo
    WHERE membros_grupo.grupo_id = assinaturas.grupo_id
      AND membros_grupo.user_id = auth.uid()
  )
);

-- UPDATE: Membros do grupo podem editar
CREATE POLICY "assinaturas_update"
ON assinaturas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM membros_grupo
    WHERE membros_grupo.grupo_id = assinaturas.grupo_id
      AND membros_grupo.user_id = auth.uid()
  )
);

-- DELETE: Membros do grupo podem excluir
CREATE POLICY "assinaturas_delete"
ON assinaturas FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM membros_grupo
    WHERE membros_grupo.grupo_id = assinaturas.grupo_id
      AND membros_grupo.user_id = auth.uid()
  )
);

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_grupo ON assinaturas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ativa ON assinaturas(grupo_id, ativa);
CREATE INDEX IF NOT EXISTS idx_expenses_assinatura_date ON expenses(assinatura_id, expense_date);
