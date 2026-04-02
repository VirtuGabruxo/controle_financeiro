const fs = require('fs');
const path = 'src/pages/Cards.jsx';
let content = fs.readFileSync(path, 'utf8');

const search = `<div className="space-y-4 relative z-10">
                  <div className="bg-background/50 p-4 rounded-xl border border-border/50 flex justify-between items-center">
                     <span className="text-sm font-medium text-muted">Fatura Atual (Mês)</span>
                     <span className="text-lg font-bold text-content">{formatCurrency(c.currentInvoice)}</span>
                  </div>`;

const replacement = `<div className="space-y-4 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted uppercase tracking-wider">Limite Comprometido (Total Utilizado)</span>
                    <h2 className="text-3xl font-bold text-content mt-1">{formatCurrency(c.totalPending)}</h2>
                  </div>

                  <div className="bg-background/40 p-3 rounded-xl border border-border/50 flex justify-between items-center">
                    <span className="text-xs font-medium text-muted">Fatura Fechada (Mês)</span>
                    <span className="text-sm font-bold text-indigo-400">{formatCurrency(c.currentInvoice)}</span>
                  </div>`;

// Use a more relaxed replacement if the exact match fails
if (content.indexOf('Fatura Atual (Mês)') !== -1) {
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('space-y-4 relative z-10') && lines[i+1]?.includes('bg-background/50')) {
            startIdx = i;
            break;
        }
    }
    
    if (startIdx !== -1) {
        // Find closing div
        let open = 0;
        for (let i = startIdx; i < lines.length; i++) {
            if (lines[i].includes('<div')) open++;
            if (lines[i].includes('</div>')) open--;
            // This is complex, let's just replace lines 213-217 based on my previous view_file
            // Actually, let's just use string replacement on the known unique pattern.
        }
    }
    
    // Robust replacement with wildcard spaces
    const looseRegex = /<div className=\"space-y-4 relative z-10\">\s*<div className=\"bg-background\/50 p-4 rounded-xl border border-border\/50 flex justify-between items-center\">\s*<span className=\"text-sm font-medium text-muted\">Fatura Atual \(Mês\)<\/span>\s*<span className=\"text-lg font-bold text-content\">\{formatCurrency\(c\.currentInvoice\)\}<\/span>\s*<\/div>/;
    
    if (looseRegex.test(content)) {
        fs.writeFileSync(path, content.replace(looseRegex, replacement));
        console.log("REPLACED SUCCESSFULLY");
    } else {
        console.log("COULD NOT FIND BLOCK WITH REGEX");
    }
}
