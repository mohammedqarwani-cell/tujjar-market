export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <div className="font-bold text-lg">تُجّار ماركت</div>
          <p className="text-sm text-gray-600">
            منصّة تستعرض متاجر الأسواق حسب المدينة والسوق، مع إمكانية تصفّح
            المنتجات وفتح متجر إلكتروني.
          </p>
        </div>

        <div>
          <div className="font-semibold mb-2">روابط</div>
          <ul className="space-y-1 text-sm">
            <li>
              <a className="hover:underline" href="/">
                الرئيسية
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/markets">
                الأسواق
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/stores">
                المتاجر
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/offers">
                العروض
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold mb-2">للتجّار</div>
          <ul className="space-y-1 text-sm">
            <li>
              <a className="hover:underline" href="/dashboard">
                لوحة التاجر
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/login">
                تسجيل الدخول
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/register">
                إنشاء حساب
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold mb-2">الدعم</div>
          <ul className="space-y-1 text-sm">
            <li>
              <a className="hover:underline" href="/help">
                المساعدة
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/terms">
                الشروط
              </a>
            </li>
            <li>
              <a className="hover:underline" href="/privacy">
                الخصوصية
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-gray-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} تُجّار ماركت</span>
          <span>صنع بحب ❤</span>
        </div>
      </div>
    </footer>
  );
}
