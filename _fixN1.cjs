const fs = require('fs');
const path = require('path');
const d = path.join(__dirname, 'src', 'services', 'business');

// Fix houseFund — (userId, cycleYear, cycleNumber) -> add _prebuiltLookup as 4th param
{
    const fp = path.join(d, 'houseFund.service.js');
    let c = fs.readFileSync(fp, 'utf-8');

    // 1. Fix calculateUserUnits signature
    c = c.replace(
        'calculateUserUnits: async (userId, cycleYear, cycleNumber) =>',
        'calculateUserUnits: async (userId, cycleYear, cycleNumber, _prebuiltLookup = null) =>'
    );

    // 2. Fix broken runCycleEndDistribution (corrupted SelfRepurchaseBVEntry line)
    c = c.replace(
        /const User\s*= \(await import\('\.\.\/\.\.\/models\/User\.model\.js'\)\)\.default;\s*\n\s*invalidateTreeCache\(\);\s*\n\s*const lookup = await getTreeLookup\(User\);\s*\n\s*= await SelfRepurchaseBVEntry\.find/,
        `const User                  = (await import('../../models/User.model.js')).default;\r\n        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;\r\n\r\n        invalidateTreeCache();\r\n        const lookup = await getTreeLookup(User);\r\n\r\n        const allEntries     = await SelfRepurchaseBVEntry.find`
    );

    // 3. Pass lookup in batch loops in runCycleEndDistribution
    c = c.replace(
        '.calculateUserUnits(u._id, cycleYear, cycleNumber)',
        '.calculateUserUnits(u._id, cycleYear, cycleNumber, lookup)'
    );

    // 4. Fix getUserStatus — add lookup
    c = c.replace(
        `const { cycleYear, cycleNumber } = houseFundService.getCurrentCycle();\r\n        const calc  = await houseFundService.calculateUserUnits(userId, cycleYear, cycleNumber);`,
        `const { cycleYear, cycleNumber } = houseFundService.getCurrentCycle();\r\n        const User  = (await import('../../models/User.model.js')).default;\r\n        const lookup = await getTreeLookup(User);\r\n        const calc  = await houseFundService.calculateUserUnits(userId, cycleYear, cycleNumber, lookup);`
    );

    // 5. Pass lookup in getLivePool batch
    c = c.replace(
        '.calculateUserUnits(u._id, cycleYear, cycleNumber)',
        '.calculateUserUnits(u._id, cycleYear, cycleNumber, lookup)'
    );

    // 6. Pass lookup in getUserLiveEstimate batch and fallback
    c = c.replace(
        '.calculateUserUnits(u._id, cycleYear, cycleNumber)',
        '.calculateUserUnits(u._id, cycleYear, cycleNumber, lookup)'
    );
    c = c.replace(
        '.calculateUserUnits(userId, cycleYear, cycleNumber)',
        '.calculateUserUnits(userId, cycleYear, cycleNumber, lookup)'
    );

    // 7. Pass lookup in getAdminUserDetails
    c = c.replace(
        `const { cycleYear, cycleNumber } = houseFundService.getCurrentCycle();\r\n        const currentCycleCalc = await houseFundService.calculateUserUnits(user._id, cycleYear, cycleNumber);`,
        `const { cycleYear, cycleNumber } = houseFundService.getCurrentCycle();\r\n        const lookup = await getTreeLookup(User);\r\n        const currentCycleCalc = await houseFundService.calculateUserUnits(user._id, cycleYear, cycleNumber, lookup);`
    );

    // 8. Pass lookup in getAdminCurrentCycleOverview batch
    c = c.replace(
        '.calculateUserUnits(u._id, cycleYear, cycleNumber)',
        '.calculateUserUnits(u._id, cycleYear, cycleNumber, lookup)'
    );

    fs.writeFileSync(fp, c);
    console.log('✅ Fixed houseFund.service.js');
}

// Fix ssvplSuperBonus — (userId, cycleYear) similar to royaltyFund
{
    const fp = path.join(d, 'ssvplSuperBonus.service.js');
    let c = fs.readFileSync(fp, 'utf-8');

    // Check current signature
    if (c.includes('_prebuiltLookup')) {
        console.log('⏭️  ssvplSuperBonus already has _prebuiltLookup');
    } else {
        // Add _prebuiltLookup to calculateUserUnits
        c = c.replace(
            /calculateUserUnits: async \(userId, cycleYear\) =>/,
            'calculateUserUnits: async (userId, cycleYear, _prebuiltLookup = null) =>'
        );
    }

    // Fix corrupted runCycleEndDistribution if needed
    c = c.replace(
        /const User\s*= \(await import\('\.\.\/\.\.\/models\/User\.model\.js'\)\)\.default;\s*\n\s*invalidateTreeCache\(\);\s*\n\s*const lookup = await getTreeLookup\(User\);\s*\n\s*= await SelfRepurchaseBVEntry\.find/,
        `const User                  = (await import('../../models/User.model.js')).default;\r\n        const SelfRepurchaseBVEntry = (await import('../../models/SelfRepurchaseBVEntry.model.js')).default;\r\n\r\n        invalidateTreeCache();\r\n        const lookup = await getTreeLookup(User);\r\n\r\n        const allEntries     = await SelfRepurchaseBVEntry.find`
    );

    // Pass lookup in batch and single-user calculateUserUnits calls
    c = c.replace(/\.calculateUserUnits\(u\._id, cycleYear\)/g, '.calculateUserUnits(u._id, cycleYear, lookup)');
    c = c.replace(/\.calculateUserUnits\(userId, cycleYear\)/g, '.calculateUserUnits(userId, cycleYear, lookup)');
    c = c.replace(/\.calculateUserUnits\(user\._id, cycleYear\)/g, '.calculateUserUnits(user._id, cycleYear, lookup)');

    // Fix getUserStatus — add lookup
    if (!c.match(/getUserStatus[\s\S]*?const User.*getTreeLookup/)) {
        c = c.replace(
            /getUserStatus: async \(userId\) => \{\s*\n\s*const cycleYear = \w+\.getCurrentCycleYear\(\);\s*\n\s*const calc\s*= await/,
            (match) => {
                return match.replace(
                    'const calc  = await',
                    "const User  = (await import('../../models/User.model.js')).default;\n        const lookup = await getTreeLookup(User);\n        const calc  = await"
                );
            }
        );
    }

    fs.writeFileSync(fp, c);
    console.log('✅ Fixed ssvplSuperBonus.service.js');
}

console.log('\nDone!');
