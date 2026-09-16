# نشر النسخة التجريبية — Vercel + Render + Supabase

نسخة **للعرض فقط** على الجهات والتجار، وليست إطلاقاً فعلياً:
- البيانات والمتاجر وهمية، وتظهر شريطة «نسخة تجريبية» أعلى كل صفحة
- رمز التحقق يظهر على الشاشة لعدم وجود مزوّد SMS بعد
- الواجهات الثلاث مخفية عن محركات البحث

| الجزء | المكان | الخطة |
|---|---|---|
| واجهة الزبائن، بوابة التجار، لوحة الإدارة | Vercel (3 مشاريع من نفس المستودع) | مجانية |
| الـ API (NestJS) | Render (منطقة فرانكفورت) | مجانية: تنام بعد 15 دقيقة بلا زيارات، وأول طلب بعدها يتأخر قرابة دقيقة |
| قاعدة البيانات + الصور + وثائق التوثيق | Supabase (منطقة فرانكفورت eu-central-1) | مجانية |

**كيف تتصل الأجزاء:** كل واجهة على Vercel تمرّر طلبات `/api/...` إلى الـ API على Render. بهذا تبقى كوكيز الجلسة
على نطاق الواجهة نفسها، وتبقى جلسات الواجهات الثلاث منفصلة.

> المطلوب منك: إنشاء الحسابات وتسجيل الدخول ونسخ القيم إلى لوحات التحكم. لا تضع أي قيمة سرية في المستودع أو في المحادثة.

---

## 1) Supabase

1. أنشئ مشروعاً جديداً باسم `tujjar-demo` في منطقة **Frankfurt (eu-central-1)**، واحفظ كلمة مرور قاعدة البيانات عندك.
2. من زر **Connect** أعلى لوحة المشروع، انسخ رابطَي الاتصال:
   - **Transaction pooler** (المنفذ 6543): هذا هو `DATABASE_URL`، وأضف في آخره `?pgbouncer=true&connection_limit=1`
   - **Session pooler** (المنفذ 5432): هذا هو `DIRECT_URL`
   - ضع كلمة مرور قاعدة البيانات مكان `[YOUR-PASSWORD]` في الرابطين
3. من **Storage** أنشئ حاويتين:
   - `tujjar-public` وفعّل خيار **Public bucket**
   - `tujjar-kyc` واتركها **خاصة** (لا تجعلها عامة أبداً، ففيها صور الهويات)
4. من **Project Settings → Storage → S3 Connection**:
   - انسخ **Endpoint** (بالشكل `https://<ref>.supabase.co/storage/v1/s3`) و**Region**
   - أنشئ **Access key** وانسخ المفتاحين

## 2) Render (الـ API)

1. ادخل Render بحساب GitHub، ثم **New → Blueprint**، واختر المستودع `tujjar-market`. سيقرأ الملف `render.yaml`.
2. املأ القيم التي يطلبها:

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | رابط Transaction pooler مع `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | رابط Session pooler |
| `MINIO_ENDPOINT` | Endpoint من Supabase |
| `MINIO_REGION` | Region من Supabase (مثل `eu-central-1`) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | مفتاحا S3 من Supabase |
| `MINIO_BUCKET` | `tujjar-public` |
| `MINIO_PRIVATE_BUCKET` | `tujjar-kyc` |
| `MEDIA_PUBLIC_URL` | `https://<ref>.supabase.co/storage/v1/object/public/tujjar-public` |
| `WEB_ORIGIN` / `MERCHANT_ORIGIN` / `ADMIN_ORIGIN` | ضع مؤقتاً `https://example.com`، وتُصحَّح في الخطوة 4 |

3. اضغط **Apply**. البناء الأول يستغرق دقائق، ثم يطبّق الترحيلات ويحمّل البيانات التجريبية تلقائياً (مرة واحدة فقط، وقاعدة البيانات فارغة).
4. انسخ رابط الخدمة، مثل `https://tujjar-api.onrender.com`، وتأكد أن `https://tujjar-api.onrender.com/categories` يعرض الأقسام.

الأسرار (مفاتيح التشفير وكلمات مرور الحسابات التجريبية) يولّدها Render تلقائياً. تجدها في صفحة الخدمة → **Environment**.

## 3) Vercel (ثلاثة مشاريع)

كرر هذا ثلاث مرات: **Add New → Project** ← استيراد `tujjar-market` ← **Root Directory**: `apps/web`.

| المشروع | الاسم المقترح | Build Command |
|---|---|---|
| واجهة الزبائن | `tujjar-market` | `npm run build` |
| بوابة التجار | `tujjar-merchant` | `npm run build:merchant` |
| لوحة الإدارة | `tujjar-admin` | `npm run build:admin` |

