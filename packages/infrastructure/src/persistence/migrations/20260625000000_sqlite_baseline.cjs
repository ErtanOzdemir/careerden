const statements = [
  `CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    profession TEXT,
    headline TEXT,
    location TEXT,
    links TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    skills TEXT NOT NULL DEFAULT '[]',
    experience TEXT NOT NULL DEFAULT '[]',
    education TEXT NOT NULL DEFAULT '[]',
    certifications TEXT NOT NULL DEFAULT '[]',
    projects TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id),
    source_url TEXT,
    status TEXT NOT NULL,
    failure_reason TEXT,
    scrape_bundle TEXT,
    match_analysis TEXT,
    document_content TEXT,
    company_logo_file_id TEXT,
    company_name TEXT,
    role_title TEXT,
    role_type TEXT,
    job_url TEXT,
    date_applied TEXT,
    application_status TEXT NOT NULL DEFAULT 'applied',
    priority TEXT NOT NULL DEFAULT 'medium',
    tags TEXT NOT NULL DEFAULT '[]',
    next_follow_up_at TEXT,
    last_response_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_applications_profile_status ON job_applications(profile_id, application_status)`,
  `CREATE INDEX IF NOT EXISTS idx_job_applications_profile_date ON job_applications(profile_id, date_applied)`,
  `CREATE INDEX IF NOT EXISTS idx_job_applications_profile_priority ON job_applications(profile_id, priority)`,
  `CREATE INDEX IF NOT EXISTS idx_job_applications_profile_updated ON job_applications(profile_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS job_application_events (
    id TEXT PRIMARY KEY,
    job_application_id TEXT NOT NULL REFERENCES job_applications(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_application_events_job_time ON job_application_events(job_application_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS job_application_contacts (
    id TEXT PRIMARY KEY,
    job_application_id TEXT NOT NULL REFERENCES job_applications(id),
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_application_contacts_job ON job_application_contacts(job_application_id)`,
  `CREATE TABLE IF NOT EXISTS job_application_interviews (
    id TEXT PRIMARY KEY,
    job_application_id TEXT NOT NULL REFERENCES job_applications(id),
    title TEXT NOT NULL,
    type TEXT,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming',
    notes TEXT,
    prep_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_application_interviews_job_time ON job_application_interviews(job_application_id, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_job_application_interviews_job_status ON job_application_interviews(job_application_id, status)`,
  `CREATE TABLE IF NOT EXISTS generated_documents (
    id TEXT PRIMARY KEY,
    job_application_id TEXT NOT NULL REFERENCES job_applications(id),
    kind TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'pdf',
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_documents_job_kind_format ON generated_documents(job_application_id, kind, format)`,
  `CREATE TABLE IF NOT EXISTS document_templates (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES user_profiles(id),
    kind TEXT NOT NULL,
    format TEXT NOT NULL,
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    placeholders TEXT NOT NULL DEFAULT '[]',
    field_mappings TEXT NOT NULL DEFAULT '{}',
    variable_aliases TEXT NOT NULL DEFAULT '{"fields":{}}',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_document_templates_profile_kind ON document_templates(profile_id, kind)`,
];

exports.up = async function up(knex) {
  for (const statement of statements) {
    await knex.raw(statement);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("document_templates");
  await knex.schema.dropTableIfExists("generated_documents");
  await knex.schema.dropTableIfExists("job_application_interviews");
  await knex.schema.dropTableIfExists("job_application_contacts");
  await knex.schema.dropTableIfExists("job_application_events");
  await knex.schema.dropTableIfExists("job_applications");
  await knex.schema.dropTableIfExists("user_profiles");
};
