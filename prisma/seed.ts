import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { googleSub: 'test-google-sub-123' },
    update: {},
    create: {
      hashid: nanoid(10),
      googleSub: 'test-google-sub-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://via.placeholder.com/150',
    },
  });

  console.log('Created test user:', testUser.email);

  // Create a test project
  const testProject = await prisma.project.upsert({
    where: { hashid: 'test-project-1' },
    update: {},
    create: {
      hashid: 'test-project-1',
      ownerId: testUser.id,
      brandName: 'Example Brand',
      brandWebsite: 'https://example.com',
      initialMetadata: {
        description: 'A test brand for development',
        industry: 'Technology',
      },
      findingsDraft: {
        tone: 'Professional and friendly',
        values: ['Innovation', 'Quality', 'Trust'],
      },
    },
  });

  console.log('Created test project:', testProject.brandName);

  // Create a test message
  await prisma.message.create({
    data: {
      projectId: testProject.id,
      senderId: testUser.id,
      role: 'user',
      content: {
        text: 'Hello! I want to create audio branding for my company.',
      },
    },
  });

  console.log('Created test message');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
