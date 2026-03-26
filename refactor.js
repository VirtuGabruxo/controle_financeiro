const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  // Backgrounds
  { p: /bg-zinc-950/g, r: 'bg-background' },
  { p: /bg-zinc-900/g, r: 'bg-surface' },
  { p: /bg-zinc-800/g, r: 'bg-border' },
  { p: /hover:bg-zinc-800/g, r: 'hover:bg-border' },
  
  // Borders
  { p: /border-zinc-800/g, r: 'border-border' },
  { p: /border-zinc-900/g, r: 'border-surface' },

  // Text contents
  { p: /text-zinc-100/g, r: 'text-content' },
  { p: /text-zinc-200/g, r: 'text-content' },
  { p: /text-zinc-300/g, r: 'text-muted' },
  { p: /text-zinc-400/g, r: 'text-muted' },
  { p: /text-zinc-500/g, r: 'text-muted' },
  { p: /text-zinc-900/g, r: 'text-inverse' },
  { p: /text-zinc-950/g, r: 'text-inverse' },
  
  // Emerald Theme to Primary Generic Theme
  { p: /emerald-500/g, r: 'primary' },
  { p: /emerald-400/g, r: 'primary-glow' }
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);
let modifiedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  replacements.forEach(({p, r}) => {
    content = content.replace(p, r);
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedFiles++;
    console.log(`Updated ${path.basename(file)}`);
  }
});

console.log(`\nRefactoring complete! Updated ${modifiedFiles} files.`);
