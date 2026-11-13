--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: auth_otp_rate_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_otp_rate_limit (
    key text NOT NULL,
    count integer NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    last_attempt_at timestamp with time zone NOT NULL
);


--
-- Name: billing_provider_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_provider_events (
    provider text NOT NULL,
    provider_event_id text NOT NULL,
    event_type text NOT NULL,
    user_id text,
    payload jsonb NOT NULL,
    processing_status text NOT NULL,
    error text,
    received_at timestamp with time zone NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT billing_provider_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: billing_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_subscriptions (
    id text NOT NULL,
    user_id text NOT NULL,
    provider text NOT NULL,
    provider_customer_id text NOT NULL,
    provider_subscription_id text NOT NULL,
    plan_key text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT billing_subscriptions_period_check CHECK ((current_period_end > current_period_start)),
    CONSTRAINT billing_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text])))
);


--
-- Name: credit_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_accounts (
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: credit_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_grants (
    id text NOT NULL,
    user_id text NOT NULL,
    source_type text NOT NULL,
    idempotency_key text NOT NULL,
    amount integer NOT NULL,
    consumed_amount integer DEFAULT 0 NOT NULL,
    reserved_amount integer DEFAULT 0 NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT credit_grants_amount_positive CHECK ((amount > 0)),
    CONSTRAINT credit_grants_consumed_nonnegative CHECK ((consumed_amount >= 0)),
    CONSTRAINT credit_grants_counters_within_amount CHECK (((consumed_amount + reserved_amount) <= amount)),
    CONSTRAINT credit_grants_reserved_nonnegative CHECK ((reserved_amount >= 0)),
    CONSTRAINT credit_grants_source_type_check CHECK ((source_type = ANY (ARRAY['free_monthly'::text, 'subscription_cycle'::text]))),
    CONSTRAINT credit_grants_valid_expiry CHECK (((expires_at IS NULL) OR (expires_at > valid_from)))
);


--
-- Name: credit_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_ledger_entries (
    id text NOT NULL,
    user_id text NOT NULL,
    grant_id text NOT NULL,
    entry_type text NOT NULL,
    delta integer NOT NULL,
    idempotency_key text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reservation_id text,
    CONSTRAINT credit_ledger_delta_nonzero CHECK ((delta <> 0)),
    CONSTRAINT credit_ledger_entry_type_check CHECK ((entry_type = ANY (ARRAY['grant'::text, 'usage'::text])))
);


--
-- Name: credit_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_reservations (
    id text NOT NULL,
    user_id text NOT NULL,
    grant_id text NOT NULL,
    operation_type text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    amount integer NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    release_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    settled_at timestamp with time zone,
    CONSTRAINT credit_reservations_amount_positive CHECK ((amount > 0)),
    CONSTRAINT credit_reservations_operation_type_check CHECK ((operation_type = 'match_analysis'::text)),
    CONSTRAINT credit_reservations_release_reason_check CHECK (((release_reason IS NULL) OR (release_reason = ANY (ARRAY['failure'::text, 'timeout'::text, 'deletion'::text, 'superseded'::text])))),
    CONSTRAINT credit_reservations_resource_type_check CHECK ((resource_type = 'job_application'::text)),
    CONSTRAINT credit_reservations_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'consumed'::text, 'released'::text])))
);


