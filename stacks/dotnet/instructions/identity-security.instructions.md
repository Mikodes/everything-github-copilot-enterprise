---
applyTo: "**/*.cs"
excludeAgent: ""
---

# ASP.NET Identity & Security Instructions

These instructions define security best practices for ASP.NET Core applications using ASP.NET Identity, JWT authentication, and authorization patterns.

## ASP.NET Identity Setup

### Identity Configuration

```csharp
// ✅ Complete Identity setup
builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
{
    // Password requirements
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredUniqueChars = 4;

    // Lockout settings
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User requirements
    options.User.RequireUniqueEmail = true;
    options.User.AllowedUserNameCharacters =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";

    // Sign-in requirements
    options.SignIn.RequireConfirmedEmail = true;
    options.SignIn.RequireConfirmedAccount = true;

    // Token lifespan
    options.Tokens.EmailConfirmationTokenProvider = TokenOptions.DefaultEmailProvider;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders()
.AddPasswordValidator<CommonPasswordValidator<ApplicationUser>>();

// Custom user and role classes
public class ApplicationUser : IdentityUser<Guid>
{
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public string FullName => $"{FirstName} {LastName}";
    public Guid? TenantId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ApplicationRole : IdentityRole<Guid>
{
    public string? Description { get; set; }
}
```

### JWT Authentication

```csharp
// ✅ JWT setup with proper validation
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
        ClockSkew = TimeSpan.Zero, // Remove default 5-min tolerance
        NameClaimType = ClaimTypes.Name,
        RoleClaimType = ClaimTypes.Role
    };

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            if (context.Exception is SecurityTokenExpiredException)
            {
                context.Response.Headers.Append("X-Token-Expired", "true");
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            // Additional validation (e.g., check if user is still active)
            return Task.CompletedTask;
        }
    };
});
```

### Token Service

```csharp
// ✅ Secure token generation
public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenService> _logger;

    public TokenService(
        IOptions<JwtSettings> settings,
        TimeProvider timeProvider,
        ILogger<TokenService> logger)
    {
        _settings = settings.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public TokenResponse GenerateTokens(ApplicationUser user, IEnumerable<string> roles)
    {
        var accessToken = GenerateAccessToken(user, roles);
        var refreshToken = GenerateRefreshToken();

        return new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt = _timeProvider.GetUtcNow().AddMinutes(_settings.AccessTokenExpirationMinutes)
        };
    }

    private string GenerateAccessToken(ApplicationUser user, IEnumerable<string> roles)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Name, user.UserName!),
            new("full_name", user.FullName),
        };

        if (user.TenantId.HasValue)
        {
            claims.Add(new Claim("tenant_id", user.TenantId.Value.ToString()));
        }

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: _timeProvider.GetUtcNow().DateTime,
            expires: _timeProvider.GetUtcNow().AddMinutes(_settings.AccessTokenExpirationMinutes).DateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private RefreshToken GenerateRefreshToken()
    {
        return new RefreshToken
        {
            Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
            ExpiresAt = _timeProvider.GetUtcNow().AddDays(_settings.RefreshTokenExpirationDays),
            CreatedAt = _timeProvider.GetUtcNow()
        };
    }
}
```

## Authorization Patterns

### Policy-Based Authorization

```csharp
// ✅ Define authorization policies
builder.Services.AddAuthorizationBuilder()
    // Role-based policies
    .AddPolicy("RequireAdmin", policy =>
        policy.RequireRole("Admin"))

    .AddPolicy("RequireManager", policy =>
        policy.RequireRole("Admin", "Manager"))

    // Claim-based policies
    .AddPolicy("CanManageUsers", policy =>
        policy.RequireClaim("permission", "users:manage"))

    .AddPolicy("CanViewReports", policy =>
        policy.RequireClaim("permission", "reports:view", "reports:manage"))

    // Custom requirement policies
    .AddPolicy("SameTenant", policy =>
        policy.AddRequirements(new SameTenantRequirement()))

    .AddPolicy("ResourceOwner", policy =>
        policy.AddRequirements(new ResourceOwnerRequirement()))

    // Combined policies
    .AddPolicy("AdminOrOwner", policy =>
        policy.AddRequirements(new AdminOrOwnerRequirement()));
```

### Custom Authorization Handlers

```csharp
// ✅ Tenant-based authorization
public class SameTenantRequirement : IAuthorizationRequirement { }

public class SameTenantHandler : AuthorizationHandler<SameTenantRequirement, ITenantResource>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SameTenantRequirement requirement,
        ITenantResource resource)
    {
        var userTenantClaim = context.User.FindFirstValue("tenant_id");

        if (userTenantClaim is null)
        {
            return Task.CompletedTask; // Fail - no tenant claim
        }

        if (Guid.TryParse(userTenantClaim, out var userTenantId) &&
            userTenantId == resource.TenantId)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

// ✅ Resource owner authorization
public class ResourceOwnerRequirement : IAuthorizationRequirement { }

public class ResourceOwnerHandler : AuthorizationHandler<ResourceOwnerRequirement, IOwnedResource>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ResourceOwnerRequirement requirement,
        IOwnedResource resource)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (userId is not null && Guid.Parse(userId) == resource.OwnerId)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

// Register handlers
builder.Services.AddScoped<IAuthorizationHandler, SameTenantHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ResourceOwnerHandler>();
```

