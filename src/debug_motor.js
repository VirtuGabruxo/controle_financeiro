import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qfukjegdsnoqcfaoccba.supabase.co";
const supabaseKey = "sb_publishable_yNeler4E4Iq-If_x5uv17Q_Nhqo4FW4";
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log("--- DEBUG START ---");
  
  try {
    // 1. Get the last added expenses to identify the group
    const { data: lastExp, error: err1 } = await supabase
      .from('expenses')
      .select('grupo_id, expense_date, description, paga, card_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (err1) throw err1;
    console.log("Last 10 expenses:", lastExp);

    if (lastExp.length === 0) return console.log("No expenses found.");

    const groupId = lastExp[0].grupo_id;
    console.log("Target Group ID:", groupId);

    // 2. Check profile for this group or the owner
    const { data: members, error: err2 } = await supabase
      .from('membros_grupo')
      .select('user_id')
      .eq('grupo_id', groupId);
    
    if (err2) throw err2;
    const userId = members[0].user_id;

    const { data: profile, error: err3 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (err3) throw err3;
    console.log("Profile state:", {
      notificar_vencimentos: profile.notificar_vencimentos,
      dias_antecedencia: profile.dias_antecedencia
    });

    // 3. Check cards for this group
    const { data: cards, error: err4 } = await supabase
      .from('cards')
      .select('*')
      .eq('grupo_id', groupId);
    
    if (err4) throw err4;
    console.log("Cards in group:", cards);

    // 4. Simulate the logic for tonight's state (March 31, 2026)
    const today = new Date('2026-03-31T12:00:00Z');
    const todayDay = today.getDate();
    const daysAdvance = profile.dias_antecedencia || 5;
    console.log("Logic simulation with today=31/03 and advance=", daysAdvance);

    for (const card of cards) {
      const isAfterClosing = todayDay > card.closing_day;
      const refMonth = isAfterClosing ? today.getMonth() : today.getMonth() - 1;
      const refYear = today.getFullYear();
      const closingDate = new Date(refYear, refMonth, card.closing_day);
      closingDate.setHours(23, 59, 59, 999);
      const closingDateStr = closingDate.toISOString().split('T')[0];

      console.log(`\n--- Card: ${card.name} ---`);
      console.log(`Closing Strategy: ${isAfterClosing ? "After Closing" : "Before Closing"}`);
      console.log(`Reference Month: ${refMonth + 1}, Closing Date Target: ${closingDateStr}`);

      const { data: cardExpenses, error: errE } = await supabase
        .from('expenses')
        .select('description, amount, expense_date, paga')
        .eq('card_id', card.id)
        .lte('expense_date', closingDateStr);
      
      if (errE) throw errE;
      
      console.log(`Expenses <= ${closingDateStr}:`, cardExpenses);

      const pendingExpenses = cardExpenses.filter(e => e.paga === false || e.paga === null);
      const totalBill = pendingExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      console.log(`Total Bill Pending: ${totalBill}`);

      if (totalBill > 0) {
        let dueDate = new Date(refYear, refMonth, card.due_day);
        if (card.due_day < card.closing_day) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log(`Due Date calculated: ${dueDate.toISOString().split('T')[0]}`);
        console.log(`diffDays: ${diffDays}, Show Alert? ${diffDays <= daysAdvance}`);
      } else {
        console.log("No pending expenses for this cycle.");
      }
    }
  } catch (err) {
    console.error("ERROR during debug:", err);
  }

  console.log("--- DEBUG END ---");
}

debug();
