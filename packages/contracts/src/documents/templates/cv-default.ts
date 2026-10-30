export const cvDefaultHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{full_name}} - CV</title>
    <style>
      @page {
        size: A4;
        margin: 22mm 18mm 18mm 18mm;
      }
      @page :first {
        @top-center {
          content: none;
        }
      }
      @page {
        @top-center {
          content: "{{full_name}}";
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 8pt;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.55;
        margin: 0;
        padding: 0;
      }
      header {
        border-bottom: 3px solid #2563eb;
        padding-bottom: 18px;
        text-align: center;
      }
      h1 {
        color: #0f172a;
        font-size: 25pt;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0;
      }
      .title {
        color: #2563eb;
        font-size: 11.5pt;
        font-weight: 600;
        margin: 6px 0 0;
      }
      .contact {
        color: #64748b;
        font-size: 9.5pt;
        margin: 10px 0 0;
      }
      .contact span:not(:last-child)::after {
        color: #cbd5e1;
        content: "•";
        margin: 0 8px;
      }
      section {
        margin-top: 26px;
      }
      section > h2 {
        break-after: avoid;
        border-bottom: 1.5px solid #e2e8f0;
        color: #2563eb;
        font-size: 10.5pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        margin: 0 0 12px;
        padding-bottom: 6px;
        text-transform: uppercase;
      }
      h3 {
        break-after: avoid;
        color: #0f172a;
        font-size: 10.5pt;
        font-weight: 700;
        margin: 0 0 2px;
      }
      p {
        margin: 4px 0;
      }
      em {
        color: #64748b;
        font-size: 9.5pt;
        font-style: italic;
      }
      ul {
        margin: 6px 0;
        padding-left: 18px;
      }
      .items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .items > li {
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 16px;
        padding-bottom: 16px;
      }
      .items > li:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      .inline-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
      }
      .inline-list li {
        color: #64748b;
        display: inline;
        font-size: 9.5pt;
      }
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
      }
      .skills-list li {
        background: #eff6ff;
        border-radius: 999px;
        color: #1d4ed8;
        font-size: 9pt;
        font-weight: 500;
        padding: 4px 13px;
      }
      .cert-list {
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
      }
      .cert-list li {
        margin-bottom: 6px;
        padding-left: 16px;
        position: relative;
      }
      .cert-list li::before {
        color: #2563eb;
        content: "▪";
        left: 0;
        position: absolute;
      }
      a {
        color: #2563eb;
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
    {{/summary}} {{#experience_content}}
    <section>
      <h2>Experience</h2>
      <ul class="items">
        {{experience_content}}
      </ul>
    </section>
    {{/experience_content}} {{#skills}}
    <section>
      <h2>Skills</h2>
      <ul class="skills-list" data-field-ref="skills">
        {{skills}}
      </ul>
    </section>
    {{/skills}} {{#education_content}}
    <section>
      <h2>Education</h2>
      <ul class="items">
        {{education_content}}
      </ul>
    </section>
    {{/education_content}} {{#project_content}}
    <section>
      <h2>Projects</h2>
      <ul class="items">
        {{project_content}}
      </ul>
    </section>
    {{/project_content}} {{#certifications}}
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
