import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const IMAGE =
  'http://localhost:9000/public/products%2F2341a108-5deb-4c21-a6c0-82d571859366.jpg';

async function upsertUser(
  email: string,
  password: string,
  role: 'ADMIN' | 'MERCHANT' | 'USER',
) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: hash, role },
  });
}

async function main() {
  console.log('🌍 Seeding base data...');

  // ========== REGIONS / CITIES / MARKETS ==========
  const regions = [
    {
      country: 'United Arab Emirates',
      name: 'United Arab Emirates',
      code: 'AE',
      cities: [
        {
          name: 'Abu Dhabi',
          markets: [
            { name: 'Marina Mall' },
            { name: 'Al Wahda Mall' },
            { name: 'Dalma Mall' },
          ],
        },
        {
          name: 'Dubai',
          markets: [
            { name: 'Dubai Mall' },
            { name: 'Deira City Centre' },
            { name: 'Mall of the Emirates' },
          ],
        },
        { name: 'Sharjah', markets: [{ name: 'Souq Al Jubail' }] },
      ],
    },
    {
      country: 'Syria',
      name: 'Syria',
      code: 'SY',
      cities: [
        {
          name: 'Damascus',
          markets: [
            { name: 'Al-Hamidiya' },
            { name: 'Al-Midan' },
            { name: "Insha'at" },
          ],
        },
        {
          name: 'Aleppo',
          markets: [{ name: 'Souq al-Madina' }],
        },
      ],
    },
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: { name: region.name },
      update: {},
      create: {
        country: region.country,
        name: region.name,
        code: region.code,
        cities: {
          create: region.cities.map((city) => ({
            name: city.name,
            markets: { create: city.markets },
          })),
        },
      },
    });
    // prisma/seed.ts (أمثلة سريعة)
    await prisma.region.upsert({
      where: { code: 'SY' },
      create: {
        name: 'Syria',
        code: 'SY',
        country: 'Syria',
        cities: {
          create: [
            {
              name: 'Damascus',
              latitude: 33.5138,
              longitude: 36.2765,
              markets: {
                create: [{ name: 'Al-Hamidiya' }, { name: 'Al-Midan' }],
              },
            },
            {
              name: 'Aleppo',
              latitude: 36.2021,
              longitude: 37.1343,
              markets: { create: [{ name: 'Souq al-Madina' }] },
            },
          ],
        },
      },
      update: {},
    });

    await prisma.region.upsert({
      where: { code: 'AE' },
      create: {
        name: 'United Arab Emirates',
        code: 'AE',
        country: 'UAE',
        cities: {
          create: [
            { name: 'Abu Dhabi', latitude: 24.4539, longitude: 54.3773 },
            { name: 'Dubai', latitude: 25.2048, longitude: 55.2708 },
          ],
        },
      },
      update: {},
    });
  }

  const allRegions = await prisma.region.findMany({
    include: { cities: { include: { markets: true } } },
  });

  const getCity = (region: string, city: string) =>
    allRegions
      .find((r) => r.name === region)
      ?.cities.find((c) => c.name === city)!;
  const getMarket = (region: string, city: string, market: string) =>
    getCity(region, city).markets.find((m) => m.name === market)!;

  // ========== USERS ==========
  console.log('👤 Creating users...');
  const admin = await upsertUser('admin@tujjar.local', 'Admin123!', 'ADMIN');
  const merchant = await upsertUser(
    'merchant@tujjar.local',
    'Merchant123!',
    'MERCHANT',
  );
  const user = await upsertUser('user@tujjar.local', 'User123!', 'USER');

  // ========== STORES ==========
  console.log('🏬 Creating stores...');
  const storesData: Prisma.StoreCreateInput[] = [
    {
      name: 'Marina Electronics',
      slug: 'marina-electronics',
      owner: { connect: { id: merchant.id } },
      city: {
        connect: { id: getCity('United Arab Emirates', 'Abu Dhabi').id },
      },
      market: {
        connect: {
          id: getMarket('United Arab Emirates', 'Abu Dhabi', 'Marina Mall').id,
        },
      },
      imageUrl: IMAGE,
    },
    {
      name: 'Dubai Beauty',
      slug: 'dubai-beauty',
      owner: { connect: { id: merchant.id } },
      city: { connect: { id: getCity('United Arab Emirates', 'Dubai').id } },
      market: {
        connect: {
          id: getMarket('United Arab Emirates', 'Dubai', 'Dubai Mall').id,
        },
      },
      imageUrl: IMAGE,
    },
    {
      name: 'Al-Hamidiya Fashion',
      slug: 'al-hamidiya-fashion',
      owner: { connect: { id: merchant.id } },
      city: { connect: { id: getCity('Syria', 'Damascus').id } },
      market: {
        connect: { id: getMarket('Syria', 'Damascus', 'Al-Hamidiya').id },
      },
      imageUrl: IMAGE,
    },
    {
      name: 'Souq Al-Madina Shoes',
      slug: 'souq-al-madina-shoes',
      owner: { connect: { id: merchant.id } },
      city: { connect: { id: getCity('Syria', 'Aleppo').id } },
      market: {
        connect: { id: getMarket('Syria', 'Aleppo', 'Souq al-Madina').id },
      },
      imageUrl: IMAGE,
    },
  ];

  for (const s of storesData) {
    await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }

  const stores = await prisma.store.findMany({
    where: { ownerId: merchant.id },
  });
  const storeBySlug = new Map(stores.map((s) => [s.slug, s]));

  // ========== PRODUCTS ==========
  console.log('🛒 Generating products...');
  const categories = ['Fashion', 'Electronics', 'Beauty', 'Home', 'Toys'];
  const productNames = [
    'Wireless Headphones',
    'Smart Watch',
    'Leather Shoes',
    'Cotton T-Shirt',
    'LED Lamp',
    'Coffee Maker',
    'Perfume Oud',
    'Gaming Mouse',
    'Bluetooth Speaker',
    'Office Chair',
    'Body Lotion',
    'Toy Car',
    'Wireless Charger',
  ];

  for (const [slug, store] of storeBySlug.entries()) {
    for (let i = 0; i < 15; i++) {
      const randomName =
        productNames[Math.floor(Math.random() * productNames.length)];
      const randomCategory =
        categories[Math.floor(Math.random() * categories.length)];
      const randomPrice = Math.floor(Math.random() * 400) + 30;

      await prisma.product.create({
        data: {
          name: `${randomName} ${i + 1}`,
          price: randomPrice * 1000,
          category: randomCategory,
          status: 'ACTIVE',
          imageUrl: IMAGE,
          store: { connect: { id: store.id } },
        },
      });
    }
  }

  console.log('✅ Done seeding everything!');
  console.table([
    { email: admin.email, role: admin.role },
    { email: merchant.email, role: merchant.role },
    { email: user.email, role: user.role },
  ]);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