### Using Authorization in Controllers

```csharp
// ✅ Authorization in controllers
[ApiController]
[Route("api/[controller]")]
[Authorize] // Require authentication for all actions
public class OrdersController : ControllerBase
{
    private readonly IAuthorizationService _authorizationService;
    private readonly IOrderService _orderService;

    public OrdersController(
        IAuthorizationService authorizationService,
        IOrderService orderService)
    {
        _authorizationService = authorizationService;
        _orderService = orderService;
    }

    [HttpGet]
    [Authorize(Policy = "CanViewReports")] // Policy-based
    public async Task<IActionResult> GetOrders() { }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var order = await _orderService.GetByIdAsync(id);
        if (order is null) return NotFound();

        // Resource-based authorization
        var authResult = await _authorizationService.AuthorizeAsync(
            User, order, "ResourceOwner");

        if (!authResult.Succeeded)
        {
            return Forbid();
        }

        return Ok(order);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")] // Role-based
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request) { }

    [HttpDelete("{id}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeleteOrder(int id) { }
}
```

## Security Headers

```csharp
// ✅ Security headers middleware
public static class SecurityHeadersMiddleware
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;

            // Prevent clickjacking
            headers.Append("X-Frame-Options", "DENY");

            // Prevent MIME sniffing
            headers.Append("X-Content-Type-Options", "nosniff");

            // XSS protection
            headers.Append("X-XSS-Protection", "1; mode=block");

            // Referrer policy
            headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

            // Content Security Policy
            headers.Append("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: https:; " +
                "font-src 'self'; " +
                "form-action 'self'; " +
                "frame-ancestors 'none'; " +
                "base-uri 'self';");

            // Permissions policy
            headers.Append("Permissions-Policy",
                "accelerometer=(), camera=(), geolocation=(), gyroscope=(), " +
                "magnetometer=(), microphone=(), payment=(), usb=()");

            await next();
        });
    }
}

// HSTS in production
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseSecurityHeaders();
```

## Input Validation

```csharp
// ✅ Always validate user input
public class RegisterUserCommandValidator : AbstractValidator<RegisterUserCommand>
{
    public RegisterUserCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(320);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(12)
            .Matches("[A-Z]").WithMessage("Password must contain uppercase letter")
            .Matches("[a-z]").WithMessage("Password must contain lowercase letter")
            .Matches("[0-9]").WithMessage("Password must contain digit")
            .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain special character");

        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(50)
            .Matches("^[a-zA-Z\\s-']+$")
            .WithMessage("First name contains invalid characters");

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(50)
            .Matches("^[a-zA-Z\\s-']+$")
            .WithMessage("Last name contains invalid characters");
    }
}
```

## Secrets Management

```csharp
// ❌ Never store secrets in code or config
private const string ApiKey = "secret-key-123"; // NEVER!

// ❌ Don't put secrets in appsettings.json
{
    "ApiKey": "secret-key-123" // NO!
}

// ✅ Use environment variables (development)
var apiKey = Environment.GetEnvironmentVariable("API_KEY");

// ✅ Use User Secrets (development)
// dotnet user-secrets set "ApiKey" "secret-key-123"
var apiKey = builder.Configuration["ApiKey"];

// ✅ Use Azure Key Vault (production)
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{keyVaultName}.vault.azure.net/"),
    new DefaultAzureCredential());

// ✅ Use Data Protection API for encrypting sensitive data
builder.Services.AddDataProtection()
    .PersistKeysToAzureBlobStorage(connectionString, containerName, blobName)
    .ProtectKeysWithAzureKeyVault(keyIdentifier, new DefaultAzureCredential());
```

## Audit Logging

```csharp
// ✅ Log security events
public class SecurityAuditService : ISecurityAuditService
{
    private readonly ILogger<SecurityAuditService> _logger;

    public void LogSuccessfulLogin(string userId, string ipAddress)
    {
        _logger.LogInformation(
            "Successful login for user {UserId} from IP {IpAddress}",
            userId, ipAddress);
    }

    public void LogFailedLogin(string email, string ipAddress, string reason)
    {
        _logger.LogWarning(
            "Failed login attempt for {Email} from IP {IpAddress}: {Reason}",
            email, ipAddress, reason);
    }

    public void LogAuthorizationFailure(string userId, string resource, string action)
    {
        _logger.LogWarning(
            "Authorization denied for user {UserId} attempting {Action} on {Resource}",
            userId, action, resource);
    }

    public void LogSensitiveDataAccess(string userId, string dataType, string dataId)
    {
        _logger.LogInformation(
            "Sensitive data access: User {UserId} accessed {DataType} {DataId}",
            userId, dataType, dataId);
    }
}
```

## Rate Limiting for Security

```csharp
// ✅ Rate limit authentication endpoints
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("AuthEndpoints", config =>
    {
        config.PermitLimit = 5;
        config.Window = TimeSpan.FromMinutes(1);
        config.QueueLimit = 0;
    });

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Please try again later." }, ct);
    };
});

app.MapPost("/api/auth/login", Login)
    .RequireRateLimiting("AuthEndpoints");
```
