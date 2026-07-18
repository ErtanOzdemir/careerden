import type { DashboardStats, JobApplication, Profile } from "./types";

export const mockApplications: JobApplication[] = [
  {
    id: "1",
    company: "Vercel Inc.",
    domain: "vercel.com",
    role: "Senior Product Designer",
    location: "Remote / San Francisco",
    dateApplied: "Oct 24, 2023",
    dateLabel: "2 days ago",
    status: "Applied",
    interestLevel: "high",
    tags: ["Remote", "Full-time"],
    description:
      "We are looking for a Senior Product Designer to own the design of our developer platform. You'll shape how thousands of developers build and deploy web applications.",
    requirements: [
      "7+ years of product design experience.",
      "Deep understanding of developer tools and workflows.",
      "Experience building and maintaining design systems.",
    ],
    timeline: [
      {
        id: "v1",
        title: "Application Submitted",
        description: "Submitted via Vercel careers portal with portfolio.",
        date: "Oct 24",
        status: "completed",
      },
      {
        id: "v2",
        title: "Hiring Manager Review",
        description: "Awaiting review by the design team lead.",
        date: "Oct 30",
        status: "upcoming",
        type: "Behavioral",
      },
    ],
    contacts: [
      { email: "laura.kim@vercel.com", initials: "LK", name: "Laura Kim", role: "Talent Partner" },
      {
        email: "raul.jimenez@vercel.com",
        initials: "RJ",
        name: "Raul Jimenez",
        role: "Design Lead",
      },
    ],
    aiMatch: {
      score: 72,
      summary:
        "Strong portfolio in product design and developer tools, but the resume could better highlight experience with design systems at scale.",
      keywords: [
        { keyword: "Product Design", match: true },
        { keyword: "Figma", match: true },
        { keyword: "Design Systems", match: true },
        { keyword: "Developer Tools", match: false },
        { keyword: "React", match: false },
      ],
      recommendation: "Apply to CV",
      currentSummary:
        "Senior Product Designer with 7 years of experience in web and mobile design. Proficient in Figma, Sketch, and prototyping tools.",
      enhancedSummary:
        "Senior Product Designer specializing in developer platform experiences and scalable design systems. Led design for tools used by 1M+ developers, driving adoption through intuitive UX and systematic component libraries.",
      bulletOptimizations: [
        {
          original: "Led redesign of the dashboard.",
          enhanced:
            '"Spearheaded the redesign of a developer dashboard serving 500K+ users, improving task completion by 35%."',
        },
        {
          original: "Created a component library.",
          enhanced:
            '"Architected a comprehensive component library with 120+ tokens, adopted by 4 product teams across the organization."',
        },
      ],
      experienceOptimizations: [
        {
          title: "Senior Product Designer",
          company: "Flow Systems",
          items: [
            {
              kind: "description",
              actual:
                "Owned end-to-end product design for enterprise SaaS workflows across discovery, prototyping, and launch.",
              enhanced:
                "Led end-to-end enterprise SaaS product design for developer platform workflows, translating discovery insights into scalable prototypes and launch-ready experiences.",
            },
            {
              kind: "achievement",
              actual:
                "Led the design of a new enterprise SaaS platform, resulting in a 40% increase in user productivity within the first quarter of launch.",
              enhanced:
                "Architected and launched an enterprise SaaS platform serving 1M+ developers, driving a 40% productivity increase through intuitive UX and developer-first workflows.",
            },
            {
              kind: "achievement",
              actual:
                "Mentored a team of 4 junior designers and established a comprehensive design system now used across 3 major product lines.",
              enhanced:
                "Established a scalable design system with 120+ components while mentoring 4 junior designers, adopted across 3 product lines and reducing design-to-dev handoff by 40%.",
            },
          ],
        },
        {
          title: "UI/UX Designer",
          company: "Creative Core Agency",
          items: [
            {
              kind: "achievement",
              actual:
                "Shipped over 15 client projects ranging from mobile apps to responsive marketing websites for Fortune 500 companies.",
              enhanced:
                "Delivered 15+ high-impact digital products for Fortune 500 clients, ranging from mobile applications to responsive web platforms, driving measurable engagement improvements across all projects.",
            },
          ],
        },
      ],
      yourSkills: ["Figma", "Product Design", "Prototyping"],
      suggestedSkills: ["React", "Next.js", "Design Tokens"],
    },
  },
  {
    id: "2",
    company: "Stripe",
    domain: "stripe.com",
    role: "Design Systems Engineer",
    location: "Hybrid / Dublin",
    dateApplied: "Oct 22, 2023",
    dateLabel: "4 days ago",
    status: "Interviewing",
    interestLevel: "high",
    tags: ["Hybrid", "Contract"],
    description:
      "We are looking for a Senior Product Designer to join our Checkout team. You will lead the design for high-scale payment flows used by millions of businesses globally.",
    requirements: [
      "5+ years of experience in high-growth SaaS.",
      "Expertise in Figma and design systems.",
      "Strong understanding of conversion optimization.",
    ],
    timeline: [
      {
        id: "m1",
        title: "Initial Recruiter Call",
        description: "Focused on salary expectations and culture fit.",
        date: "Oct 12",
        status: "completed",
      },
      {
        id: "m2",
        title: "Technical Portfolio Review",
        description: "Reviewing the Checkout flow redesign project.",
        date: "Oct 24",
        status: "upcoming",
        type: "Technical",
      },
    ],
    contacts: [
      {
        email: "sarah.hughes@stripe.com",
        initials: "SH",
        name: "Sarah Hughes",
        role: "Recruitment Lead",
      },
      {
        email: "ryan.miller@stripe.com",
        initials: "RM",
        name: "Ryan Miller",
        role: "Hiring Manager",
      },
    ],
    aiMatch: {
      score: 85,
      summary:
        '"Strong alignment in visual design and SaaS experience, but missing direct Fintech compliance keywords."',
      keywords: [
        { keyword: "Product Design", match: true },
        { keyword: "Figma", match: true },
        { keyword: "SaaS", match: true },
        { keyword: "Fintech", match: false },
        { keyword: "SQL", match: false },
      ],
      recommendation: "Apply to CV",
      currentSummary:
        "Product Designer with 5 years experience in building web apps. Specialized in user research and Figma.",
      enhancedSummary:
        "Senior Product Designer specializing in high-conversion SaaS checkout flows and design systems. Proven track record in optimizing global payment experiences using data-driven design in Figma.",
      bulletOptimizations: [
        {
          original: "Led the redesign of the user dashboard.",
          enhanced:
            '"Spearheaded the redesign of high-scale dashboard interfaces, resulting in a 25% increase in user engagement."',
        },
        {
          original: "Managed a design team of 3.",
          enhanced:
            '"Mentored a cross-functional team of 3 designers, establishing a new design system architecture."',
        },
      ],
      experienceOptimizations: [
        {
          title: "Senior Product Designer",
          company: "Flow Systems",
          items: [
            {
              kind: "description",
              actual:
                "Owned end-to-end product design for enterprise SaaS workflows across discovery, prototyping, and launch.",
              enhanced:
                "Led end-to-end product design for SaaS payment workflows, connecting discovery, Figma prototyping, and conversion-focused launch execution.",
            },
            {
              kind: "achievement",
              actual:
                "Led the design of a new enterprise SaaS platform, resulting in a 40% increase in user productivity within the first quarter of launch.",
              enhanced:
                "Spearheaded the design and launch of a high-scale enterprise SaaS payments platform, driving a 40% boost in user productivity across 15K+ active users within the first quarter.",
            },
            {
              kind: "achievement",
              actual:
                "Mentored a team of 4 junior designers and established a comprehensive design system now used across 3 major product lines.",
              enhanced:
                "Mentored and upskilled a team of 4 junior designers while architecting a comprehensive design system adopted by 3 product lines, reducing UI development time by 35%.",
            },
          ],
        },
        {
          title: "UI/UX Designer",
          company: "Creative Core Agency",
          items: [
            {
              kind: "achievement",
              actual:
                "Shipped over 15 client projects ranging from mobile apps to responsive marketing websites for Fortune 500 companies.",
              enhanced:
                "Delivered 15+ end-to-end digital products for Fortune 500 clients including mobile apps and responsive web platforms, consistently exceeding client satisfaction targets by 20%.",
            },
          ],
        },
      ],
      yourSkills: ["Figma", "UI Design", "Research"],
      suggestedSkills: ["Fintech", "SQL", "CRO"],
    },
  },
  {
    id: "3",
    company: "HealthTap",
    domain: "healthtap.com",
    role: "UX Researcher",
    location: "Full Remote",
    dateApplied: "Oct 20, 2023",
    dateLabel: "6 days ago",
    status: "Rejected",
    interestLevel: "low",
    tags: ["Remote"],
    description:
      "HealthTap is seeking a UX Researcher to drive user insights for our telehealth platform. You'll work closely with product and clinical teams.",
    requirements: [
      "3+ years of UX research experience.",
      "Experience with healthcare or regulated industries.",
      "Strong qualitative and quantitative research skills.",
    ],
    timeline: [
      {
        id: "h1",
        title: "Initial Screen",
        description: "Phone screen with the research lead.",
        date: "Oct 15",
        status: "completed",
      },
      {
        id: "h2",
        title: "Research Presentation",
        description: "Presented a past research study on patient onboarding.",
        date: "Oct 18",
        status: "completed",
      },
    ],
    contacts: [
      {
        email: "jamie.diaz@healthtap.com",
        initials: "JD",
        name: "Jamie Diaz",
        role: "Research Lead",
      },
      {
        email: "priya.nair@healthtap.com",
        initials: "PN",
        name: "Priya Nair",
        role: "HR Coordinator",
      },
    ],
    aiMatch: {
      score: 38,
      summary:
        "The resume lacks sufficient healthcare domain experience and the research portfolio is light on regulated-industry case studies.",
      keywords: [
        { keyword: "User Research", match: true },
        { keyword: "Qualitative", match: true },
        { keyword: "Healthcare", match: false },
        { keyword: "Compliance", match: false },
        { keyword: "Statistical Analysis", match: false },
      ],
      recommendation: "Skip CV",
      currentSummary:
        "UX Researcher with 4 years of experience conducting user interviews and usability tests for web applications.",
      enhancedSummary:
        "UX Researcher experienced in qualitative and quantitative methods for healthcare platforms. Skilled in navigating HIPAA-compliant research environments and translating patient needs into product improvements.",
      bulletOptimizations: [
        {
          original: "Conducted user interviews for web apps.",
          enhanced:
            '"Led user research for healthcare applications, conducting HIPAA-compliant interviews and synthesizing insights for cross-functional product teams."',
        },
      ],
      yourSkills: ["User Research", "Usability Testing"],
      suggestedSkills: ["Healthcare", "HIPAA", "Statistics"],
    },
  },
  {
    id: "4",
    company: "Linear",
    domain: "linear.app",
    role: "Frontend Engineer",
    location: "Remote / EU",
    dateApplied: "Oct 18, 2023",
    dateLabel: "8 days ago",
    status: "Offer",
    interestLevel: "high",
    tags: ["Remote", "Stock Options"],
    description:
      "Linear is hiring a Frontend Engineer to build the next generation of issue tracking and project management tools. You'll work on a fast, performant React + TypeScript codebase.",
    requirements: [
      "Strong proficiency in React and TypeScript.",
      "Experience with performance optimization and rendering.",
      "Passion for developer experience and tooling.",
    ],
    timeline: [
      {
        id: "l1",
        title: "Technical Screen",
        description: "Pair programming session on React performance.",
        date: "Oct 20",
        status: "completed",
        type: "Technical",
      },
      {
        id: "l2",
        title: "System Design Round",
        description: "Designed a real-time sync architecture.",
        date: "Oct 23",
        status: "completed",
        type: "Technical",
      },
      {
        id: "l3",
        title: "Offer Extended",
        description: "Received offer via email. Negotiating terms.",
        date: "Oct 25",
        status: "completed",
      },
    ],
    contacts: [
      {
        email: "tuomas.ch@linear.app",
        initials: "TC",
        name: "Tuomas Ch",
        role: "Engineering Manager",
      },
      { email: "karri.r@linear.app", initials: "KR", name: "Karri R", role: "Cofounder" },
    ],
    aiMatch: {
      score: 92,
      summary:
        "Excellent match! Your frontend experience directly aligns with Linear's tech stack and performance-first culture. Strong signals in all key areas.",
      keywords: [
        { keyword: "React", match: true },
        { keyword: "TypeScript", match: true },
        { keyword: "Performance", match: true },
        { keyword: "GraphQL", match: true },
        { keyword: "Electron", match: false },
      ],
      recommendation: "Apply to CV",
      currentSummary:
        "Frontend Engineer with strong React and TypeScript skills. Focused on building fast, scalable user interfaces.",
      enhancedSummary:
        "Frontend Engineer with deep expertise in React and TypeScript, specializing in performance-critical UI rendering. Built and optimized interfaces for high-traffic applications, reducing load times by 60% through advanced memoization and code-splitting strategies.",
      bulletOptimizations: [
        {
          original: "Optimized page load times.",
          enhanced:
            '"Optimized page load times by 60% through code splitting, lazy loading, and React.memo, improving Core Web Vitals across the application."',
        },
        {
          original: "Built a component library.",
          enhanced:
            '"Designed and shipped a shared component library used by 6 frontend teams, reducing development time for new features by 30%."',
        },
      ],
      yourSkills: ["React", "TypeScript", "GraphQL"],
      suggestedSkills: ["Electron", "Rust", "WebAssembly"],
    },
  },
  {
    id: "5",
    company: "Notion",
    domain: "notion.so",
    role: "Product Designer",
    location: "Remote / US",
    dateApplied: "Oct 15, 2023",
    dateLabel: "11 days ago",
    status: "Interviewing",
    interestLevel: "high",
    tags: ["Remote", "Full-time"],
    description:
      "Notion is looking for a Product Designer to reimagine how teams collaborate with docs, wikings, and projects in one unified workspace.",
    requirements: [
      "4+ years of product design experience.",
      "Strong portfolio with deep interaction design craft.",
      "Experience with collaborative or productivity tools.",
    ],
    timeline: [
      {
        id: "n1",
        title: "Portfolio Review",
        description: "Presented the design system project to the design team.",
        date: "Oct 18",
        status: "completed",
      },
      {
        id: "n2",
        title: "Product Sense Interview",
        description: "Case study on improving the Notion AI experience.",
        date: "Oct 26",
        status: "upcoming",
        type: "Technical",
      },
      {
        id: "n3",
        title: "Cross-functional Panel",
        description: "Meeting with engineering, product, and leadership.",
        date: "Nov 2",
        status: "upcoming",
        type: "On-site",
      },
    ],
    contacts: [
      {
        email: "alice.chen@airbnb.com",
        initials: "AC",
        name: "Alice Chen",
        role: "Design Recruiter",
      },
      {
        email: "mike.torres@airbnb.com",
        initials: "MT",
        name: "Mike Torres",
        role: "VP of Design",
      },
    ],
    aiMatch: {
      score: 78,
      summary:
        "Good alignment with product design craft and collaboration tools experience. Consider emphasizing AI-related design work more prominently.",
      keywords: [
        { keyword: "Interaction Design", match: true },
        { keyword: "Figma", match: true },
        { keyword: "Design Systems", match: true },
        { keyword: "AI/ML", match: false },
        { keyword: "Collaboration Tools", match: true },
      ],
      recommendation: "Apply to CV",
      currentSummary:
        "Product Designer with 5 years creating user interfaces and design systems for web applications.",
      enhancedSummary:
        "Product Designer focused on collaborative and AI-enhanced experiences. Designed intuitive interfaces for productivity tools used by millions, with a strong emphasis on interaction design and systematic thinking.",
      bulletOptimizations: [
        {
          original: "Designed the onboarding flow.",
          enhanced:
            '"Redesigned the onboarding flow for a productivity app, reducing time-to-value by 40% and increasing activation by 25%."',
        },
        {
          original: "Built a design system.",
          enhanced:
            '"Developed and maintained a design system with 80+ components, ensuring consistency across 3 product platforms."',
        },
      ],
      yourSkills: ["Figma", "UI Design", "Interaction Design"],
      suggestedSkills: ["AI/UX", "Motion Design", "Design Strategy"],
    },
  },
  {
    id: "6",
    company: "Figma",
    domain: "figma.com",
    role: "Design Advocate",
    location: "San Francisco, CA",
    dateApplied: "Oct 12, 2023",
    dateLabel: "14 days ago",
    status: "Rejected",
    interestLevel: "medium",
    tags: ["On-site"],
  },
  {
    id: "7",
    company: "Airbnb",
    domain: "airbnb.com",
    role: "Staff Product Designer",
    location: "Remote / US",
    dateApplied: "Oct 10, 2023",
    dateLabel: "16 days ago",
    status: "Applied",
    interestLevel: "high",
    tags: ["Remote", "Full-time"],
  },
  {
    id: "8",
    company: "Supabase",
    domain: "supabase.com",
    role: "Frontend Engineer",
    location: "Remote / Global",
    dateApplied: "Oct 8, 2023",
    dateLabel: "18 days ago",
    status: "Interviewing",
    interestLevel: "medium",
    tags: ["Remote", "Open Source"],
  },
  {
    id: "9",
    company: "Datadog",
    domain: "datadoghq.com",
    role: "UX Engineer",
    location: "New York, NY",
    dateApplied: "Oct 5, 2023",
    dateLabel: "21 days ago",
    status: "Applied",
    interestLevel: "medium",
    tags: ["Hybrid", "Full-time"],
  },
  {
    id: "10",
    company: "Raycast",
    domain: "raycast.com",
    role: "Design Engineer",
    location: "Remote / EU",
    dateApplied: "Oct 2, 2023",
    dateLabel: "24 days ago",
    status: "Rejected",
    interestLevel: "low",
    tags: ["Remote", "Small Team"],
  },
  {
    id: "11",
    company: "Cal.com",
    domain: "cal.com",
    role: "Senior Frontend Engineer",
    location: "Remote / Global",
    dateApplied: "Sep 28, 2023",
    dateLabel: "28 days ago",
    status: "Offer",
    interestLevel: "medium",
    tags: ["Remote", "Open Source"],
  },
  {
    id: "12",
    company: "GitHub",
    domain: "github.com",
    role: "Design Infrastructure Engineer",
    location: "Remote / US",
    dateApplied: "Sep 25, 2023",
    dateLabel: "1 month ago",
    status: "Interviewing",
    interestLevel: "high",
    tags: ["Remote", "Benefits"],
  },
];

