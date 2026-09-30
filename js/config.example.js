// ============================================================================
// ملف الإعدادات — انسخ هذا الملف باسم config.js وضع بياناتك الحقيقية
// لا تضع service_role key هنا أبدًا، فقط الرابط والمفتاح العام anon key
// ============================================================================
window.APP_CONFIG = {
  // رابط مشروع Supabase — من: Project Settings → API → Project URL
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",

  // المفتاح العام anon فقط — من: Project Settings → API → anon public
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  // اسم الشركة الظاهر في الواجهة
  APP_NAME: "الحلواني",

  // الحد الأدنى: الوقت الذي يُعتبر بعده الصنف "انتهى مبكرًا" في التقارير (24 ساعة)
  EARLY_OUT_OF_STOCK_HOUR: 15
};
