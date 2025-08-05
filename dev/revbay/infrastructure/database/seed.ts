import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a test customer
  const customer = await prisma.customer.create({
    data: {
      email: 'test@revbay.com',
      name: 'Test Customer',
      apiKey: process.env.TEST_API_KEY || 'generated_test_key_replace_in_production',
      metadata: {
        plan: 'development',
        source: 'seed_script'
      }
    }
  });

  console.log('✅ Test customer created:');
  console.log('📧 Email:', customer.email);
  console.log('🔑 API Key:', customer.apiKey);
  console.log('🆔 Customer ID:', customer.id);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });