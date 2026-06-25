export type UserRole = 'admin' | 'supervisor' | 'worker'
export type Language = 'ca' | 'es'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  language: Language
  telegram_chat_id: string | null
  active: boolean
  avatar_url: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface RolePermission {
  id: string
  role: UserRole
  permission: string
  enabled: boolean
}

export type AbsenceType = 'vacation' | 'sick_leave' | 'permission' | 'other'
export type AbsenceStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface AbsenceRequest {
  id: string
  user_id: string
  type: AbsenceType
  start_date: string
  end_date: string
  working_days: number
  status: AbsenceStatus
  notes: string | null
  admin_note: string | null
  deducts_vacation: boolean | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface VacationBalance {
  id: string
  user_id: string
  year: number
  total_days: number
  used_days: number
  pending_days: number
  remaining_days: number
  carry_over_days: number
  carry_over_expires_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Holiday {
  id: string
  date: string
  name: string
  calendar_type: string
  year: number
}

export interface CompanyClosure {
  id: string
  date: string
  name: string
  year: number
  deducts_vacation: boolean
}

export interface CriticalPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  year: number
  description: string | null
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'rescheduled'
export type AppointmentChannel = 'in_person' | 'phone' | 'video' | 'email' | 'other'
export type AppointmentTopic =
  | 'fiscal'
  | 'labor'
  | 'accounting'
  | 'income_tax'
  | 'freelance'
  | 'companies'
  | 'internal_meeting'
  | 'client_query'
  | 'documentation'
  | 'other'
export type AppointmentPriority = 'normal' | 'high' | 'urgent' | 'other'

export interface Appointment {
  id: string
  created_by: string
  client_id: string | null
  main_attendee_id: string
  start_time: string
  end_time: string
  topic: AppointmentTopic
  channel: AppointmentChannel
  priority: AppointmentPriority
  status: AppointmentStatus
  location: string | null
  meet_link: string | null
  internal_notes: string | null
  send_email_to_client: boolean
  google_event_id: string | null
  expedient_ref: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentAttendee {
  id: string
  appointment_id: string
  user_id: string | null
  external_email: string | null
  external_name: string | null
  is_main: boolean
  status: 'pending' | 'accepted' | 'rejected' | 'proposed_new_time'
  token: string | null
  token_expires_at: string | null
  proposed_time: string | null
}

export interface Client {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  nif_cif: string | null
  notes: string | null
  responsible_id: string | null
  origin: 'appointment' | 'manual' | 'other'
  created_at: string
  updated_at: string
}

export interface FileMetadata {
  id: string
  name: string
  original_name: string
  mime_type: string
  size_bytes: number
  drive_url: string
  drive_file_id: string
  client_id: string | null
  appointment_id: string | null
  uploaded_by: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  link: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface Settings {
  id: string
  key: string
  value: string
  description: string | null
  updated_by: string | null
  updated_at: string
}
