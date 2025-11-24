import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
  console.log('🌱 Seeding test data...');

  try {
    // Create test customers
    const customer1 = await prisma.customer.upsert({
      where: { id: 'cust_1001' },
      update: {},
      create: {
        id: 'cust_1001',
        emailMasked: 'test****@example.com',
        name: 'Test Customer 1001',
        kycLevel: 'full',
        createdAt: new Date(),
      },
    });
    console.log('✅ Created customer:', customer1.id);

    const customer2 = await prisma.customer.upsert({
      where: { id: 'cust_1002' },
      update: {},
      create: {
        id: 'cust_1002',
        emailMasked: 'test****@example.com',
        name: 'Test Customer 1002',
        kycLevel: 'basic',
        createdAt: new Date(),
      },
    });
    console.log('✅ Created customer:', customer2.id);

    // Create test cards
    const card1 = await prisma.card.upsert({
      where: { id: 'card_2001' },
      update: {},
      create: {
        id: 'card_2001',
        customerId: 'cust_1001',
        last4: '4001',
        network: 'VISA',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    });
    console.log('✅ Created card:', card1.id);

    const card2 = await prisma.card.upsert({
      where: { id: 'card_2002' },
      update: {},
      create: {
        id: 'card_2002',
        customerId: 'cust_1002',
        last4: '4002',
        network: 'MASTERCARD',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    });
    console.log('✅ Created card:', card2.id);

    console.log('🎉 Test data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
