import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
  const csvFilePath = path.join(__dirname, '../../Part and mold lists.csv');
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });

  const records: any[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // 1. Ensure we have a Company
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'GMPL Default Company',
      },
    });
  }
  const companyId = company.id;

  // Process unique Raw Materials
  const rawMaterialsMap = new Map();
  const vendorsMap = new Map();

  for (const row of records) {
    // Collect Raw Materials
    const rmName = row['RM NAME'] || 'Unknown RM';
    const rmGrade = row['RAW MATERIAL GRADE'] || 'Unknown Grade';
    const rmKey = `${rmName}-${rmGrade}`;
    
    if (!rawMaterialsMap.has(rmKey) && rmGrade) {
      rawMaterialsMap.set(rmKey, {
        name: rmName,
        code: rmGrade,
      });
    }

    // Collect Vendors
    const customer = row['CUSOMER'] || 'Unknown Vendor'; 
    if (customer && customer !== '`') {
      vendorsMap.set(customer, {
        name: customer,
        code: customer.replace(/\s+/g, '_').toUpperCase(),
      });
    }
  }

  // Insert Raw Materials
  for (const [key, rm] of rawMaterialsMap.entries()) {
    await prisma.rawMaterial.upsert({
      where: {
        companyId_code: {
          companyId,
          code: rm.code,
        }
      },
      update: {},
      create: {
        companyId,
        code: rm.code,
        name: rm.name,
        unit: 'kg', // assuming kg
      }
    });
  }

  // Insert Vendors
  for (const [key, vendor] of vendorsMap.entries()) {
    await prisma.vendor.upsert({
      where: {
        companyId_code: {
          companyId,
          code: vendor.code,
        }
      },
      update: {},
      create: {
        companyId,
        code: vendor.code,
        name: vendor.name,
      }
    });
  }

  // Reload maps from DB
  const dbRawMaterials = await prisma.rawMaterial.findMany({ where: { companyId } });
  const dbVendors = await prisma.vendor.findMany({ where: { companyId } });

  // Insert Moulds
  let mouldsCreated = 0;
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const name = row['MOULD NAME'];
    if (!name) continue;

    let code = row['MODEL'] || `MOULD-${i+1}`;
    const cavityCount = parseInt(row['NO OF CAVITY']) || 1;
    const partWeightG = (parseFloat(row['P.WEIGHT']) || 0) * 1000;
    const runnerWeightG = (parseFloat(row['RUNNER WEIGHT']) || 0) * 1000;
    
    // shot_weight_g = runner_weight_g + (part_weight_g × cavity_count)
    const shotWeightG = runnerWeightG + (partWeightG * cavityCount);
    
    // Check if mould code already exists to prevent duplicate error
    const existing = await prisma.mould.findUnique({
      where: {
        companyId_code: { companyId, code }
      }
    });

    if (!existing) {
      await prisma.mould.create({
        data: {
          companyId,
          name,
          code,
          cavityCount,
          partWeightG,
          runnerWeightG,
          shotWeightG,
          shotLifeLimit: 50000,
          lifecycleState: 'active',
        }
      });
      mouldsCreated++;
    }
  }

  console.log(`Seed complete!`);
  console.log(`Created/Ensured Company: ${company.name}`);
  console.log(`Raw Materials: ${dbRawMaterials.length}`);
  console.log(`Vendors: ${dbVendors.length}`);
  console.log(`Moulds Created: ${mouldsCreated}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
