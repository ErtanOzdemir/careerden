export const cvTechnicalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{full_name}} - CV</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 18mm 18mm 18mm;
      }
      @page :first {
        @top-left {
          content: none;
        }
      }
      @page {
        @top-left {
          content: "{{full_name}}";
          color: #94a3b8;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 7.5pt;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #1f2937;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.55;
        margin: 0;
        padding: 0;
      }
      header {
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 14px;
      }
      h1 {
        color: #111827;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 21pt;
        font-weight: 600;
        letter-spacing: -0.02em;
        margin: 0;
      }
      .title {
        color: #0f766e;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 9.5pt;
        margin: 4px 0 0;
      }
      .contact {
        color: #6b7280;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 8pt;
        margin: 10px 0 0;
      }
      .contact span:not(:last-child)::after {
        color: #d1d5db;
        content: "//";
        margin: 0 8px;
      }
      section {
        margin-top: 20px;
      }
      section > h2 {
        break-after: avoid;
        color: #0f766e;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 10pt;
        font-weight: 600;
        margin: 0 0 10px;
      }
      section > h2::before {
        color: #99f6e4;
        content: "## ";
      }
      h3 {
        break-after: avoid;
        color: #111827;
        font-size: 9.5pt;
        font-weight: 600;
        margin: 0 0 1px;
      }
      p {
        margin: 3px 0;
      }
      em {
        color: #6b7280;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 7.5pt;
        font-style: normal;
      }
      ul {
        margin: 4px 0;
        padding-left: 16px;
      }
      ul li::marker {
        color: #0f766e;
      }
      .items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .items > li {
        border-left: 2px solid #ccfbf1;
        margin-bottom: 12px;
        padding-left: 12px;
      }
      .items > li:last-child {
        margin-bottom: 0;
      }
      .inline-list {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
      }
      .inline-list li {
        color: #0f766e;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 8pt;
      }
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .skills-list li {
        border: 1px solid #d1d5db;
        border-radius: 3px;
        color: #374151;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 7.5pt;
        padding: 2px 7px;
      }
      .cert-list {
        margin: 0;
        padding-left: 16px;
      }
      .cert-list li {
        margin-bottom: 4px;
      }
      a {
        color: #0f766e;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>{{full_name}}</h1>
      {{#profile_title}}
      <p class="title">{{profile_title}}</p>
      {{/profile_title}}
      <p class="contact">
        {{#email}}<span>{{email}}</span>{{/email}}
        {{#location}}<span>{{location}}</span>{{/location}}
      </p>
      {{#links}}
      <ul class="inline-list">
        {{links}}
      </ul>
      {{/links}}
    </header>

    {{#summary}}
    <section>
      <h2>Profile</h2>
      <div data-field-ref="summary">{{summary}}</div>
    </section>
    {{/summary}} {{#skills}}
    <section>
      <h2>Skills</h2>
      <ul class="skills-list" data-field-ref="skills">
        {{skills}}
      </ul>
    </section>
    {{/skills}} {{#experience_content}}
    <section>
      <h2>Experience</h2>
      <ul class="items">
        {{experience_content}}
      </ul>
    </section>
    {{/experience_content}} {{#project_content}}
    <section>
      <h2>Projects</h2>
      <ul class="items">
        {{project_content}}
      </ul>
    </section>
    {{/project_content}} {{#education_content}}
    <section>
      <h2>Education</h2>
      <ul class="items">
        {{education_content}}
      </ul>
    </section>
    {{/education_content}} {{#certifications}}
    <section>
      <h2>Certifications</h2>
      <ul class="cert-list" data-field-ref="certifications">
        {{certifications}}
      </ul>
    </section>
    {{/certifications}}
  </body>
</html>
`;