export const mockProfile: Profile = {
  id: "p1",
  fullName: "Alex Rivera",
  title: "Senior UI/UX",
  headline:
    "Crafting seamless digital experiences through systematic design and user-centric problem solving. Currently open to roles in FinTech and Healthcare sectors.",
  summary: "Product Designer with 5 years experience building web apps.",
  location: "San Francisco, CA",
  email: "alex.rivera@trackly.io",
  portfolio: "portfolio.alexr.design",
  experiences: [
    {
      id: "e1",
      title: "Senior Product Designer",
      company: "Flow Systems",
      period: "Jan 2021 — Present",
      icon: "corporate_fare",
      achievements: [
        "Led the design of a new enterprise SaaS platform, resulting in a 40% increase in user productivity within the first quarter of launch.",
        "Mentored a team of 4 junior designers and established a comprehensive design system now used across 3 major product lines.",
      ],
    },
    {
      id: "e2",
      title: "UI/UX Designer",
      company: "Creative Core Agency",
      period: "Aug 2018 — Dec 2020",
      icon: "palette",
      achievements: [
        "Shipped over 15 client projects ranging from mobile apps to responsive marketing websites for Fortune 500 companies.",
      ],
    },
  ],
  skills: [
    {
      name: "Design",
      icon: "design_services",
      skills: [
        "Figma",
        "Adobe XD",
        "Design Systems",
        "Prototyping",
        "User Research",
        "UI/UX Architecture",
      ],
    },
    {
      name: "Development",
      icon: "code",
      color: "tertiary",
      skills: ["HTML/CSS", "Tailwind CSS", "React Basics", "GitHub"],
    },
    {
      name: "Soft Skills",
      icon: "groups",
      color: "secondary",
      skills: ["Leadership", "Stakeholder Management", "Public Speaking", "Strategic Thinking"],
    },
  ],
  education: [
    {
      id: "edu1",
      degree: "B.S. in Interaction Design",
      institution: "California Institute of the Arts",
      period: "2014 — 2018",
      icon: "school",
    },
    {
      id: "edu2",
      degree: "Google UX Design Professional Certificate",
      institution: "Coursera / Google",
      period: "Issued Dec 2022",
      icon: "workspace_premium",
    },
  ],
  documents: [
    {
      id: "doc1",
      name: "Rivera_Resume_2024.pdf",
      size: "1.2 MB",
      uploaded: "2 days ago",
      isMaster: true,
    },
    {
      id: "doc2",
      name: "Rivera_Product_Lead_V2.pdf",
      size: "840 KB",
      uploaded: "1 month ago",
    },
  ],
};

