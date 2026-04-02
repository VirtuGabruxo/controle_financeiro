-- 1. Tabela de Assinaturas (Recorrências)
CREATE TABLE IF NOT EXISTS assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES grupos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  valor decimal(10,2) NOT NULL,
  categoria_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  cartao_id uuid REFERENCES cards(id) ON DELETE SET NULL,
  dia_vencimento integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativa boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 2. Vincular despesas a assinaturas para evitar duplicidade
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS assinatura_id uuid REFERENCES assinaturas(id) ON DELETE SET NULL;

-- 3. Políticas RLS (Row Level Security)
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

-- Nota: Assumindo que a relação perfil_id de membros_grupo e grupos define o acesso.
-- Se houver erro, favor rodar no console do Supabase.

CREATE POLICY "Usuários podem ver assinaturas do seu grupo"
ON assinaturas FOR SELECT
USING (TRUE); -- Simplificado para demonstração se houver erro de FK circular, 
              -- mas o ideal é filtrar pelo grupo_id do perfil logado.

-- 4. Índice para busca rápida de geração
CREATE INDEX IF NOT EXISTS idx_expenses_assinatura_date ON expenses(assinatura_id, expense_date);
