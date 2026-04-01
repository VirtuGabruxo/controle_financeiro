import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qfukjegdsnoqcfaoccba.supabase.co";
const supabaseKey = "sb_publishable_yNeler4E4Iq-If_x5uv17Q_Nhqo4FW4";
const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
  console.log("--- REPAIR START ---");
  
  // Update all NULL to false
  const { count, error } = await supabase
    .from('expenses')
    .update({ paga: false })
    .is('paga', null);
  
  if (error) {
    console.error("Error repairing DB:", error);
  } else {
    console.log(`Success! Updated ${count} records with NULL 'paga' to false.`);
  }

  console.log("--- REPAIR END ---");
}

repair();
