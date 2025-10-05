# Security Policy

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3.0 | :x:                |

## Reporting a Vulnerability

We take the security of `three-rovemaps-camera-controls` seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

1. **Do not** create a public GitHub issue for security vulnerabilities
2. Email security reports to: [russ@roveiq.com] or use GitHub's private vulnerability reporting feature
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if available)

### What to Expect

- **Initial Response**: Within 48 hours, we'll acknowledge receipt of your report
- **Assessment**: Within 5 business days, we'll provide an initial assessment
- **Updates**: We'll keep you informed about our progress at least weekly
- **Resolution**: We aim to release a fix within 30 days for critical vulnerabilities
- **Credit**: With your permission, we'll acknowledge your contribution in the security advisory

### Security Best Practices for Users

When integrating this library into your application:

1. **Content Security Policy (CSP)**: Implement appropriate CSP headers in your application
2. **Input Validation**: While this library handles input safely, validate any external configuration passed to the controller
3. **Keep Updated**: Regularly update to the latest version to receive security patches
4. **Production Dependencies**: Run `npm audit --production` to check for vulnerabilities in production dependencies
5. **Context Menu**: If you need native context menus, set `suppressContextMenu: false` in handler options

### Known Security Considerations

#### Debug Overlay
The `showDebugOverlay` option (mobile touch debugging) creates a high z-index DOM element. This is intended for development only and should not be enabled in production.

#### Event Listener Management
The library automatically cleans up event listeners on `dispose()`. Always call `controller.dispose()` when unmounting/destroying the controller to prevent memory leaks.

#### SSR Safety
The library includes SSR guards for Next.js compatibility. Use `createControllerForNext()` factory when integrating with server-side rendering frameworks.

## Security Changelog

### Version 0.3.5 (Current)
- Updated development dependencies to address esbuild vulnerability (GHSA-67mh-4wv8-2f99)
- No security issues in production dependencies
- All tests passing with latest security patches

## Third-Party Dependencies

This library has minimal production dependencies:
- **Peer Dependency**: three.js (version >=0.153)
- **Zero** runtime dependencies in production builds

Development dependencies are regularly updated and audited.

## Contact

For urgent security matters, contact: [your-email@example.com]

For general questions, use GitHub Discussions or Issues.
