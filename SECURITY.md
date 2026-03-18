# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |

Only the latest release of CLISYS receives security updates. We encourage all users to stay on the latest version.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

To report a security vulnerability, please use one of the following methods:

1. **GitHub Private Vulnerability Reporting** (preferred): Use the [Report a vulnerability](https://github.com/XucroYuri/CLISYS/security/advisories/new) button on the Security tab of the repository.

2. **Email**: Send a description of the vulnerability to the maintainer(s) listed on the GitHub repository profile page.

### What to include in your report

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof of concept, if possible)
- Affected version(s)
- Any suggested mitigations or fixes

### Response timeline

- **Acknowledgement**: Within 72 hours
- **Initial assessment**: Within 7 days
- **Fix or mitigation**: Dependent on complexity, typically within 30 days

We will coordinate with you on the disclosure timeline. We follow a **responsible disclosure** model and ask that you give us reasonable time to fix the issue before making it public.

---

## Security Considerations

CLISYS orchestrates external AI CLI tools by spawning subprocesses. Please be aware of the following:

- **External process execution**: CLISYS executes CLI tools as subprocesses. A malicious adapter configuration or compromised adapter binary could execute arbitrary code.
- **No sandboxing in v0.x**: The current version does not sandbox adapter processes. Sandboxing is planned for Phase 4 (v0.5.x). See [docs/roadmap.md](docs/roadmap.md).
- **Configuration files**: Configuration files (TOML) are loaded from the file system. Ensure that config files in shared environments have appropriate permissions.
- **API keys**: CLISYS does not currently manage API keys directly — they are managed by the individual CLI tools. Ensure your underlying tools' credentials are stored securely (e.g., in environment variables, not in config files).

---

## Scope

The following are **in scope** for vulnerability reports:

- Arbitrary code execution via crafted inputs or configurations
- Path traversal or file disclosure vulnerabilities
- Authentication or authorisation bypasses (when such features exist)
- Injection attacks (command injection, etc.)

The following are **out of scope**:

- Vulnerabilities in third-party CLI tools (Claude Code, Codex, Aider, etc.) — please report those to their respective maintainers
- Theoretical vulnerabilities with no practical exploitation path
- Social engineering attacks
