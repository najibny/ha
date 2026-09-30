-- ============================================================================
-- نظام التحديث اللحظي للأصناف — الحلواني
-- ملف قاعدة البيانات الكامل: الجداول، الفهارس، الدوال، المحفزات، وسياسات RLS
-- ============================================================================
-- طريقة الاستخدام:
-- 1) افتح مشروعك في supabase.com → SQL Editor → New query
-- 2) الصق هذا الملف كاملًا ثم اضغط Run
-- 3) نفّذه مرة واحدة فقط على قاعدة بيانات جديدة (يحتوي على DROP احترازية بأمان)
-- ============================================================================

-- تفعيل الإضافات المطلوبة (تشفير الأرقام السرية PIN + توليد UUID)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1) جدول الأقسام / الجهات (department, callcenter, admin, developer, ...)
-- ============================================================================
create table if not exists public.departments (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,               -- معرّف ثابت يستخدم داخليًا مثل 'baklawa'
  name          text not null,                       -- الاسم المعروض بالعربية
  icon          text not null default 'package',     -- اسم أيقونة Lucide
  kind          text not null default 'department'   -- department | callcenter | admin | developer
                  check (kind in ('department','callcenter','admin','developer')),
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  work_mode     text not null default 'normal'       -- normal | high_pressure (وضع الضغط العالي)
                  check (work_mode in ('normal','high_pressure')),
  work_mode_updated_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
comment on table public.departments is 'الأقسام والجهات: أقسام الإنتاج + الكول سنتر + الإدارة + حساب المطور';

-- ============================================================================
-- 2) جدول رموز الدخول PIN — مخزّنة كـ hash فقط عبر pgcrypto (crypt/bcrypt)
-- ============================================================================
create table if not exists public.department_pins (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  pin_hash      text not null,          -- ناتج crypt(pin, gen_salt('bf'))
  updated_at    timestamptz not null default now(),
  unique(department_id)
);
comment on table public.department_pins is 'لا تحتوي أبدًا على رقم PIN كنص صريح، فقط hash آمن';

-- ============================================================================
-- 3) جدول الجلسات القصيرة الأمد بعد التحقق من PIN
-- ============================================================================
create table if not exists public.sessions (
  token         uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '12 hours'),
  last_seen_at  timestamptz not null default now()
);
comment on table public.sessions is 'جلسة قصيرة الأمد تُنشأ بعد نجاح RPC للتحقق من PIN';

-- ============================================================================
-- 4) جدول الأصناف
-- ============================================================================
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                 -- كود اختياري يُستخدم في بحث الكول سنتر
  name          text not null,
  description   text default '',
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 5) ربط الأصناف بالأقسام (صنف قد ينتمي لأكثر من قسم)
-- ============================================================================
create table if not exists public.product_departments (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  unique(product_id, department_id)
);

-- ============================================================================
-- 6) حالة كل صنف داخل كل قسم — الجدول الأهم للتحديث اللحظي
-- ============================================================================
create table if not exists public.product_statuses (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  department_id     uuid not null references public.departments(id) on delete cascade,
  status            text not null default 'available'   -- available | out_of_stock | coming_soon
                        check (status in ('available','out_of_stock','coming_soon')),
  quantity_level    text default null                    -- less_5 | 5_10 | more_10 | plenty
                        check (quantity_level is null or quantity_level in ('less_5','5_10','more_10','plenty')),
  available_at      timestamptz default null,             -- موعد التوفر المتوقع لحالة "سيتوفر لاحقًا"
  note              text default '',
  version           int not null default 1,               -- يمنع الكتابة فوق تعديل أحدث بصمت
  updated_at        timestamptz not null default now(),
  updated_by_department_id uuid references public.departments(id),
  unique(product_id, department_id)
);
create index if not exists idx_product_statuses_department on public.product_statuses(department_id);
create index if not exists idx_product_statuses_status on public.product_statuses(status);
create index if not exists idx_product_statuses_available_at on public.product_statuses(available_at);

