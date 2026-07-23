# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Careerden, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email **mail@ozdemirertan.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. You should receive an acknowledgment within **48 hours**.

3. We will work with you to understand and address the issue before any public disclosure.

### What to Expect

- **Acknowledgment**: Within 48 hours of your report.
- **Assessment**: We will assess the severity and impact.
- **Fix**: We will develop and test a fix.
- **Disclosure**: We will coordinate with you on the timing of public disclosure.
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous).

### Scope

This security policy applies to:

- The latest release of Careerden
- The main branch of this repository

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations and data destruction
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a vulnerability beyond what is necessary to confirm its existence
- Report vulnerabilities promptly

We will not take legal action against researchers who follow these guidelines.

## Security Best Practices

When deploying Careerden:

- Use environment variables for all secrets (API keys, database URLs, session secrets).
- Never commit `.env` files to version control.
- Use strong, unique values for `LINKEDIN_SESSION_SECRET`.
- Keep dependencies updated regularly.
- Use HTTPS in production.
- Restrict database access to trusted networks.
- Never embed GitHub tokens or private-repository credentials in desktop builds. Desktop
  updates must come from public, manually verified GitHub Releases.
