/**
 * Domain models.
 *
 * These mirror the PostgreSQL schema in supabase/migrations. They are the
 * single source of truth for the rest of the app — services return these
 * shapes, components consume them, nothing re-declares a row inline.
 */

export type Gender = 'male' | 'female';
export type EmploymentStatus = 'active' | 'inactive';
export type ColorMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'leave'
  | 'holiday'
  | 'excused'
  | 'early_leave';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type EvaluationStage = 'manager' | 'administrative' | 'self' | 'peer';
export type EvaluationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type RoleKey = 'admin' | 'hr' | 'manager' | 'employee' | (string & {});

export interface Role {
  id: string;
  key: RoleKey;
  name_en: string;
  name_ar: string;
  description: string | null;
  is_system: boolean;
  rank: number;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  name_en: string;
  name_ar: string;
  description: string | null;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface UserPermission {
  user_id: string;
  permission_id: string;
  granted: boolean;
}

export interface AppUser {
  id: string;
  username: string | null;
  email: string;
  role_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  preferred_language: Language;
  preferred_theme: string | null;
  color_mode: ColorMode;
  last_login_at: string | null;
  created_at: string;
  role?: Role | null;
}

export interface Department {
  id: string;
  code: string | null;
  name_en: string;
  name_ar: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  manager?: Pick<Employee, 'id' | 'full_name_en' | 'full_name_ar' | 'photo_url'> | null;
  employee_count?: number;
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name_en: string;
  full_name_ar: string | null;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department_id: string | null;
  manager_id: string | null;
  gender: Gender | null;
  joining_date: string | null;
  employment_status: EmploymentStatus;
  frame_id: string | null;
  name_color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  department?: Pick<Department, 'id' | 'name_en' | 'name_ar'> | null;
  manager?: Pick<Employee, 'id' | 'full_name_en' | 'full_name_ar'> | null;
  user?: Pick<AppUser, 'id' | 'email' | 'username' | 'is_active' | 'role_id'> | null;
  badges?: EmployeeBadge[];
}

export interface Team {
  id: string;
  name_en: string;
  name_ar: string | null;
  department_id: string | null;
  manager_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  department?: Pick<Department, 'id' | 'name_en' | 'name_ar'> | null;
  manager?: Pick<Employee, 'id' | 'full_name_en' | 'full_name_ar' | 'photo_url'> | null;
  member_count?: number;
}

export interface TeamMember {
  team_id: string;
  employee_id: string;
  employee?: Employee;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  worked_minutes: number | null;
  is_excused: boolean;
  notes: string | null;
  created_at: string;
  employee?: Employee;
}

export interface LeaveType {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  is_paid: boolean;
  max_days_year: number | null;
  is_active: boolean;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  employee?: Employee;
  leave_type?: LeaveType | null;
}

export interface EvaluationTemplate {
  id: string;
  name_en: string;
  name_ar: string | null;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
}

export interface EvaluationCriterion {
  id: string;
  template_id: string | null;
  key: string | null;
  name_en: string;
  name_ar: string;
  description: string | null;
  max_score: number;
  weight: number;
  stage: EvaluationStage;
  sort_order: number;
  is_active: boolean;
}

export interface EvaluationStageWeight {
  id: string;
  template_id: string;
  stage: EvaluationStage;
  weight: number;
  is_enabled: boolean;
}

export interface Evaluation {
  id: string;
  employee_id: string;
  evaluator_id: string | null;
  template_id: string | null;
  stage: EvaluationStage;
  period_year: number;
  period_month: number;
  total_score: number | null;
  percentage: number | null;
  status: EvaluationStatus;
  comments: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  employee?: Employee;
}

export interface MonthlyRanking {
  id: string;
  employee_id: string;
  period_year: number;
  period_month: number;
  attendance_score: number;
  punctuality_score: number;
  evaluation_score: number;
  final_score: number;
  rank: number | null;
  is_employee_of_month: boolean;
  full_name_en?: string;
  full_name_ar?: string | null;
  photo_url?: string | null;
  frame_id?: string | null;
  name_color?: string | null;
  department_name_en?: string | null;
  department_name_ar?: string | null;
}

export interface ProfileFrame {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  css_gradient: string | null;
  ring_width: number;
  glow_color: string | null;
  icon: string | null;
  auto_role_key: string | null;
  auto_condition: string | null;
  priority: number;
  is_active: boolean;
}

export interface Badge {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  auto_role_key: string | null;
  auto_condition: string | null;
  priority: number;
  is_active: boolean;
}

export interface EmployeeBadge {
  id: string;
  employee_id: string;
  badge_id: string;
  awarded_at: string;
  expires_at: string | null;
  note: string | null;
  badge?: Badge;
}

export interface NameColorRule {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  color: string;
  condition_type: 'role' | 'status';
  condition_value: string;
  priority: number;
  is_active: boolean;
}

export type ThemeTokens = Record<string, string>;

export interface Theme {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  tokens_light: ThemeTokens;
  tokens_dark: ThemeTokens;
  is_active: boolean;
  sort_order: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title_en: string;
  title_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_label: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* System settings                                                     */
/* ------------------------------------------------------------------ */

export interface BrandingSettings {
  company_name_en: string;
  company_name_ar: string;
  system_name_en: string;
  system_name_ar: string;
  logo_url: string | null;
  favicon_url: string | null;
}

export interface PdfBrandingSettings {
  footer_text_ar: string;
  footer_text_en: string;
  show_logo: boolean;
  accent_color: string;
}

export interface AppearanceSettings {
  default_theme: string;
  default_color_mode: ColorMode;
  allow_user_theme: boolean;
  default_language: Language;
  allow_user_language: boolean;
}

export interface AttendanceRules {
  work_start: string;
  work_end: string;
  late_grace_minutes: number;
  work_days: number[];
}

export interface RankingWeights {
  attendance: number;
  punctuality: number;
  evaluation: number;
}

export interface SplashSettings {
  enabled: boolean;
  duration_ms: number;
  media_type: 'placeholder' | 'image' | 'video' | 'lottie';
  media_url: string | null;
}

export interface SystemSettingsMap {
  branding: BrandingSettings;
  pdf_branding: PdfBrandingSettings;
  appearance: AppearanceSettings;
  attendance_rules: AttendanceRules;
  ranking_weights: RankingWeights;
  splash: SplashSettings;
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export interface SessionProfile {
  user: AppUser;
  employee: Employee | null;
  roleKey: RoleKey;
  permissions: Set<string>;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
}
