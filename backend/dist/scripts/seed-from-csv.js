"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
async function main() {
    const csvFilePath = path.join(__dirname, '../../Part and mold lists.csv');
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    const records = (0, sync_1.parse)(fileContent, {
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
        if (!name)
            continue;
        let code = row['MODEL'] || `MOULD-${i + 1}`;
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
