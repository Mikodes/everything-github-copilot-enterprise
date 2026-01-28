---
name: add-spring-security
description: Add Spring Security configuration to a Spring Boot application with JWT, OAuth2, or session-based authentication
---

# Add Spring Security

Configure Spring Security for a Spring Boot application with proper authentication, authorization, and security headers.

## Context Required

Before running this prompt:
1. Read the project context from Memory Bank
2. Check existing security patterns in the codebase
3. Identify the identity provider (Keycloak, Auth0, Azure AD, custom)

## Input

```
Authentication Type: {JWT | OAuth2 | Session | Basic}
Identity Provider: {Keycloak | Auth0 | Azure AD | Custom}
API Type: {REST | GraphQL | Web MVC}
Roles: {list of application roles}
Public Endpoints: {endpoints that don't require authentication}
Admin Endpoints: {endpoints requiring admin role}
Stateless: {true/false}
```

## Generation Process

### 1. Dependencies

#### build.gradle.kts
```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")

    testImplementation("org.springframework.security:spring-security-test")
}
```

### 2. Security Configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthConverter jwtAuthConverter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // CSRF configuration
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/webhooks/**"))

            // CORS configuration
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Authorization rules
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers(
                    "/actuator/health",
                    "/actuator/info",
                    "/api/public/**",
                    "/swagger-ui/**",
                    "/v3/api-docs/**"
                ).permitAll()

                // Admin endpoints
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // Specific role requirements
                .requestMatchers(HttpMethod.DELETE, "/api/**").hasAnyRole("ADMIN", "MANAGER")

                // All other API endpoints require authentication
                .requestMatchers("/api/**").authenticated()

                // Deny all other requests
                .anyRequest().denyAll())

            // OAuth2 Resource Server with JWT
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter)))

            // Session management
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(authenticationEntryPoint())
                .accessDeniedHandler(accessDeniedHandler()))

            // Security headers
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; frame-ancestors 'none'"))
                .frameOptions(frame -> frame.deny())
                .xssProtection(xss -> xss
                    .headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)))

            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "${CORS_ALLOWED_ORIGINS:https://app.example.com}"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(
            HttpHeaders.AUTHORIZATION,
            HttpHeaders.CONTENT_TYPE,
            "X-Requested-With"
        ));
        config.setExposedHeaders(List.of(
            "X-Total-Count",
            "X-Page-Number"
        ));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return new BearerTokenAuthenticationEntryPoint();
    }

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return new BearerTokenAccessDeniedHandler();
    }
}
```

### 3. JWT Authentication Converter

```java
@Component
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter;

    @Value("${jwt.auth.converter.principal-attribute:preferred_username}")
    private String principalAttribute;

    @Value("${jwt.auth.converter.resource-id:my-app}")
    private String resourceId;

    public JwtAuthConverter() {
        this.jwtGrantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        this.jwtGrantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");
        this.jwtGrantedAuthoritiesConverter.setAuthoritiesClaimName("roles");
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = Stream.concat(
            jwtGrantedAuthoritiesConverter.convert(jwt).stream(),
            extractResourceRoles(jwt).stream()
        ).collect(Collectors.toSet());

        return new JwtAuthenticationToken(
            jwt,
            authorities,
            getPrincipalClaimName(jwt)
        );
    }

    private String getPrincipalClaimName(Jwt jwt) {
        String claim = jwt.getClaim(principalAttribute);
        return claim != null ? claim : jwt.getSubject();
    }

    private Collection<GrantedAuthority> extractResourceRoles(Jwt jwt) {
        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess == null) {
            return Collections.emptyList();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> resource = (Map<String, Object>) resourceAccess.get(resourceId);
        if (resource == null) {
            return Collections.emptyList();
        }

        @SuppressWarnings("unchecked")
        Collection<String> roles = (Collection<String>) resource.get("roles");
        if (roles == null) {
            return Collections.emptyList();
        }

        return roles.stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
            .collect(Collectors.toList());
    }
}
```

### 4. Application Configuration

```yaml
# application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${JWT_ISSUER_URI:https://auth.example.com/realms/my-app}
          jwk-set-uri: ${JWT_JWK_SET_URI:${spring.security.oauth2.resourceserver.jwt.issuer-uri}/protocol/openid-connect/certs}

jwt:
  auth:
    converter:
      principal-attribute: preferred_username
      resource-id: ${JWT_RESOURCE_ID:my-app}
```

### 5. Method Security

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAllOrders() {
        // Only admins
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<Order> getAllOrders() {
        // Admins and managers
    }

    @PreAuthorize("@orderSecurityService.canAccess(#orderId, authentication)")
    public Order getOrder(Long orderId) {
        // Custom security check
    }

    @PreAuthorize("#order.customerId == authentication.principal.claims['sub']")
    public Order updateOrder(@P("order") Order order) {
        // Owner only
    }

    @PostAuthorize("returnObject.customerId == authentication.principal.claims['sub'] or hasRole('ADMIN')")
    public Order findOrder(Long id) {
        // Filter return value
    }
}
```

### 6. Security Service for Custom Checks

```java
@Component
@RequiredArgsConstructor
public class OrderSecurityService {

    private final OrderRepository orderRepository;

    public boolean canAccess(Long orderId, Authentication authentication) {
        if (hasRole(authentication, "ADMIN")) {
            return true;
        }

        String userId = getUserId(authentication);
        return orderRepository.existsByIdAndCustomerId(orderId, userId);
    }

    public boolean canModify(Order order, Authentication authentication) {
        if (hasRole(authentication, "ADMIN")) {
            return true;
        }

        String userId = getUserId(authentication);
        return order.getCustomerId().equals(userId);
    }

    private boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    private String getUserId(Authentication auth) {
        Jwt jwt = (Jwt) auth.getPrincipal();
        return jwt.getSubject();
    }
}
```

### 7. Security Context Helper

```java
@Component
public class SecurityContextHelper {

    public Optional<String> getCurrentUserId() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .filter(auth -> auth.getPrincipal() instanceof Jwt)
            .map(auth -> ((Jwt) auth.getPrincipal()).getSubject());
    }

    public Optional<String> getCurrentUsername() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .filter(auth -> auth.getPrincipal() instanceof Jwt)
            .map(auth -> ((Jwt) auth.getPrincipal()).getClaimAsString("preferred_username"));
    }

    public Set<String> getCurrentUserRoles() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(Authentication::getAuthorities)
            .orElse(Collections.emptyList())
            .stream()
            .map(GrantedAuthority::getAuthority)
            .filter(a -> a.startsWith("ROLE_"))
            .map(a -> a.substring(5))
            .collect(Collectors.toSet());
    }

    public boolean hasRole(String role) {
        return getCurrentUserRoles().contains(role);
    }
}
```

### 8. Security Testing

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @Test
    @WithAnonymousUser
    void shouldReturn401WhenNotAuthenticated() throws Exception {
        mockMvc.perform(get("/api/orders"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void shouldReturn200WhenAuthenticated() throws Exception {
        mockMvc.perform(get("/api/orders"))
            .andExpect(status().isOk());
    }

    @Test
    void shouldReturn200WithValidJwt() throws Exception {
        mockMvc.perform(get("/api/orders")
            .with(jwt().jwt(builder -> builder
                .claim("sub", "user-123")
                .claim("preferred_username", "testuser")
                .claim("roles", List.of("USER")))))
            .andExpect(status().isOk());
    }
}
```

## Output Checklist

Ensure the security configuration has:

- [ ] `@EnableWebSecurity` and `@EnableMethodSecurity`
- [ ] Proper CSRF configuration
- [ ] CORS configuration for frontend
- [ ] Authorization rules for all endpoints
- [ ] JWT authentication converter
- [ ] Session management (stateless for APIs)
- [ ] Security headers (CSP, HSTS, X-Frame-Options)
- [ ] Exception handlers for auth errors
- [ ] Method-level security annotations
- [ ] Security testing setup

## Memory Bank Updates

After adding security:

- [ ] Create ADR for authentication approach
- [ ] Document roles and permissions
- [ ] Add security patterns to knowledge base

## Example Usage

**User**: Add JWT-based security with Keycloak for my REST API

**Response**:
[Generates complete security configuration with JWT, Keycloak integration, and method security]
