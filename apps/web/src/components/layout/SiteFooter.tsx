import Link from "next/link";
import { Logo } from "@components/brand/Logo";
import { merchantUrl } from "@lib/urls";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-sand/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm leading-7 text-muted">
            منصة سورية تجمع محلات الأسواق في مكان واحد. ابحث عن المنتج، قارن الأسعار، وتواصل مع التاجر
            مباشرة — بدون وسيط وبدون عمولة.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">تسوّق</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/markets" className="hover:text-ink">الأسواق حسب المحافظة</Link></li>
            <li><Link href="/search?offers=1" className="hover:text-ink">العروض والتخفيضات</Link></li>
            <li><Link href="/search?type=stores" className="hover:text-ink">كل المتاجر</Link></li>
            <li><Link href="/favorites" className="hover:text-ink">المفضلة</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">للتجار</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href={merchantUrl("/join")} className="hover:text-ink">افتح متجرك مجاناً</Link></li>
            <li><Link href={merchantUrl("/login")} className="hover:text-ink">دخول التجار</Link></li>
            <li><Link href={merchantUrl("/dashboard")} className="hover:text-ink">لوحة المتجر</Link></li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line/70 px-4 py-4 text-xs text-muted">
        <span>© {new Date().getFullYear()} تُجّار ماركت · صُنع لأسواق سوريا</span>
        <Link href="/terms" className="hover:text-ink">الشروط والأحكام</Link>
        <Link href="/privacy" className="hover:text-ink">سياسة الخصوصية</Link>
      </div>
    </footer>
  );
}
