import { Prisma } from '@prisma/client';

export const storeCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  logoUrl: true,
  coverUrl: true,
  verificationLevel: true,
  ratingAvg: true,
  ratingCount: true,
  hasDelivery: true,
  createdAt: true,
  governorate: { select: { slug: true, name: true } },
  market: { select: { slug: true, name: true } },
  category: { select: { slug: true, name: true, icon: true } },
  _count: { select: { products: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.StoreSelect;

export const productCardSelect = {
  id: true,
  title: true,
  priceType: true,
  price: true,
  oldPrice: true,
  currency: true,
  condition: true,
  inStock: true,
  images: true,
  isFeatured: true,
  createdAt: true,
  category: { select: { slug: true, name: true, icon: true } },
  store: {
    select: {
      slug: true,
      name: true,
      verificationLevel: true,
      governorate: { select: { name: true } },
      market: { select: { name: true } },
    },
  },
} satisfies Prisma.ProductSelect;

/** A store is public only while live and in a governorate that has opened. */
export const publicStoreWhere = {
  status: 'ACTIVE',
  governorate: { status: 'ACTIVE' },
} satisfies Prisma.StoreWhereInput;

/** Only products that are live and belong to a public store are public. */
export const publicProductWhere = {
  status: 'ACTIVE',
  store: publicStoreWhere,
} satisfies Prisma.ProductWhereInput;
