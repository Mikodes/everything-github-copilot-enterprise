# Codebase Explorer Prompt

## Purpose

Guide new team members through a structured exploration of the codebase, helping them understand architecture, key components, and how different parts work together.

## Prompt Template

```markdown
# Codebase Exploration Session

## Context
I'm a new team member exploring the codebase for the first time. I need a guided tour that helps me understand how things work and where to find what I need.

## My Background
- **Previous experience**: [Your tech stack experience]
- **Familiarity with this stack**: [None/Basic/Intermediate]
- **Focus areas**: [What you'll be working on]

## Exploration Request

Please guide me through the codebase with focus on:

### 1. High-Level Architecture
- What are the main components/services?
- How do they communicate?
- What are the key data flows?

### 2. Entry Points
- Where does execution start?
- What are the main API endpoints?
- How are requests processed?

### 3. Core Business Logic
- Where is the domain logic located?
- What are the key business rules?
- How is data validated and transformed?

### 4. Data Layer
- What databases are used?
- How is data accessed (ORM, raw SQL)?
- What are the key entities/models?

### 5. Testing Structure
- Where are tests located?
- What testing frameworks are used?
- How do I run tests locally?

### 6. Configuration & Environment
- Where are configuration files?
- How do environment variables work?
- What's different between dev/staging/prod?

## Desired Output Format

For each area explored, provide:
1. **Location**: File paths and directories
2. **Purpose**: What this code does
3. **Key Files**: Most important files to understand
4. **Connections**: How it relates to other components
5. **Tips**: Things to watch out for or remember

## Memory Bank Context

Please reference:
- Active ADRs relevant to architecture
- Module documentation
- Team conventions for this area
```

## Usage Examples

### Example 1: Backend API Exploration

```markdown
# Codebase Exploration: Backend API

## Context
I'm joining as a backend developer and need to understand our API structure.

## My Background
- **Previous experience**: Node.js, Express, PostgreSQL
- **Familiarity with this stack**: Basic (Java/Spring is new to me)
- **Focus areas**: User authentication and authorization

## Exploration Request
Please guide me through:
1. The authentication flow
2. How controllers handle requests
3. Where authorization logic lives
4. How errors are handled
5. The testing approach for API endpoints
```

### Example 2: Frontend Exploration

```markdown
# Codebase Exploration: Frontend Application

## Context
I'm a new frontend developer exploring our React application.

## My Background
- **Previous experience**: Vue.js, Angular
- **Familiarity with this stack**: Intermediate (React experience)
- **Focus areas**: Component library and state management

## Exploration Request
Please guide me through:
1. Component organization and naming
2. State management patterns used
3. Styling approach (CSS modules, styled-components, etc.)
4. How API calls are made
5. Testing strategy for components
```

### Example 3: Data Pipeline Exploration

```markdown
# Codebase Exploration: Data Pipeline

## Context
I'm joining the data team and need to understand our ETL processes.

## My Background
- **Previous experience**: Python, Apache Airflow
- **Familiarity with this stack**: None (first time with this setup)
- **Focus areas**: Daily reporting pipelines

## Exploration Request
Please guide me through:
1. Pipeline orchestration setup
2. Data sources and sinks
3. Transformation logic location
4. Monitoring and alerting
5. How to run pipelines locally
```

## Response Format

When responding to this prompt, structure the exploration as:

```markdown
# Codebase Exploration Results

## Overview Map
[ASCII diagram or description of component relationships]

## Exploration by Area

### 1. [Area Name]

**Location**: `src/path/to/component`

**Purpose**: Brief description of what this does

**Key Files**:
| File | Purpose |
|------|---------|
| `file1.ts` | Main entry point |
| `file2.ts` | Core business logic |

**Code Example**:
```typescript
// Example of how this is used
```

**Connections**:
- Imports from: [modules]
- Exports to: [modules]
- Depends on: [services]

**Tips**:
- Watch out for X
- Remember that Y
- Convention is Z

### 2. [Next Area]
...

## Quick Reference

### Important Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm test` | Run test suite |

### Key Directories
| Directory | Contents |
|-----------|----------|
| `src/api` | API endpoints |
| `src/services` | Business logic |

## Next Steps
1. Explore X in more detail
2. Try modifying Y
3. Review ADR-XXX for context on Z

## Related Memory Bank Entries
- Module: [module-name]
- ADR: [ADR-XXX]
- Knowledge: [relevant-entry]
```

## Tips for Effective Exploration

### For New Developers
1. **Don't try to understand everything at once** - Focus on your immediate work area
2. **Follow the data** - Trace a request from start to finish
3. **Read tests** - They often explain expected behavior
4. **Check Git history** - Recent changes show active areas
5. **Ask questions** - Document answers for future team members

### For Guides (AI or Human)
1. **Start high, go deep** - Overview first, details later
2. **Use real examples** - Point to actual code, not abstractions
3. **Explain the "why"** - Context matters more than syntax
4. **Highlight gotchas** - Warn about common pitfalls
5. **Connect to tasks** - Relate to work they'll actually do

## Integration with Memory Bank

This prompt works best when combined with Memory Bank context:

```yaml
memory_bank_queries:
  - project_context: "Get architecture overview"
  - module_context: "Get details for explored module"
  - decision_records: "Find ADRs affecting this area"
  - knowledge_entries: "Find tips and conventions"
```

---

*Use this prompt to get a structured, comprehensive tour of any codebase area. Combine with the Memory Bank for historical context and team conventions.*
