-- Local showcase content for design screenshots: reviews with a merchant reply, follows,
-- favorites, notifications for each interface and a sent campaign. Safe to re-run.
-- Never run against the demo or production database.

-- Sample reviewers (cannot sign in: the password hash is not a valid bcrypt hash)
INSERT INTO "User" (id, name, phone, "passwordHash", role, "phoneVerifiedAt", "createdAt", "updatedAt")
VALUES
  ('showcase_u1', 'سامر خليل', '963900000901', '!', 'BUYER', now(), now() - interval '40 days', now()),
  ('showcase_u2', 'ريم العلي', '963900000902', '!', 'BUYER', now(), now() - interval '35 days', now()),
  ('showcase_u3', 'أحمد الحلبي', '963900000903', '!', 'BUYER', now(), now() - interval '20 days', now()),
  ('showcase_u4', 'لينا الشامي', '963900000904', '!', 'BUYER', now(), now() - interval '12 days', now())
ON CONFLICT (phone) DO NOTHING;

DELETE FROM "Review" WHERE id LIKE 'showcase_%';
INSERT INTO "Review" (id, "storeId", "buyerId", rating, comment, status, "merchantReply", "merchantRepliedAt", "createdAt", "updatedAt")
SELECT r.id, s.id, r.buyer, r.rating, r.comment, 'PUBLISHED', r.reply, CASE WHEN r.reply IS NULL THEN NULL ELSE now() - interval '1 day' END,
       now() - r.age, now() - r.age
FROM "Store" s
JOIN (VALUES
  ('showcase_r1', 'brocade-alsham', 'showcase_u1', 5, 'قماش أصلي وشغل يدوي نظيف، والتاجر شرح لي الفرق بين الأنواع بصبر. أنصح فيه.', 'أهلاً وسهلاً فيك، منورنا دائماً', interval '6 days'),
  ('showcase_r2', 'brocade-alsham', 'showcase_u2', 5, 'اشتريت شرشف هدية للمغتربين ووصل مغلف بشكل جميل. الأسعار معقولة مقارنة بالسوق.', NULL, interval '4 days'),
  ('showcase_r3', 'brocade-alsham', 'showcase_u3', 4, 'البضاعة ممتازة، بس الرد على الواتساب تأخر شوي بوقت الذروة.', 'نعتذر عن التأخير، زدنا عدد الموظفين على الواتساب', interval '2 days'),
  ('showcase_r4', 'abu-fouad-spices', 'showcase_u4', 5, 'بهارات طازجة وريحتها بتفتح النفس، والوزن مضبوط.', NULL, interval '3 days'),
  ('showcase_r5', 'abu-fouad-spices', 'showcase_u1', 4, 'تشكيلة واسعة وأسعار منافسة.', NULL, interval '8 days')
) AS r(id, slug, buyer, rating, comment, reply, age) ON s.slug = r.slug;

UPDATE "Store" s SET
  "ratingAvg" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM "Review" r WHERE r."storeId" = s.id AND r.status = 'PUBLISHED'), 0),
  "ratingCount" = (SELECT count(*) FROM "Review" r WHERE r."storeId" = s.id AND r.status = 'PUBLISHED');

-- The demo buyer follows stores and keeps favorites
INSERT INTO "StoreFollow" ("userId", "storeId")
SELECT u.id, s.id FROM "User" u, "Store" s
WHERE u.phone = '963900000200' AND s.slug IN ('brocade-alsham', 'abu-fouad-spices', 'alnoor-solar')
ON CONFLICT DO NOTHING;
INSERT INTO "Favorite" ("userId", "productId")
SELECT u.id, p.id FROM "User" u, (SELECT id FROM "Product" WHERE status = 'ACTIVE' ORDER BY "contactsCount" DESC LIMIT 4) p
WHERE u.phone = '963900000200'
ON CONFLICT DO NOTHING;

