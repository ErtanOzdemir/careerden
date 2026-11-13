# Security Policy

## Supported Versions

Careerden ships as two desktop editions built from the same release tag: **Careerden**
(the cloud edition, which talks to the hosted Careerden API) and **Careerden Unplugged**
(the local edition, which sends no data to a Careerden server). Both editions share one
version number and one support policy.

Only the latest minor release line receives security fixes. Fixes ship as a new patch or
minor release; older release lines are not patched.

| Version | Careerden          | Careerden Unplugged |
| ------- | ------------------ | ------------------- |
| 1.0.x   | :white_check_mark: | :white_check_mark:  |
| < 1.0   | :x:                | :x:                 |

When the next minor release is published, it becomes the only supported line and the table
moves with it.

Installed desktop apps check public GitHub Releases for updates at startup, hourly, and on
demand, and download new versions automatically. When a fix must reach every user, the
maintainer raises `minimumSupportedVersion` in
[`apps/desktop/release-policy.json`](apps/desktop/release-policy.json), which is published
with each release. Any installed app older than that version, in either edition, shows a
blocking "required update" screen in place of the app until it has updated. If the policy
cannot be fetched, the app falls back to the last policy it cached, so an update that was
already required stays required. The minimum is currently `0.6.0`; versions between it and
the latest release still run but no longer receive fixes.

For the cloud edition, the hosted API and web app are always the currently deployed
version, and only that deployment is supported.

## Reporting a Vulnerability

If you discover a security vulnerability in Careerden, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Use either private channel:

- **Email**: send your report to **mail@ozdemirertan.com**.
- **GitHub private vulnerability reporting**: when the repository's **Security** tab shows
  a **Report a vulnerability** button, you can submit a private advisory there. If the
  button is not available, use email.

Include:

- Description of the vulnerability
- Affected edition (Careerden, Careerden Unplugged, or both) and version
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive an acknowledgment within **48 hours**. We will work with you to
understand and address the issue before any public disclosure.

### What to Expect

- **Acknowledgment**: Within 48 hours of your report.
- **Assessment**: We will assess the severity and impact.
- **Fix**: We will develop and test a fix.
- **Disclosure**: We will coordinate with you on the timing of public disclosure.
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous).

### Scope

This security policy applies to:

- The supported releases of both desktop editions listed above: Careerden and Careerden
  Unplugged
- The hosted Careerden API and web app used by the cloud edition
- The `master` branch of this repository

#### Careerden Unplugged

Careerden Unplugged runs its backend on your own machine instead of a Careerden server.
Reports about these local protections are in scope:

- **Local loopback API**: the app starts its API in an Electron utility process that listens
  only on `127.0.0.1`, on a port chosen by the operating system at launch.
- **Per-launch token**: every launch generates a random 256-bit session token. The app adds
  it to each request it proxies to the local API, and the API rejects requests without it,
  so other local processes cannot call the API.
- **AI provider keys**: the API keys you enter for your own AI provider are encrypted with
  Electron `safeStorage` (the macOS Keychain, Windows DPAPI, or the Linux secret service)
  and stored by the main process. They are never returned to the renderer, and the app
  refuses to save a key when operating-system encryption is unavailable.

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
- Keep dependencies updated regularly.
- Use HTTPS in production.
- Restrict database access to trusted networks.
- Never embed GitHub tokens or private-repository credentials in desktop builds. Desktop
  updates must come from public, manually verified GitHub Releases.
