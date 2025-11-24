import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate large transaction dataset (1M+)
 * Usage: npm run db:generate-transactions
 */
async function generateLargeDataset() {
  const TARGET_COUNT = 1_000_000;
  console.log(`🚀 Generating ${TARGET_COUNT.toLocaleString()} transactions...`);
  
  const existingCount = await prisma.transaction.count();
  console.log(`Current transaction count: ${existingCount.toLocaleString()}`);
  
  if (existingCount >= TARGET_COUNT) {
    console.log('✅ Target already reached!');
    return;
  }

  const toGenerate = TARGET_COUNT - existingCount;
  console.log(`Generating ${toGenerate.toLocaleString()} additional transactions...`);

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
    { name: 'Shoppers Stop', mcc: '5311' },
    { name: 'Westside', mcc: '5651' },
    { name: 'Metro Cash & Carry', mcc: '5411' },
    { name: 'Spencer\'s', mcc: '5411' },
    { name: 'Pizza Hut', mcc: '5814' },
    { name: 'KFC', mcc: '5814' },
    { name: 'Domino\'s', mcc: '5814' },
    { name: 'Cafe Coffee Day', mcc: '5814' },
    { name: 'Pantaloons', mcc: '5651' },
    { name: 'Lifestyle', mcc: '5311' },
  ];

  const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
  ];
  
  const devices = [
    'device_android_001',
    'device_ios_001',
    'device_web_001',
    'device_android_002',
    'device_web_002'
  ];
  
  const customerIds = ['cust_001', 'cust_002', 'cust_003', 'cust_004', 'cust_005'];
  const cardIds = ['card_001', 'card_002', 'card_003', 'card_004', 'card_005'];

  const batchSize = 5000;
  const batches = Math.ceil(toGenerate / batchSize);
  const startTime = Date.now();

  for (let batch = 0; batch < batches; batch++) {
    const transactionsToCreate = [];
    const currentBatchSize = Math.min(batchSize, toGenerate - batch * batchSize);

    for (let i = 0; i < currentBatchSize; i++) {
      const customerIdx = Math.floor(Math.random() * customerIds.length);
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      
      // Generate timestamp within last 12 months
      const daysAgo = Math.floor(Math.random() * 365);
      const hoursOffset = Math.floor(Math.random() * 24);
      const minutesOffset = Math.floor(Math.random() * 60);
      const ts = new Date();
      ts.setDate(ts.getDate() - daysAgo);
      ts.setHours(hoursOffset, minutesOffset, 0, 0);

      // Generate realistic amounts with proper distribution
      let amountCents: number;
      const rand = Math.random();
      if (rand < 0.6) {
        // 60% small amounts (₹50 - ₹1000)
        amountCents = Math.floor(Math.random() * 95000) + 5000;
      } else if (rand < 0.85) {
        // 25% medium amounts (₹1000 - ₹5000)
        amountCents = Math.floor(Math.random() * 400000) + 100000;
      } else if (rand < 0.97) {
        // 12% large amounts (₹5000 - ₹25000)
        amountCents = Math.floor(Math.random() * 2000000) + 500000;
      } else {
        // 3% very large amounts (₹25000 - ₹100000)
        amountCents = Math.floor(Math.random() * 7500000) + 2500000;
      }

      transactionsToCreate.push({
        id: `txn_gen_${existingCount + batch * batchSize + i}`,
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

    const progress = ((batch + 1) / batches * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = ((batch + 1) * batchSize / (Date.now() - startTime) * 1000).toFixed(0);
    
    if ((batch + 1) % 10 === 0 || batch === batches - 1) {
      console.log(
        `  Progress: ${progress}% | ` +
        `Generated: ${((batch + 1) * batchSize).toLocaleString()} | ` +
        `Elapsed: ${elapsed}s | ` +
        `Rate: ${rate} txns/s`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = await prisma.transaction.count();
  
  console.log('\n✅ Transaction generation complete!');
  console.log(`Total transactions: ${finalCount.toLocaleString()}`);
  console.log(`Total time: ${totalTime}s`);
  console.log(`Average rate: ${(finalCount / (Date.now() - startTime) * 1000).toFixed(0)} txns/s`);

  await prisma.$disconnect();
}

generateLargeDataset()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