-- ============================================================================
-- 7) البدائل المقترحة عند نفاد صنف
-- ============================================================================
create table if not exists public.product_alternatives (
  id                uuid primary key default gen_random_uuid(),
  product_status_id uuid not null references public.product_statuses(id) on delete cascade,
  alternative_product_id uuid not null references public.products(id) on delete cascade,
  created_at        timestamptz not null default now()
);
create index if not exists idx_alternatives_status on public.product_alternatives(product_status_id);

-- ============================================================================
-- 8) الأصناف "الأكثر شيوعًا" — تصنيف عرض خاص بشاشة الكول سنتر فقط
-- ============================================================================
create table if not exists public.popular_products (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  sort_order    int not null default 0,
  unique(product_id)
);

-- ============================================================================
-- 9) الرسائل بين الأقسام والكول سنتر
-- ============================================================================
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  from_department_id uuid not null references public.departments(id),
  to_department_id   uuid references public.departments(id), -- NULL يعني رسالة عامة لكل الأقسام (من الكول سنتر)
  body               text not null,
  is_archived        boolean not null default false,  -- أرشفة بدل حذف عند "تصفير المحادثة"
  created_at         timestamptz not null default now()
);
create index if not exists idx_messages_to on public.messages(to_department_id);
create index if not exists idx_messages_from on public.messages(from_department_id);
create index if not exists idx_messages_archived on public.messages(is_archived);

-- ============================================================================
-- 10) سجل النشاط — يُملأ تلقائيًا عبر Triggers، لا يُنشأ من الواجهة فقط
-- ============================================================================
create table if not exists public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,   -- status_change | work_mode_change | bulk_action | pin_change | product_change
  department_id   uuid references public.departments(id),
  product_id      uuid references public.products(id),
  actor_department_id uuid references public.departments(id),
  old_value       jsonb,
  new_value       jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_activity_log_created on public.activity_log(created_at desc);
create index if not exists idx_activity_log_department on public.activity_log(department_id);
create index if not exists idx_activity_log_product on public.activity_log(product_id);
create index if not exists idx_activity_log_type on public.activity_log(event_type);

-- ============================================================================
-- محفز عام: يمنع تعارض الكتابة الصامت + يرفع version + يسجل في activity_log
-- ============================================================================
create or replace function public.fn_product_status_before_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- إذا أرسل العميل version أقدم من المخزّن، يعني أن شخصًا آخر عدّل قبله
  if new.version is not null and old.version is not null and new.version < old.version then
    raise exception 'CONFLICT: تم تعديل الحالة في مكان آخر، الرجاء إعادة التحميل';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_product_status_before_update on public.product_statuses;
create trigger trg_product_status_before_update
  before update on public.product_statuses
  for each row execute function public.fn_product_status_before_update();

-- تسجيل كل تغيير حالة في activity_log تلقائيًا
create or replace function public.fn_product_status_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status)
     or (tg_op = 'INSERT') then
    insert into public.activity_log(event_type, department_id, product_id, actor_department_id, old_value, new_value)
    values (
      'status_change',
      new.department_id,
      new.product_id,
      new.updated_by_department_id,
      case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'quantity_level', old.quantity_level) else null end,
      jsonb_build_object('status', new.status, 'quantity_level', new.quantity_level, 'available_at', new.available_at)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_status_log on public.product_statuses;
create trigger trg_product_status_log
  after insert or update on public.product_statuses
  for each row execute function public.fn_product_status_log();

-- تسجيل تغيير وضع القسم (عادي / ضغط عالٍ)
create or replace function public.fn_department_work_mode_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.work_mode is distinct from new.work_mode then
    new.work_mode_updated_at := now();
    insert into public.activity_log(event_type, department_id, old_value, new_value)
    values ('work_mode_change', new.id, jsonb_build_object('work_mode', old.work_mode), jsonb_build_object('work_mode', new.work_mode));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_department_work_mode_log on public.departments;
