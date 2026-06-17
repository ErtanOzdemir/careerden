import { Link, useParams } from "react-router-dom";
import { mockApplications } from "../mockData";
import Timeline from "../components/Timeline";
import AiMatchCard from "../components/AiMatchCard";

export default function AppDetail() {
  const { id } = useParams();
  const app = mockApplications.find((a) => a.id === id);

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl gap-4">
        <span className="material-symbols-outlined text-6xl text-outline">
          search_off
        </span>
        <p className="font-headline-md">Application not found</p>
        <Link
          to="/applications"
          className="text-primary font-label-md hover:underline"
        >
          Back to Applications
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-max-width mx-auto">
      <nav className="flex items-center gap-2 mb-lg text-on-surface-variant pt-lg">
        <Link
          to="/applications"
          className="hover:text-primary transition-colors flex items-center gap-1 font-label-md"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back to Boards
        </Link>
      </nav>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-2xl">
        <div>
          <h2 className="font-display font-headline-lg text-on-surface">
            {app.role}
          </h2>
          <p className="font-body-lg text-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">
              corporate_fare
            </span>
            {app.company}, Inc. &bull; {app.location}
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <div className="bg-surface-container-high px-4 py-2 rounded-lg flex items-center gap-3 border border-outline-variant">
            <span className="font-label-md text-on-surface-variant">
              Status:
            </span>
            <select className="bg-transparent border-none font-bold text-primary focus:ring-0 cursor-pointer p-0 pr-8 outline-none">
              <option>Applied</option>
              <option selected={app.status === "Interviewing"}>
                Interviewing
              </option>
              <option>Offer Received</option>
              <option>Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7 space-y-lg">
          {app.description && (
            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-md">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    description
                  </span>
                  Role Summary
                </h3>
                <span className="text-label-md text-secondary">
                  Scraped 2 days ago
                </span>
              </div>
              <div className="font-body-md text-on-surface-variant space-y-md">
                <p>{app.description}</p>
                {app.requirements && (
                  <ul className="list-disc pl-5 space-y-sm">
                    {app.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {app.timeline && (
            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-lg">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    event_upcoming
                  </span>
                  Interview Timeline
                </h3>
                <button className="flex items-center gap-1 text-primary font-label-md hover:underline cursor-pointer">
                  <span className="material-symbols-outlined text-[18px]">
                    add_circle
                  </span>
                  Add Milestone
                </button>
              </div>
              <Timeline milestones={app.timeline} />
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            {app.contacts && (
              <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-md">
                  <h3 className="font-display font-headline-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      contacts
                    </span>
                    Key Contacts
                  </h3>
                  <button className="text-primary material-symbols-outlined hover:bg-surface-container-high rounded-full p-1 transition-colors cursor-pointer">
                    person_add
                  </button>
                </div>
                <div className="space-y-md flex-1">
                  {app.contacts.map((contact, i) => (
                    <div key={i} className="flex items-center gap-sm">
                      <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold">
                        {contact.initials}
                      </div>
                      <div>
                        <div className="font-body-md font-bold">
                          {contact.name}
                        </div>
                        <div className="font-label-md text-secondary">
                          {contact.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-md">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    edit_note
                  </span>
                  Interview Notes
                </h3>
                <div className="flex gap-1">
                  <button
                    className="text-secondary hover:text-error material-symbols-outlined text-[20px] transition-colors cursor-pointer"
                    title="Clear"
                  >
                    delete
                  </button>
                  <button className="text-primary hover:bg-primary/10 px-2 rounded font-label-md transition-colors cursor-pointer">
                    Save
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col bg-surface-container-low rounded-lg p-sm">
                <div className="flex gap-2 border-b border-outline-variant pb-1 mb-2">
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_bold
                  </button>
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_italic
                  </button>
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_list_bulleted
                  </button>
                </div>
                <textarea
                  className="w-full h-24 p-0 border-none bg-transparent focus:ring-0 text-body-md text-on-surface-variant resize-none custom-scrollbar outline-none"
                  placeholder="Start typing your prep notes..."
                />
              </div>
            </section>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-lg">
            {app.aiMatch && <AiMatchCard aiMatch={app.aiMatch} />}

            <div className="bg-surface-container-high p-lg rounded-xl border border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-primary border border-outline-variant">
                  <span className="material-symbols-outlined">attachment</span>
                </div>
                <div>
                  <div className="font-body-md font-bold">
                    Original Resume.pdf
                  </div>
                  <div className="font-label-md text-secondary">
                    Uploaded Sep 15, 2023
                  </div>
                </div>
              </div>
              <button className="text-secondary hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
