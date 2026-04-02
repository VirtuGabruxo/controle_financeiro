const fs = require('fs');
const path = 'src/pages/Cards.jsx';
let content = fs.readFileSync(path, 'utf8');

// Usando Regex mais flexível para capturar o bloco mesmo com variações de espaço
const blockRegex = /<div className=\"space-y-4 relative z-10\">\s*<div className=\"bg-background\/50 p-4 rounded-xl border border-border\/50 flex justify-between items-center\">\s*<span className=\"text-sm font-medium text-muted\">Fatura Atual \(Mês\)<\/span>\s*<span className=\"text-lg font-bold text-content\">\{formatCurrency\(c\.currentInvoice\)\}<\/span>\s*<\/div>/;

const newBlock = `<div className="space-y-4 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted uppercase font-bold tracking-wider">Limite Comprometido (Total)</span>
                    <h2 className="text-3xl font-bold text-content mt-1">{formatCurrency(c.totalPending)}</h2>
                  </div>

                  <div className="bg-background/40 p-3 rounded-xl border border-border/50 flex justify-between items-center text-indigo-400">
                    <span className="text-xs font-medium text-muted text-content">Fatura Fechada (Mês)</span>
                    <span className="text-sm font-bold">{formatCurrency(c.currentInvoice)}</span>
                  </div>`;

if (blockRegex.test(content)) {
    content = content.replace(blockRegex, newBlock);
    content = content.replace('Limite Comprometido (Todas Faturas)', 'Consumo do Limite Global');
    fs.writeFileSync(path, content);
    console.log('REFACTOR_SUCCESS');
} else {
    console.log('REFACTOR_FAIL_NOT_FOUND');
}