--
-- Name: generated_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_documents (
    id text NOT NULL,
    job_application_id text NOT NULL,
    kind text NOT NULL,
    format text DEFAULT 'pdf'::text NOT NULL,
    file_id text NOT NULL,
    file_name text NOT NULL,
    content_type text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: job_application_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_contacts (
    id text NOT NULL,
    job_application_id text NOT NULL,
    name text NOT NULL,
    role text,
    email text,
    phone text,
    linkedin_url text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: job_application_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_events (
    id text NOT NULL,
    job_application_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: job_application_follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_follow_ups (
    id text NOT NULL,
    job_application_id text NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    reminder_job_id text,
    reminder_scheduled_for timestamp with time zone,
    reminder_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id text NOT NULL,
    profile_id text NOT NULL,
    source_url text,
    status text NOT NULL,
    failure_reason text,
    scrape_bundle jsonb,
    match_analysis jsonb,
    document_content jsonb,
    company_logo_file_id text,
    company_name text,
    role_title text,
    role_type text,
    job_url text,
    date_applied text,
    application_status text DEFAULT 'saved'::text,
    priority text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_response_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scrape_claimed_by text,
    scrape_claim_expires_at timestamp with time zone,
    scrape_attempt_count integer DEFAULT 0 NOT NULL,
    next_scrape_attempt_at timestamp with time zone,
    analysis_attempt_id text,
    document_generation_attempt_id text,
    salary_min_amount numeric(14,2),
    salary_max_amount numeric(14,2),
    salary_currency text,
    salary_period text,
    salary_type text,
    work_style text,
    application_pack_preferences jsonb DEFAULT '{"tone": "professional", "language": "auto"}'::jsonb NOT NULL,
    archived_at timestamp with time zone,
    ai_failure jsonb
);


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    profile_id text NOT NULL,
    job_application_id text,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id text NOT NULL,
    type text NOT NULL,
    aggregate_id text,
    payload jsonb NOT NULL,
    available_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    processed_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dead_lettered_at timestamp with time zone,
    last_error_at timestamp with time zone
);


--
-- Name: rateLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."rateLimit" (
    id text NOT NULL,
    key text NOT NULL,
    count integer NOT NULL,
    "lastRequest" bigint NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id text NOT NULL,
    user_id text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    profession text,
    headline text,
    location text,
    links jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary text,
    experience jsonb DEFAULT '[]'::jsonb NOT NULL,
    education jsonb DEFAULT '[]'::jsonb NOT NULL,
    certifications jsonb DEFAULT '[]'::jsonb NOT NULL,
    projects jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    auto_run_match_analysis boolean DEFAULT true NOT NULL,
    follow_up_reminders_enabled boolean DEFAULT true NOT NULL,
    summary_rich_text jsonb,
    auto_generate_documents boolean DEFAULT true NOT NULL,
    default_cv_template_id text,
    default_cover_letter_template_id text,
    onboarding_completed_at timestamp with time zone,
    onboarding_checklist_dismissed_at timestamp with time zone,
    skill_groups jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: auth_otp_rate_limit; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_provider_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: billing_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_accounts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_grants; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_ledger_entries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_reservations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: generated_documents; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.generated_documents VALUES ('d1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'cv', 'pdf', 'job-applications/b0000000-0000-4000-8000-000000000004/document-generations/d0000000-0000-4000-8000-000000000004/cv.pdf', 'Ada Yilmaz - CV.pdf', 'application/pdf', '2026-10-12 09:40:00+00');
INSERT INTO public.generated_documents VALUES ('d1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', 'cover_letter', 'pdf', 'job-applications/b0000000-0000-4000-8000-000000000004/document-generations/d0000000-0000-4000-8000-000000000004/cover-letter.pdf', 'Ada Yilmaz - Cover Letter.pdf', 'application/pdf', '2026-10-12 09:40:00+00');
INSERT INTO public.generated_documents VALUES ('d1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000006', 'cv', 'pdf', 'job-applications/b0000000-0000-4000-8000-000000000006/document-generations/d0000000-0000-4000-8000-000000000006/cv.pdf', 'Ada Yilmaz - CV.pdf', 'application/pdf', '2026-10-03 09:00:00+00');
INSERT INTO public.generated_documents VALUES ('d1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006', 'cover_letter', 'pdf', 'job-applications/b0000000-0000-4000-8000-000000000006/document-generations/d0000000-0000-4000-8000-000000000006/cover-letter.pdf', 'Ada Yilmaz - Cover Letter.pdf', 'application/pdf', '2026-10-03 09:00:00+00');


--
-- Data for Name: job_application_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.job_application_contacts VALUES ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Jordan Recruiter', 'Technical Recruiter', 'jordan@umbrella.example.com', NULL, 'https://www.linkedin.com/in/jordan-recruiter', 'Prefers email.', '2026-10-21 15:00:00+00', '2026-10-21 15:00:00+00');


--
-- Data for Name: job_application_events; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'created', 'Job application created', NULL, '2026-10-26 09:00:00+00', '{}', '2026-10-26 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'created', 'Job application created', NULL, '2026-10-24 09:00:00+00', '{}', '2026-10-24 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'processing', 'Job scraped', NULL, '2026-10-24 09:02:00+00', '{}', '2026-10-24 09:02:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'created', 'Job application created', NULL, '2026-10-22 09:00:00+00', '{}', '2026-10-22 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'processing', 'AI analysis completed', NULL, '2026-10-22 09:20:00+00', '{}', '2026-10-22 09:20:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'created', 'Job application created', NULL, '2026-10-12 09:00:00+00', '{}', '2026-10-12 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000004', 'processing', 'Application pack generated', NULL, '2026-10-12 09:40:00+00', '{"generationAttemptId": "d0000000-0000-4000-8000-000000000004"}', '2026-10-12 09:40:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000004', 'status_changed', 'Marked as applied', NULL, '2026-10-15 09:00:00+00', '{"to": "applied", "from": "saved"}', '2026-10-15 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'status_changed', 'Moved to interview', NULL, '2026-10-21 14:30:00+00', '{"to": "interview", "from": "applied"}', '2026-10-21 14:30:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000004', 'note', 'Recruiter call', 'Talked to the recruiter; technical interview next week.', '2026-10-21 15:00:00+00', '{}', '2026-10-21 15:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000005', 'created', 'Job application created', NULL, '2026-10-18 09:00:00+00', '{}', '2026-10-18 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000005', 'processing', 'Scraping failed', NULL, '2026-10-18 09:30:00+00', '{"reason": "The job posting could not be fetched from LinkedIn."}', '2026-10-18 09:30:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000006', 'created', 'Job application created', NULL, '2026-10-02 09:00:00+00', '{}', '2026-10-02 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000006', 'status_changed', 'Marked as rejected', NULL, '2026-10-10 09:00:00+00', '{"to": "rejected", "from": "applied"}', '2026-10-10 09:00:00+00');
INSERT INTO public.job_application_events VALUES ('c0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000007', 'created', 'Job application created', NULL, '2026-10-20 09:00:00+00', '{}', '2026-10-20 09:00:00+00');


--
-- Data for Name: job_application_follow_ups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.job_application_follow_ups VALUES ('f1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Send a thank-you note', NULL, '2026-10-22 10:00:00+00', 'follow-up-reminder:f1000000-0000-4000-8000-000000000001', '2026-10-22 09:50:00+00', '2026-10-22 09:50:01+00', '2026-10-21 15:05:00+00', '2026-10-22 09:50:01+00');
INSERT INTO public.job_application_follow_ups VALUES ('f1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Check in with the hiring manager', 'Ask whether the role is still open.', '2036-10-27 10:00:00+00', 'follow-up-reminder:f1000000-0000-4000-8000-000000000002', '2036-10-27 09:50:00+00', NULL, '2026-10-20 10:05:00+00', '2026-10-20 10:05:00+00');


--
-- Data for Name: job_applications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000001', 'queued', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.linkedin.com/jobs/view/4100000001', NULL, 'saved', NULL, '[]', NULL, '{}', '2026-10-26 09:00:00+00', '2026-10-26 09:01:00+00', NULL, NULL, 1, '2026-10-26 09:05:00+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"tone": "professional", "language": "auto"}', NULL, NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000002', 'scraped', NULL, '{"job": {"raw": {"url": "https://www.linkedin.com/jobs/view/4100000002", "source": "linkedin-guest", "fetchedAt": "2026-10-20T09:00:00.000Z"}, "title": "Platform Engineer", "location": "Berlin, Germany (Hybrid)", "companyName": "Globex", "description": "Globex is hiring a Platform Engineer to build reliable backend services.", "requirements": ["5+ years of backend engineering", "PostgreSQL", "Kafka Streams"], "descriptionHtml": "<p>Globex is hiring a Platform Engineer to build reliable backend services.</p>", "companyLinkedInUrl": "https://www.linkedin.com/company/globex"}, "companyLinkedIn": {"raw": {"source": "linkedin-guest"}, "name": "Globex", "description": "Globex builds software for growing businesses."}}', NULL, NULL, NULL, 'Globex', 'Platform Engineer', NULL, 'https://www.linkedin.com/jobs/view/4100000002', NULL, 'saved', NULL, '["platform"]', NULL, '{}', '2026-10-24 09:00:00+00', '2026-10-24 09:02:00+00', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'hybrid', '{"tone": "professional", "language": "auto"}', NULL, NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000003', 'review_ready', NULL, '{"job": {"raw": {"url": "https://www.linkedin.com/jobs/view/4100000003", "source": "linkedin-guest", "fetchedAt": "2026-10-20T09:00:00.000Z"}, "title": "Senior Backend Engineer", "location": "Remote (EU)", "companyName": "Initech", "description": "Initech is hiring a Senior Backend Engineer to build reliable backend services.", "requirements": ["5+ years of backend engineering", "PostgreSQL", "Kafka Streams"], "descriptionHtml": "<p>Initech is hiring a Senior Backend Engineer to build reliable backend services.</p>", "companyLinkedInUrl": "https://www.linkedin.com/company/initech"}, "companyLinkedIn": {"raw": {"source": "linkedin-guest"}, "name": "Initech", "description": "Initech builds software for growing businesses."}}', '{"matchScore": 78, "summaryTips": [{"text": "Lead with the payment ledger migration.", "evidence": "payment ledger"}], "gapQuestions": [{"field": {"type": "experience", "index": 0}, "question": "Have you operated Kafka Streams in production?", "requirement": "Kafka Streams"}], "strongSkills": ["TypeScript", "PostgreSQL"], "interviewTips": ["Prepare a story about running an incident review."], "missingSkills": ["Kafka Streams"], "coverLetterContent": "I would like to bring my payments experience to your platform team.", "requirementEvaluations": [{"status": "matched", "evidence": ["Northwind Payments"], "priority": "must", "requirement": "5+ years of backend engineering"}, {"status": "matched", "evidence": ["Northwind Payments"], "priority": "nice", "requirement": "PostgreSQL"}, {"status": "missing", "evidence": [], "priority": "nice", "requirement": "Kafka Streams"}]}', '{"appliedTips": ["summary:0"], "formatVersion": 2, "skillSuggestions": ["TypeScript", "Node.js", "PostgreSQL", "Redis", "AWS", "Docker"], "customizedSummary": {"blocks": [{"type": "paragraph", "children": [{"text": "Backend engineer with eight years of TypeScript and Node.js.", "type": "text"}]}], "version": 1}, "coverLetterContent": {"blocks": [{"type": "paragraph", "children": [{"text": "I would like to join Initech''s backend team.", "type": "text"}]}], "version": 1}, "projectEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "A Redis-backed sliding-window rate limiter for Node.js services. Used in production by several teams.", "type": "text"}]}], "version": 1}, "projectIndex": 0}], "educationEnhancements": [{"educationIndex": 0}], "experienceEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Led the move of the payment ledger to event-driven services on PostgreSQL and Kafka.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Designed idempotent payment APIs handling 3M requests per day.", "type": "text"}]}], "version": 1}, "experienceIndex": 0}, {"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Built the shipment tracking API in Node.js and TypeScript.", "type": "text"}]}], "version": 1}, "experienceIndex": 1}], "certificationSuggestions": ["AWS Certified Solutions Architect – Associate"]}', NULL, 'Initech', 'Senior Backend Engineer', 'Full-time', 'https://www.linkedin.com/jobs/view/4100000003', NULL, 'saved', 'high', '["remote", "typescript"]', NULL, '{}', '2026-10-22 09:00:00+00', '2026-10-22 09:20:00+00', NULL, NULL, 0, NULL, 'e0000000-0000-4000-8000-000000000003', NULL, 85000.00, 105000.00, 'EUR', 'yearly', 'gross', 'remote', '{"tone": "professional", "language": "auto"}', NULL, NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000004', 'completed', NULL, '{"job": {"raw": {"url": "https://www.linkedin.com/jobs/view/4100000004", "source": "linkedin-guest", "fetchedAt": "2026-10-20T09:00:00.000Z"}, "title": "Staff Engineer", "location": "Amsterdam, Netherlands", "companyName": "Umbrella Health", "description": "Umbrella Health is hiring a Staff Engineer to build reliable backend services.", "requirements": ["5+ years of backend engineering", "PostgreSQL", "Kafka Streams"], "descriptionHtml": "<p>Umbrella Health is hiring a Staff Engineer to build reliable backend services.</p>", "companyLinkedInUrl": "https://www.linkedin.com/company/umbrella-health"}, "companyLinkedIn": {"raw": {"source": "linkedin-guest"}, "name": "Umbrella Health", "description": "Umbrella Health builds software for growing businesses."}}', '{"matchScore": 91, "summaryTips": [{"text": "Lead with the payment ledger migration.", "evidence": "payment ledger"}], "gapQuestions": [{"field": {"type": "experience", "index": 0}, "question": "Have you operated Kafka Streams in production?", "requirement": "Kafka Streams"}], "strongSkills": ["TypeScript", "PostgreSQL"], "interviewTips": ["Prepare a story about running an incident review."], "missingSkills": ["Kafka Streams"], "coverLetterContent": "I would like to bring my payments experience to your platform team.", "requirementEvaluations": [{"status": "matched", "evidence": ["Northwind Payments"], "priority": "must", "requirement": "5+ years of backend engineering"}, {"status": "matched", "evidence": ["Northwind Payments"], "priority": "nice", "requirement": "PostgreSQL"}, {"status": "missing", "evidence": [], "priority": "nice", "requirement": "Kafka Streams"}]}', '{"appliedTips": ["summary:0"], "formatVersion": 2, "skillSuggestions": ["TypeScript", "Node.js", "PostgreSQL", "Redis", "AWS", "Docker"], "customizedSummary": {"blocks": [{"type": "paragraph", "children": [{"text": "Backend engineer with eight years of TypeScript and Node.js.", "type": "text"}]}], "version": 1}, "coverLetterContent": {"blocks": [{"type": "paragraph", "children": [{"text": "Umbrella Health''s mission matches my experience.", "type": "text"}]}], "version": 1}, "projectEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "A Redis-backed sliding-window rate limiter for Node.js services. Used in production by several teams.", "type": "text"}]}], "version": 1}, "projectIndex": 0}], "educationEnhancements": [{"educationIndex": 0}], "experienceEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Led the move of the payment ledger to event-driven services on PostgreSQL and Kafka.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Designed idempotent payment APIs handling 3M requests per day.", "type": "text"}]}], "version": 1}, "experienceIndex": 0}, {"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Built the shipment tracking API in Node.js and TypeScript.", "type": "text"}]}], "version": 1}, "experienceIndex": 1}], "certificationSuggestions": ["AWS Certified Solutions Architect – Associate"]}', NULL, 'Umbrella Health', 'Staff Engineer', NULL, 'https://www.linkedin.com/jobs/view/4100000004', '2026-10-15', 'interview', 'high', '["health"]', '2026-10-21 14:30:00+00', '{}', '2026-10-12 09:00:00+00', '2026-10-21 14:30:00+00', NULL, NULL, 0, NULL, 'e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', NULL, NULL, NULL, NULL, NULL, 'on_site', '{"tone": "concise", "language": "en", "cvTemplateId": "cv.modern"}', NULL, NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000005', 'failed', 'The job posting could not be fetched from LinkedIn.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://www.linkedin.com/jobs/view/4100000005', NULL, 'saved', NULL, '[]', NULL, '{}', '2026-10-18 09:00:00+00', '2026-10-18 09:30:00+00', NULL, NULL, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"tone": "professional", "language": "auto"}', NULL, NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'https://www.linkedin.com/jobs/view/4100000006', 'completed', NULL, '{"job": {"raw": {"url": "https://www.linkedin.com/jobs/view/4100000006", "source": "linkedin-guest", "fetchedAt": "2026-10-20T09:00:00.000Z"}, "title": "Backend Engineer", "location": "London, United Kingdom", "companyName": "Hooli", "description": "Hooli is hiring a Backend Engineer to build reliable backend services.", "requirements": ["5+ years of backend engineering", "PostgreSQL", "Kafka Streams"], "descriptionHtml": "<p>Hooli is hiring a Backend Engineer to build reliable backend services.</p>", "companyLinkedInUrl": "https://www.linkedin.com/company/hooli"}, "companyLinkedIn": {"raw": {"source": "linkedin-guest"}, "name": "Hooli", "description": "Hooli builds software for growing businesses."}}', '{"matchScore": 64, "summaryTips": [{"text": "Lead with the payment ledger migration.", "evidence": "payment ledger"}], "gapQuestions": [{"field": {"type": "experience", "index": 0}, "question": "Have you operated Kafka Streams in production?", "requirement": "Kafka Streams"}], "strongSkills": ["TypeScript", "PostgreSQL"], "interviewTips": ["Prepare a story about running an incident review."], "missingSkills": ["Kafka Streams"], "coverLetterContent": "I would like to bring my payments experience to your platform team.", "requirementEvaluations": [{"status": "matched", "evidence": ["Northwind Payments"], "priority": "must", "requirement": "5+ years of backend engineering"}, {"status": "matched", "evidence": ["Northwind Payments"], "priority": "nice", "requirement": "PostgreSQL"}, {"status": "missing", "evidence": [], "priority": "nice", "requirement": "Kafka Streams"}]}', '{"appliedTips": ["summary:0"], "formatVersion": 2, "skillSuggestions": ["TypeScript", "Node.js", "PostgreSQL", "Redis", "AWS", "Docker"], "customizedSummary": {"blocks": [{"type": "paragraph", "children": [{"text": "Backend engineer with eight years of TypeScript and Node.js.", "type": "text"}]}], "version": 1}, "coverLetterContent": {"blocks": [{"type": "paragraph", "children": [{"text": "I am excited to apply to Hooli.", "type": "text"}]}], "version": 1}, "projectEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "A Redis-backed sliding-window rate limiter for Node.js services. Used in production by several teams.", "type": "text"}]}], "version": 1}, "projectIndex": 0}], "educationEnhancements": [{"educationIndex": 0}], "experienceEnhancements": [{"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Led the move of the payment ledger to event-driven services on PostgreSQL and Kafka.", "type": "text"}]}, {"type": "paragraph", "children": [{"text": "Designed idempotent payment APIs handling 3M requests per day.", "type": "text"}]}], "version": 1}, "experienceIndex": 0}, {"description": {"blocks": [{"type": "paragraph", "children": [{"text": "Built the shipment tracking API in Node.js and TypeScript.", "type": "text"}]}], "version": 1}, "experienceIndex": 1}], "certificationSuggestions": ["AWS Certified Solutions Architect – Associate"]}', NULL, 'Hooli', 'Backend Engineer', NULL, 'https://www.linkedin.com/jobs/view/4100000006', '2026-10-03', 'rejected', NULL, '[]', '2026-10-10 09:00:00+00', '{}', '2026-10-02 09:00:00+00', '2026-10-11 09:00:00+00', NULL, NULL, 0, NULL, 'e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', NULL, NULL, NULL, NULL, NULL, NULL, '{"tone": "professional", "language": "auto"}', '2026-10-11 09:00:00+00', NULL);
INSERT INTO public.job_applications VALUES ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', NULL, 'scraped', NULL, '{"job": {"raw": {"source": "manual"}, "title": "Backend Developer", "location": "Istanbul, Turkey", "companyName": "Vandelay Industries", "description": "Pasted job description for a Node.js backend developer.", "requirements": []}, "companyManual": {"raw": {"source": "manual"}, "name": "Vandelay Industries", "websiteUrl": "https://vandelay.example.com"}}', NULL, NULL, NULL, 'Vandelay Industries', 'Backend Developer', NULL, 'https://vandelay.example.com/careers/backend', '2026-10-20', 'applied', 'medium', '[]', NULL, '{"source": "manual"}', '2026-10-20 09:00:00+00', '2026-10-20 10:00:00+00', NULL, NULL, 0, NULL, NULL, NULL, 60000.00, NULL, 'USD', 'yearly', 'net', NULL, '{"tone": "professional", "language": "auto"}', NULL, NULL);


--
-- Data for Name: knex_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.knex_migrations VALUES (1, '20260626000000_initial_schema.cjs', 1, '2026-10-01 00:00:00+00');
INSERT INTO public.knex_migrations VALUES (2, '20260806000000_collapse_legacy_document_content_achievements.cjs', 1, '2026-10-01 00:00:00+00');
INSERT INTO public.knex_migrations VALUES (3, '20261012000000_auth_rate_limits.cjs', 1, '2026-10-01 00:00:00+00');
INSERT INTO public.knex_migrations VALUES (4, '20261031000000_profile_onboarding_state.cjs', 1, '2026-10-01 00:00:00+00');
INSERT INTO public.knex_migrations VALUES (5, '20261108000000_job_application_ai_failure.cjs', 1, '2026-10-01 00:00:00+00');
INSERT INTO public.knex_migrations VALUES (6, '20261112000000_profile_skill_groups.cjs', 1, '2026-10-01 00:00:00+00');


--
-- Data for Name: knex_migrations_lock; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.knex_migrations_lock VALUES (1, 0);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES ('f2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'follow_up_reminder', 'Send a thank-you note', 'Umbrella Health · Staff Engineer', '2026-10-22 11:00:00+00', '2026-10-22 09:50:01+00');
INSERT INTO public.notifications VALUES ('f2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'follow_up_reminder', 'Ask Hooli for feedback', NULL, NULL, '2026-10-09 09:50:00+00');


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.outbox_events VALUES ('f3000000-0000-4000-8000-000000000001', 'application-pack.generation-requested', 'b0000000-0000-4000-8000-000000000004', '{"jobApplicationId": "b0000000-0000-4000-8000-000000000004", "generationAttemptId": "d0000000-0000-4000-8000-000000000004"}', '2026-10-12 09:30:00+00', 1, NULL, NULL, '2026-10-12 09:40:00+00', NULL, '2026-10-12 09:30:00+00', '2026-10-12 09:40:00+00', NULL, NULL);
INSERT INTO public.outbox_events VALUES ('f3000000-0000-4000-8000-000000000002', 'storage.delete', 'job-applications/b0000000-0000-4000-8000-000000000004/document-generations/d0000000-0000-4000-8000-0000000000f4/cv.pdf', '{"fileId": "job-applications/b0000000-0000-4000-8000-000000000004/document-generations/d0000000-0000-4000-8000-0000000000f4/cv.pdf"}', '2026-10-26 09:00:00+00', 0, NULL, NULL, NULL, NULL, '2026-10-26 09:00:00+00', '2026-10-26 09:00:00+00', NULL, NULL);
INSERT INTO public.outbox_events VALUES ('f3000000-0000-4000-8000-000000000003', 'job-application.analysis-requested', 'b0000000-0000-4000-8000-000000000005', '{"jobApplicationId": "b0000000-0000-4000-8000-000000000005", "analysisAttemptId": "e0000000-0000-4000-8000-000000000005"}', '2026-10-18 09:10:00+00', 3, NULL, NULL, NULL, 'AI provider is not configured', '2026-10-18 09:10:00+00', '2026-10-18 09:20:00+00', '2026-10-18 09:20:00+00', '2026-10-18 09:20:00+00');


--
-- Data for Name: rateLimit; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."user" VALUES ('local-user', '', '', false, NULL, '2026-10-01 08:00:00+00', '2026-10-01 08:00:00+00');


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_profiles VALUES ('a0000000-0000-4000-8000-000000000001', 'local-user', 'Ada Yilmaz', 'ada.yilmaz@example.com', 'Senior Backend Engineer', 'Backend engineer building reliable TypeScript and Node.js platforms', 'Istanbul, Turkey (open to remote)', '["https://github.com/example"]', 'Backend engineer with eight years of experience in TypeScript and Node.js.', '[{"title": "Senior Backend Engineer", "company": "Northwind Payments", "startDate": "2022-03", "description": "Led the move of the payment ledger to event-driven services on PostgreSQL and Kafka.\nDesigned idempotent payment APIs handling 3M requests per day."}, {"title": "Backend Engineer", "company": "Brightline Logistics", "endDate": "2022-02", "startDate": "2019-06", "description": "Built the shipment tracking API in Node.js and TypeScript."}]', '[{"field": "Computer Engineering", "degree": "BSc", "endDate": "2016-06", "startDate": "2012-09", "institution": "Middle East Technical University"}]', '["AWS Certified Solutions Architect – Associate"]', '[{"url": "https://github.com/example/rate-limiter", "name": "Open-source rate limiter", "skills": ["TypeScript", "Redis"], "description": "A Redis-backed sliding-window rate limiter for Node.js services.", "achievements": ["Used in production by several teams"]}]', '2026-10-01 08:00:00+00', '2026-10-01 08:30:00+00', true, true, NULL, false, 'cv.default', 'cover-letter.default', NULL, NULL, '[{"name": "Backend", "skills": ["TypeScript", "Node.js", "PostgreSQL", "Redis"]}, {"name": "Cloud", "skills": ["AWS", "Docker"]}]');


--
-- Data for Name: verification; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knex_migrations_id_seq', 6, true);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knex_migrations_lock_index_seq', 1, true);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: auth_otp_rate_limit auth_otp_rate_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_otp_rate_limit
    ADD CONSTRAINT auth_otp_rate_limit_pkey PRIMARY KEY (key);


--
-- Name: billing_provider_events billing_provider_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_provider_events
    ADD CONSTRAINT billing_provider_events_pkey PRIMARY KEY (provider, provider_event_id);


--
-- Name: billing_subscriptions billing_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: billing_subscriptions billing_subscriptions_provider_provider_subscription_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_provider_provider_subscription_id_unique UNIQUE (provider, provider_subscription_id);


--
-- Name: credit_accounts credit_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_accounts
    ADD CONSTRAINT credit_accounts_pkey PRIMARY KEY (user_id);


--
-- Name: credit_grants credit_grants_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_grants
    ADD CONSTRAINT credit_grants_id_user_id_unique UNIQUE (id, user_id);


--
-- Name: credit_grants credit_grants_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_grants
    ADD CONSTRAINT credit_grants_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: credit_grants credit_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_grants
    ADD CONSTRAINT credit_grants_pkey PRIMARY KEY (id);


--
-- Name: credit_ledger_entries credit_ledger_entries_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entries
    ADD CONSTRAINT credit_ledger_entries_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: credit_ledger_entries credit_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entries
    ADD CONSTRAINT credit_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: credit_reservations credit_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_reservations
    ADD CONSTRAINT credit_reservations_pkey PRIMARY KEY (id);


--
-- Name: generated_documents generated_documents_job_application_id_kind_format_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_job_application_id_kind_format_unique UNIQUE (job_application_id, kind, format);


--
-- Name: generated_documents generated_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_pkey PRIMARY KEY (id);


--
-- Name: job_application_contacts job_application_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_contacts
    ADD CONSTRAINT job_application_contacts_pkey PRIMARY KEY (id);


--
-- Name: job_application_events job_application_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_events
    ADD CONSTRAINT job_application_events_pkey PRIMARY KEY (id);


--
-- Name: job_application_follow_ups job_application_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_follow_ups
    ADD CONSTRAINT job_application_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: rateLimit rateLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateLimit"
    ADD CONSTRAINT "rateLimit_pkey" PRIMARY KEY (id);


--
-- Name: rateLimit ratelimit_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."rateLimit"
    ADD CONSTRAINT ratelimit_key_unique UNIQUE (key);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_unique UNIQUE (token);


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: idx_billing_events_status_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_events_status_received ON public.billing_provider_events USING btree (processing_status, received_at);


--
-- Name: idx_billing_subscriptions_user_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_subscriptions_user_updated ON public.billing_subscriptions USING btree (user_id, updated_at);


--
-- Name: idx_credit_grants_user_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_grants_user_expiry ON public.credit_grants USING btree (user_id, expires_at);


--
-- Name: idx_credit_ledger_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_ledger_user_time ON public.credit_ledger_entries USING btree (user_id, created_at);


--
-- Name: idx_credit_reservations_status_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_reservations_status_expiry ON public.credit_reservations USING btree (status, expires_at);


--
-- Name: idx_follow_ups_job_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_job_app ON public.job_application_follow_ups USING btree (job_application_id);


--
-- Name: idx_follow_ups_profile_upcoming; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_profile_upcoming ON public.job_application_follow_ups USING btree (profile_id, scheduled_at) WHERE (reminder_sent_at IS NULL);


--
-- Name: idx_follow_ups_reminder_recovery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_ups_reminder_recovery ON public.job_application_follow_ups USING btree (reminder_scheduled_for, reminder_sent_at) WHERE (reminder_sent_at IS NULL);


--
-- Name: idx_job_application_contacts_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_application_contacts_job ON public.job_application_contacts USING btree (job_application_id);


--
-- Name: idx_job_application_events_job_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_application_events_job_time ON public.job_application_events USING btree (job_application_id, occurred_at);


--
-- Name: idx_job_applications_profile_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_profile_archived_at ON public.job_applications USING btree (profile_id, archived_at DESC) WHERE (archived_at IS NOT NULL);


--
-- Name: idx_job_applications_profile_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_profile_status ON public.job_applications USING btree (profile_id, application_status);


--
-- Name: idx_job_applications_profile_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_profile_updated ON public.job_applications USING btree (profile_id, updated_at);


--
-- Name: idx_job_applications_scrape_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_scrape_claim ON public.job_applications USING btree (profile_id, status, next_scrape_attempt_at, scrape_claim_expires_at, created_at);


--
-- Name: idx_notifications_profile_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_profile_created ON public.notifications USING btree (profile_id, created_at DESC);


--
-- Name: idx_notifications_profile_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_profile_unread ON public.notifications USING btree (profile_id, read_at);


--
-- Name: idx_outbox_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_pending ON public.outbox_events USING btree (type, available_at, lease_expires_at, created_at) WHERE ((processed_at IS NULL) AND (dead_lettered_at IS NULL));


--
-- Name: uq_credit_ledger_usage_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_credit_ledger_usage_reservation ON public.credit_ledger_entries USING btree (reservation_id) WHERE ((entry_type = 'usage'::text) AND (reservation_id IS NOT NULL));


--
-- Name: uq_credit_reservations_active_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_credit_reservations_active_resource ON public.credit_reservations USING btree (operation_type, resource_type, resource_id) WHERE (status = 'reserved'::text);


--
-- Name: account account_userid_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_userid_foreign FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: billing_subscriptions billing_subscriptions_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_user_id_foreign FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: credit_accounts credit_accounts_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_accounts
    ADD CONSTRAINT credit_accounts_user_id_foreign FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: credit_grants credit_grants_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_grants
    ADD CONSTRAINT credit_grants_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.credit_accounts(user_id) ON DELETE CASCADE;


--
-- Name: credit_ledger_entries credit_ledger_entries_grant_id_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entries
    ADD CONSTRAINT credit_ledger_entries_grant_id_user_id_foreign FOREIGN KEY (grant_id, user_id) REFERENCES public.credit_grants(id, user_id) ON DELETE CASCADE;


--
-- Name: credit_ledger_entries credit_ledger_entries_reservation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entries
    ADD CONSTRAINT credit_ledger_entries_reservation_id_foreign FOREIGN KEY (reservation_id) REFERENCES public.credit_reservations(id) ON DELETE SET NULL;


--
-- Name: credit_ledger_entries credit_ledger_entries_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger_entries
    ADD CONSTRAINT credit_ledger_entries_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.credit_accounts(user_id) ON DELETE CASCADE;


--
-- Name: credit_reservations credit_reservations_grant_id_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_reservations
    ADD CONSTRAINT credit_reservations_grant_id_user_id_foreign FOREIGN KEY (grant_id, user_id) REFERENCES public.credit_grants(id, user_id) ON DELETE CASCADE;


--
-- Name: generated_documents generated_documents_job_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_job_application_id_foreign FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_contacts job_application_contacts_job_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_contacts
    ADD CONSTRAINT job_application_contacts_job_application_id_foreign FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_events job_application_events_job_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_events
    ADD CONSTRAINT job_application_events_job_application_id_foreign FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_follow_ups job_application_follow_ups_job_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_follow_ups
    ADD CONSTRAINT job_application_follow_ups_job_application_id_foreign FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_follow_ups job_application_follow_ups_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_follow_ups
    ADD CONSTRAINT job_application_follow_ups_profile_id_foreign FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_profile_id_foreign FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_job_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_job_application_id_foreign FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_profile_id_foreign FOREIGN KEY (profile_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: session session_userid_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_userid_foreign FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


