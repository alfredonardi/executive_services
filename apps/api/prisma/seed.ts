import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin123!Dev', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@executiveconciergesp.com' },
    update: {},
    create: {
      email: 'admin@executiveconciergesp.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      preferences: {},
      timezone: 'America/Sao_Paulo',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create a concierge agent
  const agentPasswordHash = await bcrypt.hash('Agent123!Dev', 12);
  const agent = await prisma.user.upsert({
    where: { email: 'agent@executiveconciergesp.com' },
    update: {},
    create: {
      email: 'agent@executiveconciergesp.com',
      firstName: 'Concierge',
      lastName: 'Agent',
      role: UserRole.CONCIERGE_AGENT,
      passwordHash: agentPasswordHash,
      preferences: {},
      timezone: 'America/Sao_Paulo',
    },
  });
  console.log('✅ Concierge agent created:', agent.email);

  // Create invitation for test executive
  const existingInvite = await prisma.invitation.findUnique({
    where: { email: 'executive@example.com' },
  });

  if (!existingInvite) {
    await prisma.invitation.create({
      data: {
        email: 'executive@example.com',
        role: UserRole.EXECUTIVE,
        token: 'dev-invite-token-change-in-prod',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        invitedById: admin.id,
      },
    });
    console.log('✅ Executive invitation created for executive@example.com');
    console.log('   Invite token: dev-invite-token-change-in-prod');
  }

  // Seed recommendations
  const recommendationData = [
    {
      title: 'Maní Restaurante',
      description:
        'Helena Rizzo\'s landmark restaurant offering creative Brazilian cuisine with a seasonal tasting menu. One of São Paulo\'s best dining experiences.',
      category: 'RESTAURANT' as const,
      venue: 'Maní',
      address: 'Rua Joaquim Antunes, 210',
      neighborhood: 'Jardins',
      durationMinutes: 120,
      priceLevel: 4,
      tags: ['fine-dining', 'tasting-menu', 'brazilian', 'award-winning'],
    },
    {
      title: 'D.O.M. by Alex Atala',
      description:
        'Two Michelin-starred restaurant by chef Alex Atala. Celebrates Amazonian ingredients in a refined São Paulo setting.',
      category: 'RESTAURANT' as const,
      venue: 'D.O.M.',
      address: 'Rua Barão de Capanema, 549',
      neighborhood: 'Jardins',
      durationMinutes: 150,
      priceLevel: 4,
      tags: ['fine-dining', 'michelin', 'amazonian', 'chef-experience'],
    },
    {
      title: 'Toro SP Private Spa',
      description:
        'Premium private wellness suite with deep tissue massage, infrared sauna, and cold plunge. Pre-booking required.',
      category: 'WELLNESS' as const,
      venue: 'Toro SP',
      address: 'Rua Augusta, 1508',
      neighborhood: 'Jardins',
      durationMinutes: 90,
      priceLevel: 3,
      tags: ['spa', 'massage', 'wellness', 'private-suite'],
    },
    {
      title: 'MASP Private Tour',
      description:
        'After-hours private access to the São Paulo Museum of Art with a specialist curator. Includes the Latin American and Brazilian modernism collections.',
      category: 'SHORT_EXPERIENCE' as const,
      venue: 'MASP',
      address: 'Avenida Paulista, 1578',
      neighborhood: 'Paulista',
      durationMinutes: 90,
      priceLevel: 3,
      tags: ['art', 'museum', 'culture', 'private-tour'],
    },
    {
      title: 'Vila Madalena Street Art Walk',
      description:
        'Private guided walk through São Paulo\'s most vibrant street art district. 45-minute experience, perfect for short schedule gaps.',
      category: 'MICRO_EXPERIENCE' as const,
      venue: 'Vila Madalena',
      neighborhood: 'Vila Madalena',
      durationMinutes: 45,
      priceLevel: 2,
      tags: ['street-art', 'culture', 'walking', 'short'],
    },
    {
      title: 'Notary & Legal Document Support',
      description:
        'Same-day notary service and legal document support for visiting executives. English-speaking professionals.',
      category: 'BUSINESS_SUPPORT' as const,
      neighborhood: 'Faria Lima',
      durationMinutes: 60,
      priceLevel: 3,
      tags: ['legal', 'notary', 'business', 'documents'],
    },
  ];

  for (const rec of recommendationData) {
    await prisma.recommendation.upsert({
      where: { id: `seed-${rec.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `seed-${rec.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...rec,
        curatedById: admin.id,
      },
    });
  }
  console.log(`✅ ${recommendationData.length} recommendations seeded`);

  console.log('\n🎉 Seed completed!');
  console.log('\n📝 Test credentials:');
  console.log('   Admin: admin@executiveconciergesp.com / Admin123!Dev');
  console.log('   Agent: agent@executiveconciergesp.com / Agent123!Dev');
  console.log('   Executive invite: dev-invite-token-change-in-prod');
  console.log('\n⚠️  Change these credentials before any non-local use!\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
