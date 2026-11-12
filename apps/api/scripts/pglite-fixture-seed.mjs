// The sample Careerden Unplugged database written into every PGlite upgrade fixture. It mirrors
// what a real user accumulates: one filled-in profile, applications in every stable processing
// state plus an archived one, generated documents, follow-ups, notifications, and outbox rows in
// each delivery state. All ids and timestamps are fixed so a regenerated fixture diffs cleanly.
//
// Rows are written as raw column values, not through the repositories, because the fixture is
// built at the schema of an older release while this file is read from the current checkout.
// Columns that did not exist yet at that release are dropped by the generator.

const localUserId = "local-user";
const profileId = "a0000000-0000-4000-8000-000000000001";

const application = {
  queued: "b0000000-0000-4000-8000-000000000001",
  scraped: "b0000000-0000-4000-8000-000000000002",
  reviewReady: "b0000000-0000-4000-8000-000000000003",
  completed: "b0000000-0000-4000-8000-000000000004",
  failed: "b0000000-0000-4000-8000-000000000005",
  archived: "b0000000-0000-4000-8000-000000000006",
  manual: "b0000000-0000-4000-8000-000000000007",
};

const generationAttempt = {
  completed: "d0000000-0000-4000-8000-000000000004",
  archived: "d0000000-0000-4000-8000-000000000006",
  superseded: "d0000000-0000-4000-8000-0000000000f4",
};

const at = (day, time = "09:00:00") => `2026-10-${String(day).padStart(2, "0")}T${time}.000Z`;
const json = (value) => JSON.stringify(value);
const rich = (...lines) => ({
  version: 1,
  blocks: lines.map((text) => ({ type: "paragraph", children: [{ type: "text", text }] })),
});

const experience = [
  {
    company: "Northwind Payments",
    title: "Senior Backend Engineer",
    startDate: "2022-03",
    description:
      "Led the move of the payment ledger to event-driven services on PostgreSQL and Kafka.\n" +
      "Designed idempotent payment APIs handling 3M requests per day.",
  },
  {
    company: "Brightline Logistics",
    title: "Backend Engineer",
    startDate: "2019-06",
    endDate: "2022-02",
    description: "Built the shipment tracking API in Node.js and TypeScript.",
  },
];
const education = [
  {
    institution: "Middle East Technical University",
    degree: "BSc",
    field: "Computer Engineering",
    startDate: "2012-09",
    endDate: "2016-06",
  },
];
const projects = [
  {
    name: "Open-source rate limiter",
    description: "A Redis-backed sliding-window rate limiter for Node.js services.",
    url: "https://github.com/example/rate-limiter",
    skills: ["TypeScript", "Redis"],
    achievements: ["Used in production by several teams"],
  },
];
const skills = ["TypeScript", "Node.js", "PostgreSQL", "Redis", "AWS", "Docker"];
const certifications = ["AWS Certified Solutions Architect – Associate"];

function scrapeBundle({ company, title, location, url, requirements }) {
  const description = `${company} is hiring a ${title} to build reliable backend services.`;
  return {
    job: {
      title,
      companyName: company,
      location,
      description,
      descriptionHtml: `<p>${description}</p>`,
      requirements,
      companyLinkedInUrl: `https://www.linkedin.com/company/${company.toLowerCase().replace(/\W+/g, "-")}`,
      raw: { source: "linkedin-guest", url, fetchedAt: at(20) },
    },
    companyLinkedIn: {
      name: company,
      description: `${company} builds software for growing businesses.`,
      raw: { source: "linkedin-guest" },
    },
  };
}

function matchAnalysis(matchScore, requirements) {
  return {
    matchScore,
    strongSkills: ["TypeScript", "PostgreSQL"],
    missingSkills: ["Kafka Streams"],
    requirementEvaluations: requirements.map((requirement, index) => ({
      requirement,
      status: index === requirements.length - 1 ? "missing" : "matched",
      evidence: index === requirements.length - 1 ? [] : ["Northwind Payments"],
      priority: index === 0 ? "must" : "nice",
    })),
    summaryTips: [{ text: "Lead with the payment ledger migration.", evidence: "payment ledger" }],
    interviewTips: ["Prepare a story about running an incident review."],
    coverLetterContent: "I would like to bring my payments experience to your platform team.",
    gapQuestions: [
      {
        question: "Have you operated Kafka Streams in production?",
        requirement: requirements.at(-1),
        field: { type: "experience", index: 0 },
      },
    ],
  };
}