export const mockDashboardStats: DashboardStats = {
  totalApplications: 42,
  activeInterviews: 5,
  offers: 2,
  rejectionRate: 15,
  weeklyTrend: [7, 10, 15, 20, 22, 28, 20, 14],
  applicationsByStatus: [
    { status: "Applied", count: 24 },
    { status: "Interviewing", count: 5 },
    { status: "Offer", count: 2 },
    { status: "Rejected", count: 11 },
  ],
  kpis: {
    totalApplications: { value: 42, label: "+12% vs last mo", positive: true },
    activeInterviews: { value: 5, label: "In Progress", positive: true },
    offers: { value: 2, label: "Milestone", positive: true },
    rejectionRate: { value: 15, label: "-3% improvement", positive: true },
  },
  statusDistributionTotal: 42,
  sankey: {
    nodes: [
      { id: "all-applications", label: "All applications", count: 42 },
      { id: "applied", label: "Applied", count: 24 },
      { id: "interview", label: "Interview", count: 5 },
      { id: "offer", label: "Offer", count: 2 },
      { id: "rejected", label: "Rejected", count: 11 },
    ],
    links: [
      { source: "all-applications", target: "applied", value: 24 },
      { source: "all-applications", target: "interview", value: 5 },
      { source: "all-applications", target: "offer", value: 2 },
      { source: "all-applications", target: "rejected", value: 11 },
    ],
  },
  upcomingInterviews: [
    {
      jobApplicationId: "1",
      month: "Jun",
      day: 12,
      time: "10:00 AM",
      company: "Stripe, Inc.",
      role: "Senior UI Designer",
      meetType: "video_call",
      meetLabel: "Zoom",
    },
    {
      jobApplicationId: "2",
      month: "Jun",
      day: 14,
      time: "02:30 PM",
      company: "Airbnb",
      role: "Product Lead",
      meetType: "person",
      meetLabel: "On-site",
    },
    {
      jobApplicationId: "3",
      month: "Jun",
      day: 18,
      time: "11:00 AM",
      company: "Linear",
      role: "Senior Frontend Engineer",
      meetType: "video_call",
      meetLabel: "Google Meet",
    },
    {
      jobApplicationId: "4",
      month: "Jun",
      day: 20,
      time: "01:00 PM",
      company: "Notion",
      role: "Product Designer",
      meetType: "person",
      meetLabel: "On-site",
    },
  ],
};
