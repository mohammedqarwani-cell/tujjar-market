import { PrismaClient, PriceType, Currency, ItemCondition } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildSearchText } from '../src/common/text/arabic';

const prisma = new PrismaClient();

// Demo numbers use the unassigned 090 prefix so no real person is contacted.
const demoPhone = (n: number) => `9639000${String(n).padStart(5, '0')}`;

type MarketSeed = [slug: string, name: string, description?: string];
const governorates: {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  markets: MarketSeed[];
}[] = [
  {
    slug: 'damascus', name: 'دمشق', lat: 33.5138, lng: 36.2765,
    markets: [
      ['al-hamidiyah', 'سوق الحميدية', 'أشهر أسواق دمشق القديمة، مسقوف ويمتد حتى الجامع الأموي'],
      ['al-buzuriyah', 'سوق البزورية', 'بهارات وعطارة وحلويات شامية'],
      ['al-hariqa', 'سوق الحريقة', 'أقمشة وألبسة بالجملة والمفرق'],
      ['midhat-pasha', 'سوق مدحت باشا', 'أقمشة وشرقيات وأدوات منزلية'],
      ['al-salihiyah', 'سوق الصالحية', 'ألبسة وأحذية وماركات'],
      ['al-hamra', 'شارع الحمرا', 'ألبسة وإكسسوارات عصرية'],
      ['al-bahsa', 'البحصة', 'موبايلات وكمبيوتر وإلكترونيات'],
    ],
  },
  {
    slug: 'rif-dimashq', name: 'ريف دمشق', lat: 33.5711, lng: 36.4033,
    markets: [
      ['jaramana', 'سوق جرمانا', 'محلات متنوعة وأسعار شعبية'],
      ['douma', 'سوق دوما', 'مواد غذائية وألبسة وأدوات منزلية'],
    ],
  },
  {
    slug: 'aleppo', name: 'حلب', lat: 36.2021, lng: 37.1343,
    markets: [
      ['souq-al-madina', 'سوق المدينة', 'السوق التاريخي المسقوف في حلب القديمة'],
      ['al-tilal', 'سوق التلل', 'ألبسة وأحذية وإكسسوارات'],
      ['al-aziziyah', 'العزيزية', 'محلات عصرية وإلكترونيات'],
    ],
  },
  {
    slug: 'homs', name: 'حمص', lat: 34.7324, lng: 36.7137,
    markets: [
      ['homs-covered-souq', 'السوق المسقوف', 'السوق القديم في قلب حمص'],
      ['al-dablan', 'شارع الدبلان', 'ألبسة وأحذية وأدوات منزلية'],
    ],
  },
  { slug: 'hama', name: 'حماة', lat: 35.1318, lng: 36.7578, markets: [['hama-center', 'وسط المدينة']] },
  {
    slug: 'latakia', name: 'اللاذقية', lat: 35.5317, lng: 35.7915,
    markets: [
      ['al-safan', 'سوق الصفن', 'سوق شعبي قديم'],
      ['sheikh-daher', 'الشيخ ضاهر', 'قلب اللاذقية التجاري'],
    ],
  },
  { slug: 'tartus', name: 'طرطوس', lat: 34.889, lng: 35.8866, markets: [['tartus-center', 'وسط المدينة']] },
  { slug: 'idlib', name: 'إدلب', lat: 35.9306, lng: 36.6339, markets: [['idlib-center', 'وسط المدينة']] },
  { slug: 'daraa', name: 'درعا', lat: 32.6189, lng: 36.1021, markets: [['daraa-center', 'وسط المدينة']] },
  { slug: 'as-suwayda', name: 'السويداء', lat: 32.709, lng: 36.5695, markets: [['suwayda-center', 'وسط المدينة']] },
  { slug: 'quneitra', name: 'القنيطرة', lat: 33.1256, lng: 35.8249, markets: [['quneitra-center', 'وسط المدينة']] },
  { slug: 'deir-ez-zor', name: 'دير الزور', lat: 35.3359, lng: 40.1408, markets: [['deir-ez-zor-center', 'وسط المدينة']] },
  { slug: 'raqqa', name: 'الرقة', lat: 35.9594, lng: 39.0079, markets: [['raqqa-center', 'وسط المدينة']] },
  { slug: 'al-hasakah', name: 'الحسكة', lat: 36.5024, lng: 40.7477, markets: [['hasakah-center', 'وسط المدينة']] },
];