function documentContent(coverLetter) {
  return {
    formatVersion: 2,
    coverLetterContent: rich(coverLetter),
    customizedSummary: rich("Backend engineer with eight years of TypeScript and Node.js."),
    experienceEnhancements: experience.map((item, index) => ({
      experienceIndex: index,
      description: rich(...item.description.split("\n")),
    })),
    educationEnhancements: [{ educationIndex: 0 }],
    projectEnhancements: [
      {
        projectIndex: 0,
        description: rich(`${projects[0].description} ${projects[0].achievements[0]}.`),
      },
    ],
    skillSuggestions: skills,
    certificationSuggestions: certifications,
    appliedTips: ["summary:0"],
  };
}

function jobApplication(id, values) {
  return {
    id,
    profile_id: profileId,
    tags: json([]),
    metadata: json({}),
    application_pack_preferences: json({ language: "auto", tone: "professional" }),
    ...values,
  };
}

const requirements = ["5+ years of backend engineering", "PostgreSQL", "Kafka Streams"];

const jobApplications = [
  jobApplication(application.queued, {
    source_url: "https://www.linkedin.com/jobs/view/4100000001",
    job_url: "https://www.linkedin.com/jobs/view/4100000001",
    status: "queued",
    scrape_attempt_count: 1,
    next_scrape_attempt_at: at(26, "09:05:00"),
    created_at: at(26),
    updated_at: at(26, "09:01:00"),
  }),
  jobApplication(application.scraped, {
    source_url: "https://www.linkedin.com/jobs/view/4100000002",
    job_url: "https://www.linkedin.com/jobs/view/4100000002",
    status: "scraped",
    scrape_bundle: json(
      scrapeBundle({
        company: "Globex",
        title: "Platform Engineer",
        location: "Berlin, Germany (Hybrid)",
        url: "https://www.linkedin.com/jobs/view/4100000002",
        requirements,
      }),
    ),
    company_name: "Globex",
    role_title: "Platform Engineer",
    work_style: "hybrid",
    tags: json(["platform"]),
    created_at: at(24),
    updated_at: at(24, "09:02:00"),
  }),
  jobApplication(application.reviewReady, {
    source_url: "https://www.linkedin.com/jobs/view/4100000003",
    job_url: "https://www.linkedin.com/jobs/view/4100000003",
    status: "review_ready",
    scrape_bundle: json(
      scrapeBundle({
        company: "Initech",
        title: "Senior Backend Engineer",
        location: "Remote (EU)",
        url: "https://www.linkedin.com/jobs/view/4100000003",
        requirements,
      }),
    ),
    match_analysis: json(matchAnalysis(78, requirements)),
    document_content: json(documentContent("I would like to join Initech's backend team.")),
    analysis_attempt_id: "e0000000-0000-4000-8000-000000000003",
    company_name: "Initech",
    role_title: "Senior Backend Engineer",
    role_type: "Full-time",
    application_status: "saved",
    priority: "high",
    tags: json(["remote", "typescript"]),
    work_style: "remote",
    salary_min_amount: "85000.00",
    salary_max_amount: "105000.00",
    salary_currency: "EUR",
    salary_period: "yearly",
    salary_type: "gross",
    created_at: at(22),
    updated_at: at(22, "09:20:00"),
  }),
  jobApplication(application.completed, {
    source_url: "https://www.linkedin.com/jobs/view/4100000004",
    job_url: "https://www.linkedin.com/jobs/view/4100000004",
    status: "completed",
    scrape_bundle: json(
      scrapeBundle({
        company: "Umbrella Health",
        title: "Staff Engineer",
        location: "Amsterdam, Netherlands",
        url: "https://www.linkedin.com/jobs/view/4100000004",
        requirements,
      }),
    ),
    match_analysis: json(matchAnalysis(91, requirements)),
    document_content: json(documentContent("Umbrella Health's mission matches my experience.")),
    analysis_attempt_id: "e0000000-0000-4000-8000-000000000004",
    document_generation_attempt_id: generationAttempt.completed,
    company_name: "Umbrella Health",
    role_title: "Staff Engineer",
    date_applied: "2026-10-15",
    application_status: "interview",
    priority: "high",
    tags: json(["health"]),
    last_response_at: at(21, "14:30:00"),
    work_style: "on_site",
    application_pack_preferences: json({
      language: "en",
      tone: "concise",
      cvTemplateId: "cv.modern",
    }),
    created_at: at(12),
    updated_at: at(21, "14:30:00"),
  }),
  jobApplication(application.failed, {
    source_url: "https://www.linkedin.com/jobs/view/4100000005",
    job_url: "https://www.linkedin.com/jobs/view/4100000005",
    status: "failed",
    failure_reason: "The job posting could not be fetched from LinkedIn.",
    scrape_attempt_count: 3,
    created_at: at(18),
    updated_at: at(18, "09:30:00"),
  }),
  jobApplication(application.archived, {
    source_url: "https://www.linkedin.com/jobs/view/4100000006",
    job_url: "https://www.linkedin.com/jobs/view/4100000006",
    status: "completed",
    scrape_bundle: json(
      scrapeBundle({
        company: "Hooli",
        title: "Backend Engineer",
        location: "London, United Kingdom",
        url: "https://www.linkedin.com/jobs/view/4100000006",
        requirements,
      }),
    ),
    match_analysis: json(matchAnalysis(64, requirements)),
    document_content: json(documentContent("I am excited to apply to Hooli.")),
    analysis_attempt_id: "e0000000-0000-4000-8000-000000000006",
    document_generation_attempt_id: generationAttempt.archived,
    company_name: "Hooli",
    role_title: "Backend Engineer",
    date_applied: "2026-10-03",
    application_status: "rejected",
    last_response_at: at(10),
    created_at: at(2),
    updated_at: at(11),
    archived_at: at(11),
  }),
  jobApplication(application.manual, {
    status: "scraped",
    scrape_bundle: json({
      job: {
        title: "Backend Developer",
        companyName: "Vandelay Industries",
        location: "Istanbul, Turkey",
        description: "Pasted job description for a Node.js backend developer.",
        requirements: [],
        raw: { source: "manual" },
      },
      companyManual: {
        name: "Vandelay Industries",
        websiteUrl: "https://vandelay.example.com",
        raw: { source: "manual" },
      },
    }),
    company_name: "Vandelay Industries",
    role_title: "Backend Developer",
    job_url: "https://vandelay.example.com/careers/backend",
    application_status: "applied",
    date_applied: "2026-10-20",
    priority: "medium",
    salary_min_amount: "60000.00",
    salary_currency: "USD",
    salary_period: "yearly",
    salary_type: "net",
    metadata: json({ source: "manual" }),
    created_at: at(20),
    updated_at: at(20, "10:00:00"),
  }),
];

