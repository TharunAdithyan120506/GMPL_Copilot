import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');
  
  // 1. Setup Company and Roles
  let company = await prisma.company.findFirst({ where: { name: 'GMPL' } });
  if (!company) {
    company = await prisma.company.create({ data: { name: 'GMPL' } });
  }
  
  let vendorRole = await prisma.role.findFirst({ where: { key: 'vendor' } });
  if (!vendorRole) {
    vendorRole = await prisma.role.create({
      data: { companyId: company.id, key: 'vendor', name: 'Vendor' }
    });
  }

  // 2. Setup Vendors
  const vendorNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'GMPL'];
  const vendors = [];
  
  for (const name of vendorNames) {
    const isInternal = name === 'GMPL';
    let vendor = await prisma.vendor.findFirst({ where: { companyId: company.id, name } });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          companyId: company.id,
          name,
          code: `V-${name.toUpperCase()}`,
          isInternal
        }
      });
    }
    vendors.push(vendor);

    // Create User for GMPL vendor specifically
    if (name === 'GMPL') {
      let user = await prisma.user.findFirst({ where: { loginIdentifier: 'gmpl_vendor' } });
      if (!user) {
        await prisma.user.create({
          data: {
            companyId: company.id,
            roleId: vendorRole.id,
            vendorId: vendor.id,
            loginIdentifier: 'gmpl_vendor',
            passwordHash: require('bcryptjs').hashSync('password', 10), 
            isActive: true
          }
        });
        console.log('Created user login: gmpl_vendor');
      }
    }
  }

  // 3. Read CSV
  const csvPath = path.join(__dirname, '../../Part and mold lists.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  
  const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows = lines.slice(1); // skip header
  
  console.log('Preparing batch data...');
  
  const rmData = new Map();
  const mouldData = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(',').map(c => c.trim());
    if (cols.length < 11) continue;
    
    const runnerWeight = parseFloat(cols[0]) || 0;
    const model = cols[1];
    const customer = cols[2];
    const mouldName = cols[3];
    const rmName = cols[4] || 'Unknown';
    const rmGrade = cols[5] || 'Unknown';
    const pWeight = parseFloat(cols[6]) || 0;
    const shotWeight = parseFloat(cols[7]) || 0;
    const cycleTime = parseFloat(cols[8]) || 0;
    const uph = parseFloat(cols[9]) || 0;
    const cavity = parseInt(cols[10]) || 1;
    
    if (!mouldName) continue;

    const rmKey = `${rmName} - ${rmGrade}`;
    if (!rmData.has(rmKey)) {
      rmData.set(rmKey, {
        companyId: company.id,
        name: rmKey,
        code: `RM-${rmName.substring(0,3).toUpperCase()}-${Math.floor(Math.random()*1000)}`,
        unit: 'kg'
      });
    }
    
    mouldData.push({
      companyId: company.id,
      name: mouldName,
      code: `MLD-${mouldName.substring(0,4).toUpperCase()}-${Math.floor(Math.random()*10000)}`,
      cavityCount: cavity,
      partWeightG: pWeight,
      runnerWeightG: runnerWeight,
      shotWeightG: shotWeight,
      shotLifeLimit: 1000000,
      lifecycleState: 'active',
      rmKey
    });
  }
  
  console.log(`Inserting ${rmData.size} raw materials...`);
  await prisma.rawMaterial.createMany({
    data: Array.from(rmData.values()),
    skipDuplicates: true
  });
  
  console.log(`Inserting ${mouldData.length} moulds...`);
  // Remove rmKey before inserting
  const mouldsToInsert = mouldData.map(({ rmKey, ...rest }) => rest);
  await prisma.mould.createMany({
    data: mouldsToInsert,
    skipDuplicates: true
  });
  
  // Refetch to get IDs
  const allMoulds = await prisma.mould.findMany({ where: { companyId: company.id } });
  const allRMs = await prisma.rawMaterial.findMany({ where: { companyId: company.id } });
  const rmNameMap = new Map(allRMs.map(r => [r.name, r.id]));

  console.log('Assigning moulds to vendors...');
  const assignmentsToInsert = [];
  
  let mouldIndex = 0;
  for (const vendor of vendors) {
    const isGMPL = vendor.name === 'GMPL';
    const countToAssign = isGMPL ? (allMoulds.length - mouldIndex) : 20;
    
    let assigned = 0;
    while (assigned < countToAssign && mouldIndex < allMoulds.length) {
      const mould = allMoulds[mouldIndex];
      const mouldRecord = mouldData.find(m => m.name === mould.name);
      const rmId = rmNameMap.get(mouldRecord?.rmKey || '') || allRMs[0].id;
      
      assignmentsToInsert.push({
        companyId: company.id,
        vendorId: vendor.id,
        mouldId: mould.id,
        rawMaterialId: rmId,
        rmAssignedQty: 10000,
        rmRemainingQty: 10000,
        status: 'active',
        assignedAt: new Date()
      });
      
      assigned++;
      mouldIndex++;
    }
    console.log(`Prepared ${assigned} assignments for ${vendor.name}`);
  }
  
  console.log('Inserting assignments...');
  await prisma.assignment.createMany({
    data: assignmentsToInsert,
    skipDuplicates: true
  });

  console.log('Seed completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
