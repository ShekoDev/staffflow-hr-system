-- =====================================================================
-- Migration 0007 — Reference data: roles, permissions, themes, frames,
--                  badges, name colours, evaluation template, settings
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
insert into public.roles (key, name_en, name_ar, is_system, rank, description) values
  ('admin',    'Administrator', 'مدير النظام', true, 10, 'Full control over the system'),
  ('hr',       'HR',            'الموارد البشرية', true, 20, 'Human resources, permission driven'),
  ('manager',  'Manager',       'مدير',        true, 30, 'Manages a department or team'),
  ('employee', 'Employee',      'موظف',        true, 40, 'Sees only their own data')
on conflict (key) do update
  set name_en = excluded.name_en, name_ar = excluded.name_ar;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, name_en, name_ar) values
  ('dashboard.view',            'dashboard',      'View dashboard',              'عرض لوحة التحكم'),

  ('employees.view_all',        'employees',      'View all employees',          'عرض كل الموظفين'),
  ('employees.view_team',       'employees',      'View own team',               'عرض الفريق التابع'),
  ('employees.create',          'employees',      'Create employees',            'إضافة موظفين'),
  ('employees.edit_all',        'employees',      'Edit any employee',           'تعديل أي موظف'),
  ('employees.edit_team',       'employees',      'Edit own team',               'تعديل الفريق التابع'),
  ('employees.delete',          'employees',      'Delete / deactivate',         'حذف أو تعطيل'),
  ('employees.export',          'employees',      'Export employee reports',     'تصدير تقارير الموظفين'),

  ('departments.manage',        'organization',   'Manage departments',          'إدارة الأقسام'),
  ('teams.manage',              'organization',   'Manage teams',                'إدارة الفرق'),

  ('users.view',                'users',          'View users',                  'عرض المستخدمين'),
  ('users.manage',              'users',          'Manage users',                'إدارة المستخدمين'),
  ('roles.manage',              'users',          'Manage roles',                'إدارة الأدوار'),
  ('permissions.manage',        'users',          'Manage permissions',          'إدارة الصلاحيات'),

  ('attendance.view_all',       'attendance',     'View all attendance',         'عرض كل الحضور'),
  ('attendance.view_team',      'attendance',     'View team attendance',        'عرض حضور الفريق'),
  ('attendance.manage',         'attendance',     'Manage all attendance',       'إدارة كل الحضور'),
  ('attendance.manage_team',    'attendance',     'Manage team attendance',      'إدارة حضور الفريق'),
  ('attendance.export',         'attendance',     'Export attendance',           'تصدير الحضور'),

  ('leaves.view_all',           'leaves',         'View all leaves',             'عرض كل الإجازات'),
  ('leaves.view_team',          'leaves',         'View team leaves',            'عرض إجازات الفريق'),
  ('leaves.manage',             'leaves',         'Manage leaves',               'إدارة الإجازات'),
  ('leaves.approve_team',       'leaves',         'Approve team leaves',         'اعتماد إجازات الفريق'),

  ('evaluations.view_all',      'evaluations',    'View all evaluations',        'عرض كل التقييمات'),
  ('evaluations.view_team',     'evaluations',    'View team evaluations',       'عرض تقييمات الفريق'),
  ('evaluations.evaluate_team', 'evaluations',    'Evaluate team members',       'تقييم أعضاء الفريق'),
  ('evaluations.self',          'evaluations',    'Submit self evaluation',      'التقييم الذاتي'),
  ('evaluations.manage',        'evaluations',    'Manage evaluations',          'إدارة التقييمات'),
  ('evaluations.configure',     'evaluations',    'Configure criteria & weights','إعداد البنود والأوزان'),
  ('evaluations.export',        'evaluations',    'Export evaluations',          'تصدير التقييمات'),

  ('ranking.view',              'ranking',        'View ranking',                'عرض التصنيف'),
  ('ranking.manage',            'ranking',        'Compute / publish ranking',   'احتساب ونشر التصنيف'),

  ('reports.employee',          'reports',        'Employee reports',            'تقارير الموظف'),
  ('reports.team',              'reports',        'Team reports',                'تقارير الفريق'),
  ('reports.department',        'reports',        'Department reports',          'تقارير القسم'),
  ('reports.company',           'reports',        'Company-wide reports',        'تقارير الشركة'),

  ('customization.manage',      'customization',  'Manage themes/frames/badges', 'إدارة الثيمات والإطارات'),
  ('settings.manage',           'settings',       'Manage system settings',      'إدارة إعدادات النظام'),
  ('notifications.send',        'settings',       'Send notifications',          'إرسال الإشعارات'),
  ('audit.view',                'audit',          'View audit logs',             'عرض سجل العمليات')
