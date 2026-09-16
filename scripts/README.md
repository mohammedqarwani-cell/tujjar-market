# سكربتات الاختبار والتوثيق

أدوات لإعادة تشغيل اختبارات الأمان وتحديث لقطات الملف التعريفي بعد أي تطوير.

> **للتطوير فقط.** الاختبارات تنشئ حساب زبون مؤقتاً وتفعّل المصادقة الثنائية لحساب الإدارة ثم تحذفهما،
> وتعتمد على `OTP_DEV_ECHO=true`. لا تُشغَّل أبداً على قاعدة بيانات الإنتاج.

## المتطلبات

1. حاويات Docker تعمل: `docker compose up -d` داخل `infra`
2. قاعدة البيانات مُرحّلة وفيها البيانات التجريبية: `npx prisma migrate deploy` ثم `npx prisma db seed` داخل `apps/api`
3. الـ API يعمل على المنفذ 4000، وكل واجهة على منفذها: الزبائن 3000، التجار 3001، الإدارة 3002
   (`npm run dev` و`npm run dev:merchant` و`npm run dev:admin` داخل `apps/web`)
4. بناء أداة رموز المصادقة مرة واحدة:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-totp-helper.ps1
```

## اختبارات الأمان

| الأمر | ماذا يختبر | العدد |
|---|---|---|
| `node scripts\security-tests\totp-vectors.cjs $env:TEMP\tj-totp` | خوارزميات المصادقة الثنائية والتشفير مقارنة بمتجهات RFC 4226 / RFC 6238 | 11 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-security.ps1` | الترويسات، CSRF، رموز SMS، الشروط، كلمات المرور، الكوكيز، فصل الواجهات، تبديل الجلسات، البلاغات، رفع الصور، المصادقة الثنائية، سجل التدقيق | 40 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-lockout.ps1` | قفل الحساب بعد 5 محاولات فاشلة | 8 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-markets.ps1` | الإطلاق التدريجي: حالة المحافظات، اهتمام التجار، إدارة الأسواق والأقسام، الحدود الجغرافية، إخفاء متاجر المحافظات غير المفتوحة، سجل التدقيق | 32 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-verification.ps1` | التوثيق المتدرّج: التعهد عند التسجيل، حدود المنتجات، الهوية وفيديو المحل، التشفير في المخزن الخاص، المراجعة، حدود السوق الجغرافية، إلغاء التوثيق عند نقل المتجر، إيقاف الشارة بعد البلاغات، سجل التدقيق | 45 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-reviews.ps1` | التقييمات ومصداقية المُبلِّغين: شرط التواصل ومهلته، النشر والحجز، إخفاء الهوية، رد التاجر وطلب المراجعة، قرارات الإدارة، منع التقييم الذاتي، إيقاف المُبلِّغ الكيدي، سجل التدقيق | 32 |
| `powershell -ExecutionPolicy Bypass -File scripts\security-tests\e2e-notifications.ps1` | الإشعارات: العدّاد والإعدادات، اشتراكات Web Push ورفض العناوين غير الحقيقية، المتابعة والمفضلة، المنتجات الجديدة وانخفاض السعر والتوفر، عزل الحسابات، طوابير المشرفين، الحملات | 31 |

**مهم:** `e2e-security.ps1` يستهلك حد محاولات الدخول (10 كل 15 دقيقة لكل IP). **أعد تشغيل الـ API** قبل تشغيل
`e2e-lockout.ps1`، لأن عدادات الحد محفوظة في الذاكرة.

## لقطات الملف التعريفي

```powershell
# 1) التقاط كل الشاشات (العامة + التاجر + الزبون + الإدارة) — يحتاج API مُعاد تشغيله حديثاً
node scripts\screenshots\capture-screens.mjs docs\presentation\screens $env:TEMP\tj-totp\auth\totp.js

# 2) إلغاء المصادقة الثنائية التي فعّلها السكربت لحساب الإدارة
'UPDATE "User" SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE phone = ''963900000001''; DELETE FROM "Session";' | docker exec -i tujjar_postgres psql -U tujjar -d tujjar_db

# 3) إعادة إنشاء ملف PDF
powershell -ExecutionPolicy Bypass -File scripts\screenshots\build-profile-pdf.ps1
```

بعد الالتقاط: غطِّ مفتاح الإعداد في `screens/admin-2fa-setup.png` قبل الرفع، لأنه مفتاح حقيقي حتى لو أُلغي لاحقاً.

## ملاحظات

- سكربتات PowerShell التي تحتوي نصاً عربياً يجب حفظها بترميز **UTF-8 مع BOM**، وإلا يقرؤها PowerShell 5.1 بشكل خاطئ.
- `capture-screens.mjs` يحتاج Microsoft Edge وNode.js 22 أو أحدث.
