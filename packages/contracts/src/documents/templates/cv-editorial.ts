export const cvEditorialHtml = `<!doctype html>
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
        @top-center {
          content: none;
        }
      }
      @page {
        @top-center {
          content: "{{full_name}}";
          color: #a8a29e;
          font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
          font-size: 8.5pt;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #292524;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.55;
        margin: 0;
        padding: 0;
      }
      h1 {
        color: #1c1917;
        font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
        font-size: 27pt;
        font-weight: 400;
        letter-spacing: -0.01em;
        margin: 0;
      }
      .title {
        color: #8c3b33;
        font-size: 10.5pt;
        margin: 4px 0 0;
      }
      .contact {
        color: #78716c;
        font-size: 8.5pt;
        margin: 12px 0 0;
      }
      .contact span:not(:last-child)::after {
        content: "·";
        margin: 0 7px;
      }
      section {
        margin-top: 22px;
      }
      section > h2 {
        break-after: avoid;
        color: #8c3b33;
        font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
        font-size: 13pt;
        font-weight: 400;
        margin: 0 0 10px;
      }
      h3 {
        break-after: avoid;
        color: #1c1917;
        font-size: 9.5pt;
        font-weight: 600;
        margin: 0 0 2px;
      }
      p {
        margin: 3px 0;
      }
      em {
        color: #78716c;
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
      .items > li {
        margin-bottom: 14px;
        position: relative;
      }
      .items > li:last-child {
        margin-bottom: 0;
      }
      .items > li > h3 {
        padding-right: 40mm;
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
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
      }
      .inline-list li {
        color: #78716c;
        font-size: 8.5pt;
      }
      .skills-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .skills-list li {
        display: inline;
      }
      .skills-list li:not(:last-child)::after {
        color: #a8a29e;
        content: ", ";
      }
      .skill-group + .skill-group {
        margin-top: 3px;
      }
      .skill-group-name {
        color: inherit;
        display: inline;
        font-size: inherit;
        font-weight: 600;
        margin: 0;
      }
      .skill-group-name::after {
        content: ": ";
      }
      .skill-group .skills-list {
        display: inline;
      }
      .cert-list {
        margin: 0;
        padding-left: 16px;
      }
      .cert-list li {
        margin-bottom: 4px;
      }
      a {
        color: #8c3b33;
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
      <div class="skill-groups" data-field-ref="skills">{{skill_groups}}</div>
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
