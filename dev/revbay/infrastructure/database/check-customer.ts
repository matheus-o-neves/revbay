import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.findUnique({
    where: { email: 'test@revbay.com' }
  });

  if (customer) {
    console.log('✅ Customer found:');
    console.log('📧 Email:', customer.email);
    console.log('🔑 API Key:', customer.apiKey);
    console.log('🆔 Customer ID:', customer.id);
  } else {
    console.log('❌ No customer found');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });