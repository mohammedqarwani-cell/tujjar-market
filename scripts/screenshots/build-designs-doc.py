"""Builds docs/designs/tujjar-market-designs.html from the captured screens (see capture-designs.mjs).

A4 landscape pages: each shows one screen or a desktop/phone pair inside device frames.
Screens that failed to capture are skipped, so the document never shows a broken image.
"""
import html
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'docs', 'designs')
SCREENS = os.path.join(OUT_DIR, 'screens')
FONTS = '../presentation/fonts'


def compress_captures():
    """Captures arrive as PNG; high-quality JPEG keeps the repo and the PDF light."""
    try:
        from PIL import Image
    except ImportError:
        return
    for f in os.listdir(SCREENS):
        if f.endswith('.png'):
            src = os.path.join(SCREENS, f)
            Image.open(src).convert('RGB').save(src[:-4] + '.jpg', quality=86, optimize=True, progressive=True)
            os.remove(src)


compress_captures()


def has(name):
    return os.path.exists(os.path.join(SCREENS, f'{name}.jpg'))


def browser(name, height_mm, url=''):
    return (
        f'<div class="browser"><div class="bar"><i></i><i></i><i></i><span>{html.escape(url)}</span></div>'
        f'<div class="shot" style="max-height:{height_mm}mm"><img src="screens/{name}.jpg" alt=""></div></div>'
    )


def phone(name, height_mm=150):
    return f'<div class="phone"><div class="notch"></div><div class="shot" style="height:{height_mm}mm"><img src="screens/{name}.jpg" alt=""></div></div>'


def fig(inner, caption):
    return f'<figure>{inner}<figcaption>{html.escape(caption)}</figcaption></figure>'


pages = []


def page(section, title, lead, body):
    pages.append(
        f'<section class="page"><header><span class="tag">{html.escape(section)}</span>'
        f'<h2>{html.escape(title)}</h2><p>{html.escape(lead)}</p></header><div class="body">{body}</div>'
        f'<footer><span>تُجّار ماركت</span><span>{html.escape(section)}</span></footer></section>'
    )


def pair(desktop, mobile, cap_d, cap_m, url):
    if not has(desktop) and not has(mobile):
        return ''
    parts = []
    if has(desktop):
        parts.append(fig(browser(desktop, 128, url), cap_d))
    if has(mobile):
        parts.append(fig(phone(mobile, 132), cap_m))
    return f'<div class="pair">{"".join(parts)}</div>'


def two(a, b, cap_a, cap_b, url_a, url_b, h=142):
    items = [fig(browser(n, h, u), c) for n, c, u in ((a, cap_a, url_a), (b, cap_b, url_b)) if has(n)]
    return f'<div class="two">{"".join(items)}</div>' if items else ''


def phones(names_caps, h=138):
    items = [fig(phone(n, h), c) for n, c in names_caps if has(n)]
    return f'<div class="phones">{"".join(items)}</div>' if items else ''


def single(name, cap, url, h=148):
    return fig(browser(name, h, url), cap) if has(name) else ''


def add(section, title, lead, body):
    if body.strip():
        page(section, title, lead, body)


W, M, A = 'tujjar-market.sy', 'merchant.tujjar-market.sy', 'admin.tujjar-market.sy'

# ---------- customers ----------
S = 'واجهة الزبائن'
add(S, 'الصفحة الرئيسية', 'بحث فوري، أسواق المحافظة المختارة، عروض ومنتجات ومتاجر موثوقة، بتصميم عربي مستوحى من أقواس الأسواق الدمشقية.',
    pair('buyer-home', 'buyer-home-mobile', 'على الكمبيوتر', 'على الموبايل', W))
add(S, 'أول زيارة', 'تحديد المحافظة تلقائياً من موقع الجهاز، أو اختيارها بسهولة، مع قائمة محافظات بتصميم المنصة.',
    '<div class="pair">'
    + (fig(browser('buyer-gov-menu', 128, W), 'قائمة المحافظات وتحديد الموقع') if has('buyer-gov-menu') else '')
    + (fig(phone('buyer-first-visit-mobile', 132), 'اختيار المحافظة عند أول زيارة') if has('buyer-first-visit-mobile') else '')
    + '</div>')
add(S, 'البحث والعروض', 'بحث عربي يفهم الكتابة بأشكالها، مع فلترة حسب القسم والسوق والسعر والحالة.',
    pair('buyer-search', 'buyer-search-mobile', 'نتائج البحث', 'العروض على الموبايل', f'{W}/search'))
add(S, 'الأسواق', 'أسواق كل محافظة، وصفحة لكل سوق بمحلاته ومنتجاته.',
    two('buyer-markets', 'buyer-market', 'أسواق سوريا', 'سوق الحميدية', f'{W}/markets', f'{W}/markets/al-hamidiyah'))
add(S, 'صفحة المتجر', 'هوية المتجر ومستوى توثيقه وتقييمه، أزرار واتساب والاتصال، المتابعة، والمنتجات والتقييمات مع ردود التاجر.',
    pair('buyer-store', 'buyer-store-mobile', 'متجر موثّق مع تقييمات الزبائن', 'على الموبايل', f'{W}/stores/brocade-alsham'))
add(S, 'صفحة المنتج', 'صور وسعر وحالة المنتج، تواصل مباشر مع التاجر برسالة جاهزة، ونصائح للشراء الآمن ومنتجات مشابهة.',
    pair('buyer-product', 'buyer-product-mobile', 'على الكمبيوتر', 'على الموبايل', f'{W}/products'))
add(S, 'حساب الزبون', 'المفضلة محفوظة في الحساب، والمتاجر المتابَعة، ومركز إشعارات يجمع العروض وانخفاض الأسعار والردود.',
    phones([('buyer-account-mobile', 'حسابي'), ('buyer-favorites-mobile', 'المفضلة'), ('buyer-notifications-mobile', 'الإشعارات')]))
add(S, 'الإشعارات', 'جرس بعدّاد وقائمة سريعة، وإعدادات لكل نوع: داخل التطبيق أو على الجهاز.',
    two('buyer-bell', 'buyer-notification-settings', 'قائمة الإشعارات', 'إعدادات الإشعارات', W, f'{W}/notifications/settings'))
add(S, 'المتابعة والثقة', 'المتاجر التي يتابعها الزبون، وصفحة تشرح للزبائن كيف نوثّق المتاجر.',
    two('buyer-following', 'buyer-verification', 'المتاجر التي أتابعها', 'كيف نوثّق المتاجر', f'{W}/account/following', f'{W}/verification'))
add(S, 'الدخول والتسجيل', 'حساب برمز تحقق SMS، وموافقة صريحة على الشروط وسياسة الخصوصية.',
    '<div class="pair">'
    + (fig(browser('buyer-register', 128, f'{W}/account/register'), 'حساب جديد') if has('buyer-register') else '')
    + (fig(phone('buyer-login-mobile', 132), 'تسجيل الدخول') if has('buyer-login-mobile') else '')
    + '</div>')

# ---------- merchants ----------
S = 'بوابة التجار'
add(S, 'انضمام التجار', 'فتح متجر مجاني خلال دقائق: المحافظة والسوق والقسم، رمز تحقق، وتعهّد بصحة المعلومات.',
    pair('merchant-join', 'merchant-join-mobile', 'على الكمبيوتر', 'على الموبايل', f'{M}/join'))
add(S, 'لوحة المتجر', 'مشاهدات ونقرات واتساب واتصال يومية، وأكثر المنتجات اهتماماً، ومستوى التوثيق.',
    pair('merchant-dashboard', 'merchant-dashboard-mobile', 'نظرة عامة', 'على الموبايل', f'{M}/dashboard'))
add(S, 'المنتجات', 'إدارة المنتجات وحالتها، وإضافة منتج بالصور والسعر والعرض من الموبايل.',
    two('merchant-products', 'merchant-product-form', 'منتجاتي', 'إضافة منتج', f'{M}/dashboard/products', f'{M}/dashboard/products/new'))
add(S, 'التوثيق المتدرّج', 'مستويات واضحة: الهوية ثم فيديو المحل من الكاميرا مع الموقع، مع حالة كل طلب وسبب الرفض إن وُجد.',
    single('merchant-verification', 'توثيق المتجر', f'{M}/dashboard/verification'))
add(S, 'التقييمات والإعدادات', 'الرد على تقييمات الزبائن وطلب مراجعة غير العادل منها، وتعديل بيانات المتجر وصوره.',
    two('merchant-reviews', 'merchant-store-settings', 'تقييمات المتجر', 'إعدادات المتجر', f'{M}/dashboard/reviews', f'{M}/dashboard/store'))
add(S, 'دخول التجار وإشعاراتهم', 'بوابة مستقلة بجلسات منفصلة، وإشعارات فورية بالتقييمات وقرارات التوثيق.',
    '<div class="pair">'
    + (fig(browser('merchant-login', 128, f'{M}/login'), 'دخول التجار') if has('merchant-login') else '')
    + (fig(phone('merchant-notifications-mobile', 132), 'إشعارات التاجر') if has('merchant-notifications-mobile') else '')
    + '</div>')

