---
applyTo: "**/*"
excludeAgent: ""
---

# Security Baseline

These security standards apply to all code in this project. They are based on OWASP guidelines and industry best practices for enterprise applications.

## Core Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Grant minimum necessary permissions
3. **Fail Secure**: Default to deny access on errors
4. **Never Trust Input**: Validate and sanitize all input
5. **Security by Design**: Build security in, don't bolt it on

## Authentication

### Password Requirements

- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Check against known breached passwords
- No password hints

### Session Management

```java
// ✅ Secure session configuration
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) {
    return http
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            .maximumSessions(1)
            .maxSessionsPreventsLogin(true))
        .build();
}
```

### Token Security (JWT)

```java
// ✅ Secure JWT configuration
- Use RS256 or ES256 (asymmetric algorithms)
- Short expiration times (15-60 minutes)
- Include 'iat', 'exp', 'aud', 'iss' claims
- Validate all claims on verification
- Use refresh tokens for longer sessions
```

### Multi-Factor Authentication

- Require MFA for admin accounts
- Support TOTP (Google Authenticator compatible)
- Provide backup codes
- Rate limit MFA attempts

## Authorization

### Access Control

```java
// ✅ Check authorization on every request
@PreAuthorize("hasRole('ADMIN') or @authService.isOwner(#resourceId)")
public Resource getResource(String resourceId) {
    return resourceService.findById(resourceId);
}
```

### Authorization Patterns

| Pattern | Use Case |
|---------|----------|
| RBAC | Role-based access (Admin, User, Guest) |
| ABAC | Attribute-based (department, location) |
| Resource-based | Object-level permissions |

### Common Authorization Flaws

```java
// ❌ Missing authorization check
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id); // Anyone can access any user!
}

// ✅ With authorization
@GetMapping("/users/{id}")
@PreAuthorize("@authz.canAccessUser(#id)")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id);
}
```

## Input Validation

### Validate All Input

```java
// ✅ Use validation annotations
public class CreateUserRequest {
    @NotBlank
    @Size(min = 2, max = 100)
    private String name;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{12,}$")
    private String password;
}
```

### Sanitization

```java
// ✅ Sanitize user-generated content
String sanitizedHtml = Jsoup.clean(userInput, Safelist.basic());
```

### File Upload Security

```java
// ✅ Secure file upload
- Validate file type by content, not extension
- Limit file size
- Generate random filenames
- Store outside web root
- Scan for malware
```

## Injection Prevention

### SQL Injection

```java
// ❌ NEVER do this
String query = "SELECT * FROM users WHERE id = " + userId;

// ✅ Always use parameterized queries
@Query("SELECT u FROM User u WHERE u.id = :userId")
User findById(@Param("userId") Long userId);

// ✅ Or prepared statements
PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE id = ?");
stmt.setLong(1, userId);
```

### Command Injection

```java
// ❌ Never execute user input
Runtime.getRuntime().exec("ls " + userInput);

// ✅ Use safe APIs or strict validation
ProcessBuilder pb = new ProcessBuilder("ls", "-la", directory);
// Validate directory is in allowed paths
```

### XSS Prevention

```java
// ✅ Encode output
<p th:text="${userContent}"></p>  <!-- Thymeleaf auto-escapes -->

// ✅ Use Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self'
```

### LDAP Injection

```java
// ❌ Vulnerable
String filter = "(uid=" + username + ")";

// ✅ Use parameterized filters
LdapQueryBuilder.query()
    .where("uid").is(username);
```

## Cryptography

### Password Hashing

```java
// ✅ Use strong hashing
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);  // Or Argon2
}

// ❌ Never use
MD5, SHA1, plain SHA256 for passwords
```

### Encryption

```java
// ✅ Use AES-GCM for encryption
Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

// ✅ Proper key management
- Use a Key Management Service (AWS KMS, Azure Key Vault)
- Rotate keys periodically
- Never hardcode keys
```

### Secure Random

```java
// ✅ Use SecureRandom
SecureRandom random = new SecureRandom();
byte[] token = new byte[32];
random.nextBytes(token);

// ❌ Never use
Math.random() for security purposes
```

## Secrets Management

### Never Hardcode Secrets

```java
// ❌ Never do this
private static final String API_KEY = "sk-1234567890";
private static final String DB_PASSWORD = "password123";

// ✅ Use environment variables or secret management
@Value("${api.key}")
private String apiKey;

// ✅ Better: Use secret management service
@Autowired
private SecretsManager secretsManager;
```

### Environment Variables

```bash
# ✅ Set sensitive values via environment
export DATABASE_PASSWORD=<secure-value>
export API_KEY=<secure-value>

# ❌ Never commit .env files with real secrets
```

### Secret Rotation

- Implement secret rotation capability
- Use short-lived credentials where possible
- Monitor for leaked credentials

## Security Headers

### Required Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (CSP preferred)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=()
```

### Spring Security Configuration

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) {
    return http
        .headers(headers -> headers
            .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
            .frameOptions(frame -> frame.deny())
            .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31536000)))
        .build();
}
```

## HTTPS/TLS

### Requirements

- TLS 1.2 minimum, prefer TLS 1.3
- Strong cipher suites only
- Valid certificates from trusted CA
- HSTS enabled

### Certificate Management

- Automate certificate renewal (Let's Encrypt)
- Monitor certificate expiration
- Use separate certs for different environments

## Logging Security Events

### What to Log

✅ Authentication attempts (success/failure)
✅ Authorization failures
✅ Input validation failures
✅ Security exceptions
✅ Admin actions
✅ Data access to sensitive records

### What NOT to Log

❌ Passwords (even failed ones)
❌ Session tokens
❌ Credit card numbers
❌ Social security numbers
❌ Other PII in full

### Secure Logging

```java
// ✅ Log security events with context
logger.warn("Authentication failed for user={} from ip={}",
    maskEmail(email), request.getRemoteAddr());

// ✅ Mask sensitive data
private String maskEmail(String email) {
    return email.replaceAll("(?<=.{2}).(?=.*@)", "*");
}
```

## Dependency Security

### Keep Dependencies Updated

```bash
# Check for vulnerabilities
./mvnw dependency-check:check
dotnet list package --vulnerable
npm audit
```

### Dependency Management

- Use dependency management tools
- Pin dependency versions
- Review transitive dependencies
- Subscribe to security advisories

## Security Testing

### Static Analysis (SAST)

- SonarQube with security rules
- Semgrep
- CodeQL

### Dynamic Analysis (DAST)

- OWASP ZAP
- Burp Suite

### Dependency Scanning

- Snyk
- OWASP Dependency-Check
- GitHub Dependabot

## Incident Response

### If a Vulnerability is Found

1. Assess severity and impact
2. Notify security team
3. Develop fix
4. Test fix
5. Deploy to production
6. Monitor for exploitation
7. Document in ADR

### If a Breach is Suspected

1. Contain the threat
2. Notify security team immediately
3. Preserve evidence
4. Follow incident response plan
5. Document everything

## Memory Bank Integration

- Document security decisions in ADRs
- Maintain security patterns in knowledge base
- Keep security baseline updated
- Track security-related tech debt
