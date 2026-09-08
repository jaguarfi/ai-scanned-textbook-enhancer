const fs = require('fs');
let code = fs.readFileSync('src/components/ImageSettingsPanel.tsx', 'utf8');

code = code.replace(/preset === 'crisp-textbook' \? 45 : 0/g, "preset === 'crisp-textbook' ? 55 : 0");
code = code.replace(/preset === 'crisp-textbook' \? 85 : 0/g, "preset === 'crisp-textbook' ? 70 : 0");

fs.writeFileSync('src/components/ImageSettingsPanel.tsx', code);
