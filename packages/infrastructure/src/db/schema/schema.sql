create table user_profiles (
  id uuid primary key,
  full_name text not null,
  email text not null,
  headline text,
  location text,
  summary text,
  skills jsonb not null default '[]',
  experience jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table job_applications (
  id uuid primary key,
  profile_id uuid not null references user_profiles(id),
  source_url text not null,
  status text not null,
  failure_reason text,
  scrape_bundle jsonb,
  match_analysis jsonb,
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
  created_at timestamptz not null default now()
);
