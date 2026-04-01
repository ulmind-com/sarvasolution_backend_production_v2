const fs = require('fs');
const p = require('path').join(__dirname, 'src', 'services', 'business', 'bikeCarFund.service.js');
let c = fs.readFileSync(p, 'utf-8');

c = c.replace(
    /const User\s*= \(await import\('\.\.\/\.\.\/models\/User\.model\.js'\)\)\.default;\s*\n\s*invalidateTreeCache\(\);\s*\n\s*const lookup = await getTreeLookup\(User\);\s*\n\s*= await SelfRepurchaseBVEntry\.find/,
    `const User                  = (await import('../../models/User.model.js')).default;\r\n        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;\r\n\r\n        invalidateTreeCache();\r\n        const lookup = await getTreeLookup(User);\r\n\r\n        const allEntries     = await SelfRepurchaseBVEntry.find`
);

fs.writeFileSync(p, c);
console.log('Fixed bikeCarFund.service.js');
