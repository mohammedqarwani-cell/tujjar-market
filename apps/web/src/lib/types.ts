import type { WeekSchedule } from "./hours";

export type Currency = "SYP" | "USD";
export type PriceType = "FIXED" | "NEGOTIABLE" | "ON_REQUEST";
export type Condition = "NEW" | "USED";
export type ProductStatus = "ACTIVE" | "UNDER_REVIEW" | "HIDDEN";
/** Tiered store verification, lowest to highest */
export type VerificationLevel = "REGISTERED" | "IDENTITY" | "LOCATION" | "PREMIUM";

export type Ref = { slug: string; name: string };
export type CategoryRef = Ref & { icon: string };
export type Category = CategoryRef & { id: string; productsCount: number };

export type MarketSummary = Ref & { id: string; storesCount: number };
/** COMING_SOON governorates are listed but don't accept stores yet (pilot rollout) */
export type GovernorateStatus = "ACTIVE" | "COMING_SOON";
export type Governorate = Ref & {
  id: string;
  status: GovernorateStatus;
  /** Governorate centre, used to pick the visitor's governorate from their location */
  latitude: number | null;
  longitude: number | null;
  storesCount: number;
  markets: MarketSummary[];
};

export type ProductCardData = {
  id: string;
  title: string;
  priceType: PriceType;
  price: number | null;
  oldPrice: number | null;
  currency: Currency;
  condition: Condition;
  inStock: boolean;
  images: string[];
  isFeatured: boolean;
  createdAt: string;
  category: CategoryRef;
  store: {
    slug: string;
    name: string;
    verificationLevel: VerificationLevel;
    governorate: { name: string };
    market: { name: string } | null;
  };
};

export type StoreCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  verificationLevel: VerificationLevel;
  /** Average of published reviews (0 when there are none) */
  ratingAvg: number;
  ratingCount: number;
  hasDelivery: boolean;
  /** Weekly hours for "مفتوح الآن" (see lib/hours.ts) */
  openingSchedule: WeekSchedule | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  governorate: Ref;
  market: Ref | null;
  category: CategoryRef | null;
  _count: { products: number };
};

export type SearchMeta = {
  mode: "smart";
  /** A spelling-corrected query, offered as "هل تقصد …؟" */
  correctedQuery: string | null;
  /** Dialect words, synonyms and needs searched alongside the shopper's words */
  alsoSearched: string[];
  semantic: boolean;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number; search?: SearchMeta };

export type HomeData = {
  categories: Category[];
  governorates: Governorate[];
  featured: ProductCardData[];
  latest: ProductCardData[];
  stores: StoreCardData[];
  totals: { stores: number; products: number; markets: number };
  layout: HomeLayout;
  banners: HomeBanner[];
  pinnedStores: StoreCardData[];
  /** Stores on a paid visibility package */
  showcase: { id: string; store: StoreCardData }[];
};

/** Homepage sections the platform team can reorder, rename or hide. */
export type HomeSectionId = "banners" | "showcase" | "stories" | "categories" | "offers" | "openNow" | "featured" | "markets" | "stores" | "howItWorks" | "recent" | "latest";
export type BannerTone = "brand" | "olive" | "ink" | "rose";

export type HomeLayout = {
  sections: { id: HomeSectionId; enabled: boolean; title: string }[];
  autoBanners: boolean;
  offers: { countdown: "midnight" | "until" | "none"; until: string | null };
  stories: { showAuto: boolean };
  quickSearches: string[];
  greeting: boolean;
};

export type HomeBanner = { id: string; eyebrow: string; title: string; cta: string; href: string; imageUrl: string | null; tone: BannerTone };

export type StoreDetail = StoreCardData & {
  description: string | null;
  address: string | null;
  mapUrl: string | null;
  whatsapp: string;
  phone: string | null;
  openingHours: string | null;
  productCategories: CategoryRef[];
};

export type ProductDetail = ProductCardData & {
  description: string | null;
  viewsCount: number;
  category: CategoryRef & { id: string };
  store: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    verificationLevel: VerificationLevel;
    hasDelivery: boolean;
    whatsapp: string;
    phone: string | null;
    address: string | null;
    openingHours: string | null;
    governorate: Ref;
    market: Ref | null;
  };
  similar: ProductCardData[];
  fromStore: ProductCardData[];
};

export type MarketDetail = Ref & {
  id: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  governorate: Ref;
  storesCount: number;
};

export type Role = "ADMIN" | "MODERATOR" | "FIELD_AGENT" | "MERCHANT" | "BUYER";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  store: { id: string; slug: string; name: string; status: "ACTIVE" | "SUSPENDED" } | null;
  /** This session passed two-factor authentication (admin interface) */
  mfa: boolean;
  mustSetupTotp: boolean;
};

export type ReviewStatus = "PUBLISHED" | "UNDER_REVIEW" | "HIDDEN";

/** A published review as the public sees it: first name and initial only */
export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: string;
};

export type ReviewSummary = { average: number; count: number; distribution: { rating: number; count: number }[] };
export type ReviewPage = Page<PublicReview> & { summary: ReviewSummary };
