create table user_profiles (
  id uuid primary key,
  full_name text not null,
  email text not null,
  headline text,
  location text,
  summary text,
  skills jsonb not null default '[]',
  experience jsonb not null default '[]',
  education jsonb not null default '[]',
  certifications jsonb not null default '[]',
  projects jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_applications (
  id uuid primary key,
  profile_id uuid not null references user_profiles(id),
  source_url text,
  status text not null,
  failure_reason text,
  company_name text,
  role_title text,
  role_type text,
  job_url text,
  date_applied date,
  application_status text not null default 'applied',
  priority text not null default 'medium',
  tags jsonb not null default '[]',
  next_follow_up_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb not null default '{}',
  scrape_bundle jsonb,
  match_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_application_events (
  id uuid primary key,
  job_application_id uuid not null references job_applications(id),
  type text not null,
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table job_application_contacts (
  id uuid primary key,
  job_application_id uuid not null references job_applications(id),
  name text not null,
  role text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_application_interviews (
  id uuid primary key,
  job_application_id uuid not null references job_applications(id),
  title text not null,
  type text,
  scheduled_at timestamptz not null,
  status text not null default 'upcoming',
  notes text,
  prep_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table generated_documents (
  id uuid primary key,
  job_application_id uuid not null references job_applications(id),
  kind text not null,
  file_id text not null,
  file_name text not null,
  content_type text not null,
  created_at timestamptz not null default now(),
  unique (job_application_id, kind)
);
