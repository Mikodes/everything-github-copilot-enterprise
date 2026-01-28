# Review Feedback Prompt

## Purpose

Generate structured, constructive code review feedback that is specific, actionable, and maintains a positive team dynamic while ensuring quality standards.

---

## Prompt Template

```markdown
# Generate Code Review Feedback

## Context
- **PR Number**: [#XXX]
- **Author**: [Developer name/level]
- **PR Type**: [Feature / Bug Fix / Refactor / Docs]
- **Files Changed**: [List of main files]
- **Lines Changed**: [+XX / -XX]

## Code to Review
```[language]
[Paste the code section to review]
```

## Review Focus Areas
- [ ] Correctness
- [ ] Security
- [ ] Performance
- [ ] Maintainability
- [ ] Testing
- [ ] Standards

## Team Context
- **Coding Conventions**: [Link or summary]
- **Relevant ADRs**: [List any relevant decisions]
- **Module Context**: [Any relevant Memory Bank context]

## Generate Feedback

Please provide structured feedback including:

### 1. Summary Assessment
Brief overall impression of the changes

### 2. Issues Found
List any blockers or issues with:
- What: The specific concern
- Where: File and line number
- Why: Impact or risk
- How: Suggested fix

### 3. Suggestions
Non-blocking improvement ideas

### 4. Positive Observations
What was done well

### 5. Questions
Clarifications needed

### 6. Verdict
Approve / Request Changes / Needs Discussion
```

---

## Usage Examples

### Example 1: Feature Review

```markdown
# Generate Code Review Feedback

## Context
- **PR Number**: #234
- **Author**: Sarah (mid-level)
- **PR Type**: Feature
- **Files Changed**: UserService.ts, UserController.ts, user.test.ts
- **Lines Changed**: +180 / -20

## Code to Review
```typescript
// UserService.ts
export class UserService {
  async createUser(data: CreateUserDTO): Promise<User> {
    // Check if email exists
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already exists');
    }

    // Create user
    const user = new User();
    user.email = data.email;
    user.password = data.password; // Store password
    user.name = data.name;
    user.role = data.role || 'user';

    return this.userRepo.save(user);
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    return user;
  }
}
```

## Review Focus Areas
- [x] Correctness
- [x] Security
- [x] Performance
- [ ] Maintainability
- [x] Testing
- [ ] Standards

## Team Context
- **Coding Conventions**: See team-conventions.instructions.md
- **Relevant ADRs**: ADR-008 (Password Hashing)
- **Module Context**: User module uses bcrypt for passwords

## Generate Feedback
```

### Expected Output

```markdown
## Code Review: PR #234 - User Creation Feature

### 1. Summary Assessment
The feature implementation covers the basic user creation flow well. However, there's a critical security issue with password handling that must be addressed before merge. The overall structure follows team patterns.

### 2. Issues Found

#### :stop_sign: Blocker: Password Stored in Plain Text

**What**: Password is being stored directly without hashing (line 14)

**Where**: `UserService.ts:14`

**Why**: Storing plain text passwords is a critical security vulnerability. If the database is compromised, all user passwords are exposed.

**How**: Hash the password before storage using bcrypt (per ADR-008):
```typescript
import { hash } from 'bcrypt';

const SALT_ROUNDS = 12;

// In createUser:
user.password = await hash(data.password, SALT_ROUNDS);
```

**Reference**: ADR-008, security-baseline.instructions.md

---

#### :warning: Issue: No Input Validation

**What**: No validation on email format, password strength, or name

**Where**: `UserService.ts:3-17`

**Why**: Invalid data could be stored, leading to issues with email delivery, weak passwords, or data quality problems.

**How**: Add validation using class-validator:
```typescript
import { IsEmail, MinLength, IsString } from 'class-validator';

class CreateUserDTO {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}
```

---

#### :warning: Issue: Missing Null Check

**What**: `getUser` doesn't handle case when user not found

**Where**: `UserService.ts:20-22`

**Why**: Will return `null` or `undefined` which could cause issues in consuming code.

**How**: Throw a specific exception:
```typescript
async getUser(id: string): Promise<User> {
  const user = await this.userRepo.findById(id);
  if (!user) {
    throw new NotFoundException(`User with id ${id} not found`);
  }
  return user;
}
```

### 3. Suggestions

#### :bulb: Consider Transaction Wrapper

The email uniqueness check and user creation could have a race condition. Consider wrapping in a transaction:
```typescript
await this.dataSource.transaction(async (manager) => {
  // Check and create within transaction
});
```

#### :bulb: Add Logging

Consider adding logging for user creation events for audit purposes:
```typescript
this.logger.info('User created', { userId: user.id, email: user.email });
```

### 4. Positive Observations

:star: **Good**: Clean separation between controller and service layers.

:star: **Good**: Email uniqueness check before creation - prevents duplicates.

:star: **Good**: Default role assignment is a nice defensive pattern.

### 5. Questions

1. Should we add rate limiting to prevent abuse of the registration endpoint?
2. Do we need email verification before activating the account?

### 6. Verdict

:red_circle: **Request Changes**

The security issue with plain text password storage must be fixed before this can be merged. Once that's addressed along with the input validation, this will be good to go.
```

