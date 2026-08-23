const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const initialLength = content.length;

  // Replace font-weight / fontWeight 800 and 700
  // For JSX style objects
  content = content.replace(/fontWeight:\s*(800|'800'|"800"|700|'700'|"700")/g, 'fontWeight: 600');
  content = content.replace(/fontWeight:\s*(\d+)/g, (match, p1) => {
    const val = parseInt(p1, 10);
    if (val >= 700) return 'fontWeight: 600';
    return match;
  });

  // For CSS / template literals
  content = content.replace(/font-weight:\s*(800|700|900|bold|bolder)/g, 'font-weight: 600');

  // Ensure 'Plus Jakarta Sans' or others are replaced by Poppins if specified
  content = content.replace(/'Plus Jakarta Sans', system-ui, sans-serif/g, "'Poppins', sans-serif");
  content = content.replace(/'Inter', sans-serif/g, "'Poppins', sans-serif");

  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated typography in: ${path.basename(filePath)}`);
  } else {
    console.log(`No changes needed in: ${path.basename(filePath)}`);
  }
}

const files = [
  path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx'),
  path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx'),
  path.join(__dirname, '..', 'src', 'pages', 'SuperAdmin.tsx'),
  path.join(__dirname, '..', 'src', 'pages', 'Admin.css'),
  path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.css'),
  path.join(__dirname, '..', 'src', 'components', 'WhatsAppPhoneVerifier.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'PqrsModal.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'erp', 'ERPPQRSModule.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'erp', 'ERPMainModule.tsx')
];

files.forEach(cleanFile);
console.log('Typography normalization complete!');