متغيرات البيئة، **نفسها في المشاريع الثلاثة**، وتُضاف قبل النشر الأول لأن متغيرات `NEXT_PUBLIC_` تُثبَّت وقت البناء:

| المتغير | القيمة |
|---|---|
| `API_BASE_URL` | رابط Render، مثل `https://tujjar-api.onrender.com` |
| `API_PROXY_TARGET` | رابط Render نفسه |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` |
| `NEXT_PUBLIC_SITE_URL` | رابط مشروع الزبائن، مثل `https://tujjar-market.vercel.app` |
| `NEXT_PUBLIC_MERCHANT_URL` | رابط مشروع التجار |
| `NEXT_PUBLIC_ADMIN_URL` | رابط مشروع الإدارة |
| `NEXT_PUBLIC_MEDIA_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |

الروابط النهائية تظهر بعد إنشاء كل مشروع. إن اختلفت عن المتوقع، صحّح المتغيرات ثم **Redeploy** للمشاريع الثلاثة.

## 4) ربط الـ API بالواجهات

في Render → الخدمة → **Environment** ضع الروابط الحقيقية ثم احفظ (يعيد Render التشغيل):
- `WEB_ORIGIN` = رابط الزبائن
- `MERCHANT_ORIGIN` = رابط التجار
- `ADMIN_ORIGIN` = رابط الإدارة

## 5) التجربة

- واجهة الزبائن: الصفحة الرئيسية والأسواق والمتاجر
- بوابة التجار `/login`: رقم `0900000100` وكلمة المرور `SEED_MERCHANT_PASSWORD` من Render
- لوحة الإدارة `/admin/login`: رقم `0900000001` وكلمة المرور `SEED_ADMIN_PASSWORD`، ثم إعداد المصادقة الثنائية في تطبيق Google Authenticator

## الإشعارات

لا تحتاج أي إعداد: الـ API يولّد مفاتيح Web Push عند أول تشغيل ويحفظها مشفّرة في قاعدة البيانات.
اختيارياً يمكن ضبط `VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` (من `npx web-push generate-vapid-keys`) و`VAPID_CONTACT_EMAIL` في Render.
**لا تغيّر `TOTP_ENC_KEY` بعد النشر**: يُستخدم لتشفير المفتاح المحفوظ، وتغييره يعطّل اشتراكات الأجهزة الحالية.

## حدود النسخة التجريبية

- **خطة Render المجانية تنام:** أول زيارة بعد فترة هدوء تتأخر قرابة دقيقة. للعرض على جهة، افتح الموقع قبلها بدقيقتين أو ارفع الخطة (7$ شهرياً).
- **حجم الرفع:** الطلبات تمر عبر وكيل Vercel، لذلك يُضغط فيديو المحل ليبقى تحت 3 ميغابايت.
- **ليست للإطلاق:** الإطلاق الفعلي يحتاج دوميناً خاصاً (مثل `tujjar.sy` و`api.tujjar.sy`) ومزوّد SMS، مع إيقاف `DEMO_MODE` و`OTP_DEV_ECHO`، وحذف الحسابات التجريبية، ومسح حدود الأسواق. التفاصيل في `docs/ROADMAP.md` و`docs/SECURITY.md`.

## مشاكل واجهتنا فعلاً عند أول نشر

| العطل | السبب | الحل |
|---|---|---|
| `sh: 1: nest: not found` في بناء Render | Render يضبط `NODE_ENV=production`، فيتخطى npm حزم التطوير ومنها أدوات البناء | أمر البناء صار `npm ci --include=dev` |
| `P1013: database string is invalid` | نُسخ السطر كاملاً من Supabase مع اسم المتغير أو علامات التنصيص | القيمة تبدأ بـ `postgresql://` مباشرة، بلا تنصيص ولا مسافات |
| Supabase يرفض اسم الحاوية `public` | اسم محجوز | استُخدم `tujjar-public` و`tujjar-kyc`، والاسمان يُدخلان كمتغيرين |
| كل طلبات الدخول ترجع 403 «مصدر الطلب غير مسموح» | `WEB_ORIGIN` أو `ADMIN_ORIGIN` لا يطابق رابط Vercel حرفياً | القيمة نص مطابق تماماً بلا شرطة مائلة في النهاية |
| Render لا يعرض المستودع | المستودع خاص وRender لم يُمنح صلاحية الوصول إليه | من GitHub: Settings ← Applications ← Render ← Configure ← إضافة المستودع |

**كيف تتحقق أن النطاقات مضبوطة بلا تسجيل دخول:** طلب `POST /auth/login` بكلمة مرور خاطئة يعيد 401 إذا كان النطاق مقبولاً، و403 إذا كان مرفوضاً.