const categories: [slug: string, name: string, icon: string][] = [
  ['fashion', 'ألبسة وأزياء', '👗'],
  ['shoes-bags', 'أحذية وحقائب', '👟'],
  ['mobiles', 'موبايلات وإكسسوارات', '📱'],
  ['electronics', 'إلكترونيات وكمبيوتر', '💻'],
  ['solar-energy', 'طاقة شمسية وبطاريات', '🔋'],
  ['home-kitchen', 'أدوات منزلية ومطبخ', '🍳'],
  ['furniture', 'مفروشات وديكور', '🛋️'],
  ['beauty', 'عطور وتجميل', '🧴'],
  ['food-spices', 'مواد غذائية وبهارات', '🫒'],
  ['sweets-coffee', 'حلويات وبن', '☕'],
  ['jewelry', 'ذهب وإكسسوارات', '💍'],
  ['kids-toys', 'ألعاب وأطفال', '🧸'],
  ['stationery', 'قرطاسية وكتب', '📚'],
  ['auto-parts', 'قطع سيارات', '🚗'],
  ['handicrafts', 'حرف يدوية وتراث', '🪡'],
];

type ProductSeed = {
  t: string;
  d?: string;
  p?: number;
  old?: number;
  pt?: PriceType;
  c?: Currency;
  used?: boolean;
  out?: boolean;
  feat?: boolean;
};

type StoreSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  gov: string;
  market: string;
  category: string;
  address: string;
  hours: string;
  delivery?: boolean;
  verified?: boolean;
  products: ProductSeed[];
};