let eventSequence = 0;
function event(jobApplicationId, type, title, occurredAt, metadata = {}, body = null) {
  eventSequence += 1;
  return {
    id: `c0000000-0000-4000-8000-${String(eventSequence).padStart(12, "0")}`,
    job_application_id: jobApplicationId,
    type,
    title,
    body,
    occurred_at: occurredAt,
    created_at: occurredAt,
    metadata: json(metadata),
  };
}

const jobApplicationEvents = [
  event(application.queued, "created", "Job application created", at(26)),
  event(application.scraped, "created", "Job application created", at(24)),
  event(application.scraped, "processing", "Job scraped", at(24, "09:02:00")),
  event(application.reviewReady, "created", "Job application created", at(22)),
  event(application.reviewReady, "processing", "AI analysis completed", at(22, "09:20:00")),
  event(application.completed, "created", "Job application created", at(12)),
  event(application.completed, "processing", "Application pack generated", at(12, "09:40:00"), {
    generationAttemptId: generationAttempt.completed,
  }),
  event(application.completed, "status_changed", "Marked as applied", at(15), {
    from: "saved",
    to: "applied",
  }),
  event(application.completed, "status_changed", "Moved to interview", at(21, "14:30:00"), {
    from: "applied",
    to: "interview",
  }),
  event(
    application.completed,
    "note",
    "Recruiter call",
    at(21, "15:00:00"),
    {},
    "Talked to the recruiter; technical interview next week.",
  ),
  event(application.failed, "created", "Job application created", at(18)),
  event(application.failed, "processing", "Scraping failed", at(18, "09:30:00"), {
    reason: "The job posting could not be fetched from LinkedIn.",
  }),
  event(application.archived, "created", "Job application created", at(2)),
  event(application.archived, "status_changed", "Marked as rejected", at(10), {
    from: "applied",
    to: "rejected",
  }),
  event(application.manual, "created", "Job application created", at(20)),
];