-- Notifications
DELETE FROM "Notification" WHERE id LIKE 'showcase_%';
INSERT INTO "Notification" (id, "userId", category, type, title, body, url, count, "readAt", "createdAt", "updatedAt")
SELECT n.id, u.id, n.category::"NotificationCategory", n.type, n.title, n.body, n.url, n.cnt,
       CASE WHEN n.is_read THEN now() ELSE NULL END, now() - n.age, now() - n.age
FROM (VALUES
  ('showcase_n1', '963900000200', 'FAVORITES', 'product.price_drop', 'انخفض سعر قماش بروكار دمشقي حرير', 'من 420,000 ل.س إلى 350,000 ل.س', '/search?offers=1', 1, false, interval '12 minutes'),
  ('showcase_n2', '963900000200', 'FOLLOWING', 'product.new', 'جديد من بروكار الشام', 'أضاف بروكار الشام 3 منتجات جديدة اليوم', '/stores/brocade-alsham', 3, false, interval '2 hours'),
  ('showcase_n3', '963900000200', 'ACCOUNT', 'review.replied', 'ردّ بروكار الشام على تقييمك', 'أهلاً وسهلاً فيك، منورنا دائماً', '/stores/brocade-alsham#reviews', 1, false, interval '5 hours'),
  ('showcase_n4', '963900000200', 'PROMOTIONS', 'campaign', 'عروض العودة إلى المدارس', 'خصومات حتى 30٪ على القرطاسية والحقائب في أسواق دمشق', '/search?offers=1', 1, true, interval '1 day'),
  ('showcase_n5', '963900000200', 'INVITES', 'review.invite', 'كيف كانت تجربتك مع أبو فؤاد للبهارات؟', 'تقييمك يساعد غيرك على اختيار التاجر المناسب', '/stores/abu-fouad-spices#reviews', 1, true, interval '2 days'),
  ('showcase_n6', '963900000200', 'FAVORITES', 'product.restocked', 'طقم هدايا تراثي متوفر من جديد', 'عاد متوفراً لدى بروكار الشام', '/stores/brocade-alsham', 1, true, interval '3 days'),
  ('showcase_n7', '963900000100', 'REVIEWS', 'review.new', 'تقييمات جديدة لمتجرك', 'وصلك 2 تقييمات جديدة اليوم', '/dashboard/reviews', 2, false, interval '30 minutes'),
  ('showcase_n8', '963900000100', 'ACCOUNT', 'verification.approved', 'تم توثيق محلك ✓', 'ظهرت شارة «محل موثّق» على متجرك، وصار ظهورك أعلى في البحث بلا حد للمنتجات', '/dashboard/verification', 1, false, interval '1 day'),
  ('showcase_n9', '963900000100', 'INVITES', 'campaign', 'جديد: ردّ على تقييمات زبائنك', 'صار بإمكانك الرد علناً على كل تقييم من صفحة التقييمات', '/dashboard/reviews', 1, true, interval '3 days'),
  ('showcase_n10', '963900000001', 'MODERATION', 'verification.submitted', 'طلبات توثيق جديدة', '3 طلبات توثيق تنتظر المراجعة اليوم', '/admin?tab=verifications', 3, false, interval '20 minutes'),
  ('showcase_n11', '963900000001', 'MODERATION', 'report.created', 'بلاغات جديدة', '2 بلاغات جديدة اليوم', '/admin?tab=reports', 2, false, interval '3 hours')
) AS n(id, phone, category, type, title, body, url, cnt, is_read, age)
JOIN "User" u ON u.phone = n.phone;

