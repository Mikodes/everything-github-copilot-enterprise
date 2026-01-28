/**
 * Add Stack Command
 *
 * Adds technology stack-specific configurations to an EGCE project.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

// Types
export interface AddStackOptions {
  version?: string;
  force?: boolean;
}

interface StackConfig {
  name: string;
  displayName: string;
  versions: string[];
  defaultVersion: string;
  agents: AgentTemplate[];
  instructions: InstructionTemplate[];
  prompts: PromptTemplate[];
}

interface AgentTemplate {
  name: string;
  slug: string;
  description: string;
  content: string;
}

interface InstructionTemplate {
  name: string;
  slug: string;
  description: string;
  content: string;
}

interface PromptTemplate {
  name: string;
  slug: string;
  description: string;
  content: string;
}

// Stack configurations
const stacks: Record<string, StackConfig> = {
  'java-spring': {
    name: 'java-spring',
    displayName: 'Java/Spring Boot',
    versions: ['3.5', '3.4', '3.3', '4.0'],
    defaultVersion: '3.5',
    agents: [
      {
        name: 'Spring Architect',
        slug: 'spring-architect',
        description: 'Specialized in Spring Boot architecture and design patterns',
        content: `---
name: "Spring Architect"
slug: "spring-architect"
role: "Spring Boot Architecture Specialist"
version: "1.0.0"
---

# Spring Architect Agent

Expert in Spring Boot architecture, design patterns, and enterprise Java development.

## Role

Design and review Spring Boot application architecture following best practices.

## Expertise

- Spring Boot 3.x/4.x application architecture
- Hexagonal/Clean Architecture with Spring
- Spring Security configuration
- Spring Data JPA optimization
- Spring Cloud microservices patterns
- Reactive programming with WebFlux

## Responsibilities

- Review and suggest architectural improvements
- Design module boundaries and dependencies
- Recommend appropriate Spring patterns
- Guide migration to newer Spring versions

## Instructions

### Architecture

- Follow hexagonal architecture principles
- Use package-by-feature organization
- Implement proper dependency injection
- Design for testability

### Spring Best Practices

- Use constructor injection over field injection
- Prefer \`@Configuration\` classes over XML
- Use \`@ConfigurationProperties\` for type-safe configuration
- Implement proper exception handling with \`@ControllerAdvice\`

## Constraints

- Do not recommend deprecated Spring features
- Always consider backward compatibility
- Prioritize security in all recommendations

## Triggers

- When: designing new Spring Boot application
- When: reviewing Spring architecture
- When: migrating Spring versions
`,
      },
      {
        name: 'JPA Specialist',
        slug: 'jpa-specialist',
        description: 'Expert in JPA/Hibernate and Spring Data',
        content: `---
name: "JPA Specialist"
slug: "jpa-specialist"
role: "JPA and Database Expert"
version: "1.0.0"
---

# JPA Specialist Agent

Expert in JPA, Hibernate, and Spring Data for efficient database access.

## Role

Design and optimize database access patterns using JPA and Spring Data.

## Expertise

- Spring Data JPA repositories
- Hibernate performance tuning
- Query optimization
- Entity relationship mapping
- Database migration strategies

## Responsibilities

- Design efficient entity mappings
- Optimize JPA queries
- Review database access patterns
- Suggest indexing strategies

## Instructions

### Entity Design

- Use proper fetch strategies (LAZY vs EAGER)
- Implement \`equals()\` and \`hashCode()\` correctly
- Use \`@Version\` for optimistic locking
- Consider using DTOs for projections

### Query Optimization

- Use \`@Query\` with JPQL for complex queries
- Prefer projections over full entity loading
- Use \`@EntityGraph\` to avoid N+1 problems
- Consider native queries for performance-critical operations

## Constraints

- Avoid EAGER fetching by default
- Do not expose entities directly in APIs
- Always consider transaction boundaries
`,
      },
    ],
    instructions: [
      {
        name: 'Spring Boot Standards',
        slug: 'spring-boot-standards',
        description: 'Coding standards for Spring Boot applications',
        content: `---
name: "Spring Boot Standards"
description: "Coding standards and best practices for Spring Boot development"
applyWhen: ["developing Spring Boot applications", "reviewing Spring code"]
---

# Spring Boot Coding Standards

## Project Structure

\`\`\`
src/main/java/
  com.company.project/
    config/           # Configuration classes
    controller/       # REST controllers
    service/          # Business logic
    repository/       # Data access
    model/            # Entities and DTOs
    exception/        # Custom exceptions
\`\`\`

## Dependency Injection

- Use constructor injection
- Mark dependencies as \`final\`
- Use \`@RequiredArgsConstructor\` from Lombok

\`\`\`java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
}
\`\`\`

## REST Controllers

- Use \`@RestController\` for REST APIs
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate HTTP status codes
- Use \`@Valid\` for request validation

\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDto created = userService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
\`\`\`

## Exception Handling

Use \`@ControllerAdvice\` for global exception handling:

\`\`\`java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse(ex.getMessage()));
    }
}
\`\`\`

## Configuration

- Use \`application.yml\` over \`application.properties\`
- Use profiles for environment-specific config
- Use \`@ConfigurationProperties\` for type-safe config

## Testing

- Write unit tests with JUnit 5 and Mockito
- Write integration tests with \`@SpringBootTest\`
- Use Testcontainers for database tests
`,
      },
    ],
    prompts: [
      {
        name: 'Create REST Controller',
        slug: 'create-rest-controller',
        description: 'Generate a Spring Boot REST controller',
        content: `---
name: "Create REST Controller"
slug: "create-rest-controller"
category: "code-generation"
trigger:
  slash: "/spring-controller"
  keywords: ["spring", "controller", "rest", "api"]
---

# Create Spring Boot REST Controller

Generate a complete REST controller with CRUD operations.

## Usage

\`\`\`
/spring-controller UserController for User entity
\`\`\`

## Template

Create a REST controller following Spring Boot best practices:

1. Use \`@RestController\` and \`@RequestMapping\`
2. Inject service via constructor
3. Implement standard CRUD endpoints
4. Use proper HTTP methods and status codes
5. Add request validation with \`@Valid\`
6. Include Swagger/OpenAPI annotations

## Example Output

\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management API")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "Get all users")
    public ResponseEntity<Page<UserDto>> getAll(Pageable pageable) {
        return ResponseEntity.ok(userService.findAll(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<UserDto> getById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    @Operation(summary = "Create new user")
    public ResponseEntity<UserDto> create(@Valid @RequestBody CreateUserRequest request) {
        UserDto created = userService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(created.getId())
            .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user")
    public ResponseEntity<UserDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
\`\`\`
`,
      },
    ],
  },
  'dotnet': {
    name: 'dotnet',
    displayName: '.NET/C#',
    versions: ['8', '9'],
    defaultVersion: '8',
    agents: [
      {
        name: '.NET Architect',
        slug: 'dotnet-architect',
        description: 'Specialized in .NET architecture and Clean Architecture patterns',
        content: `---
name: ".NET Architect"
slug: "dotnet-architect"
role: ".NET Architecture Specialist"
version: "1.0.0"
---

# .NET Architect Agent

Expert in .NET architecture, Clean Architecture, and enterprise C# development.

## Role

Design and review .NET application architecture following best practices.

## Expertise

- .NET 8/9 application architecture
- Clean Architecture implementation
- ASP.NET Core Web API design
- Entity Framework Core optimization
- Minimal APIs vs Controllers
- CQRS and MediatR patterns

## Responsibilities

- Review and suggest architectural improvements
- Design solution structure and project dependencies
- Recommend appropriate .NET patterns
- Guide migration to newer .NET versions

## Instructions

### Architecture

- Follow Clean Architecture principles
- Use vertical slice architecture where appropriate
- Implement proper dependency injection
- Design for testability

### .NET Best Practices

- Use record types for DTOs
- Prefer primary constructors (C# 12)
- Use \`IOptions<T>\` for configuration
- Implement proper exception handling

## Constraints

- Do not recommend obsolete .NET features
- Always consider performance implications
- Prioritize security in all recommendations
`,
      },
    ],
    instructions: [
      {
        name: '.NET Standards',
        slug: 'dotnet-standards',
        description: 'Coding standards for .NET applications',
        content: `---
name: ".NET Standards"
description: "Coding standards and best practices for .NET development"
applyWhen: ["developing .NET applications", "reviewing C# code"]
---

# .NET Coding Standards

## Project Structure (Clean Architecture)

\`\`\`
src/
  Domain/           # Entities, Value Objects, Domain Events
  Application/      # Use Cases, DTOs, Interfaces
  Infrastructure/   # Data Access, External Services
  WebApi/           # Controllers, Middleware
tests/
  Domain.Tests/
  Application.Tests/
  Infrastructure.Tests/
  WebApi.Tests/
\`\`\`

## Naming Conventions

- Use PascalCase for public members
- Use camelCase for private fields with underscore prefix
- Use meaningful names that describe intent
- Interfaces start with 'I'

## Dependency Injection

Use constructor injection with primary constructors (C# 12):

\`\`\`csharp
public class UserService(IUserRepository userRepository, ILogger<UserService> logger)
{
    public async Task<User> GetByIdAsync(int id)
    {
        logger.LogInformation("Getting user {UserId}", id);
        return await userRepository.GetByIdAsync(id);
    }
}
\`\`\`

## API Design

Use Minimal APIs for simple endpoints:

\`\`\`csharp
app.MapGet("/users/{id}", async (int id, IUserService userService) =>
    await userService.GetByIdAsync(id) is User user
        ? Results.Ok(user)
        : Results.NotFound());
\`\`\`

Use Controllers for complex APIs:

\`\`\`csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController(IUserService userService) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetById(int id)
    {
        var user = await userService.GetByIdAsync(id);
        return user is null ? NotFound() : Ok(user);
    }
}
\`\`\`

## Error Handling

Use Result pattern or Problem Details:

\`\`\`csharp
app.UseExceptionHandler(appBuilder =>
{
    appBuilder.Run(async context =>
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = 500,
            Title = "An error occurred"
        });
    });
});
\`\`\`
`,
      },
    ],
    prompts: [
      {
        name: 'Create Minimal API',
        slug: 'create-minimal-api',
        description: 'Generate a .NET Minimal API endpoint',
        content: `---
name: "Create Minimal API"
slug: "create-minimal-api"
category: "code-generation"
trigger:
  slash: "/dotnet-api"
  keywords: ["dotnet", "minimal", "api", "endpoint"]
---

# Create .NET Minimal API

Generate Minimal API endpoints following .NET best practices.

## Usage

\`\`\`
/dotnet-api User CRUD endpoints
\`\`\`

## Template

Create Minimal API endpoints with:

1. Proper route mapping
2. Dependency injection
3. Result pattern handling
4. OpenAPI documentation
5. Validation

## Example Output

\`\`\`csharp
public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .WithOpenApi();

        group.MapGet("/", GetAllUsers)
            .WithName("GetAllUsers")
            .WithSummary("Get all users");

        group.MapGet("/{id:int}", GetUserById)
            .WithName("GetUserById")
            .WithSummary("Get user by ID");

        group.MapPost("/", CreateUser)
            .WithName("CreateUser")
            .WithSummary("Create new user");

        group.MapPut("/{id:int}", UpdateUser)
            .WithName("UpdateUser")
            .WithSummary("Update user");

        group.MapDelete("/{id:int}", DeleteUser)
            .WithName("DeleteUser")
            .WithSummary("Delete user");
    }

    private static async Task<IResult> GetAllUsers(IUserService userService)
    {
        var users = await userService.GetAllAsync();
        return Results.Ok(users);
    }

    private static async Task<IResult> GetUserById(int id, IUserService userService)
    {
        var user = await userService.GetByIdAsync(id);
        return user is not null ? Results.Ok(user) : Results.NotFound();
    }

    private static async Task<IResult> CreateUser(
        CreateUserRequest request,
        IUserService userService,
        IValidator<CreateUserRequest> validator)
    {
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return Results.ValidationProblem(validationResult.ToDictionary());

        var user = await userService.CreateAsync(request);
        return Results.Created($"/api/users/{user.Id}", user);
    }
}
\`\`\`
`,
      },
    ],
  },
};

/**
 * Main add-stack command handler
 */