const jobApplicationContacts = [
  {
    id: "f0000000-0000-4000-8000-000000000001",
    job_application_id: application.completed,
    name: "Jordan Recruiter",
    role: "Technical Recruiter",
    email: "jordan@umbrella.example.com",
    linkedin_url: "https://www.linkedin.com/in/jordan-recruiter",
    notes: "Prefers email.",
    created_at: at(21, "15:00:00"),
    updated_at: at(21, "15:00:00"),
  },
];

const followUps = {
  sent: "f1000000-0000-4000-8000-000000000001",
  pending: "f1000000-0000-4000-8000-000000000002",
};

const jobApplicationFollowUps = [
  {
    id: followUps.sent,
    job_application_id: application.completed,
    profile_id: profileId,
    title: "Send a thank-you note",
    scheduled_at: at(22, "10:00:00"),
    reminder_job_id: `follow-up-reminder:${followUps.sent}`,
    reminder_scheduled_for: at(22, "09:50:00"),
    reminder_sent_at: at(22, "09:50:01"),
    created_at: at(21, "15:05:00"),
    updated_at: at(22, "09:50:01"),
  },
  {
    // Far enough ahead that a restored reminder never fires while the upgrade test runs.
    id: followUps.pending,
    job_application_id: application.manual,
    profile_id: profileId,
    title: "Check in with the hiring manager",
    description: "Ask whether the role is still open.",
    scheduled_at: "2036-10-27T10:00:00.000Z",
    reminder_job_id: `follow-up-reminder:${followUps.pending}`,
    reminder_scheduled_for: "2036-10-27T09:50:00.000Z",
    created_at: at(20, "10:05:00"),
    updated_at: at(20, "10:05:00"),
  },
];

