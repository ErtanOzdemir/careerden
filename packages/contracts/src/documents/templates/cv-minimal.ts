export const cvMinimalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{full_name}} - CV</title>
    <style>
      @page {
        size: A4;
        margin: 24mm 22mm 20mm 22mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        background: #ffffff;
        color: #262626;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.6;
        margin: 0;
        padding: 0;
      }
      h1 {
        color: #0a0a0a;
        font-size: 22pt;
        font-weight: 300;
        letter-spacing: -0.01em;
        margin: 0;
      }
      .title {
        color: #525252;
        font-size: 10.5pt;
        margin: 2px 0 0;
      }
      .contact {
        color: #737373;
        font-size: 8.5pt;
        margin: 14px 0 0;
      }
      .contact span:not(:last-child)::after {
        content: "/";
        margin: 0 8px;
      }
      section {
        border-top: 0.5px solid #d4d4d4;
        margin-top: 22px;
        padding-top: 14px;
      }
      section > h2 {
        break-after: avoid;
        color: #737373;
        font-size: 8pt;
        font-weight: 500;
        letter-spacing: 0.16em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }
      h3 {
        break-after: avoid;
        color: #0a0a0a;
        font-size: 9.5pt;
        font-weight: 500;
        margin: 0;
      }
      p {
        margin: 3px 0;
      }
      em {
        color: #737373;
        font-size: 8.5pt;
        font-style: normal;
      }
      ul {
        margin: 4px 0;
        padding-left: 14px;
      }
      .items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .items > li {
        margin-bottom: 14px;
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
        color: #737373;
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
        color: #a3a3a3;
        content: " · ";
      }
      .cert-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .cert-list li {
        margin-bottom: 4px;
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
