---
name: migrate-to-dotnet-9
description: Guide for migrating an existing project from .NET 6/7/8 to .NET 9
---

# Migrate to .NET 9

Step-by-step guide for migrating an existing .NET project to .NET 9.

## Context Required

Before migrating, check:
1. `.memory-bank/project/context.md` for current .NET version
2. `.memory-bank/decisions/` for any constraints on upgrades
3. Current dependencies and their .NET 9 compatibility

## Pre-Migration Checklist

```
Current .NET Version: {6 | 7 | 8}
Project Type: {Web API | Blazor | Worker | Console | Library}
Dependencies Count: {number}
Test Coverage: {percentage}
CI/CD Pipeline: {yes | no}
Production Workload: {yes | no}
```

## Migration Process

### Phase 1: Preparation

#### 1.1 Verify Prerequisites

```bash
# Install .NET 9 SDK
# Download from https://dotnet.microsoft.com/download/dotnet/9.0

# Verify installation
dotnet --list-sdks

# Update global.json
{
  "sdk": {
    "version": "9.0.100",
    "rollForward": "latestMinor"
  }
}
```

#### 1.2 Backup and Branch

```bash
# Create migration branch
git checkout -b feature/migrate-to-dotnet-9

# Document current state
dotnet --info > migration-notes/dotnet-before.txt
dotnet list package > migration-notes/packages-before.txt
```

#### 1.3 Review Breaking Changes

Check Microsoft's breaking changes documentation:
- Runtime breaking changes
- ASP.NET Core breaking changes
- EF Core breaking changes

### Phase 2: Update Project Files

#### 2.1 Update Target Framework

```xml
<!-- Before -->
<PropertyGroup>
  <TargetFramework>net8.0</TargetFramework>
</PropertyGroup>

<!-- After -->
<PropertyGroup>
  <TargetFramework>net9.0</TargetFramework>
</PropertyGroup>
```

#### 2.2 Update NuGet Packages

```bash
# List outdated packages
dotnet list package --outdated

# Update all packages
dotnet outdated --upgrade

# Or update specific packages
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer --version 9.0.0
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 9.0.0
```

#### 2.3 Update Package References

```xml
<!-- Before -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.*" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.*" />

<!-- After -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="9.0.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="9.0.*" />
<!-- Consider using built-in OpenAPI in .NET 9 instead of Swashbuckle -->
```

### Phase 3: Address Breaking Changes

#### 3.1 OpenAPI Changes (.NET 9)

```csharp
// .NET 9 has built-in OpenAPI support
// Before (Swashbuckle)
builder.Services.AddSwaggerGen();
app.UseSwagger();
app.UseSwaggerUI();

// After (.NET 9 built-in)
builder.Services.AddOpenApi();
app.MapOpenApi();

// Or keep Swashbuckle if you need advanced features
```

#### 3.2 Static File Serving (.NET 9)

```csharp
// Before
app.UseStaticFiles();

// After (.NET 9 optimized)
app.MapStaticAssets(); // Better compression, fingerprinting
```

#### 3.3 HybridCache (.NET 9)

```csharp
// Before (separate memory and distributed cache)
builder.Services.AddMemoryCache();
builder.Services.AddStackExchangeRedisCache(options => { });

// After (.NET 9 HybridCache)
builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(5),
        LocalCacheExpiration = TimeSpan.FromMinutes(1)
    };
});
```

#### 3.4 LINQ Enhancements

```csharp
// .NET 9 - Use new LINQ methods
// Before
var counts = items.GroupBy(x => x.Category)
    .Select(g => new { g.Key, Count = g.Count() });

// After (.NET 9)
var counts = items.CountBy(x => x.Category);

// Before
for (int i = 0; i < items.Count; i++)
{
    Console.WriteLine($"{i}: {items[i]}");
}

// After (.NET 9)
foreach (var (index, item) in items.Index())
{
    Console.WriteLine($"{index}: {item}");
}
```

### Phase 4: Update Code Patterns

#### 4.1 Adopt C# 13 Features (if available)

```csharp
// params collections
public void Log(params ReadOnlySpan<string> messages) { }

// Collection expressions improvements
List<int> numbers = [1, 2, 3, ..existingNumbers, 4, 5];
```

#### 4.2 Update EF Core Code

```csharp
// EF Core 9 improvements
// Better LINQ translation
var result = await context.Orders
    .Where(o => ids.Contains(o.Id)) // Optimized with VALUES clause
    .ToListAsync();

// Complex type ordering
var sorted = await context.Customers
    .OrderBy(c => c.Address)
    .ToListAsync();
```

### Phase 5: Testing

#### 5.1 Run All Tests

```bash
# Run tests
dotnet test --verbosity normal

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

#### 5.2 Manual Testing

- [ ] Application starts successfully
- [ ] Authentication works
- [ ] All API endpoints respond
- [ ] Database migrations run
- [ ] Background jobs execute
- [ ] Performance is acceptable

#### 5.3 Performance Testing

```bash
# Run benchmarks if available
dotnet run -c Release --project Benchmarks
```

### Phase 6: Update CI/CD

#### 6.1 Update GitHub Actions

```yaml
# .github/workflows/build.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore

      - name: Test
        run: dotnet test --no-build
```

#### 6.2 Update Docker Images

```dockerfile
# Before
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# After
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
```

### Phase 7: Documentation

#### 7.1 Update README

```markdown
## Requirements

- .NET 9.0 SDK or later
```

#### 7.2 Update Memory Bank

Create ADR for the migration decision:

```markdown
# ADR-XXX: Migrate to .NET 9

## Status
Accepted

## Context
Project was running on .NET 8. .NET 9 offers performance improvements
and new features that benefit our use case.

## Decision
Migrate to .NET 9 to leverage:
- HybridCache for better caching
- Built-in OpenAPI support
- Improved LINQ performance
- Better AOT support

## Consequences
- Requires .NET 9 SDK for development
- Docker images updated
- Some deprecated APIs replaced
```

## Rollback Plan

If issues arise:

```bash
# Revert to previous branch
git checkout main

# Or revert specific commits
git revert HEAD~n..HEAD
```

## Post-Migration Checklist

- [ ] All tests passing
- [ ] Application deploys successfully
- [ ] No runtime errors in logs
- [ ] Performance metrics acceptable
- [ ] Documentation updated
- [ ] Team notified of changes
- [ ] Memory Bank updated with ADR

## New .NET 9 Features to Adopt

After successful migration, consider adopting:

1. **HybridCache** - Replace separate memory/distributed caches
2. **Built-in OpenAPI** - Simplify API documentation
3. **MapStaticAssets** - Optimize static file delivery
4. **New LINQ methods** - CountBy, AggregateBy, Index
5. **Improved JSON handling** - JsonSerializerOptions.Web
