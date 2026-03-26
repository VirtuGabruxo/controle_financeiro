import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'As variáveis de ambiente do Supabase estão ausentes. ' +
    'Certifique-se de preencher o arquivo .env correntamente.'
  );
}

// Cria e exporta o cliente Supabase padronizado
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