export async function addStackCommand(stack: string, options: AddStackOptions): Promise<void> {
  const spinner = ora();

  console.log(chalk.cyan(`\n📦 Adding ${stack} Stack Configuration\n`));

  try {
    // Validate stack
    const stackConfig = stacks[stack];
    if (!stackConfig) {
      console.log(chalk.red(`❌ Unknown stack: ${stack}`));
      console.log(chalk.gray('\nAvailable stacks:'));
      for (const [key, config] of Object.entries(stacks)) {
        console.log(chalk.gray(`  - ${key} (${config.displayName})`));
      }
      return;
    }

    // Get version
    let version = options.version || stackConfig.defaultVersion;

    if (!options.version) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'version',
          message: `Select ${stackConfig.displayName} version:`,
          choices: stackConfig.versions,
          default: stackConfig.defaultVersion,
        },
      ]);
      version = answers.version;
    }

    console.log(chalk.gray(`Using ${stackConfig.displayName} version ${version}\n`));

    // Create directories
    const stackDir = `stacks/${stack}`;
    await fs.ensureDir(path.join(stackDir, 'agents'));
    await fs.ensureDir(path.join(stackDir, 'instructions'));
    await fs.ensureDir(path.join(stackDir, 'prompts'));

    // Add agents
    spinner.start('Adding agents...');
    for (const agent of stackConfig.agents) {
      const agentPath = path.join(stackDir, 'agents', `${agent.slug}.agent.md`);
      await fs.writeFile(agentPath, agent.content);
    }
    spinner.succeed(`Added ${stackConfig.agents.length} agents`);

    // Add instructions
    spinner.start('Adding instructions...');
    for (const instruction of stackConfig.instructions) {
      const instructionPath = path.join(stackDir, 'instructions', `${instruction.slug}.instructions.md`);
      await fs.writeFile(instructionPath, instruction.content);
    }
    spinner.succeed(`Added ${stackConfig.instructions.length} instruction files`);

    // Add prompts
    spinner.start('Adding prompts...');
    for (const prompt of stackConfig.prompts) {
      const promptPath = path.join(stackDir, 'prompts', `${prompt.slug}.prompt.md`);
      await fs.writeFile(promptPath, prompt.content);
    }
    spinner.succeed(`Added ${stackConfig.prompts.length} prompts`);

    // Update Memory Bank
    spinner.start('Updating Memory Bank...');
    const mbPath = '.memory-bank/project/context.md';
    if (await fs.pathExists(mbPath)) {
      let content = await fs.readFile(mbPath, 'utf-8');

      // Add stack to technical stack section if not already present
      if (!content.includes(stackConfig.displayName)) {
        content = content.replace(
          '## Technical Stack',
          `## Technical Stack\n\n**Primary Stack:** ${stackConfig.displayName} ${version}\n`
        );
        await fs.writeFile(mbPath, content);
      }
    }
    spinner.succeed('Updated Memory Bank');

    // Summary
    console.log(chalk.cyan('\n✨ Stack configuration added successfully!\n'));
    console.log(chalk.white('Created:'));
    console.log(chalk.green(`  ✓ ${stackDir}/`));
    console.log(chalk.gray(`    ├── agents/ (${stackConfig.agents.length} files)`));
    console.log(chalk.gray(`    ├── instructions/ (${stackConfig.instructions.length} files)`));
    console.log(chalk.gray(`    └── prompts/ (${stackConfig.prompts.length} files)`));

    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray('  1. Review the generated files'));
    console.log(chalk.gray('  2. Customize agents and prompts for your project'));
    console.log(chalk.gray('  3. Run `egce validate` to verify configuration'));

  } catch (error) {
    spinner.fail('Failed to add stack');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export default addStackCommand;
