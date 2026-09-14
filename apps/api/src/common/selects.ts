import { Prisma } from '@prisma/client';

export const storeCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  logoUrl: true,
  coverUrl: true,
  isVerified: true,
  hasDelivery: true,
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
      isVerified: true,
      governorate: { select: { name: true } },
      market: { select: { name: true } },
    },
  },
} satisfies Prisma.ProductSelect;

/** Only products that are live and belong to a live store are public. */
export const publicProductWhere = {
  status: 'ACTIVE',
  store: { status: 'ACTIVE' },
} satisfies Prisma.ProductWhereInput;
