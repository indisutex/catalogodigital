const fs = require('fs');
let c = fs.readFileSync('siigo_clean.txt', 'utf8');
c = c.replace(/\"\"/g, '\"');
fs.writeFileSync('siigo_clean.txt', c);
