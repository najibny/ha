// ============================================================================
// إعداد الاتصال بـ Supabase
// نستخدم مفتاح anon العام فقط — كل عملية كتابة حساسة تمر عبر دوال RPC آمنة
// معرّفة في supabase/schema.sql، وليس عبر إدراج/تعديل مباشر من الواجهة.
// ============================================================================

const cfg = window.APP_CONFIG || {};

if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
  console.warn('⚠️ لم يتم ضبط إعدادات Supabase بعد. انسخ js/config.example.js إلى js/config.js وضع بياناتك.');
}

// عميل Supabase العام (يُحمَّل من CDN في index.html قبل هذا الملف)
const supabaseClient = window.supabase.createClient(
  cfg.SUPABASE_URL || 'https://placeholder.supabase.co',
  cfg.SUPABASE_ANON_KEY || 'placeholder'
);

// حالة التطبيق المشتركة بين كل الوحدات (module-less, يعمل مباشرة عبر <script>)
const STATE = {
  session: null,        // { token, department_id, department_name, department_kind }
  departments: [],
  products: [],
  productDepartments: [],
  statuses: [],          // product_statuses
  alternatives: [],
  popular: [],
  messages: [],
  activityLog: [],
  connection: 'online',  // online | reconnecting | offline
  theme: localStorage.getItem('theme') || 'light',
  soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
  searchTerm: '',
  currentView: 'login',
  callcenterDepartmentFilter: 'all'
};
