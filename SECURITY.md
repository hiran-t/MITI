# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within MITI, please send an email to the maintainers. All security vulnerabilities will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to include in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to expect:

- Confirmation of receipt within 48 hours
- A detailed response within 7 days
- Regular updates on the progress toward a fix
- Credit in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using MITI:

1. **Use WSS (Secure WebSocket)** in production environments
2. **Validate all input** from ROS topics before processing
3. **Keep dependencies updated** regularly
4. **Use environment variables** for sensitive configuration
5. **Run with minimal privileges** when deploying
6. **Monitor logs** for suspicious activity

## Known Security Considerations

- WebSocket connections should be secured with WSS in production
- URDF files loaded from URLs should be from trusted sources only
- Browser localStorage is used for configuration - sensitive data should not be stored there