on conflict (key) do update
  set module = excluded.module, name_en = excluded.name_en, name_ar = excluded.name_ar;

-- ---------------------------------------------------------------------
-- Default role -> permission matrix
-- ---------------------------------------------------------------------
-- Admin: everything
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- HR: customizable starting point (admin can tune afterwards)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'dashboard.view','employees.view_all','employees.create','employees.edit_all','employees.export',
  'departments.manage','teams.manage','users.view',
  'attendance.view_all','attendance.manage','attendance.export',
  'leaves.view_all','leaves.manage',
  'evaluations.view_all','evaluations.export',
  'ranking.view','reports.employee','reports.team','reports.department','reports.company'
) where r.key = 'hr'
on conflict do nothing;

-- Manager: strictly team-scoped
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'dashboard.view','employees.view_team',
  'attendance.view_team','attendance.manage_team',
  'leaves.view_team','leaves.approve_team',
  'evaluations.view_team','evaluations.evaluate_team',
  'ranking.view','reports.team'
) where r.key = 'manager'
on conflict do nothing;

-- Employee: own data only
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'dashboard.view','evaluations.self','ranking.view'
) where r.key = 'employee'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Themes
-- ---------------------------------------------------------------------
insert into public.themes (key, name_en, name_ar, sort_order, tokens_light, tokens_dark) values
('modern-blue', 'Modern Blue', 'الأزرق العصري', 1,
 '{"primary":"#2563eb","primary-hover":"#1d4ed8","primary-fg":"#ffffff","accent":"#38bdf8","bg":"#f4f7fb","surface":"#ffffff","surface-2":"#f8fafc","border":"#e2e8f0","text":"#0f172a","text-muted":"#64748b","success":"#16a34a","warning":"#d97706","danger":"#dc2626","radius":"14px","shadow":"0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)","surface-blur":"none"}',
 '{"primary":"#3b82f6","primary-hover":"#60a5fa","primary-fg":"#04121f","accent":"#38bdf8","bg":"#0b1220","surface":"#111a2c","surface-2":"#0f1728","border":"#1e293b","text":"#e2e8f0","text-muted":"#94a3b8","success":"#22c55e","warning":"#f59e0b","danger":"#ef4444","radius":"14px","shadow":"0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.7)","surface-blur":"none"}'),

('professional', 'Professional', 'احترافي', 2,
 '{"primary":"#0f766e","primary-hover":"#115e59","primary-fg":"#ffffff","accent":"#0ea5e9","bg":"#f6f7f6","surface":"#ffffff","surface-2":"#f1f5f4","border":"#dfe5e3","text":"#111827","text-muted":"#6b7280","success":"#15803d","warning":"#b45309","danger":"#b91c1c","radius":"10px","shadow":"0 1px 2px rgba(17,24,39,.08)","surface-blur":"none"}',
 '{"primary":"#14b8a6","primary-hover":"#2dd4bf","primary-fg":"#04211e","accent":"#38bdf8","bg":"#0c1413","surface":"#131e1d","surface-2":"#101a19","border":"#1f2f2d","text":"#e5e7eb","text-muted":"#9ca3af","success":"#22c55e","warning":"#f59e0b","danger":"#ef4444","radius":"10px","shadow":"0 1px 2px rgba(0,0,0,.6)","surface-blur":"none"}'),

