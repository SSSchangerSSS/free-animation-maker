// ─────────────────────────────────────────────────────────────
// منبع واحد مسیر پایه‌ی انتشار (A24)
// هم next.config.ts و هم همه‌ی URL های asset از همین فایل می‌خوانند
// تا دو منبعِ ناسازگار برای basePath وجود نداشته باشد.
// ─────────────────────────────────────────────────────────────

/** نام مخزن — با تغییر نام مخزن فقط همین ثابت عوض می‌شود */
export const REPO = 'free-animation-maker';

const isStatic = process.env.BUILD_MODE === 'static';

/**
 * مسیر پایه:
 *  • اگر NEXT_PUBLIC_BASE_PATH تنظیم شده باشد از همان استفاده می‌شود
 *  • در حالت static (GitHub Pages) پیش‌فرض ‎/<repo>‎
 *  • در حالت dev/server پیش‌فرض '' (ریشه)
 */
export const BASE_PATH: string =
  process.env.NEXT_PUBLIC_BASE_PATH ?? (isStatic ? `/${REPO}` : '');

/** ساخت URL کامل برای asset های زیر public */
export function assetUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
