const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // We want to match <img ... linkedinLogo.svg ... />
  // but we should avoid wrapping if it's already inside an <a> tag.
  // A simple regex approach:
  // Find all <img ... linkedinLogo.svg ... />
  // We'll replace it with <a href="/">$&</a>
  // But first, let's just do a naive replace and see if there are any double links.
  
  const imgRegex = /(<img[^>]*src="[^"]*linkedinLogo\.svg"[^>]*>)/gi;
  
  // check if already wrapped. 
  // It's safer to just split by the regex, and check the prefix.
  
  let changed = false;
  let newContent = content.replace(imgRegex, (match, p1, offset, string) => {
    // Check if preceded by <a href="/"> or similar
    const before = string.slice(Math.max(0, offset - 15), offset);
    if (before.includes('<a ')) {
      return match; // already wrapped
    }
    changed = true;
    return `<a href="/">${match}</a>`;
  });
  
  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.html')) {
      processFile(fullPath);
    }
  }
}

walkDir(publicDir);
console.log('Done!');