# ---------- admin ----------
S = 'لوحة الإدارة'
add(S, 'دخول آمن', 'لوحة على نطاق منفصل، ومصادقة ثنائية إلزامية لكل حسابات الإدارة.',
    two('admin-login', 'admin-2fa-setup', 'دخول الإدارة', 'إعداد المصادقة الثنائية', f'{A}/admin/login', f'{A}/admin'))
add(S, 'نظرة عامة', 'مؤشرات المنصة وطوابير المراجعة في مكان واحد: طلبات التوثيق، المتاجر، المنتجات، البلاغات والتقييمات.',
    single('admin-verifications', 'لوحة الإدارة', f'{A}/admin'))
add(S, 'المنتجات والمتاجر', 'مراجعة المنتجات عالية المخاطر، وإدارة المتاجر ومستويات توثيقها.',
    two('admin-products', 'admin-stores', 'المنتجات', 'المتاجر', f'{A}/admin?tab=products', f'{A}/admin?tab=stores'))
add(S, 'البلاغات والتقييمات', 'بلاغات مع مصداقية كل مُبلِّغ، وتقييمات محجوزة أو مطلوب مراجعتها مع دليل التواصل الفعلي.',
    two('admin-reports', 'admin-reviews', 'البلاغات', 'التقييمات', f'{A}/admin?tab=reports', f'{A}/admin?tab=reviews'))
add(S, 'الأسواق والأقسام', 'فتح المحافظات تدريجياً، وإدارة الأسواق وحدودها الجغرافية، والأقسام.',
    two('admin-markets', 'admin-categories', 'المحافظات والأسواق', 'الأقسام', f'{A}/admin?tab=markets', f'{A}/admin?tab=categories'))
add(S, 'الحملات والتدقيق', 'حملات إشعارات للزبائن أو التجار مع أرقام التسليم، وسجل تدقيق لكل عملية.',
    two('admin-campaigns', 'admin-audit', 'الإشعارات والحملات', 'سجل التدقيق', f'{A}/admin?tab=campaigns', f'{A}/admin?tab=audit'))
if has('admin-mobile'):
    add(S, 'الإدارة من الموبايل', 'كل أدوات المراجعة تعمل على شاشة الموبايل.', phones([('admin-mobile', 'مراجعة التقييمات')], h=150))

SWATCHES = [
    ('#b86e14', 'نحاسي السوق', 'اللون الرئيسي'), ('#8f5410', 'نحاسي داكن', 'النصوص البارزة'), ('#f2cc8f', 'ذهبي القنديل', 'التمييز'),
    ('#56632a', 'زيتوني', 'التوثيق والنجاح'), ('#1f1a14', 'حبر', 'النصوص'), ('#fbf7f1', 'ورق', 'الخلفية'),
    ('#f4ece0', 'رملي', 'المساحات'), ('#1fa855', 'واتساب', 'التواصل'),
]
swatches = ''.join(
    f'<div class="swatch"><span style="background:{c}"></span><b>{n}</b><small>{u} · <bdi>{c}</bdi></small></div>' for c, n, u in SWATCHES
)
identity = f'''
<section class="page">
  <header><span class="tag">الهوية البصرية</span><h2>لغة تصميم واحدة لثلاث واجهات</h2>
  <p>مستوحاة من أقواس الأسواق الدمشقية وألوان النحاس والزيتون، عربية من اليمين لليسار، ومصممة للموبايل أولاً.</p></header>
  <div class="body identity">
    <div class="logo-card">
      <svg width="120" height="120" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#b86e14"/><path d="M11 31V18.5a9 9 0 0 1 18 0V31" fill="none" stroke="#fdf6ea" stroke-width="3.2" stroke-linecap="round"/><path d="M16 31v-9.5a4 4 0 0 1 8 0V31" fill="#6b7a36"/><circle cx="20" cy="11.5" r="1.8" fill="#f2cc8f"/></svg>
      <div><div class="logo-name">تُجّار ماركت</div><div class="logo-tag">أسواق سوريا بين يديك</div>
      <p>القوس بوابة السوق، والباب الزيتوني المحل، والقنديل الذهبي الثقة.</p></div>
    </div>
    <div class="swatches">{swatches}</div>
    <div class="type">
      <div><span class="aa">أبجد</span><b>IBM Plex Sans Arabic</b><small>خط واحد بثلاثة أوزان: عادي، متوسط، عريض</small></div>
      <div class="principles">
        <div><b>عربي أولاً</b><small>اتجاه من اليمين لليسار ولهجة قريبة من الناس</small></div>
        <div><b>الموبايل أولاً</b><small>شريط تنقل سفلي وأزرار كبيرة سهلة اللمس</small></div>
        <div><b>الثقة ظاهرة</b><small>شارات توثيق وتقييمات حقيقية في كل مكان</small></div>
        <div><b>متاح للجميع</b><small>تباين واضح، أوصاف للقارئات الصوتية، ودعم لوحة المفاتيح</small></div>
      </div>
    </div>
  </div>
  <footer><span>تُجّار ماركت</span><span>الهوية البصرية</span></footer>
</section>'''

