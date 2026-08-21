# Contributing to INTUTER

We're excited you want to contribute to INTUTER! This document outlines our process and guidelines.

## Code of Conduct

- Be respectful and inclusive to all contributors
- Provide constructive feedback
- Focus on ideas, not individuals
- Help others grow and learn

## Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/anime.git
cd anime
```

### 2. Set Up Development Environment
```bash
cd anime-studio
npm install
cp .env.example .env
# Edit .env with your credentials
npm run migrate
npm run dev:web
```

### 3. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## Development Guidelines

### Code Style

#### JavaScript
- Use ES6+ features (const/let, arrow functions, template literals)
- Write clear, self-documenting code
- Add comments for complex logic only
- Keep functions small and focused (~50 lines max)
- Use meaningful variable names

```javascript
// ✅ Good
const calculateLearningScore = (completed, total) => {
  return Math.round((completed / total) * 100);
};

// ❌ Avoid
function cs(c, t) {
  return Math.round((c / t) * 100);
}
```

#### CSS
- Use CSS variables for colors and spacing
- Follow BEM naming convention where applicable
- Mobile-first responsive design
- Group related properties

```css
/* ✅ Good */
.chat-message {
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg-secondary);
}

.chat-message--user {
  background-color: var(--color-primary);
}

/* ❌ Bad */
.chatMessage { padding: 16px; }
.user-chat-message { ... }
```

#### HTML
- Use semantic elements (`<header>`, `<main>`, `<section>`, etc.)
- Proper heading hierarchy (h1 → h6)
- Accessible ARIA labels where needed
- Keep markup lean and organized

### Database Changes

**Creating a Migration:**
```bash
npx sequelize-cli migration:generate --name your-migration-name

# Edit migrations/20251223XXXXXX-your-migration-name.js
# Run: npx sequelize-cli db:migrate
```

**Never:**
- Manually delete/alter database tables
- Skip migrations in deployments
- Hard-code database connection strings

### API Development

**Endpoint Structure:**
```javascript
// routes/api/topics.js
router.post('/:sessionId/topics', async (req, res) => {
  try {
    // Validate input
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    // Process
    const topic = await Topic.create({ sessionId, name, description });

    // Respond
    res.status(201).json({ data: topic });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Response Format:**
```json
{
  "data": { ... },
  "error": null,
  "timestamp": "2025-12-23T10:30:00Z"
}
```

### Testing

**Before committing:**
```bash
# Test API endpoints
npm run test:api

# Test UI interactions
npm run test:ui

# Lint code
npm run lint

# Build check
npm run build
```

## Commit Guidelines

### Commit Message Format
```
type(scope): Brief description

Detailed explanation of what changed and why.
- Bullet point for significant changes
- Another important detail

Fixes #123
Closes #456
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style (no logic change)
- `refactor:` Code restructuring
- `perf:` Performance improvement
- `test:` Test additions/changes
- `chore:` Build/dependency updates

### Examples
```
feat(chat): Add file attachment support

- Support image uploads (JPEG, PNG, WebP)
- Support PDF uploads up to 20MB
- Preview attachments before sending
- Store attachments in message history

Fixes #234
```

```
fix(revision): Correct tag rendering in knowledge popup

The popup was not displaying related concepts correctly.
This was due to incorrect filtering in the knowledgeNodes array.

Closes #345
```

## Pull Request Process

### Before Opening a PR
1. ✅ Ensure all tests pass
2. ✅ Rebase on latest `main`
3. ✅ Run linter and fix issues
4. ✅ Update relevant documentation
5. ✅ Add yourself to CONTRIBUTORS.md

### PR Template
```markdown
## Description
Brief summary of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing Done
- [ ] Manual testing in web
- [ ] Manual testing in desktop
- [ ] Unit tests added
- [ ] E2E tests added

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Code follows style guidelines
- [ ] Commit messages are clear
- [ ] Documentation updated
- [ ] No console errors/warnings
```

## Feature Development

### Adding a New Learning Mode Feature

1. **Create feature branch:**
   ```bash
   git checkout -b feature/new-learning-feature
   ```

2. **Add database model** (if needed):
   ```bash
   # Create migration
   npx sequelize-cli migration:generate --name add-feature-table
   
   # Create model in models/
   ```

3. **Add backend API:**
   ```javascript
   // routes/api/feature.js
   router.post('/create', async (req, res) => { ... });
   ```

4. **Add frontend UI:**
   ```javascript
   // anime-studio/featureManager.js
   export class FeatureManager { ... }
   ```

5. **Update main app file:**
   ```javascript
   // anime-studio/app.js
   import { FeatureManager } from './featureManager.js';
   ```

6. **Test thoroughly:**
   - Test in web browser
   - Test in Electron desktop
   - Test with different browsers
   - Check mobile responsiveness

7. **Update documentation:**
   - Update README.md
   - Update IMPROVEMENT_PLAN.md
   - Add inline code comments

## Performance Considerations

### Frontend
- Lazy load components
- Minimize DOM manipulations
- Use event delegation
- Optimize images
- Debounce search/input events

```javascript
// ✅ Good - Debounce search
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

const handleSearch = debounce((query) => {
  // API call
}, 300);
```

### Backend
- Use database indexes
- Pagination for large datasets
- Query optimization (eager loading)
- Response caching
- Connection pooling

```javascript
// ✅ Good - Paginated response
router.get('/questions', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  const questions = await UserQuestion.findAll({
    offset, limit,
    include: ['subtopic']
  });
  
  res.json({ data: questions, page, limit });
});
```

## Documentation

### Updating Documentation
- Keep README.md current
- Document new APIs
- Add examples for complex features
- Update IMPROVEMENT_PLAN.md with progress

### Code Comments
Only comment the "why", not the "what":
```javascript
// ✅ Good
// We use ultra-condensed content for initial context
// to stay within token limits
const context = await getUltraCondensed(subtopicId);

// ❌ Bad
// Get the ultra condensed content
const context = await getUltraCondensed(subtopicId);
```

## Review Process

Your PR will be reviewed by maintainers:
1. Code quality check
2. Testing verification
3. Documentation review
4. Performance assessment
5. Security audit

**Be patient!** Reviews may take 2-7 days. We'll provide constructive feedback.

## Running INTUTER Locally

```bash
# Install dependencies
cd anime-studio && npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run db:migrate

# Start development server
npm run dev:web

# In another terminal, start Electron
npm start
```

## Reporting Issues

### Bug Report
```markdown
**Describe the bug:**
Clear description of the issue

**To Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What should happen

**Screenshots:**
[If applicable]

**Environment:**
- Browser: Chrome 120
- OS: macOS/Windows/Linux
- Node version: 18.x
```

### Feature Request
```markdown
**Description:**
Clear description of what you want

**Use Case:**
Why is this needed?

**Proposed Solution:**
How should it work?

**Alternatives:**
Other approaches considered
```

## Questions?

- **Discord**: [Join our community](#)
- **Discussions**: GitHub Discussions tab
- **Email**: dev@intuter.ai

---

## Resources

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Database Schema](docs/schema.md)

Thank you for contributing to INTUTER! 🚀
