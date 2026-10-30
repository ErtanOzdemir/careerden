export const cvModernHtml = `<!doctype html>
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
        @top-right {
          content: none;
        }
      }
      @page {
        @top-right {
          content: "{{full_name}}";
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 8pt;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.55;
        margin: 0;
        padding: 0;
      }
      header {
        border-left: 4px solid #1d4ed8;
        padding-left: 14px;
      }
      h1 {
        color: #0f172a;
        font-size: 24pt;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0;
      }
      .title {
        color: #1d4ed8;
        font-size: 11pt;
        font-weight: 500;
        margin: 2px 0 0;
      }
      .contact {
        color: #64748b;
        font-size: 8.5pt;
        margin: 8px 0 0;
      }
      .contact span:not(:last-child)::after {
        color: #cbd5e1;
        content: "|";
        margin: 0 8px;
      }
      section {
        margin-top: 22px;
      }
      section > h2 {
        break-after: avoid;
        align-items: center;
        color: #1d4ed8;
        display: flex;
        font-size: 9pt;
        font-weight: 700;
        gap: 10px;
        letter-spacing: 0.1em;
        margin: 0 0 12px;
        text-transform: uppercase;
      }
      section > h2::after {
        background: #bfdbfe;
        content: "";
        flex: 1;
        height: 1px;
      }
      h3 {
        break-after: avoid;
        color: #0f172a;
        font-size: 10pt;
        font-weight: 600;
        margin: 0 0 2px;
      }
      p {
        margin: 3px 0;
      }
      em {
        color: #64748b;
        font-size: 8.5pt;
        font-style: normal;
      }
      ul {
        margin: 4px 0;
        padding-left: 16px;
      }
      .items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      /* The meta line (dates, degree, links) sits in its own column beside the entry, so a long
         one makes the entry taller instead of overlapping the next one. */
      .items > li {
        column-gap: 6mm;
        display: grid;
        grid-template-columns: 36mm minmax(0, 1fr);
        margin-bottom: 14px;
      }
      .items > li:last-child {
        margin-bottom: 0;
      }
      /* Kept weaker than one attribute selector: Paged.js rewrites the sibling selector below into
         one, and it must still win. grid-column has no effect on other lists' items. */
      li > * {
        grid-column: 2;
      }
      .items > li > h3 + p:has(> em:only-child) {
        grid-column: 1;
        grid-row: 1 / span 20;
        margin: 0;
        overflow-wrap: anywhere;
        padding-top: 1px;
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
        color: #1d4ed8;
        font-size: 8.5pt;
      }
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .skills-list li {
        background: #eff6ff;
        border-radius: 4px;
        color: #1e40af;
        font-size: 8.5pt;
        padding: 3px 9px;
      }
      .cert-list {
        margin: 0;
        padding-left: 16px;
      }
      .cert-list li {
        margin-bottom: 4px;
      }
      a {
        color: #1d4ed8;
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
