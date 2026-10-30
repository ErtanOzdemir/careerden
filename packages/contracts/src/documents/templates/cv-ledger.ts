export const cvLedgerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{full_name}} - CV</title>
    <style>
      @page {
        size: A4;
        margin: 20mm 20mm 18mm 20mm;
      }
      @page :first {
        @bottom-center {
          content: none;
        }
      }
      @page {
        @bottom-center {
          content: "{{full_name}}";
          color: #a1a1aa;
          font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
          font-size: 8pt;
          font-style: italic;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #27272a;
        font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
        font-size: 10pt;
        line-height: 1.5;
        margin: 0;
        padding: 0;
      }
      header {
        border-bottom: 3px double #18181b;
        border-top: 3px double #18181b;
        padding: 14px 0 12px;
        text-align: center;
      }
      h1 {
        color: #18181b;
        font-size: 24pt;
        font-weight: 400;
        letter-spacing: 0.04em;
        margin: 0;
      }
      .title {
        color: #52525b;
        font-size: 10.5pt;
        font-style: italic;
        margin: 2px 0 0;
      }
      .contact {
        color: #52525b;
        font-size: 8.5pt;
        margin: 8px 0 0;
      }
      .contact span:not(:last-child)::after {
        content: "◆";
        font-size: 6pt;
        margin: 0 8px;
        vertical-align: 1px;
      }
      section {
        margin-top: 20px;
      }
      section > h2 {
        break-after: avoid;
        border-bottom: 1px solid #18181b;
        color: #18181b;
        font-size: 10pt;
        font-variant: small-caps;
        font-weight: 700;
        letter-spacing: 0.1em;
        margin: 0 0 10px;
        padding-bottom: 3px;
      }
      h3 {
        break-after: avoid;
        color: #18181b;
        font-size: 10pt;
        font-weight: 700;
        margin: 0 0 1px;
      }
      p {
        margin: 3px 0;
      }
      em {
        color: #52525b;
        font-size: 9pt;
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
      .items > li {
        margin-bottom: 12px;
        position: relative;
      }
      .items > li:last-child {
        margin-bottom: 0;
      }
      .items > li > h3 {
        padding-right: 42mm;
      }
      .items > li > h3 + p:has(> em:only-child) {
        margin: 0;
        position: absolute;
        right: 0;
        top: 0;
      }
      .inline-list {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        justify-content: center;
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
      }
      .inline-list li {
        color: #52525b;
        font-size: 8.5pt;
      }
      .skills-list {
        columns: 3;
        column-gap: 18px;
        margin: 0;
        padding-left: 14px;
      }
      .skills-list li {
        break-inside: avoid;
        margin-bottom: 2px;
      }
      .cert-list {
        columns: 2;
        column-gap: 18px;
        margin: 0;
        padding-left: 14px;
      }
      .cert-list li {
        break-inside: avoid;
        margin-bottom: 3px;
      }
      a {
        color: inherit;
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
    {{/experience_content}} {{#education_content}}
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
    {{/project_content}} {{#skills}}
    <section>
      <h2>Skills</h2>
      <ul class="skills-list" data-field-ref="skills">
        {{skills}}
      </ul>
    </section>
    {{/skills}} {{#certifications}}
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
