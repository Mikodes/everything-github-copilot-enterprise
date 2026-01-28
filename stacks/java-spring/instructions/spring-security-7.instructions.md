---
applyTo: "**/*.java,**/application*.yml"
excludeAgent: ""
---

# Spring Security 6.x/7.x Instructions

These instructions apply when implementing security in Spring Boot 3.x/4.x applications using Spring Security 6.x and 7.x.

## Security Configuration

### Modern Security Filter Chain
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthConverter jwtAuthConverter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                .ignoringRequestMatchers("/api/webhooks/**"))

            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

                // Role-based access
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/**").hasAnyRole("ADMIN", "MANAGER")

                // Authenticated access
                .requestMatchers("/api/**").authenticated()

                // Deny all other requests
                .anyRequest().denyAll())

            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter)))

            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))

            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; frame-ancestors 'none'"))
                .frameOptions(frame -> frame.deny())
                .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)))

            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "https://app.example.com",
            "https://admin.example.com"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(
            HttpHeaders.AUTHORIZATION,
            HttpHeaders.CONTENT_TYPE,
            "X-Requested-With"
        ));
        config.setExposedHeaders(List.of(
            "X-Total-Count",
            "X-Page-Number",
            HttpHeaders.LOCATION
        ));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

## JWT Authentication

### JWT Configuration (application.yml)
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${JWT_ISSUER_URI:https://auth.example.com/realms/my-app}
          jwk-set-uri: ${JWT_JWK_SET_URI:${spring.security.oauth2.resourceserver.jwt.issuer-uri}/protocol/openid-connect/certs}
```

### Custom JWT Converter
```java
@Component
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter;
    private final String principalAttribute;

    public JwtAuthConverter(
            @Value("${jwt.auth.converter.principal-attribute:preferred_username}") String principalAttribute) {
        this.principalAttribute = principalAttribute;
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
        return jwt.getClaim(principalAttribute);
    }

    private Collection<GrantedAuthority> extractResourceRoles(Jwt jwt) {
        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess == null) {
            return Collections.emptyList();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> resource = (Map<String, Object>) resourceAccess.get("my-app");
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

### Custom Principal
```java
public record UserPrincipal(
    String userId,
    String username,
    String email,
    Set<String> roles,
    Map<String, Object> attributes
) {
    public static UserPrincipal fromJwt(Jwt jwt) {
        return new UserPrincipal(
            jwt.getSubject(),
            jwt.getClaimAsString("preferred_username"),
            jwt.getClaimAsString("email"),
            extractRoles(jwt),
            jwt.getClaims()
        );
    }

    public boolean hasRole(String role) {
        return roles.contains(role) || roles.contains("ROLE_" + role);
    }

    private static Set<String> extractRoles(Jwt jwt) {
        // Extract from token claims
        return Set.of();
    }
}

// Usage in controller
@GetMapping("/me")
public UserPrincipal getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
    return UserPrincipal.fromJwt(jwt);
}
```

## Method Security

### PreAuthorize Patterns
```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderSecurityEvaluator securityEvaluator;

    // Simple role check
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAllOrders() {
        orderRepository.deleteAll();
    }

    // Multiple roles
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    // Custom SpEL expression with service
    @PreAuthorize("@orderSecurityEvaluator.canAccess(#orderId, authentication)")
    public Order getOrder(Long orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    // Access method argument
    @PreAuthorize("#order.customerId == authentication.principal.claims['sub']")
    public Order updateOrder(@P("order") Order order) {
        return orderRepository.save(order);
    }

    // Post-filter results
    @PostFilter("filterObject.customerId == authentication.principal.claims['sub'] or hasRole('ADMIN')")
    public List<Order> getMyOrders() {
        return orderRepository.findAll();
    }

    // Post-authorize return value
    @PostAuthorize("returnObject.customerId == authentication.principal.claims['sub'] or hasRole('ADMIN')")
    public Order findOrder(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(() -> new OrderNotFoundException(id));
    }
}

@Component
public class OrderSecurityEvaluator {

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

## Security Utilities

### Security Context Helper
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
            .collect(Collectors.toSet());
    }

    public boolean hasRole(String role) {
        return getCurrentUserRoles().contains("ROLE_" + role);
    }

    public boolean isAuthenticated() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated() &&
               !(auth instanceof AnonymousAuthenticationToken);
    }
}
```

## Exception Handling

```java
@Component
@Slf4j
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                        AuthenticationException authException) throws IOException {
        log.warn("Authentication failed for request to {}: {}",
            request.getRequestURI(), authException.getMessage());

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNAUTHORIZED,
            "Authentication required"
        );
        problem.setTitle("Unauthorized");
        problem.setType(URI.create("https://api.example.com/errors/unauthorized"));

        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}

@Component
@Slf4j
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                      AccessDeniedException accessDeniedException) throws IOException {
        log.warn("Access denied for user {} to {}",
            getCurrentUsername(), request.getRequestURI());

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN,
            "You don't have permission to access this resource"
        );
        problem.setTitle("Forbidden");
        problem.setType(URI.create("https://api.example.com/errors/forbidden"));

        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
```

## Security Testing

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
    @WithMockUser(roles = "USER")
    void shouldReturn403WhenNotAuthorized() throws Exception {
        mockMvc.perform(delete("/api/admin/orders"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void shouldReturn200WhenAuthorized() throws Exception {
        mockMvc.perform(delete("/api/admin/orders"))
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

## Memory Bank Integration

When implementing Spring Security:

1. **Document security model**: Create ADR for authentication approach
2. **Track permissions**: Document role definitions in knowledge base
3. **Security patterns**: Add common patterns to team knowledge

## What You MUST Do

- Use stateless sessions for APIs
- Validate all JWT claims (issuer, audience, expiration)
- Implement proper CORS configuration
- Add security headers (CSP, HSTS, X-Frame-Options)
- Log security events (authentication failures, access denied)
- Use `@PreAuthorize` for method-level security

## What You MUST NOT Do

- Store JWT secrets in code or version control
- Use wildcard CORS origins in production
- Disable CSRF without understanding implications
- Expose stack traces in error responses
- Use Basic Auth without HTTPS
- Ignore authorization failures