DELETE FROM "Campaign" WHERE id LIKE 'showcase_%';
INSERT INTO "Campaign" (id, category, audience, title, body, url, status, recipients, delivered, pushed, "createdById", "createdAt", "finishedAt")
SELECT 'showcase_c1', 'PROMOTIONS', 'BUYERS', 'عروض العودة إلى المدارس', 'خصومات حتى 30٪ على القرطاسية والحقائب في أسواق دمشق', '/search?offers=1', 'SENT', 1840, 1796, 1210, u.id, now() - interval '1 day', now() - interval '1 day'
FROM "User" u WHERE u.phone = '963900000001';
INSERT INTO "Campaign" (id, category, audience, title, body, url, status, recipients, delivered, pushed, "createdById", "createdAt", "finishedAt")
SELECT 'showcase_c2', 'INVITES', 'MERCHANTS_UNVERIFIED', 'وثّق متجرك واظهر أولاً في البحث', 'التوثيق مجاني ويأخذ دقائق من الموبايل', '/dashboard/verification', 'SENT', 146, 146, 88, u.id, now() - interval '4 days', now() - interval '4 days'
FROM "User" u WHERE u.phone = '963900000001';

-- Moderation queues: open reports, a held review, a merchant's review flag, a product under review
DELETE FROM "Notification" WHERE id NOT LIKE 'showcase_%'
  AND "userId" IN (SELECT id FROM "User" WHERE phone IN ('963900000200', '963900000100', '963900000001'));

DELETE FROM "Report" WHERE id LIKE 'showcase_%';
INSERT INTO "Report" (id, "reporterId", "storeId", "productId", reason, details, status, "createdAt")
SELECT r.id, r.reporter, p."storeId", p.id, r.reason, r.details, 'OPEN', now() - r.age
FROM (VALUES
  ('showcase_rep1', 'showcase_u2', 'معلومات مضللة', 'الصورة لا تطابق المنتج الذي وصلني', interval '2 hours', 0),
  ('showcase_rep2', 'showcase_u3', 'رقم تواصل لا يعمل', 'حاولت الاتصال عدة مرات دون رد', interval '5 hours', 1),
  ('showcase_rep3', 'showcase_u4', 'احتيال أو نصب', 'طلب تحويل مبلغ مسبق قبل المعاينة', interval '1 day', 2)
) AS r(id, reporter, reason, details, age, n)
JOIN LATERAL (SELECT id, "storeId" FROM "Product" WHERE status = 'ACTIVE' ORDER BY "createdAt" OFFSET r.n LIMIT 1) p ON true;

INSERT INTO "Review" (id, "storeId", "buyerId", rating, comment, status, "moderationNote", "createdAt", "updatedAt")
SELECT 'showcase_r6', s.id, 'showcase_u2', 2, 'ما رد علي، اتصلوا على 0944 123 456 بدل الواتساب', 'UNDER_REVIEW', 'محجوز تلقائياً: يحتوي رقم هاتف', now() - interval '3 hours', now() - interval '3 hours'
FROM "Store" s WHERE s.slug = 'abu-fouad-spices'
ON CONFLICT DO NOTHING;
UPDATE "Review" SET "flagOpen" = true, "flagReason" = 'الزبون لم يشترِ من المحل، والتقييم بعد مكالمة واحدة فقط', "flaggedAt" = now() - interval '1 hour'
WHERE id = 'showcase_r3';

DELETE FROM "Product" WHERE title = 'سماعات لاسلكية أصلية بسعر الجملة';
INSERT INTO "Product" (id, "storeId", "categoryId", title, description, "priceType", price, currency, condition, "inStock", images, status, "riskScore", "searchText", "createdAt", "updatedAt")
SELECT 'showcase_p1', p."storeId", p."categoryId", 'سماعات لاسلكية أصلية بسعر الجملة', 'نسخة طبق الأصل عن الماركة، كفالة شهر', 'FIXED', 95000, 'SYP', 'NEW', true, '{}', 'UNDER_REVIEW', 55, 'سماعات لاسلكيه', now() - interval '40 minutes', now() - interval '40 minutes'
FROM "Product" p ORDER BY p."createdAt" LIMIT 1;
