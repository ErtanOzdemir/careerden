export const coverLetterDefaultHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{{full_name}} - Cover Letter</title>
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
        line-height: 1.65;
        margin: 0;
        padding: 0;
      }
      header {
        border-bottom: 3px solid #2563eb;
        padding-bottom: 18px;
      }
      h1 {
        color: #0f172a;
        font-size: 19pt;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0;
      }
      .contact {
        color: #64748b;
        font-size: 9.5pt;
        margin: 8px 0 0;
      }
      .contact span:not(:last-child)::after {
        color: #cbd5e1;
        content: "•";
        margin: 0 8px;
      }
      .body {
        margin-top: 30px;
      }
      .body p {
        margin: 0 0 14px;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    {{#full_name}}
    <header>
      <h1>{{full_name}}</h1>
      <p class="contact">
        {{#email}}<span>{{email}}</span>{{/email}}
        {{#location}}<span>{{location}}</span>{{/location}}
      </p>
    </header>
    {{/full_name}}
    <div class="body">{{cover_letter_content}}</div>
  </body>
</html>
`;
