/**
 * Development seed — realistic sample data for testing.
 */
import 'dotenv/config';
import { PrismaClient, Role, type User, type Kit, type KitItem } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Helpers ──────────────────────────────────────────────────────────────────

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rndInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}

function monthsFromNow(m: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return d;
}

// ── Master item catalogue ────────────────────────────────────────────────────

const ITEM_POOL = [
  // Wound Care
  { name: 'Adhesive Bandages (assorted)',  category: 'Wound Care',          unit: 'pcs',     minQty: 20, maxQty: 60, expiryMonths: 36 },
  { name: 'Sterile Gauze Pads 10×10cm',   category: 'Wound Care',          unit: 'pcs',     minQty: 10, maxQty: 30, expiryMonths: 48 },
  { name: 'Elastic Bandage 5cm',          category: 'Wound Care',          unit: 'pcs',     minQty: 4,  maxQty: 10, expiryMonths: 60 },
  { name: 'Elastic Bandage 10cm',         category: 'Wound Care',          unit: 'pcs',     minQty: 4,  maxQty: 10, expiryMonths: 60 },
  { name: 'Antiseptic Wipes',             category: 'Wound Care',          unit: 'pcs',     minQty: 20, maxQty: 50, expiryMonths: 24 },
  { name: 'Wound Closure Strips',         category: 'Wound Care',          unit: 'pcs',     minQty: 10, maxQty: 20, expiryMonths: 36 },
  { name: 'Hydrogel Burn Dressing',       category: 'Wound Care',          unit: 'pcs',     minQty: 2,  maxQty: 6,  expiryMonths: 24 },
  { name: 'Triangular Bandage',           category: 'Wound Care',          unit: 'pcs',     minQty: 2,  maxQty: 4,  expiryMonths: null },
  { name: 'Sterile Eye Pad',              category: 'Wound Care',          unit: 'pcs',     minQty: 4,  maxQty: 10, expiryMonths: 36 },
  // Medication
  { name: 'Paracetamol 500mg',            category: 'Medication',          unit: 'tablets', minQty: 20, maxQty: 50, expiryMonths: 18 },
  { name: 'Ibuprofen 400mg',              category: 'Medication',          unit: 'tablets', minQty: 16, maxQty: 32, expiryMonths: 18 },
  { name: 'Aspirin 300mg',               category: 'Medication',          unit: 'tablets', minQty: 10, maxQty: 20, expiryMonths: 24 },
  { name: 'Antihistamine Tablets',        category: 'Medication',          unit: 'tablets', minQty: 10, maxQty: 20, expiryMonths: 12 },
  { name: 'Burn Gel Tube',               category: 'Medication',          unit: 'tubes',   minQty: 2,  maxQty: 4,  expiryMonths: 24 },
  { name: 'Eye Wash Solution 250ml',      category: 'Medication',          unit: 'bottles', minQty: 1,  maxQty: 3,  expiryMonths: 6 },
  { name: 'Saline Solution 500ml',        category: 'Medication',          unit: 'bottles', minQty: 2,  maxQty: 4,  expiryMonths: 12 },
  { name: 'Oral Rehydration Sachets',     category: 'Medication',          unit: 'pcs',     minQty: 4,  maxQty: 10, expiryMonths: 18 },
  // Personal Protection
  { name: 'Nitrile Gloves S',            category: 'Personal Protection', unit: 'pairs',   minQty: 5,  maxQty: 20, expiryMonths: 36 },
  { name: 'Nitrile Gloves M',            category: 'Personal Protection', unit: 'pairs',   minQty: 5,  maxQty: 20, expiryMonths: 36 },
  { name: 'Nitrile Gloves L',            category: 'Personal Protection', unit: 'pairs',   minQty: 5,  maxQty: 20, expiryMonths: 36 },
  { name: 'Surgical Face Mask',          category: 'Personal Protection', unit: 'pcs',     minQty: 10, maxQty: 30, expiryMonths: 36 },
  { name: 'FFP2 Respirator Mask',        category: 'Personal Protection', unit: 'pcs',     minQty: 4,  maxQty: 10, expiryMonths: 36 },
  { name: 'Protective Goggles',          category: 'Personal Protection', unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  { name: 'Disposable Apron',            category: 'Personal Protection', unit: 'pcs',     minQty: 5,  maxQty: 10, expiryMonths: null },
  // Diagnostic
  { name: 'Digital Thermometer',         category: 'Diagnostic',          unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  { name: 'Pulse Oximeter',              category: 'Diagnostic',          unit: 'pcs',     minQty: 1,  maxQty: 1,  expiryMonths: null },
  { name: 'Blood Pressure Monitor',      category: 'Diagnostic',          unit: 'pcs',     minQty: 1,  maxQty: 1,  expiryMonths: null },
  { name: 'Glucose Test Strips',         category: 'Diagnostic',          unit: 'pcs',     minQty: 10, maxQty: 25, expiryMonths: 12 },
  // Resuscitation
  { name: 'CPR Face Shield',             category: 'Resuscitation',       unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: 36 },
  { name: 'Pocket CPR Mask',             category: 'Resuscitation',       unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  // Emergency Supplies
  { name: 'Emergency Blanket',           category: 'Emergency Supplies',  unit: 'pcs',     minQty: 2,  maxQty: 4,  expiryMonths: null },
  { name: 'Cold Pack (instant)',         category: 'Emergency Supplies',  unit: 'pcs',     minQty: 3,  maxQty: 8,  expiryMonths: 36 },
  { name: 'Hot Pack (instant)',          category: 'Emergency Supplies',  unit: 'pcs',     minQty: 2,  maxQty: 6,  expiryMonths: 36 },
  { name: 'Tourniquet',                  category: 'Emergency Supplies',  unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  // Tools
  { name: 'Trauma Scissors',            category: 'Tools',               unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  { name: 'Tweezers (splinter)',        category: 'Tools',               unit: 'pcs',     minQty: 1,  maxQty: 2,  expiryMonths: null },
  { name: 'Safety Pins (assorted)',     category: 'Tools',               unit: 'pcs',     minQty: 6,  maxQty: 12, expiryMonths: null },
  { name: 'Disposable Gloves Box',      category: 'Tools',               unit: 'boxes',   minQty: 1,  maxQty: 3,  expiryMonths: 36 },
  { name: 'Adhesive Tape 2.5cm',        category: 'Tools',               unit: 'rolls',   minQty: 2,  maxQty: 4,  expiryMonths: null },
  { name: 'Digital Torch',              category: 'Tools',               unit: 'pcs',     minQty: 1,  maxQty: 1,  expiryMonths: null },
];

const INCIDENT_DESCRIPTIONS = [
  'Employee sustained a minor cut while handling equipment.',
  'Worker slipped and suffered a sprained ankle.',
  'Chemical splash to the eyes during lab procedure.',
  'Minor burn from hot surface contact.',
  'Laceration on hand from broken glass.',
  'Head injury from bump against shelf.',
  'Allergic reaction — antihistamine administered.',
  'Nose bleed during shift — gauze used.',
  'Worker felt faint — glucose and ORS administered.',
  'Insect sting — antihistamine and cold pack applied.',
  'Back strain while lifting — cold pack and pain relief given.',
  'Paper cut turned infected — antiseptic and bandage applied.',
];

const INSPECTION_NOTES = [
  'All items present and within expiry. Kit in good condition.',
  'Eye wash solution nearing expiry — flagged for replacement.',
  'Paracetamol stock low — restocking requested.',
  'All items checked. Two bandages replaced from stock.',
  'Kit fully stocked. No issues found.',
  'Gloves running low — order placed.',
  'Monthly inspection complete. Minor restocking done.',
  'Cold packs expired — removed and replacement ordered.',
  'Kit slightly disorganised — reorganised during inspection.',
  null,
];

async function main() {
  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@fakcrm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 12),
        fullName: process.env.SEED_ADMIN_NAME ?? 'System Admin',
        role: Role.ADMIN,
      },
    });
    console.log(`[seed] Admin created: ${adminEmail}`);
  } else {
    console.log(`[seed] Admin already exists`);
  }

  // Skip the rest if checkers already exist
  const checkerCount = await prisma.user.count({ where: { role: Role.CHECKER } });
  if (checkerCount > 0) {
    console.log(`[seed] Sample data already seeded — skipping`);
    return;
  }

  // ── 20 Checker users ─────────────────────────────────────────────────────────
  const checkerDefs = [
    { fullName: 'Maria Papadaki',     email: 'maria.papadaki@fakcrm.local' },
    { fullName: 'Nikos Georgiou',     email: 'nikos.georgiou@fakcrm.local' },
    { fullName: 'Elena Stavrou',      email: 'elena.stavrou@fakcrm.local' },
    { fullName: 'Dimitris Kostas',    email: 'dimitris.kostas@fakcrm.local' },
    { fullName: 'Sofia Alexiou',      email: 'sofia.alexiou@fakcrm.local' },
    { fullName: 'Petros Ioannidis',   email: 'petros.ioannidis@fakcrm.local' },
    { fullName: 'Anna Theodorou',     email: 'anna.theodorou@fakcrm.local' },
    { fullName: 'Giorgos Makris',     email: 'giorgos.makris@fakcrm.local' },
    { fullName: 'Ioanna Vasiliou',    email: 'ioanna.vasiliou@fakcrm.local' },
    { fullName: 'Kostas Nikolaou',    email: 'kostas.nikolaou@fakcrm.local' },
    { fullName: 'Chrysa Mpekiari',    email: 'chrysa.mpekiari@fakcrm.local' },
    { fullName: 'Thanasis Mourtzoukos', email: 'thanasis.mourtzoukos@fakcrm.local' },
    { fullName: 'Vasia Kontou',       email: 'vasia.kontou@fakcrm.local' },
    { fullName: 'Lefteris Papadopoulos', email: 'lefteris.papadopoulos@fakcrm.local' },
    { fullName: 'Katerina Zografou',  email: 'katerina.zografou@fakcrm.local' },
    { fullName: 'Spyros Alexakis',    email: 'spyros.alexakis@fakcrm.local' },
    { fullName: 'Theodora Kampos',    email: 'theodora.kampos@fakcrm.local' },
    { fullName: 'Manolis Daskalakis', email: 'manolis.daskalakis@fakcrm.local' },
    { fullName: 'Irene Papadimitriou', email: 'irene.papadimitriou@fakcrm.local' },
    { fullName: 'Alexis Fountoulakis', email: 'alexis.fountoulakis@fakcrm.local' },
  ];

  const checkers: User[] = [];
  const hashedPw = await bcrypt.hash('Checker1!', 12);
  for (const c of checkerDefs) {
    const user = await prisma.user.create({
      data: { ...c, password: hashedPw, role: Role.CHECKER },
    });
    checkers.push(user);
  }
  console.log(`[seed] Created ${checkers.length} checker users`);

  // ── 10 Kits ──────────────────────────────────────────────────────────────────
  const kitDefs = [
    { name: 'HQ – Reception',          location: 'Headquarters, Ground Floor',    description: 'Main entrance first-aid station' },
    { name: 'HQ – IT Department',      location: 'Headquarters, Floor 2',         description: 'IT wing kit' },
    { name: 'HQ – Executive Floor',    location: 'Headquarters, Floor 5',         description: 'Executive level kit' },
    { name: 'Warehouse A – North',     location: 'Warehouse A, North Section',    description: 'Heavy-use industrial kit' },
    { name: 'Warehouse A – South',     location: 'Warehouse A, South Section',    description: 'Secondary warehouse kit' },
    { name: 'Factory Floor – Line 1',  location: 'Factory Building, Line 1',      description: 'Production line first-aid' },
    { name: 'Factory Floor – Line 2',  location: 'Factory Building, Line 2',      description: 'Production line first-aid' },
    { name: 'Cafeteria & Kitchen',     location: 'Ground Floor Cafeteria',        description: 'Kitchen and dining area kit' },
    { name: 'Outdoor Facilities',      location: 'Exterior – Parking & Grounds',  description: 'Outdoor events and grounds kit' },
    { name: 'Medical Room',            location: 'Building B, Room 102',          description: 'Primary medical response station' },
  ];

  // Assign 3–5 checkers per kit (mix and match)
  const checkerGroups = [
    [0,1,2,3],       // HQ Reception
    [1,4,5],         // HQ IT
    [6,7,2],         // HQ Executive
    [3,8,9,10],      // Warehouse A North
    [8,11,12,3],     // Warehouse A South
    [11,13,14,15],   // Factory Line 1
    [14,15,16,17],   // Factory Line 2
    [2,4,18,19],     // Cafeteria
    [5,9,16,19],     // Outdoor
    [0,6,7,13,18],   // Medical Room
  ];

  const kits: Kit[] = [];
  for (let i = 0; i < kitDefs.length; i++) {
    const assigneeIds = checkerGroups[i]!.map((idx) => ({ id: checkers[idx]!.id }));
    const kit = await prisma.kit.create({
      data: {
        ...kitDefs[i]!,
        assignees: { connect: assigneeIds } as never,
      },
    });
    kits.push(kit);
  }
  console.log(`[seed] Created ${kits.length} kits`);

  // ── Items per kit ─────────────────────────────────────────────────────────────
  // Each kit gets a randomised subset of 20–32 items from the pool
  const allKitItems: Map<string, KitItem[]> = new Map();

  for (const kit of kits) {
    // shuffle pool and pick 20–32
    const shuffled = [...ITEM_POOL].sort(() => Math.random() - 0.5);
    const count = rndInt(20, 32);
    const selected = shuffled.slice(0, count);

    const kitItems: KitItem[] = [];
    for (const tmpl of selected) {
      const expiry = tmpl.expiryMonths !== null
        ? monthsFromNow(rndInt(Math.max(1, tmpl.expiryMonths - 6), tmpl.expiryMonths + 6))
        : null;
      const qty = rndInt(tmpl.minQty, tmpl.maxQty);
      const ki = await prisma.kitItem.create({
        data: {
          kitId: kit.id,
          name: tmpl.name,
          category: tmpl.category,
          unit: tmpl.unit,
          quantity: qty,
          expirationDate: expiry,
        },
      });
      kitItems.push(ki);
    }
    allKitItems.set(kit.id, kitItems);
    console.log(`[seed] ${kitItems.length} items added to "${kit.name}"`);
  }

  // ── Inspections — monthly over past 12 months ─────────────────────────────────
  let totalInspections = 0;
  for (const kit of kits) {
    const kitItems = allKitItems.get(kit.id)!;
    const assignedCheckerIds = checkerGroups[kits.indexOf(kit)]!.map((idx) => checkers[idx]!.id);

    for (let monthsBack = 12; monthsBack >= 0; monthsBack--) {
      // ~80% chance of inspection each month per kit
      if (monthsBack > 0 && Math.random() < 0.2) continue;

      const daysOffset = monthsBack * 30 + rndInt(0, 10);
      const inspectedAt = daysAgo(daysOffset);
      const inspectorId = rnd(assignedCheckerIds)!;

      // Inspect a random subset of items (80–100%)
      const itemsToInspect = kitItems
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(kitItems.length * rndInt(80, 100) / 100));

      await prisma.inspectionLog.create({
        data: {
          kitId: kit.id,
          inspectedById: inspectorId,
          notes: rnd(INSPECTION_NOTES) ?? undefined,
          createdAt: inspectedAt,
          items: {
            create: itemsToInspect.map((ki) => ({
              kitItemId: ki.id,
              quantityFound: Math.max(0, ki.quantity - rndInt(0, 2)),
              expirationDateFound: ki.expirationDate ?? null,
              notes: Math.random() < 0.1 ? 'Item checked manually' : null,
            })),
          },
        },
      });
      totalInspections++;
    }
  }
  console.log(`[seed] Created ${totalInspections} inspection logs`);

  // ── Incidents — random occurrences over past 12 months ───────────────────────
  let totalIncidents = 0;
  for (const kit of kits) {
    const kitItems = allKitItems.get(kit.id)!;
    const assignedCheckerIds = checkerGroups[kits.indexOf(kit)]!.map((idx) => checkers[idx]!.id);
    const consumableItems = kitItems.filter((ki) =>
      ['Wound Care', 'Medication', 'Emergency Supplies'].includes(ki.category ?? '')
    );

    // 3–8 incidents per kit over the year
    const incidentCount = rndInt(3, 8);
    const usedDays = new Set<number>();

    for (let n = 0; n < incidentCount; n++) {
      let day: number;
      do { day = rndInt(1, 365); } while (usedDays.has(day));
      usedDays.add(day);

      const reporterId = rnd(assignedCheckerIds)!;
      const itemsUsed = consumableItems
        .sort(() => Math.random() - 0.5)
        .slice(0, rndInt(1, 4));

      await (prisma as any).incidentReport.create({
        data: {
          kitId: kit.id,
          reportedById: reporterId,
          description: rnd(INCIDENT_DESCRIPTIONS),
          createdAt: daysAgo(day),
          items: {
            create: itemsUsed.map((ki) => ({
              kitItemId: ki.id,
              quantityUsed: rndInt(1, Math.min(3, ki.quantity)),
              notes: Math.random() < 0.3 ? 'Used during incident response' : null,
            })),
          },
        },
      });
      totalIncidents++;
    }
  }
  console.log(`[seed] Created ${totalIncidents} incident reports`);
  console.log('[seed] Done ✔');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