('glassmorphism', 'Glassmorphism', 'زجاجي', 3,
 '{"primary":"#7c3aed","primary-hover":"#6d28d9","primary-fg":"#ffffff","accent":"#ec4899","bg":"linear-gradient(135deg,#e0e7ff 0%,#fce7f3 50%,#ccfbf1 100%)","surface":"rgba(255,255,255,.62)","surface-2":"rgba(255,255,255,.42)","border":"rgba(255,255,255,.7)","text":"#1e1b4b","text-muted":"#5b5580","success":"#059669","warning":"#d97706","danger":"#e11d48","radius":"20px","shadow":"0 8px 32px rgba(31,38,135,.18)","surface-blur":"blur(14px)"}',
 '{"primary":"#a78bfa","primary-hover":"#c4b5fd","primary-fg":"#1a1030","accent":"#f472b6","bg":"linear-gradient(135deg,#0f0a24 0%,#1e1035 50%,#04212a 100%)","surface":"rgba(30,25,60,.55)","surface-2":"rgba(30,25,60,.35)","border":"rgba(255,255,255,.12)","text":"#ede9fe","text-muted":"#a5a0c4","success":"#34d399","warning":"#fbbf24","danger":"#fb7185","radius":"20px","shadow":"0 8px 32px rgba(0,0,0,.45)","surface-blur":"blur(14px)"}'),

('minimal', 'Minimal', 'بسيط', 4,
 '{"primary":"#111827","primary-hover":"#000000","primary-fg":"#ffffff","accent":"#6b7280","bg":"#ffffff","surface":"#ffffff","surface-2":"#fafafa","border":"#ebebeb","text":"#111111","text-muted":"#737373","success":"#16a34a","warning":"#ca8a04","danger":"#dc2626","radius":"8px","shadow":"none","surface-blur":"none"}',
 '{"primary":"#fafafa","primary-hover":"#ffffff","primary-fg":"#111111","accent":"#a3a3a3","bg":"#0a0a0a","surface":"#121212","surface-2":"#0f0f0f","border":"#232323","text":"#f5f5f5","text-muted":"#a3a3a3","success":"#22c55e","warning":"#eab308","danger":"#ef4444","radius":"8px","shadow":"none","surface-blur":"none"}'),

('corporate', 'Corporate', 'مؤسسي', 5,
 '{"primary":"#1e3a8a","primary-hover":"#1e40af","primary-fg":"#ffffff","accent":"#b45309","bg":"#eef1f6","surface":"#ffffff","surface-2":"#f5f7fa","border":"#d8dfe9","text":"#16223a","text-muted":"#5a6a85","success":"#166534","warning":"#92400e","danger":"#991b1b","radius":"6px","shadow":"0 1px 3px rgba(22,34,58,.12)","surface-blur":"none"}',
 '{"primary":"#3b5bdb","primary-hover":"#4c6ef5","primary-fg":"#ffffff","accent":"#f59e0b","bg":"#0a0f1c","surface":"#101728","surface-2":"#0d1424","border":"#1d2740","text":"#dbe4f0","text-muted":"#8fa0bd","success":"#22c55e","warning":"#f59e0b","danger":"#ef4444","radius":"6px","shadow":"0 1px 3px rgba(0,0,0,.6)","surface-blur":"none"}'),

('soft-elegant', 'Soft / Elegant', 'ناعم وأنيق', 6,
 '{"primary":"#9d174d","primary-hover":"#831843","primary-fg":"#ffffff","accent":"#c084fc","bg":"#fdf7f8","surface":"#ffffff","surface-2":"#fbf1f3","border":"#f0dde2","text":"#3b2733","text-muted":"#8a7480","success":"#0f766e","warning":"#b45309","danger":"#be123c","radius":"18px","shadow":"0 4px 20px -8px rgba(157,23,77,.18)","surface-blur":"none"}',
 '{"primary":"#f472b6","primary-hover":"#f9a8d4","primary-fg":"#2a1020","accent":"#c084fc","bg":"#170d13","surface":"#22141c","surface-2":"#1c1017","border":"#3a2430","text":"#f7e7ee","text-muted":"#c0a3b1","success":"#2dd4bf","warning":"#fbbf24","danger":"#fb7185","radius":"18px","shadow":"0 4px 20px -8px rgba(0,0,0,.6)","surface-blur":"none"}')
