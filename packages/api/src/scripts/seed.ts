import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Seed database with fixture data
 * Loads customers, cards, accounts, KB docs, policies, devices, chargebacks, and alerts
 */
async function seed() {
  console.log('🌱 Starting database seed...');

  const fixturesPath = path.join(__dirname, '../../fixtures');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await prisma.agentTrace.deleteMany();
    await prisma.triageRun.deleteMany();
    await prisma.caseEvent.deleteMany();
    await prisma.case.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.chargeback.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.device.deleteMany();
    await prisma.policy.deleteMany();
    await prisma.kbDoc.deleteMany();
    await prisma.account.deleteMany();
    await prisma.card.deleteMany();
    await prisma.customer.deleteMany();

    // Seed customers
    console.log('Seeding customers...');
    const customers = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'customers.json'), 'utf-8')
    );
    for (const customer of customers) {
      await prisma.customer.create({ data: customer });
    }
    console.log(`✓ Created ${customers.length} customers`);

    // Seed cards
    console.log('Seeding cards...');
    const cards = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'cards.json'), 'utf-8')
    );
    for (const card of cards) {
      await prisma.card.create({ data: card });
    }
    console.log(`✓ Created ${cards.length} cards`);

    // Seed accounts
    console.log('Seeding accounts...');
    const accounts = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'accounts.json'), 'utf-8')
    );
    for (const account of accounts) {
      await prisma.account.create({ data: account });
    }
    console.log(`✓ Created ${accounts.length} accounts`);

    // Seed KB docs
    console.log('Seeding KB documents...');
    const kbDocs = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'kb_docs.json'), 'utf-8')
    );
    for (const doc of kbDocs) {
      await prisma.kbDoc.create({ data: doc });
    }
    console.log(`✓ Created ${kbDocs.length} KB documents`);

    // Seed policies
    console.log('Seeding policies...');
    const policies = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'policies.json'), 'utf-8')
    );
    for (const policy of policies) {
      await prisma.policy.create({ data: policy });
    }
    console.log(`✓ Created ${policies.length} policies`);

    // Seed devices
    console.log('Seeding devices...');
    const devices = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'devices.json'), 'utf-8')
    );
    for (const device of devices) {
      await prisma.device.create({ data: device });
    }
    console.log(`✓ Created ${devices.length} devices`);

    // Seed chargebacks
    console.log('Seeding chargebacks...');
    const chargebacks = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'chargebacks.json'), 'utf-8')
    );
    for (const chargeback of chargebacks) {
      await prisma.chargeback.create({ data: chargeback });
    }
    console.log(`✓ Created ${chargebacks.length} chargebacks`);

    // Generate sample transactions (200k+)
    console.log('Generating transactions (this may take a while)...');
    await generateTransactions(200000);

    // Seed alerts (after transactions)
    console.log('Seeding alerts...');
    const alerts = JSON.parse(
      fs.readFileSync(path.join(fixturesPath, 'alerts.json'), 'utf-8')
    );
    
    // Create suspect transactions first
    const suspectTxns = [
      {
        id: 'txn_suspect_001',
        customerId: 'cust_002',
        cardId: 'card_002',
        mcc: '5999',
        merchant: 'Unknown Online Store',
        amountCents: 4999,
        currency: 'INR',
        ts: new Date('2025-01-20T09:00:00Z'),
        deviceId: 'device_android_002',
        country: 'IN',
        city: 'Mumbai',
      },
      {
        id: 'txn_suspect_002',
        customerId: 'cust_004',
        cardId: 'card_004',
        mcc: '4816',
        merchant: 'QuickCab',
        amountCents: 8500,
        currency: 'INR',
        ts: new Date('2025-01-21T13:00:00Z'),
        deviceId: 'device_ios_001',
        country: 'IN',
        city: 'Bangalore',
      },
      {
        id: 'txn_suspect_003',
        customerId: 'cust_001',
        cardId: 'card_001',
        mcc: '5411',
        merchant: 'ABC Mart',
        amountCents: 499900,
        currency: 'INR',
        ts: new Date('2025-01-22T08:00:00Z'),
        deviceId: 'device_web_001',
        country: 'IN',
        city: 'Delhi',
      },
    ];

    for (const txn of suspectTxns) {
      await prisma.transaction.create({ data: txn });
    }

    for (const alert of alerts) {
      await prisma.alert.create({ data: alert });
    }
    console.log(`✓ Created ${alerts.length} alerts`);

    console.log('✅ Database seeded successfully!');
    console.log('\nSeeded data summary:');
    console.log(`  - ${customers.length} customers`);
    console.log(`  - ${cards.length} cards`);
    console.log(`  - ${accounts.length} accounts`);
    console.log(`  - 200,000+ transactions`);
    console.log(`  - ${alerts.length} alerts`);
    console.log(`  - ${kbDocs.length} KB documents`);
    console.log(`  - ${policies.length} policies`);
    console.log(`  - ${devices.length} devices`);
    console.log(`  - ${chargebacks.length} chargebacks`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate realistic transaction data
 * @param count - Number of transactions to generate
 */
async function generateTransactions(count: number) {
  const merchants = [
    { name: 'Amazon India', mcc: '5999' },
    { name: 'Swiggy', mcc: '5812' },
    { name: 'Zomato', mcc: '5812' },
    { name: 'Big Bazaar', mcc: '5411' },
    { name: 'Reliance Fresh', mcc: '5411' },
    { name: 'Uber India', mcc: '4121' },
    { name: 'Ola Cabs', mcc: '4121' },
    { name: 'BookMyShow', mcc: '7832' },
    { name: 'PVR Cinemas', mcc: '7832' },
    { name: 'Shell Petrol', mcc: '5541' },
    { name: 'HP Gas Station', mcc: '5541' },
    { name: 'Flipkart', mcc: '5999' },
    { name: 'Myntra', mcc: '5651' },
    { name: 'Starbucks', mcc: '5814' },
    { name: 'McDonald\'s', mcc: '5814' },
    { name: 'DMart', mcc: '5411' },
    { name: 'MakeMyTrip', mcc: '4722' },
    { name: 'OYO Rooms', mcc: '7011' },
    { name: 'Apollo Pharmacy', mcc: '5912' },
    { name: 'Decathlon', mcc: '5941' },
  ];

  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune'];
  const devices = ['device_android_001', 'device_ios_001', 'device_web_001', 'device_android_002'];
  const customerIds = ['cust_001', 'cust_002', 'cust_003', 'cust_004', 'cust_005'];
  const cardIds = ['card_001', 'card_002', 'card_003', 'card_004', 'card_005'];

  const batchSize = 1000;
  const batches = Math.ceil(count / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const transactionsToCreate = [];
    const currentBatchSize = Math.min(batchSize, count - batch * batchSize);

    for (let i = 0; i < currentBatchSize; i++) {
      const customerIdx = Math.floor(Math.random() * customerIds.length);
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      
      // Generate timestamp within last 6 months
      const daysAgo = Math.floor(Math.random() * 180);
      const hoursOffset = Math.floor(Math.random() * 24);
      const ts = new Date();
      ts.setDate(ts.getDate() - daysAgo);
      ts.setHours(hoursOffset);

      // Generate realistic amounts (most small, some large)
      let amountCents: number;
      const rand = Math.random();
      if (rand < 0.7) {
        // 70% small amounts (₹50 - ₹2000)
        amountCents = Math.floor(Math.random() * 195000) + 5000;
      } else if (rand < 0.95) {
        // 25% medium amounts (₹2000 - ₹10000)
        amountCents = Math.floor(Math.random() * 800000) + 200000;
      } else {
        // 5% large amounts (₹10000 - ₹50000)
        amountCents = Math.floor(Math.random() * 4000000) + 1000000;
      }

      transactionsToCreate.push({
        id: `txn_${batch}_${i}`,
        customerId: customerIds[customerIdx],
        cardId: cardIds[customerIdx],
        mcc: merchant.mcc,
        merchant: merchant.name,
        amountCents,
        currency: 'INR',
        ts,
        deviceId: devices[Math.floor(Math.random() * devices.length)],
        country: 'IN',
        city: cities[Math.floor(Math.random() * cities.length)],
      });
    }

    // Bulk insert
    await prisma.transaction.createMany({
      data: transactionsToCreate,
      skipDuplicates: true,
    });

    if ((batch + 1) % 10 === 0) {
      console.log(`  Generated ${(batch + 1) * batchSize} / ${count} transactions...`);
    }
  }

  console.log(`✓ Generated ${count} transactions`);
}

// Run seed
seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