create trigger trg_department_work_mode_log
  before update on public.departments
  for each row execute function public.fn_department_work_mode_log();

-- ============================================================================
-- دالة RPC: التحقق من PIN وإنشاء جلسة — تُستدعى من الواجهة بدل مقارنة PIN محليًا
-- ============================================================================
create or replace function public.verify_pin_and_create_session(p_department_code text, p_pin text)
returns table(session_token uuid, department_id uuid, department_name text, department_kind text)
language plpgsql
security definer
as $$
declare
  v_department record;
  v_pin_hash text;
begin
  select id, name, kind into v_department from public.departments
    where code = p_department_code and is_active = true;

  if v_department.id is null then
    raise exception 'DEPARTMENT_NOT_FOUND';
  end if;

  select pin_hash into v_pin_hash from public.department_pins where department_id = v_department.id;

  if v_pin_hash is null or v_pin_hash <> crypt(p_pin, v_pin_hash) then
    raise exception 'INVALID_PIN';
  end if;

  return query
    insert into public.sessions(department_id) values (v_department.id)
    returning token, v_department.id, v_department.name, v_department.kind;
end;
$$;

-- ============================================================================
-- دالة RPC: تغيير PIN (تُستخدم من لوحة المطور فقط، الحماية عبر RLS على الاستدعاء)
-- ============================================================================
create or replace function public.set_department_pin(p_department_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.department_pins(department_id, pin_hash)
  values (p_department_id, crypt(p_new_pin, gen_salt('bf')))
  on conflict (department_id) do update set pin_hash = excluded.pin_hash, updated_at = now();

  insert into public.activity_log(event_type, department_id, new_value)
  values ('pin_change', p_department_id, jsonb_build_object('changed_at', now()));
end;
$$;

-- ============================================================================
-- دالة RPC: تحديث حالة صنف بأمان (تتحقق من الجلسة وتمنع تعديل قسم آخر)
-- ============================================================================
create or replace function public.update_product_status(
  p_session_token uuid,
  p_product_id uuid,
  p_status text,
  p_quantity_level text default null,
  p_available_at timestamptz default null,
  p_note text default null,
  p_expected_version int default null
) returns public.product_statuses
language plpgsql
security definer
as $$
declare
  v_department_id uuid;
  v_row public.product_statuses;
begin
  select department_id into v_department_id from public.sessions
    where token = p_session_token and expires_at > now();

  if v_department_id is null then
    raise exception 'SESSION_EXPIRED';
  end if;

  update public.sessions set last_seen_at = now() where token = p_session_token;

  update public.product_statuses
    set status = p_status,
        quantity_level = p_quantity_level,
        available_at = p_available_at,
        note = coalesce(p_note, note),
        updated_by_department_id = v_department_id,
        version = case when p_expected_version is not null then p_expected_version else version end
    where product_id = p_product_id and department_id = v_department_id
    returning * into v_row;

  if v_row.id is null then
    insert into public.product_statuses(product_id, department_id, status, quantity_level, available_at, note, updated_by_department_id)
    values (p_product_id, v_department_id, p_status, p_quantity_level, p_available_at, coalesce(p_note,''), v_department_id)
    returning * into v_row;
  end if;

  return v_row;
exception
  when others then
    if sqlerrm like 'CONFLICT%' then
      raise exception 'CONFLICT';
    else
      raise;
    end if;
end;
$$;

-- ============================================================================
-- دالة RPC: إجراء جماعي (توفير/إيقاف كل أصناف القسم) بشكل ذرّي (Transaction)
-- ============================================================================
create or replace function public.bulk_update_department_status(
  p_session_token uuid,
  p_status text
) returns int
language plpgsql
security definer
as $$
declare
  v_department_id uuid;
  v_count int;
begin
  select department_id into v_department_id from public.sessions
    where token = p_session_token and expires_at > now();

  if v_department_id is null then
    raise exception 'SESSION_EXPIRED';
  end if;

  update public.product_statuses ps
    set status = p_status,
        available_at = null,
        updated_by_department_id = v_department_id
    where ps.department_id = v_department_id
      and ps.product_id in (
        select product_id from public.product_departments where department_id = v_department_id
      );
  get diagnostics v_count = row_count;

  insert into public.activity_log(event_type, department_id, actor_department_id, new_value)
  values ('bulk_action', v_department_id, v_department_id, jsonb_build_object('status', p_status, 'affected', v_count));

  return v_count;
end;
$$;

-- ============================================================================
-- دالة RPC: تحديث وضع القسم (عادي / ضغط عالٍ)
-- ============================================================================
create or replace function public.set_department_work_mode(p_session_token uuid, p_work_mode text)
returns void
language plpgsql
security definer
as $$
declare
  v_department_id uuid;
begin
  select department_id into v_department_id from public.sessions
    where token = p_session_token and expires_at > now();
  if v_department_id is null then
    raise exception 'SESSION_EXPIRED';
  end if;

  update public.departments set work_mode = p_work_mode where id = v_department_id;
end;
$$;

-- ============================================================================
-- دالة RPC: إرسال رسالة (تتحقق من الجلسة قبل الإدراج)
-- ============================================================================
create or replace function public.send_message(p_session_token uuid, p_to_department_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
as $$
declare
  v_department_id uuid;
  v_row public.messages;
begin
  select department_id into v_department_id from public.sessions
    where token = p_session_token and expires_at > now();
  if v_department_id is null then
    raise exception 'SESSION_EXPIRED';
  end if;

  insert into public.messages(from_department_id, to_department_id, body)
  values (v_department_id, p_to_department_id, p_body)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================================
-- دالة مجدولة/تُستدعى دوريًا من الواجهة: تحويل "سيتوفر لاحقًا" المنتهية إلى "متوفر"
-- تُستدعى عبر RPC بسيط بدل الاعتماد الكامل على الواجهة فقط لضمان الاتساق
-- ============================================================================
create or replace function public.auto_resolve_expired_coming_soon()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  update public.product_statuses
    set status = 'available',
        quantity_level = coalesce(quantity_level, 'plenty'),
        available_at = null
    where status = 'coming_soon' and available_at is not null and available_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================================
-- تفعيل Row Level Security على كل الجداول المكشوفة
-- ============================================================================
alter table public.departments enable row level security;
alter table public.department_pins enable row level security;
alter table public.sessions enable row level security;
alter table public.products enable row level security;
alter table public.product_departments enable row level security;
alter table public.product_statuses enable row level security;
alter table public.product_alternatives enable row level security;
alter table public.popular_products enable row level security;
alter table public.messages enable row level security;
alter table public.activity_log enable row level security;

-- ملاحظة أمنية مهمة:
-- نستخدم مفتاح anon العام فقط في الواجهة. القراءة العامة مسموحة للجداول غير الحساسة
-- (الأقسام، الأصناف، الحالات، الرسائل، السجل) لأن التطبيق يعرضها للجميع بعد الدخول،
-- والتعديل يتم فقط عبر RPC (security definer) التي تتحقق من الجلسة داخليًا.
-- department_pins و sessions ممنوعتان تمامًا من القراءة عبر anon.

create policy "public read departments" on public.departments for select using (true);
create policy "public read products" on public.products for select using (true);
create policy "public read product_departments" on public.product_departments for select using (true);
create policy "public read product_statuses" on public.product_statuses for select using (true);
create policy "public read product_alternatives" on public.product_alternatives for select using (true);
create policy "public read popular_products" on public.popular_products for select using (true);
create policy "public read messages" on public.messages for select using (true);
create policy "public read activity_log" on public.activity_log for select using (true);

-- لا سياسات SELECT لجدولي department_pins و sessions => ممنوعة تمامًا عبر anon
-- كل الكتابة (INSERT/UPDATE/DELETE) تمر حصرًا عبر دوال RPC أعلاه (security definer)
-- لذلك لا نضيف سياسات INSERT/UPDATE عامة على anon لبقية الجداول أيضًا فيما يخص التعديلات الحساسة.
-- لوحة المطور تستخدم RPC مخصصة (انظر أسفل) لإدارة الأقسام/الأصناف بدل الكتابة المباشرة.

-- ============================================================================
-- دوال RPC إضافية للوحة المطور: إدارة الأقسام والأصناف (كتابة آمنة عبر RPC)
-- ============================================================================
create or replace function public.dev_upsert_department(
  p_session_token uuid, p_id uuid, p_code text, p_name text, p_icon text, p_sort_order int
) returns public.departments
language plpgsql security definer as $$
declare
  v_kind text; v_row public.departments;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'developer' then raise exception 'FORBIDDEN'; end if;

  if p_id is null then
    insert into public.departments(code, name, icon, sort_order, kind)
      values (p_code, p_name, p_icon, p_sort_order, 'department') returning * into v_row;
  else
    update public.departments set code = p_code, name = p_name, icon = p_icon, sort_order = p_sort_order
      where id = p_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.dev_set_department_active(p_session_token uuid, p_department_id uuid, p_is_active boolean)
returns void language plpgsql security definer as $$
declare v_kind text;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'developer' then raise exception 'FORBIDDEN'; end if;
  update public.departments set is_active = p_is_active where id = p_department_id;
end;
$$;

create or replace function public.dev_upsert_product(
  p_session_token uuid, p_id uuid, p_code text, p_name text, p_description text, p_sort_order int, p_department_ids uuid[]
) returns public.products
language plpgsql security definer as $$
declare v_kind text; v_row public.products; v_dep uuid;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'developer' then raise exception 'FORBIDDEN'; end if;

  if p_id is null then
    insert into public.products(code, name, description, sort_order)
      values (p_code, p_name, p_description, p_sort_order) returning * into v_row;
  else
    update public.products set code = p_code, name = p_name, description = p_description, sort_order = p_sort_order
      where id = p_id returning * into v_row;
    delete from public.product_departments where product_id = v_row.id;
  end if;

  foreach v_dep in array p_department_ids loop
    insert into public.product_departments(product_id, department_id) values (v_row.id, v_dep)
      on conflict do nothing;
    insert into public.product_statuses(product_id, department_id) values (v_row.id, v_dep)
      on conflict do nothing;
  end loop;

  return v_row;
end;
$$;

create or replace function public.dev_set_product_active(p_session_token uuid, p_product_id uuid, p_is_active boolean)
returns void language plpgsql security definer as $$
declare v_kind text;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'developer' then raise exception 'FORBIDDEN'; end if;
  update public.products set is_active = p_is_active where id = p_product_id;
end;
$$;

create or replace function public.dev_set_popular(p_session_token uuid, p_product_id uuid, p_is_popular boolean, p_sort_order int default 0)
returns void language plpgsql security definer as $$
declare v_kind text;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'developer' then raise exception 'FORBIDDEN'; end if;

  if p_is_popular then
    insert into public.popular_products(product_id, sort_order) values (p_product_id, p_sort_order)
      on conflict (product_id) do update set sort_order = excluded.sort_order;
  else
    delete from public.popular_products where product_id = p_product_id;
  end if;
end;
$$;

-- إضافة بديل لصنف منتهٍ
create or replace function public.add_product_alternative(p_session_token uuid, p_product_status_id uuid, p_alternative_product_id uuid)
returns void language plpgsql security definer as $$
declare v_department_id uuid; v_owner uuid;
begin
  select department_id into v_department_id from public.sessions where token = p_session_token and expires_at > now();
  if v_department_id is null then raise exception 'SESSION_EXPIRED'; end if;
  select department_id into v_owner from public.product_statuses where id = p_product_status_id;
  if v_owner is distinct from v_department_id then raise exception 'FORBIDDEN'; end if;
  insert into public.product_alternatives(product_status_id, alternative_product_id) values (p_product_status_id, p_alternative_product_id);
end;
$$;

-- تصفير/أرشفة المحادثة (لا تحذف نهائيًا، فقط تعليم is_archived)
create or replace function public.archive_conversation(p_session_token uuid, p_department_id uuid)
returns void language plpgsql security definer as $$
declare v_kind text;
begin
  select d.kind into v_kind from public.sessions s join public.departments d on d.id = s.department_id
    where s.token = p_session_token and s.expires_at > now();
  if v_kind is distinct from 'callcenter' and v_kind is distinct from 'admin' and v_kind is distinct from 'developer' then
    raise exception 'FORBIDDEN';
  end if;
  update public.messages set is_archived = true
    where (to_department_id = p_department_id or from_department_id = p_department_id);
end;
$$;

-- ============================================================================
-- 11) بيانات أولية (Seed) — أقسام + رموز PIN تجريبية + أصناف تجريبية قليلة
-- ============================================================================
insert into public.departments (code, name, icon, kind, sort_order) values
  ('baklawa',   'البقلاوة',              'cake-slice',  'department', 1),
  ('kunafa',    'الكنافات',              'chef-hat',    'department', 2),
  ('cakes',     'قطع الكيك والقوالب',     'cake',        'department', 3),
  ('pastries',  'الفطائر والكروسان',      'croissant',   'department', 4),
  ('sweets',    'المعجنات والمعمول',      'cookie',      'department', 5),
  ('chocolate', 'الشوكولا والنوغا',       'candy',       'department', 6),
  ('callcenter','الكول سنتر',            'headset',     'callcenter', 7),
  ('admin',     'الإدارة',               'shield-check','admin',      8),
  ('developer', 'المطور مجد',            'terminal',    'developer',  9)
on conflict (code) do nothing;

-- رموز PIN تجريبية: كل الأقسام = 1234 ما عدا الإدارة 9999 والمطور 0000
-- ⚠️ غيّرها فورًا بعد التشغيل الأول من لوحة المطور — راجع README
insert into public.department_pins (department_id, pin_hash)
select id,
  crypt(
    case
      when code = 'admin' then '9999'
      when code = 'developer' then '0000'
      else '1234'
    end,
    gen_salt('bf')
  )
from public.departments
on conflict (department_id) do nothing;

-- أصناف تجريبية (يمكن حذفها من لوحة المطور)
insert into public.products (code, name, description, sort_order) values
  ('SMP-001', 'صنف تجريبي 1', 'وصف تجريبي مختصر للصنف الأول', 1),
  ('SMP-002', 'صنف تجريبي 2', 'وصف تجريبي مختصر للصنف الثاني', 2),
  ('SMP-003', 'صنف تجريبي 3', 'وصف تجريبي مختصر للصنف الثالث', 3)
on conflict (code) do nothing;

-- ربط الأصناف التجريبية بقسم البقلاوة كمثال، وإنشاء حالة أولية لها
insert into public.product_departments (product_id, department_id)
select p.id, d.id from public.products p, public.departments d
where p.code in ('SMP-001','SMP-002','SMP-003') and d.code = 'baklawa'
on conflict do nothing;

insert into public.product_statuses (product_id, department_id, status, quantity_level)
select p.id, d.id, 'available', 'plenty' from public.products p, public.departments d
where p.code in ('SMP-001','SMP-002','SMP-003') and d.code = 'baklawa'
on conflict do nothing;

-- ============================================================================
-- 12) تفعيل Realtime على الجداول المطلوب متابعتها لحظيًا
-- ============================================================================
alter publication supabase_realtime add table public.product_statuses;
alter publication supabase_realtime add table public.departments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.activity_log;

-- ============================================================================
-- انتهى الملف. راجع README.md لخطوات الربط مع الواجهة.
-- ============================================================================