on conflict (key) do update
  set tokens_light = excluded.tokens_light,
      tokens_dark  = excluded.tokens_dark,
      name_en = excluded.name_en,
      name_ar = excluded.name_ar;

-- ---------------------------------------------------------------------
-- Profile frames
-- ---------------------------------------------------------------------
insert into public.profile_frames (key, name_en, name_ar, css_gradient, ring_width, glow_color, auto_role_key, auto_condition, priority) values
  ('default',   'Default',            'افتراضي',              'linear-gradient(135deg,#cbd5e1,#94a3b8)', 2, null,       null,      null,                 900),
  ('employee-of-month','Employee of the Month','موظف الشهر',  'linear-gradient(135deg,#fde047,#f59e0b,#fbbf24)', 4, '#f59e0b', null, 'employee_of_month', 10),
  ('gold',      'Gold',               'ذهبي',                 'linear-gradient(135deg,#fcd34d,#d97706)', 3, '#f59e0b',  null,      'top_performer',      20),
  ('silver',    'Silver',             'فضي',                  'linear-gradient(135deg,#e5e7eb,#9ca3af)', 3, null,       null,      null,                 30),
  ('admin',     'Admin',              'إطار الأدمن',          'linear-gradient(135deg,#a78bfa,#7c3aed)', 3, '#7c3aed',  'admin',   null,                 40),
  ('manager',   'Manager',            'إطار المدير',          'linear-gradient(135deg,#60a5fa,#2563eb)', 3, '#2563eb',  'manager', null,                 50),
  ('hr',        'HR',                 'إطار الموارد البشرية', 'linear-gradient(135deg,#6ee7b7,#059669)', 3, '#059669',  'hr',      null,                 60),
  ('blue',      'Blue',               'أزرق',                 'linear-gradient(135deg,#93c5fd,#3b82f6)', 3, null,       null,      null,                 70),
  ('premium',   'Premium',            'بريميوم',              'linear-gradient(135deg,#f0abfc,#818cf8,#38bdf8)', 4, '#818cf8', null, null,               80)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------
insert into public.badges (key, name_en, name_ar, icon, color, auto_role_key, auto_condition, priority) values
  ('employee_of_month', 'Employee of the Month', 'موظف الشهر',    '🏆', '#f59e0b', null,      'employee_of_month',   10),
  ('top_performer',     'Top Performer',         'الأفضل أداءً',  '⭐', '#eab308', null,      'top_performer',       20),
  ('perfect_attendance','Perfect Attendance',    'حضور كامل',     '📅', '#16a34a', null,      'perfect_attendance',  30),
  ('manager',           'Manager',               'مدير',          '👑', '#2563eb', 'manager', null,                  40),
  ('admin',             'Admin',                 'أدمن',          '🛡', '#7c3aed', 'admin',   null,                  50),
  ('hr',                'HR',                    'موارد بشرية',   '🧩', '#059669', 'hr',      null,                  60),
  ('new_employee',      'New Employee',          'موظف جديد',     '🌱', '#0ea5e9', null,      'new_employee',        70)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Name colour rules (lower priority number wins)
-- ---------------------------------------------------------------------
insert into public.name_color_rules (key, name_en, name_ar, color, condition_type, condition_value, priority) values
  ('eom_gold',      'Employee of the Month', 'موظف الشهر',   '#d97706', 'status', 'employee_of_month', 10),
  ('top_gold',      'Top Performer',         'الأفضل أداءً', '#ca8a04', 'status', 'top_performer',     20),
  ('admin_purple',  'Admin',                 'أدمن',         '#7c3aed', 'role',   'admin',             30),
  ('manager_blue',  'Manager',               'مدير',         '#2563eb', 'role',   'manager',           40),
  ('hr_green',      'HR',                    'موارد بشرية',  '#059669', 'role',   'hr',                50),
  ('employee_default','Employee',            'موظف',         '',        'role',   'employee',          900)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Leave types
