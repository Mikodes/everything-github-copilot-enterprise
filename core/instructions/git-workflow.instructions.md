---
applyTo: "**/*"
excludeAgent: ""
---

# Git Workflow Standards

These standards define how we use Git in this project. Following these practices ensures a clean history, easy collaboration, and reliable deployments.

## Branching Strategy

### Branch Types

| Branch Type | Pattern | Purpose | Lifetime |
|-------------|---------|---------|----------|
| `main` | `main` | Production-ready code | Permanent |
| `develop` | `develop` | Integration branch | Permanent |
| `feature` | `feature/<ticket>-<description>` | New features | Until merged |
| `bugfix` | `bugfix/<ticket>-<description>` | Bug fixes | Until merged |
| `hotfix` | `hotfix/<ticket>-<description>` | Production fixes | Until merged |
| `release` | `release/<version>` | Release preparation | Until released |

### Branch Naming Convention

```
<type>/<ticket-id>-<short-description>

Examples:
feature/PROJ-123-add-user-authentication
bugfix/PROJ-456-fix-order-calculation
hotfix/PROJ-789-security-patch
release/1.2.0
```

### Branch Rules

#### Protected Branches

- `main` and `develop` are protected
- Direct pushes are NOT allowed
- All changes via Pull Request
- Required reviews before merge
- CI must pass before merge

#### Feature Branch Workflow

```
1. Create branch from develop
   git checkout develop
   git pull origin develop
   git checkout -b feature/PROJ-123-new-feature

2. Work on feature (commit frequently)
   git add .
   git commit -m "feat(module): add feature description"

3. Keep branch updated
   git fetch origin develop
   git rebase origin/develop

4. Push and create PR
   git push -u origin feature/PROJ-123-new-feature
   # Create PR to develop

5. After approval, merge
   # Squash merge preferred for clean history
```

## Commit Messages

### Format: Conventional Commits

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(orders): correct total calculation` |
| `docs` | Documentation | `docs(readme): update setup instructions` |
| `style` | Formatting | `style(api): fix indentation` |
| `refactor` | Code restructuring | `refactor(users): extract validation logic` |
| `test` | Adding tests | `test(orders): add unit tests for OrderService` |
| `chore` | Maintenance | `chore(deps): update Spring Boot to 3.2` |
| `perf` | Performance | `perf(queries): optimize customer search` |
| `ci` | CI/CD changes | `ci(github): add SonarQube analysis` |

### Scope

The scope should be the module or component affected:
- `auth`, `orders`, `users`, `api`, `db`, `config`

### Subject Line Rules

1. **Imperative mood**: "add" not "added" or "adds"
2. **Lowercase**: Don't capitalize first letter
3. **No period**: Don't end with a period
4. **Max 50 characters**: Keep it concise

### Body (Optional)

- Explain **what** and **why**, not how
- Wrap at 72 characters
- Separate from subject with blank line

### Footer (Optional)

- Reference issues: `Closes #123`
- Breaking changes: `BREAKING CHANGE: description`

### Examples

```
feat(auth): add multi-factor authentication support

Implement TOTP-based 2FA using Google Authenticator compatible tokens.
Users can enable 2FA from their security settings.

- Add TOTP secret generation
- Add QR code generation for setup
- Add verification endpoint

Closes #234
```

```
fix(orders): prevent negative quantities in cart

Validate quantity is positive before adding to cart.
Previously, negative values could bypass price calculations.

Fixes #456
```

```
refactor(users): extract address validation to separate service

Move address validation logic from UserService to AddressValidator
for better separation of concerns and reusability.

No functional changes.
```

## Pull Requests

### PR Title Format

Same as commit message format:
```
feat(auth): add OAuth2 authentication
```

### PR Description Template

```markdown
## Summary

Brief description of what this PR does.

## Changes

- Change 1
- Change 2
- Change 3

## Type of Change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation
- [ ] Other: ___

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed my code
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] No new warnings introduced

## Related Issues

Closes #XXX

## Screenshots (if applicable)

[Add screenshots here]
```

### PR Best Practices

1. **Small PRs**: Easier to review, faster feedback
2. **Single Purpose**: One feature/fix per PR
3. **Self-Review First**: Review your own code before requesting
4. **Descriptive**: Explain what and why
5. **Tests Included**: Don't skip tests
6. **CI Passing**: All checks green before review

### Merge Strategies

| Strategy | When to Use |
|----------|------------|
| **Squash Merge** | Feature branches to develop (clean history) |
| **Merge Commit** | Release branches to main (preserve history) |
| **Rebase** | Updating feature branch from develop |

## Code Review

### As Author

- Respond to all comments
- Explain decisions when needed
- Don't take feedback personally
- Request re-review after changes

### As Reviewer

- Be constructive and specific
- Approve when acceptable, not perfect
- Use suggestions for minor changes
- Request changes for blocking issues

## Git Hygiene

### Do's

✅ Pull before starting work
✅ Commit frequently with meaningful messages
✅ Keep branches short-lived
✅ Delete merged branches
✅ Rebase feature branches on develop

### Don'ts

❌ Force push to shared branches
❌ Commit directly to main/develop
❌ Leave branches open for weeks
❌ Commit secrets or credentials
❌ Use vague commit messages

### Useful Commands

```bash
# Update your branch with develop
git fetch origin develop
git rebase origin/develop

# Interactive rebase to clean up commits
git rebase -i HEAD~3

# Amend last commit
git commit --amend

# Stash changes temporarily
git stash
git stash pop

# View branch graph
git log --oneline --graph --all
```

## CI/CD Integration

### Required Checks

All PRs must pass:
- Build
- Unit tests
- Linting
- Security scan

### Deployment Flow

```
feature → develop (auto-deploy to dev)
develop → release (auto-deploy to staging)
release → main (manual deploy to production)
```

## Memory Bank Integration

- Document significant Git workflow decisions in ADRs
- Update team context when workflow changes
- Reference workflow in onboarding documentation