function generatedDocuments(jobApplicationId, attemptId, createdAt, sequence) {
  const fileId = (fileName) =>
    `job-applications/${jobApplicationId}/document-generations/${attemptId}/${fileName}`;
  return [
    {
      id: `d1000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      job_application_id: jobApplicationId,
      kind: "cv",
      format: "pdf",
      file_id: fileId("cv.pdf"),
      file_name: "Ada Yilmaz - CV.pdf",
      content_type: "application/pdf",
      created_at: createdAt,
    },
    {
      id: `d1000000-0000-4000-8000-${String(sequence + 1).padStart(12, "0")}`,
      job_application_id: jobApplicationId,
      kind: "cover_letter",
      format: "pdf",
      file_id: fileId("cover-letter.pdf"),
      file_name: "Ada Yilmaz - Cover Letter.pdf",
      content_type: "application/pdf",
      created_at: createdAt,
    },
  ];
}

const documents = [
  ...generatedDocuments(application.completed, generationAttempt.completed, at(12, "09:40:00"), 1),
  ...generatedDocuments(application.archived, generationAttempt.archived, at(3), 3),
];

const notifications = [
  {
    id: "f2000000-0000-4000-8000-000000000001",
    profile_id: profileId,
    job_application_id: application.completed,
    type: "follow_up_reminder",
    title: "Send a thank-you note",
    body: "Umbrella Health · Staff Engineer",
    read_at: at(22, "11:00:00"),
    created_at: at(22, "09:50:01"),
  },
  {
    id: "f2000000-0000-4000-8000-000000000002",
    profile_id: profileId,
    job_application_id: application.archived,
    type: "follow_up_reminder",
    title: "Ask Hooli for feedback",
    created_at: at(9, "09:50:00"),
  },
];

const outboxEvents = [
  {
    id: "f3000000-0000-4000-8000-000000000001",
    type: "application-pack.generation-requested",
    aggregate_id: application.completed,
    payload: json({
      jobApplicationId: application.completed,
      generationAttemptId: generationAttempt.completed,
    }),
    available_at: at(12, "09:30:00"),
    attempt_count: 1,
    processed_at: at(12, "09:40:00"),
    created_at: at(12, "09:30:00"),
    updated_at: at(12, "09:40:00"),
  },
  {
    // Still pending: the superseded generation's files are deleted on the next start.
    id: "f3000000-0000-4000-8000-000000000002",
    type: "storage.delete",
    aggregate_id: `job-applications/${application.completed}/document-generations/${generationAttempt.superseded}/cv.pdf`,
    payload: json({
      fileId: `job-applications/${application.completed}/document-generations/${generationAttempt.superseded}/cv.pdf`,
    }),
    available_at: at(26, "09:00:00"),
    created_at: at(26, "09:00:00"),
    updated_at: at(26, "09:00:00"),
  },
  {
    id: "f3000000-0000-4000-8000-000000000003",
    type: "job-application.analysis-requested",
    aggregate_id: application.failed,
    payload: json({
      jobApplicationId: application.failed,
      analysisAttemptId: "e0000000-0000-4000-8000-000000000005",
    }),
    available_at: at(18, "09:10:00"),
    attempt_count: 3,
    last_error: "AI provider is not configured",
    last_error_at: at(18, "09:20:00"),
    dead_lettered_at: at(18, "09:20:00"),
    created_at: at(18, "09:10:00"),
    updated_at: at(18, "09:20:00"),
  },
];

// Tables in foreign-key order.
export const seedTables = [
  [
    "user",
    [
      {
        id: localUserId,
        name: "",
        email: "",
        createdAt: at(1, "08:00:00"),
        updatedAt: at(1, "08:00:00"),
      },
    ],
  ],
  [
    "user_profiles",
    [
      {
        id: profileId,
        user_id: localUserId,
        full_name: "Ada Yilmaz",
        email: "ada.yilmaz@example.com",
        profession: "Senior Backend Engineer",
        headline: "Backend engineer building reliable TypeScript and Node.js platforms",
        location: "Istanbul, Turkey (open to remote)",
        links: json(["https://github.com/example"]),
        summary: "Backend engineer with eight years of experience in TypeScript and Node.js.",
        skill_groups: json([
          { name: "Backend", skills: skills.slice(0, 4) },
          { name: "Cloud", skills: skills.slice(4) },
        ]),
        experience: json(experience),
        education: json(education),
        certifications: json(certifications),
        projects: json(projects),
        auto_run_match_analysis: true,
        follow_up_reminders_enabled: true,
        auto_generate_documents: false,
        default_cv_template_id: "cv.default",
        default_cover_letter_template_id: "cover-letter.default",
        created_at: at(1, "08:00:00"),
        updated_at: at(1, "08:30:00"),
      },
    ],
  ],
  ["job_applications", jobApplications],
  ["job_application_events", jobApplicationEvents],
  ["job_application_contacts", jobApplicationContacts],
  ["job_application_follow_ups", jobApplicationFollowUps],
  ["generated_documents", documents],
  ["notifications", notifications],
  ["outbox_events", outboxEvents],
];

// The stored document files the generated_documents rows point at.
export const seedFiles = documents.map((document) => ({
  fileId: document.file_id,
  fileName: document.file_name,
  contentType: document.content_type,
  body: `%PDF-1.4\n% Careerden upgrade fixture: ${document.kind} for ${document.job_application_id}\n%%EOF\n`,
}));

// What the upgrade test reads back after migrating; stored next to the dump so each fixture
// carries its own expectations.
export const seedExpectations = {
  profileId,
  profileFullName: "Ada Yilmaz",
  activeApplications: Object.fromEntries(
    jobApplications.filter((row) => !row.archived_at).map((row) => [row.id, row.status]),
  ),
  archivedApplications: Object.fromEntries(
    jobApplications.filter((row) => row.archived_at).map((row) => [row.id, row.status]),
  ),
  applicationsWithDocumentContent: jobApplications
    .filter((row) => row.document_content)
    .map((row) => row.id),
  documents: documents.map((document) => ({
    id: document.id,
    jobApplicationId: document.job_application_id,
    kind: document.kind,
    fileId: document.file_id,
  })),
  followUpIds: jobApplicationFollowUps.map((row) => row.id),
  notificationIds: notifications.map((row) => row.id),
};
