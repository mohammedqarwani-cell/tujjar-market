/**
 * Every test builds the rows it needs under its own prefix and removes them afterwards, so a
 * test database shared with other runs (or with seeded demo data) stays usable.
 */
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient, type Prisma, type Product } from '@prisma/client';

export const TEST_PASSWORD = 'Test@2026pass';
/** bcrypt cost 4 keeps a test with many logins quick; the API's own cost is unchanged */
const TEST_ROUNDS = 4;

export type Fixture = Awaited<ReturnType<typeof createFixture>>;

export async function createFixture(
  prisma: PrismaClient,
  opts: {
    products?: {
      price: number | null;
      priceType?: Prisma.ProductCreateInput['priceType'];
    }[];
    hasDelivery?: boolean;
  } = {},
) {
  const tag = `test-${randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, TEST_ROUNDS);

  const governorate = await prisma.governorate.create({
    data: { slug: `${tag}-gov`, name: `محافظة ${tag}`, status: 'ACTIVE' },
  });
  const category = await prisma.category.create({
    data: {
      slug: `${tag}-cat`,
      name: `قسم ${tag}`,
      icon: '🧪',
      isActive: true,
    },
  });
  const merchant = await prisma.user.create({
    data: {
      name: `تاجر ${tag}`,
      phone: phoneFor(tag, 1),
      passwordHash,
      role: 'MERCHANT',
      status: 'ACTIVE',
    },
  });
  const buyer = await prisma.user.create({
    data: {
      name: `زبون ${tag}`,
      phone: phoneFor(tag, 2),
      passwordHash,
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });
  const store = await prisma.store.create({
    data: {
      slug: `${tag}-store`,
      name: `متجر ${tag}`,
      ownerId: merchant.id,
      governorateId: governorate.id,
      categoryId: category.id,
      whatsapp: phoneFor(tag, 1),
      status: 'ACTIVE',
      hasDelivery: opts.hasDelivery ?? true,
    },
  });
  const products: Product[] = [];
  for (const [i, p] of (opts.products ?? []).entries()) {
    products.push(
      await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: category.id,
          title: `منتج ${tag} ${i + 1}`,
          price: p.price,
          priceType: p.priceType ?? (p.price === null ? 'ON_REQUEST' : 'FIXED'),
          currency: 'SYP',
          status: 'ACTIVE',
          inStock: true,
        },
      }),
    );
  }

  return {
    tag,
    governorate,
    category,
    merchant,
    buyer,
    store,
    products,
    async cleanup() {
      await prisma.order.deleteMany({ where: { storeId: store.id } });
      await prisma.storePost.deleteMany({ where: { storeId: store.id } });
      await prisma.product.deleteMany({ where: { storeId: store.id } });
      await prisma.storeContact.deleteMany({ where: { storeId: store.id } });
      await prisma.store.deleteMany({ where: { id: store.id } });
      await prisma.notification.deleteMany({
        where: { userId: { in: [merchant.id, buyer.id] } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorId: { in: [merchant.id, buyer.id] } },
      });
      await prisma.session.deleteMany({
        where: { userId: { in: [merchant.id, buyer.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [merchant.id, buyer.id] } },
      });
      await prisma.category.deleteMany({ where: { id: category.id } });
      await prisma.governorate.deleteMany({ where: { id: governorate.id } });
    },
  };
}

/** A Syrian mobile number nobody owns, unique per fixture. */
export function phoneFor(tag: string, index: number): string {
  const digits = [...tag].reduce(
    (n, c) => (n * 31 + c.charCodeAt(0)) % 1_000_000,
    7,
  );
  return `9639${String(digits).padStart(6, '0')}${String(index).padStart(2, '0')}`;
}