cover = '''
<section class="cover">
  <div class="cover-in">
    <div class="brand">
      <svg width="64" height="64" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#b86e14"/><path d="M11 31V18.5a9 9 0 0 1 18 0V31" fill="none" stroke="#fdf6ea" stroke-width="3.2" stroke-linecap="round"/><path d="M16 31v-9.5a4 4 0 0 1 8 0V31" fill="#6b7a36"/><circle cx="20" cy="11.5" r="1.8" fill="#f2cc8f"/></svg>
      <div><div class="brand-name">تُجّار ماركت</div><div class="brand-tag">أسواق سوريا بين يديك</div></div>
    </div>
    <h1>تصاميم المنصة<br><span>كاملة</span></h1>
    <p>واجهة الزبائن، بوابة التجار، ولوحة الإدارة، على الكمبيوتر والموبايل. لقطات حقيقية من المنصة العاملة.</p>
    <div class="chips"><span>3 واجهات</span><span>كمبيوتر وموبايل</span><span>أيلول 2026</span></div>
  </div>
</section>'''

style = f'''
@font-face {{ font-family: "Plex Arabic"; font-weight: 400; src: url("{FONTS}/plex-arabic-400.woff2") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF; }}
@font-face {{ font-family: "Plex Arabic"; font-weight: 500; src: url("{FONTS}/plex-arabic-500.woff2") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF; }}
@font-face {{ font-family: "Plex Arabic"; font-weight: 700; src: url("{FONTS}/plex-arabic-700.woff2") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF; }}
@font-face {{ font-family: "Plex Arabic"; font-weight: 400; src: url("{FONTS}/plex-latin-400.woff2") format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+20AC; }}
@font-face {{ font-family: "Plex Arabic"; font-weight: 700; src: url("{FONTS}/plex-latin-700.woff2") format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+20AC; }}
:root {{ --canvas:#fbf7f1; --sand:#f4ece0; --ink:#1f1a14; --muted:#6f655a; --line:#e6dccd; --brand:#b86e14; --brand-dark:#8f5410; --olive:#56632a; }}
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; }}
body {{ font-family: "Plex Arabic", "Segoe UI", Tahoma, sans-serif; color: var(--ink); background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.cover, .page {{ width: 297mm; height: 210mm; position: relative; overflow: hidden; break-after: page; }}
.cover {{ background: linear-gradient(150deg, #fdf3e2 0%, #fbf7f1 55%, #eef2e1 100%); display: flex; align-items: center; padding: 0 26mm; }}
.cover::after {{ content: ""; position: absolute; inset: auto 0 0 0; height: 90mm; opacity: .55;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64' viewBox='0 0 56 64'%3E%3Cpath d='M6 64V30a22 22 0 0 1 44 0v34' fill='none' stroke='%23b86e14' stroke-opacity='.22' stroke-width='2'/%3E%3C/svg%3E");
  -webkit-mask-image: linear-gradient(to top, #000, transparent); }}
.cover-in {{ position: relative; z-index: 1; }}
.brand {{ display: flex; gap: 5mm; align-items: center; }}
.brand-name {{ font-size: 22pt; font-weight: 700; }}
.brand-tag {{ color: var(--muted); font-size: 11pt; }}
.cover h1 {{ font-size: 46pt; line-height: 1.25; margin: 16mm 0 5mm; }}
.cover h1 span {{ color: var(--brand); }}
.cover p {{ font-size: 14pt; color: var(--muted); max-width: 170mm; line-height: 1.9; margin: 0; }}
.chips {{ display: flex; gap: 3mm; margin-top: 10mm; }}
.chips span {{ background: #fff; border: 1px solid var(--line); border-radius: 99px; padding: 1.5mm 5mm; font-size: 10.5pt; font-weight: 700; }}
.page {{ background: var(--canvas); padding: 11mm 14mm 0; display: flex; flex-direction: column; }}
.page header {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 2mm 5mm; }}
.tag {{ font-size: 9pt; font-weight: 700; color: var(--brand); background: #fdf3e2; border-radius: 99px; padding: .6mm 3.5mm; }}
.page h2 {{ font-size: 21pt; margin: 0; }}
.page header p {{ flex-basis: 100%; margin: 1mm 0 0; color: var(--muted); font-size: 11pt; line-height: 1.7; }}
.body {{ flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 4mm 0; }}
.page footer {{ height: 10mm; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; color: var(--muted); }}
figure {{ margin: 0; display: flex; flex-direction: column; align-items: center; }}
figcaption {{ margin-top: 2.5mm; font-size: 9.5pt; color: var(--muted); font-weight: 500; }}
.browser {{ border-radius: 3mm; overflow: hidden; background: #fff; box-shadow: 0 2mm 7mm rgba(31,26,20,.12); border: 1px solid var(--line); }}
.browser .bar {{ height: 6mm; background: #efe7da; display: flex; align-items: center; gap: 1.3mm; padding: 0 3mm; direction: ltr; }}
.browser .bar i {{ width: 2mm; height: 2mm; border-radius: 50%; background: #d8cbb6; }}
.browser .bar span {{ margin-left: 3mm; background: #fbf7f1; border-radius: 99px; padding: 0 4mm; font-size: 7pt; color: var(--muted); line-height: 4mm; }}
.browser .shot {{ overflow: hidden; }}
.browser img, .phone img {{ display: block; width: 100%; height: auto; }}
.phone {{ position: relative; border: 2.4mm solid #231d17; border-radius: 8mm; overflow: hidden; background: #231d17; box-shadow: 0 2.5mm 8mm rgba(31,26,20,.2); }}
.phone .notch {{ position: absolute; top: 1.5mm; left: 50%; transform: translateX(-50%); width: 18mm; height: 4mm; border-radius: 99px; background: #231d17; z-index: 2; }}
.phone .shot {{ overflow: hidden; border-radius: 5.5mm; background: #fbf7f1; }}
.pair {{ display: grid; grid-template-columns: 1fr 66mm; gap: 9mm; align-items: center; width: 100%; }}
.pair .browser {{ width: 100%; }}
.pair .phone {{ width: 64mm; }}
.two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; width: 100%; }}
.two .browser {{ width: 100%; }}
.phones {{ display: flex; gap: 12mm; justify-content: center; }}
.phones .phone {{ width: 66mm; }}
.body > figure {{ width: 100%; }}
.body > figure .browser {{ width: 100%; }}
.identity {{ display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr; gap: 7mm; align-items: stretch; }}
.logo-card {{ background: #fff; border: 1px solid var(--line); border-radius: 5mm; padding: 7mm; display: flex; gap: 7mm; align-items: center; }}
.logo-name {{ font-size: 20pt; font-weight: 700; }}
.logo-tag {{ color: var(--muted); }}
.logo-card p {{ margin: 3mm 0 0; font-size: 10pt; color: var(--muted); line-height: 1.8; }}
.swatches {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }}
.swatch {{ background: #fff; border: 1px solid var(--line); border-radius: 4mm; padding: 2.5mm; display: flex; flex-direction: column; }}
.swatch span {{ height: 14mm; border-radius: 2.5mm; border: 1px solid rgba(0,0,0,.06); }}
.swatch b {{ font-size: 9.5pt; margin-top: 1.5mm; }}
.swatch small {{ font-size: 7.5pt; color: var(--muted); }}
.type {{ grid-column: 1 / -1; background: #fff; border: 1px solid var(--line); border-radius: 5mm; padding: 6mm 7mm; display: grid; grid-template-columns: 70mm 1fr; gap: 8mm; align-items: center; }}
.type .aa {{ display: block; font-size: 44pt; font-weight: 700; line-height: 1.1; color: var(--brand); }}
.type small {{ display: block; color: var(--muted); font-size: 9pt; }}
.principles {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 8mm; }}
.principles b {{ font-size: 11pt; }}
'''

doc = f'''<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>تُجّار ماركت — تصاميم المنصة</title><style>{style}</style></head>
<body>{cover}{identity}{"".join(pages)}</body>
</html>'''

os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, 'tujjar-market-designs.html'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(doc)
print(f'{len(pages) + 2} pages written', file=sys.stderr)