const stores: StoreSeed[] = [
  {
    slug: 'brocade-alsham', name: 'بروكار الشام', gov: 'damascus', market: 'al-hamidiyah', category: 'handicrafts',
    tagline: 'بروكار دمشقي أصيل منذ 1965',
    description: 'نصنع ونبيع أقمشة البروكار الدمشقي والشراشف والهدايا التراثية. نشحن لكل المحافظات.',
    address: 'سوق الحميدية، قرب الجامع الأموي', hours: 'يومياً 9 صباحاً – 8 مساءً', delivery: true, verified: true,
    products: [
      { t: 'قماش بروكار دمشقي حرير – المتر', d: 'نقشة الورد الشامي، عرض 120 سم، ألوان متعددة', p: 350000, feat: true },
      { t: 'شرشف طاولة بروكار مطرز', d: 'مقاس 150×220 سم مع 6 مناديل', p: 900000, old: 1100000 },
      { t: 'علبة مجوهرات خشب موزاييك', d: 'صدف وخشب جوز، صناعة يدوية دمشقية', p: 450000 },
      { t: 'وسادة بروكار للديكور', d: 'مع حشوة، مقاس 45×45 سم', p: 180000 },
      { t: 'طقم هدايا تراثي للمغتربين', d: 'بروكار + علبة موزاييك + صابون غار', pt: PriceType.ON_REQUEST },
    ],
  },
  {
    slug: 'abu-fouad-spices', name: 'بهارات أبو فؤاد', gov: 'damascus', market: 'al-buzuriyah', category: 'food-spices',
    tagline: 'بهارات وعطارة البزورية بالجملة والمفرق',
    description: 'أجود أنواع البهارات المطحونة طازجة يومياً، زهورات شامية، زعتر حلبي وسمنة عربية.',
    address: 'سوق البزورية، دمشق القديمة', hours: 'السبت – الخميس 8 صباحاً – 7 مساءً', verified: true,
    products: [
      { t: 'زعتر حلبي فاخر – 1 كغ', d: 'زعتر مع سمسم محمص وسماق بلدي', p: 95000, feat: true },
      { t: 'بهار سبعة بهارات – نصف كغ', d: 'مطحون طازج', p: 60000 },
      { t: 'زهورات شامية مشكلة – 250 غ', d: 'بابونج، زيزفون، ورد جوري', p: 45000 },
      { t: 'سماق بلدي – 1 كغ', p: 70000 },
      { t: 'قهوة عربية بالهيل – 500 غ', d: 'تحميص وسط وطحن ناعم', p: 120000, old: 135000 },
      { t: 'بهارات بالجملة للمطاعم', d: 'أسعار خاصة للكميات', pt: PriceType.NEGOTIABLE },
    ],
  },
  {
    slug: 'hamra-style', name: 'ستايل الحمرا', gov: 'damascus', market: 'al-hamra', category: 'fashion',
    tagline: 'موضة رجالية ونسائية بأسعار معقولة',
    description: 'تشكيلة جديدة كل أسبوع: قمصان، بناطيل جينز، فساتين وجاكيتات.',
    address: 'شارع الحمرا، دمشق', hours: 'يومياً 10 صباحاً – 10 مساءً',
    products: [
      { t: 'جاكيت جينز رجالي', d: 'مقاسات من M حتى XXL', p: 275000, feat: true },
      { t: 'فستان صيفي نسائي قطن', d: 'ألوان: زيتي، بيج، أسود', p: 220000, old: 260000 },
      { t: 'قميص رجالي كلاسيك', p: 150000 },
      { t: 'بنطال جينز نسائي', p: 190000 },
      { t: 'بلوزة نسائية شتوية', p: 165000, out: true },
    ],
  },
  {
    slug: 'bahsa-mobile', name: 'موبايل سنتر البحصة', gov: 'damascus', market: 'al-bahsa', category: 'mobiles',
    tagline: 'موبايلات جديدة ومستعملة مع كفالة',
    description: 'بيع وشراء وصيانة موبايلات، إكسسوارات وشواحن أصلية. كفالة على كل جهاز.',
    address: 'البحصة، دمشق', hours: 'السبت – الخميس 10 صباحاً – 9 مساءً', verified: true, delivery: true,
    products: [
      { t: 'Samsung Galaxy A15 – 128GB', d: 'جديد بالكرتونة، كفالة سنة', p: 165, c: Currency.USD, feat: true },
      { t: 'iPhone 13 – 128GB مستعمل', d: 'بطارية 88٪، بحالة ممتازة', p: 380, c: Currency.USD, used: true },
      { t: 'Xiaomi Redmi Note 13', d: 'جديد، 256GB', p: 210, c: Currency.USD },
      { t: 'شاحن سريع أصلي 25W', p: 18, c: Currency.USD },
      { t: 'باور بانك 20000 mAh', d: 'مناسب لانقطاع الكهرباء', p: 25, c: Currency.USD },
      { t: 'صيانة شاشات جميع الأنواع', pt: PriceType.ON_REQUEST },
    ],
  },
  {
    slug: 'alnoor-solar', name: 'النور للطاقة الشمسية', gov: 'rif-dimashq', market: 'jaramana', category: 'solar-energy',
    tagline: 'منظومات طاقة شمسية متكاملة مع التركيب',
    description: 'ألواح، إنفرترات، بطاريات ليثيوم وجل. دراسة مجانية لاحتياج منزلك وتركيب مع كفالة.',
    address: 'جرمانا، الشارع الرئيسي', hours: 'يومياً 9 صباحاً – 6 مساءً', delivery: true, verified: true,
    products: [
      { t: 'لوح طاقة شمسية 550 واط', d: 'مونو كريستال، كفالة 10 سنوات', p: 115, c: Currency.USD, feat: true },
      { t: 'إنفرتر هايبرد 5 كيلو', d: 'يدعم الشحن من الشبكة والألواح', p: 480, c: Currency.USD },
      { t: 'بطارية ليثيوم 100 أمبير', d: 'عمر 6000 دورة', p: 520, c: Currency.USD, old: 560 },
      { t: 'بطارية جل 200 أمبير', p: 230, c: Currency.USD },
      { t: 'منظومة منزلية كاملة 3 كيلو', d: 'ألواح + إنفرتر + بطاريات + تركيب', pt: PriceType.ON_REQUEST, c: Currency.USD },
    ],
  },
  {
    slug: 'shahba-soap', name: 'بيت الشهباء لصابون الغار', gov: 'aleppo', market: 'souq-al-madina', category: 'beauty',
    tagline: 'صابون غار حلبي تقليدي مُعتّق',
    description: 'صابون غار بزيت الزيتون مصنوع بالطريقة التقليدية ومعتّق لسنتين، إضافة لزيوت طبيعية.',
    address: 'سوق المدينة، حلب القديمة', hours: 'السبت – الخميس 9 صباحاً – 6 مساءً', verified: true, delivery: true,
    products: [
      { t: 'صابون غار حلبي 40٪ – 1 كغ', d: 'معتّق سنتين', p: 85000, feat: true },
      { t: 'صابون غار 20٪ – علبة 6 قطع', p: 60000 },
      { t: 'زيت غار طبيعي – 100 مل', p: 55000 },
      { t: 'علبة هدايا صابون مشكل', d: 'مناسبة للمغتربين', p: 140000, old: 160000 },
    ],
  },
  {
    slug: 'tilal-shoes', name: 'أحذية التلل', gov: 'aleppo', market: 'al-tilal', category: 'shoes-bags',
    tagline: 'صناعة حلبية جلد طبيعي',
    description: 'أحذية رجالية ونسائية وولادية من الجلد الطبيعي، صناعة محلية بجودة عالية.',
    address: 'سوق التلل، حلب', hours: 'يومياً 10 صباحاً – 9 مساءً',
    products: [
      { t: 'حذاء رجالي جلد طبيعي', d: 'مقاسات 40 – 46', p: 320000, feat: true },
      { t: 'صندل نسائي طبي', p: 180000 },
      { t: 'حذاء رياضي ولادي', p: 140000, old: 170000 },
      { t: 'حقيبة يد نسائية جلد', p: 260000 },
    ],
  },
  {
    slug: 'aziziyeh-computers', name: 'كمبيوتر العزيزية', gov: 'aleppo', market: 'al-aziziyah', category: 'electronics',
    tagline: 'لابتوبات وقطع كمبيوتر وصيانة',
    description: 'لابتوبات جديدة ومستعملة، قطع تجميع، طابعات وشبكات. خدمة صيانة سريعة.',
    address: 'العزيزية، حلب', hours: 'السبت – الخميس 10 صباحاً – 8 مساءً',
    products: [
      { t: 'Lenovo IdeaPad 3 – Core i5', d: 'RAM 8GB، SSD 512GB', p: 430, c: Currency.USD, feat: true },
      { t: 'HP EliteBook مستعمل', d: 'Core i7 جيل ثامن، بحالة ممتازة', p: 290, c: Currency.USD, used: true },
      { t: 'راوتر TP-Link', p: 30, c: Currency.USD },
      { t: 'UPS للكمبيوتر 1000VA', p: 75, c: Currency.USD },
    ],
  },
  {
    slug: 'dablan-home', name: 'أدوات منزلية الدبلان', gov: 'homs', market: 'al-dablan', category: 'home-kitchen',
    tagline: 'كل ما يحتاجه مطبخك',
    description: 'طناجر، أطقم صحون، أدوات كهربائية صغيرة ومستلزمات تنظيف.',
    address: 'شارع الدبلان، حمص', hours: 'يومياً 9 صباحاً – 9 مساءً', delivery: true,
    products: [
      { t: 'طقم طناجر جرانيت 10 قطع', p: 750000, old: 850000, feat: true },
      { t: 'طقم صحون بورسلان 24 قطعة', p: 520000 },
      { t: 'ركوة قهوة نحاس', p: 65000 },
      { t: 'مفرمة لحمة كهربائية', p: 390000 },
      { t: 'ترمس شاي 1 لتر', p: 55000 },
    ],
  },
  {
    slug: 'homs-sweets', name: 'حلويات السوق المسقوف', gov: 'homs', market: 'homs-covered-souq', category: 'sweets-coffee',
    tagline: 'حلاوة الجبن الحمصية والمعمول',
    description: 'حلويات حمصية طازجة يومياً: حلاوة الجبن، معمول، بقلاوة. نوصي بالطلب قبل يوم للكميات.',
    address: 'السوق المسقوف، حمص', hours: 'يومياً 8 صباحاً – 10 مساءً', verified: true,
    products: [
      { t: 'حلاوة الجبن الحمصية – 1 كغ', p: 160000, feat: true },
      { t: 'معمول بالفستق الحلبي – 1 كغ', p: 220000 },
      { t: 'بقلاوة مشكلة – 1 كغ', p: 250000 },
      { t: 'صدر حلويات للمناسبات', pt: PriceType.ON_REQUEST },
    ],
  },
  {
    slug: 'safan-toys', name: 'ألعاب الصفن', gov: 'latakia', market: 'al-safan', category: 'kids-toys',
    tagline: 'ألعاب تعليمية وهدايا أطفال',
    description: 'ألعاب تركيب، دراجات، دمى ومستلزمات مدرسية للأطفال.',
    address: 'سوق الصفن، اللاذقية', hours: 'يومياً 10 صباحاً – 9 مساءً',
    products: [
      { t: 'دراجة أطفال مقاس 16', p: 450000, feat: true },
      { t: 'مكعبات تركيب تعليمية 500 قطعة', p: 150000 },
      { t: 'دمية مع ملابس', p: 95000, old: 120000 },
      { t: 'حقيبة مدرسية ولادية', p: 110000 },
    ],
  },
  {
    slug: 'sahel-auto', name: 'قطع سيارات الساحل', gov: 'tartus', market: 'tartus-center', category: 'auto-parts',
    tagline: 'قطع أصلية وتجارية لجميع السيارات',
    description: 'قطع كورية ويابانية وأوروبية، زيوت وفلاتر وبطاريات سيارات.',
    address: 'وسط المدينة، طرطوس', hours: 'السبت – الخميس 8 صباحاً – 6 مساءً',
    products: [
      { t: 'بطارية سيارة 70 أمبير', p: 95, c: Currency.USD, feat: true },
      { t: 'طقم فحمات فرام كيا ريو', p: 250000 },
      { t: 'زيت محرك 5W-30 – 4 لتر', p: 28, c: Currency.USD },
      { t: 'قطع مستعملة بحالة جيدة', pt: PriceType.ON_REQUEST, used: true },
    ],
  },
  {
    slug: 'asi-furniture', name: 'مفروشات العاصي', gov: 'hama', market: 'hama-center', category: 'furniture',
    tagline: 'غرف نوم وصالونات بتصاميم حديثة',
    description: 'تصنيع مفروشات حسب الطلب، غرف نوم، صالونات، طاولات سفرة. توصيل وتركيب.',
    address: 'وسط المدينة، حماة', hours: 'السبت – الخميس 9 صباحاً – 7 مساءً', delivery: true,
    products: [
      { t: 'صالون مودرن 7 مقاعد', p: 6500000, pt: PriceType.NEGOTIABLE, feat: true },
      { t: 'غرفة نوم خشب زان', pt: PriceType.ON_REQUEST },
      { t: 'طاولة سفرة 6 كراسي', p: 3200000 },
      { t: 'سجادة يدوية 2×3 م', p: 1400000, old: 1650000 },
    ],
  },
];

