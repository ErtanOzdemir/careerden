import { useState } from "react";
import type { JobApplication } from "../types";

interface AiMatchCardProps {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
}

const tabs = ["Analysis", "Summary", "Experience", "Skills"] as const;

export default function AiMatchCard({ aiMatch }: AiMatchCardProps) {
  const [activeTab, setActiveTab] = useState<string>("Analysis");

  const scoreRadius = 56;
  const circumference = 2 * Math.PI * scoreRadius;
  const offset =
    circumference - (aiMatch.score / 100) * circumference;

  return (
    <section className="bg-inverse-surface text-inverse-on-surface p-lg rounded-xl shadow-lg relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary opacity-20 rounded-full blur-3xl" />
      <div className="flex items-center justify-between mb-lg relative">
        <h3 className="font-display font-headline-md flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-fixed-dim">
            auto_awesome
          </span>
          AI Match Intelligence
        </h3>
        <span className="bg-primary px-3 py-1 rounded-full text-label-sm font-bold text-on-primary">
          BETA
        </span>
      </div>

      <div className="flex border-b border-outline/20 mb-lg overflow-x-auto custom-scrollbar relative z-10">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-label-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab
                ? "text-primary-fixed-dim border-b-2 border-primary-fixed-dim"
                : "text-inverse-on-surface opacity-60 hover:opacity-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Analysis" && (
        <div className="space-y-lg relative z-10 animate-fade-in">
          <div className="flex flex-col items-center mb-xl">
            <div className="relative w-32 h-32 flex items-center justify-center mb-md">
              <svg className="w-full h-full -rotate-90">
                <circle
                  className="text-on-surface-variant opacity-30"
                  cx="64"
                  cy="64"
                  fill="transparent"
                  r={scoreRadius}
                  stroke="currentColor"
                  strokeWidth="8"
                />
                <circle
                  className="text-primary-fixed-dim"
                  cx="64"
                  cy="64"
                  fill="transparent"
                  r={scoreRadius}
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-display text-primary-fixed-dim leading-none">
                  {aiMatch.score}
                </span>
                <span className="text-label-sm uppercase opacity-70">
                  Match
                </span>
              </div>
            </div>
            <p className="text-body-md text-center px-4 opacity-80 italic">
              {aiMatch.summary}
            </p>
          </div>
          <div>
            <h4 className="text-label-md font-bold uppercase mb-sm opacity-60">
              Keyword Analysis
            </h4>
            <div className="flex flex-wrap gap-2">
              {aiMatch.keywords.map((kw) => (
                <span
                  key={kw.keyword}
                  className={`px-3 py-1 rounded-full text-label-sm border flex items-center gap-1 ${
                    kw.match
                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {kw.match ? "check" : "close"}
                  </span>
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Summary" && (
        <div className="space-y-md relative z-10 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-label-md font-bold uppercase opacity-60">
              AI Recommendation
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-label-sm opacity-70">
                {aiMatch.recommendation}
              </span>
              <div className="w-8 h-4 bg-primary rounded-full relative">
                <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
              </div>
            </div>
          </div>
          <div className="bg-surface-container-highest/20 rounded-lg p-md border border-outline/30">
            <div className="flex justify-between items-start mb-2">
              <span className="text-label-sm bg-primary/20 text-primary-fixed-dim px-2 py-0.5 rounded">
                Current
              </span>
              <button className="material-symbols-outlined text-primary-fixed-dim text-[18px] cursor-pointer">
                edit
              </button>
            </div>
            <p className="text-body-md opacity-70">{aiMatch.currentSummary}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-md border border-primary-fixed-dim/30">
            <span className="text-label-sm bg-green-500/20 text-green-300 px-2 py-0.5 rounded mb-2 inline-block">
              AI Enhanced
            </span>
            <p className="text-body-md text-inverse-on-surface">
              {aiMatch.enhancedSummary}
            </p>
          </div>
        </div>
      )}

      {activeTab === "Experience" && (
        <div className="space-y-lg relative z-10 animate-fade-in">
          {aiMatch.experienceOptimizations && aiMatch.experienceOptimizations.length > 0 ? (
            aiMatch.experienceOptimizations.map((exp, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-md">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">
                    corporate_fare
                  </span>
                  <div>
                    <h5 className="text-body-md font-bold text-inverse-on-surface">
                      {exp.title}
                    </h5>
                    <p className="text-label-sm opacity-60">{exp.company}</p>
                  </div>
                </div>
                <div className="space-y-md ml-1">
                  <div className="bg-surface-container-highest/20 rounded-lg p-md border border-outline/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-label-sm bg-primary/20 text-primary-fixed-dim px-2 py-0.5 rounded">
                        Current
                      </span>
                      <button className="material-symbols-outlined text-primary-fixed-dim text-[18px] cursor-pointer">
                        edit
                      </button>
                    </div>
                    <ul className="space-y-sm">
                      {exp.originalAchievements.map((ach, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-fixed-dim shrink-0 opacity-60" />
                          <p className="text-body-md opacity-70">{ach}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-md border border-primary-fixed-dim/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-label-sm bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                        AI Enhanced
                      </span>
                      <button className="text-primary-fixed-dim shrink-0 cursor-pointer text-label-md font-bold">
                        Apply
                      </button>
                    </div>
                    <ul className="space-y-sm">
                      {exp.enhancedAchievements.map((ach, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          <p className="text-body-md text-inverse-on-surface italic">
                            {ach}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-lg">
              <h4 className="text-label-md font-bold uppercase opacity-60">
                Bullet Point Optimization
              </h4>
              {aiMatch.bulletOptimizations.map((opt, i) => (
                <div key={i} className="space-y-md">
                  <div className="bg-surface-container-highest/20 rounded-lg p-md border border-outline/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-label-sm bg-primary/20 text-primary-fixed-dim px-2 py-0.5 rounded">
                        Current
                      </span>
                      <button className="material-symbols-outlined text-primary-fixed-dim text-[18px] cursor-pointer">
                        edit
                      </button>
                    </div>
                    <p className="text-body-md opacity-70">{opt.original}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-md border border-primary-fixed-dim/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-label-sm bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                        AI Enhanced
                      </span>
                      <button className="text-primary-fixed-dim shrink-0 cursor-pointer text-label-md font-bold">
                        Apply
                      </button>
                    </div>
                    <p className="text-body-md text-inverse-on-surface italic">
                      {opt.enhanced}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "Skills" && (
        <div className="space-y-md relative z-10 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-label-md font-bold uppercase opacity-60 mb-2">
                Your Skills
              </h4>
              <div className="flex flex-wrap gap-1">
                {aiMatch.yourSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 bg-surface-container-highest/20 rounded text-label-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-label-md font-bold uppercase text-primary-fixed-dim mb-2">
                AI Suggested
              </h4>
              <div className="flex flex-wrap gap-1">
                {aiMatch.suggestedSkills.map((skill) => (
                  <button
                    key={skill}
                    className="px-2 py-0.5 bg-primary/20 border border-primary/40 rounded text-label-sm flex items-center gap-1 hover:bg-primary/40 transition-colors cursor-pointer"
                  >
                    {skill}{" "}
                    <span className="material-symbols-outlined text-[14px]">
                      add
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <button className="w-full py-4 bg-primary-container text-on-primary-container font-display font-headline-md rounded-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-3 mt-xl relative z-10 cursor-pointer">
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          file_download
        </span>
        Export Personalized CV
      </button>
    </section>
  );
}