-- ---------------------------------------------------------------------
insert into public.leave_types (key, name_en, name_ar, is_paid, max_days_year) values
  ('annual',    'Annual Leave',     'إجازة سنوية',   true,  21),
  ('sick',      'Sick Leave',       'إجازة مرضية',   true,  30),
  ('unpaid',    'Unpaid Leave',     'إجازة بدون أجر', false, null),
  ('emergency', 'Emergency Leave',  'إجازة طارئة',   true,  5)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Default evaluation template + criteria + stage weights
-- ---------------------------------------------------------------------
insert into public.evaluation_templates (name_en, name_ar, description, is_default, is_active)
select 'Standard Monthly Evaluation', 'التقييم الشهري القياسي',
       'Default template — criteria and weights are editable by the admin', true, true
where not exists (select 1 from public.evaluation_templates where is_default);

insert into public.evaluation_criteria (template_id, key, name_en, name_ar, max_score, weight, stage, sort_order)
select t.id, v.key, v.en, v.ar, 10, v.w, 'manager'::evaluation_stage_type, v.ord
from public.evaluation_templates t,
(values
  ('punctuality',    'Punctuality',              'الالتزام بالمواعيد',    20::numeric, 1),
  ('work_quality',   'Work Quality',             'جودة العمل',            25::numeric, 2),
  ('speed',          'Speed of Delivery',        'سرعة الإنجاز',          15::numeric, 3),
  ('teamwork',       'Teamwork',                 'التعاون',               15::numeric, 4),
  ('responsibility', 'Responsibility',           'تحمل المسؤولية',        15::numeric, 5),
  ('instructions',   'Following Instructions',   'الالتزام بالتعليمات',   10::numeric, 6)
) as v(key, en, ar, w, ord)
where t.is_default
  and not exists (select 1 from public.evaluation_criteria c where c.template_id = t.id and c.key = v.key);

insert into public.evaluation_stage_weights (template_id, stage, weight, is_enabled)
select t.id, v.stage::evaluation_stage_type, v.w, v.enabled
from public.evaluation_templates t,
(values
  ('manager',        60::numeric, true),
  ('administrative', 25::numeric, true),
  ('self',           10::numeric, true),
  ('peer',            5::numeric, false)
) as v(stage, w, enabled)
where t.is_default
on conflict (template_id, stage) do nothing;

-- ---------------------------------------------------------------------
-- System settings
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, category, is_public) values
  ('branding', '{"company_name_en":"StaffFlow","company_name_ar":"ستاف فلو","system_name_en":"Employee Management & HR System","system_name_ar":"نظام إدارة الموظفين والموارد البشرية","logo_url":null,"favicon_url":null}', 'branding', true),
  ('pdf_branding', '{"footer_text_ar":"جميع حقوق الملكية محفوظة لمحمود شهاب","footer_text_en":"All rights reserved to Mahmoud Shehab","show_logo":true,"accent_color":"#2563eb"}', 'branding', true),
  ('appearance', '{"default_theme":"modern-blue","default_color_mode":"system","allow_user_theme":true,"default_language":"en","allow_user_language":true}', 'appearance', true),
  ('attendance_rules', '{"work_start":"09:00","work_end":"17:00","late_grace_minutes":15,"work_days":[0,1,2,3,4]}', 'attendance', true),
  ('ranking_weights', '{"attendance":25,"punctuality":15,"evaluation":60}', 'ranking', true),
  ('splash', '{"enabled":true,"duration_ms":2200,"media_type":"placeholder","media_url":null}', 'branding', true)
on conflict (key) do nothing;