async function main() {
  console.log('🧹 Clearing old data...');
  await prisma.report.deleteMany();
  await prisma.storeDailyStat.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
  await prisma.market.deleteMany();
  await prisma.governorate.deleteMany();
  await prisma.category.deleteMany();

  console.log('🗺️  Governorates & markets...');
  const govBySlug = new Map<string, { id: string; name: string }>();
  const marketBySlug = new Map<string, { id: string; name: string }>();
  for (const [i, g] of governorates.entries()) {
    const gov = await prisma.governorate.create({
      data: {
        slug: g.slug,
        name: g.name,
        sortOrder: i,
        latitude: g.lat,
        longitude: g.lng,
        markets: {
          create: g.markets.map(([slug, name, description], j) => ({ slug, name, description, sortOrder: j })),
        },
      },
      include: { markets: true },
    });
    govBySlug.set(gov.slug, gov);
    gov.markets.forEach((m) => marketBySlug.set(m.slug, m));
  }

  console.log('🏷️  Categories...');
  const catBySlug = new Map<string, { id: string; name: string }>();
  for (const [i, [slug, name, icon]] of categories.entries()) {
    catBySlug.set(slug, await prisma.category.create({ data: { slug, name, icon, sortOrder: i } }));
  }

  console.log('👤 Users...');
  const merchantHash = await bcrypt.hash('Tujjar@2026', 10);
  await prisma.user.create({
    data: {
      name: 'مدير المنصة',
      phone: demoPhone(1),
      passwordHash: await bcrypt.hash('Admin@2026', 10),
      role: 'ADMIN',
    },
  });

  console.log('🏪 Stores & products...');
  const today = new Date(Date.now() + 3 * 3600_000);
  today.setUTCHours(0, 0, 0, 0);

  for (const [i, s] of stores.entries()) {
    const gov = govBySlug.get(s.gov)!;
    const market = marketBySlug.get(s.market)!;
    const cat = catBySlug.get(s.category)!;
    const phone = demoPhone(100 + i);

    const owner = await prisma.user.create({
      data: { name: `صاحب ${s.name}`, phone, passwordHash: merchantHash, role: 'MERCHANT' },
    });
    const store = await prisma.store.create({
      data: {
        slug: s.slug,
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        ownerId: owner.id,
        governorateId: gov.id,
        marketId: market.id,
        categoryId: cat.id,
        address: s.address,
        openingHours: s.hours,
        whatsapp: phone,
        phone,
        hasDelivery: !!s.delivery,
        isVerified: !!s.verified,
        viewsCount: 150 + ((i * 97) % 900),
        contactsCount: 20 + ((i * 37) % 120),
        searchText: buildSearchText(s.name, s.tagline, s.description, market.name, gov.name, cat.name),
        createdAt: new Date(Date.now() - (stores.length - i) * 86400_000),
      },
    });

    for (const [j, p] of s.products.entries()) {
      const priceType = p.pt ?? PriceType.FIXED;
      await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: cat.id,
          title: p.t,
          description: p.d,
          priceType,
          price: priceType === PriceType.ON_REQUEST ? null : (p.p ?? null),
          oldPrice: p.old ?? null,
          currency: p.c ?? Currency.SYP,
          condition: p.used ? ItemCondition.USED : ItemCondition.NEW,
          inStock: !p.out,
          images: [],
          isFeatured: !!p.feat,
          viewsCount: 10 + (((i + 3) * (j + 5) * 7) % 400),
          contactsCount: ((i + 2) * (j + 3)) % 45,
          searchText: buildSearchText(p.t, p.d, cat.name, s.name, market.name, gov.name),
          // Staggered dates so "newest" ordering mixes stores naturally
          createdAt: new Date(Date.now() - (j * 13 + i) * 3600_000),
        },
      });
    }

    // Two weeks of dashboard stats
    await prisma.storeDailyStat.createMany({
      data: Array.from({ length: 14 }, (_, d) => {
        const base = 8 + (((i + 1) * (d + 3) * 13) % 40);
        return {
          storeId: store.id,
          day: new Date(today.getTime() - d * 86400_000),
          views: base,
          whatsapp: Math.round(base * 0.18),
          calls: Math.round(base * 0.05),
        };
      }),
    });
  }

  console.log('✅ Done');
  console.table([
    { role: 'ADMIN', phone: '0900000001', password: 'Admin@2026' },
    { role: 'MERCHANT (بروكار الشام)', phone: '0900000100', password: 'Tujjar@2026' },
  ]);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
