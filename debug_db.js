import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qfukjegdsnoqcfaoccba.supabase.co";
const supabaseAnonKey = "sb_publishable_yNeler4E4Iq-If_x5uv17Q_Nhqo4FW4";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("--- CARDS ---");
  const { data: cards, error: errC } = await supabase.from('cards').select('*');
  console.log(cards || errC);

  console.log("\n--- GROUPS ---");
  const { data: groups, error: errG } = await supabase.from('grupos').select('*');
  console.log(groups || errG);

  console.log("\n--- EXPENSES SAMPLE ---");
  const { data: expenses, error: errE } = await supabase.from('expenses').select('id, description, card_id, grupo_id').limit(10);
  console.log(expenses || errE);
}

check();