---

### Example 2: Bug Fix Review

```markdown
# Generate Code Review Feedback

## Context
- **PR Number**: #456
- **Author**: Mike (senior)
- **PR Type**: Bug Fix
- **Files Changed**: PaymentProcessor.ts, payment.test.ts
- **Lines Changed**: +25 / -5

## Code to Review
```typescript
// PaymentProcessor.ts - Fix for PROJ-789
export class PaymentProcessor {
  async processPayment(order: Order): Promise<PaymentResult> {
    // Validate order before processing
    if (!order.items || order.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    const amount = this.calculateTotal(order);

    // Fix: Check for zero/negative amounts
    if (amount <= 0) {
      throw new ValidationError('Payment amount must be positive');
    }

    try {
      const result = await this.paymentGateway.charge(order.userId, amount);
      await this.orderRepo.updatePaymentStatus(order.id, 'paid');
      return result;
    } catch (error) {
      await this.orderRepo.updatePaymentStatus(order.id, 'failed');
      throw new PaymentError('Payment processing failed', { cause: error });
    }
  }
}
```

## Review Focus Areas
- [x] Correctness (root cause fixed?)
- [x] Testing (regression test?)
- [x] No side effects

## Generate Feedback
```

### Expected Output

```markdown
## Code Review: PR #456 - Payment Amount Validation Fix

### 1. Summary Assessment
Clean, focused bug fix that addresses the root cause. Good defensive coding with the validation checks. Test coverage confirms the fix.

### 2. Issues Found

No blocking issues found.

### 3. Suggestions

#### :bulb: Consider Logging Failed Payments

For debugging and monitoring, consider adding a log entry when payments fail:
```typescript
catch (error) {
  this.logger.warn('Payment failed', {
    orderId: order.id,
    amount,
    error: error.message
  });
  // ... rest of error handling
}
```

### 4. Positive Observations

:star: **Excellent**: Root cause properly addressed - validating amount before processing.

:star: **Excellent**: Comprehensive error handling with proper status updates.

:star: **Nice**: Using cause chaining for error context - great for debugging.

:star: **Good**: Checking for both zero AND negative amounts.

### 5. Questions

None - the fix is clear and well-documented.

### 6. Verdict

:white_check_mark: **Approve**

Solid fix with good test coverage. The suggestion for logging is optional but recommended for production monitoring.
```

---

## Feedback Tone Guidelines

### Professional and Constructive
```yaml
instead_of: "This is wrong"
use: "This approach has a potential issue because..."

instead_of: "You should know better"
use: "A safer pattern here would be..."

instead_of: "This is terrible"
use: "This needs significant revision because..."

instead_of: "Obviously this is..."
use: "Note that this..."
```

### Balancing Criticism
```yaml
ratio: "Aim for at least 1 positive for every 2-3 critiques"

why: |
  - Maintains morale
  - Encourages good practices
  - Makes feedback more receptive
  - Builds team culture

exceptions: |
  - Critical security issues: address directly
  - Repeated mistakes: focus on learning
```

### Adjusting for Experience Level

#### Junior Developers
```yaml
approach:
  - More explanation of "why"
  - Link to learning resources
  - Offer to pair if helpful
  - Celebrate improvements
  - Be encouraging

example: |
  :bulb: **Learning Opportunity**: This is a great chance to learn about
  the Repository pattern! The approach here could be improved by...

  Here's a resource that explains this well: [link]
```

#### Senior Developers
```yaml
approach:
  - Assume knowledge of basics
  - Focus on design decisions
  - Ask questions to understand choices
  - Discuss trade-offs
  - Peer discussion tone

example: |
  :thinking: **Question**: I noticed you chose X over Y here.
  Was that to address the performance concern mentioned in the ticket,
  or is there another consideration I'm missing?
```

---

## Integration with Memory Bank

### Include Relevant Context
```markdown
## Memory Bank Context Applied

Based on project context, I've considered:

- **ADR-012**: This aligns with our API versioning strategy
- **Module: auth-service**: Follows established auth patterns
- **Recent Decision**: Uses the new error handling approach from last sprint
```

### Flag for Updates
```markdown
## Memory Bank Updates Needed

This PR introduces patterns that should be documented:

- [ ] Add knowledge entry for new caching strategy
- [ ] Update module context for auth-service
- [ ] Consider ADR for new validation approach
```

---

*Use this prompt to generate consistent, helpful code review feedback that maintains quality while building a positive team dynamic.*
