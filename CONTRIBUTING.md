# Contributing to MITI

First off, thank you for considering contributing to MITI! It's people like you that make MITI such a great tool for the ROS2 community.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct of being respectful and inclusive to all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, screenshots, etc.)
- **Describe the behavior you observed and what you expected**
- **Include details about your environment** (OS, ROS2 version, browser, etc.)

**Bug Report Template:**
```markdown
**Description:**
A clear description of the bug.

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What you expected to happen.

**Actual Behavior:**
What actually happened.

**Environment:**
- OS: [e.g., Ubuntu 22.04]
- ROS2 Distribution: [e.g., Humble]
- Browser: [e.g., Chrome 120]
- MITI Version: [e.g., 1.0.0]

**Screenshots:**
If applicable, add screenshots.

**Additional Context:**
Any other relevant information.
```

### Suggesting Enhancements

Enhancement suggestions are welcome! Before creating an enhancement suggestion:

- **Check if the enhancement has already been suggested**
- **Provide a clear use case** for the enhancement
- **Explain how it would be useful** to most MITI users

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** used in the project
3. **Write clear, descriptive commit messages**
4. **Update documentation** if you're adding or changing features
5. **Test your changes** thoroughly
6. **Ensure your code builds** without errors or warnings

#### Pull Request Process

1. **Update the README.md** with details of changes if applicable
2. **Follow the code style** guidelines below
3. **Include tests** for new features when possible
4. **Ensure CI passes** (if configured)
5. **Request review** from maintainers

**Pull Request Template:**
```markdown
**Description:**
Brief description of what this PR does.

**Type of Change:**
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

**Testing:**
Describe the tests you ran and how to reproduce them.

**Checklist:**
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have tested my changes thoroughly

**Screenshots (if applicable):**
Add screenshots to help explain your changes.

**Related Issues:**
Closes #[issue number]
```

## Development Setup

1. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/miti.git
   cd miti
   ```

2. **Install dependencies:**
   ```bash
   bun install  # or npm install
   ```

3. **Start development server:**
   ```bash
   bun dev  # or npm run dev
   ```

4. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Coding Style Guidelines

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **functional component** patterns for React
- Use **hooks** instead of class components
- Prefer **const** over let, avoid var
- Use **arrow functions** for callbacks
- Use **async/await** over promises when possible

### Component Structure

```typescript
'use client';  // If client component

import { useState } from 'react';
import { SomeIcon } from 'lucide-react';
import { someUtil } from '@/lib/utils';
import { commonStyles } from '@/styles';

interface MyComponentProps {
  prop1: string;
  prop2?: number;
}

export default function MyComponent({ prop1, prop2 = 0 }: MyComponentProps) {
  const [state, setState] = useState(false);

  const handleClick = () => {
    // Handler logic
  };

  return (
    <div className={commonStyles.container}>
      {/* JSX */}
    </div>
  );
}
```

### Styling

- Use **centralized style modules** in `src/styles/`
- Import from `@/styles` for consistency
- Use **Tailwind CSS classes** in style constants
- Use the `cn()` helper for conditional classes
- Keep styles organized by feature

Example:
```typescript
import { visualizationStyles, cn } from '@/styles';

<div className={cn(
  visualizationStyles.camera.container,
  isActive && visualizationStyles.camera.active
)}>
```

### File Naming

- **Components**: PascalCase (e.g., `MyComponent.tsx`)
- **Utilities**: camelCase (e.g., `myUtil.ts`)
- **Types**: PascalCase (e.g., `MyTypes.ts`)
- **Styles**: kebab-case with .styles suffix (e.g., `my-feature.styles.ts`)

### Git Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add point cloud color mapping options
fix: resolve URDF mesh loading CORS issue
docs: update installation instructions for ROS2 Iron
refactor: extract styles from visualization components
```

## Project Structure

Please maintain the feature-based organization:

```
src/
├── components/features/    # Feature-specific components
├── hooks/                  # Global React hooks
├── lib/                    # Core libraries
├── styles/                 # Centralized style modules
└── types/                  # TypeScript definitions
```

## Testing Guidelines

While we don't have automated tests yet, please manually test:

- **Functionality**: Does your change work as expected?
- **Edge cases**: Test with empty data, large datasets, errors
- **Performance**: Does it impact performance?
- **Compatibility**: Test on different browsers (Chrome, Firefox, Safari)
- **ROS2 integration**: Test with real ROS2 topics when applicable

## Documentation

When adding new features:

1. **Update README.md** with usage examples
2. **Add JSDoc comments** to complex functions
3. **Include inline comments** for non-obvious code
4. **Update type definitions** if adding new interfaces

## Questions?

Feel free to:
- **Open an issue** for questions
- **Start a discussion** in GitHub Discussions (if enabled)
- **Reach out to maintainers** via issue comments

## Recognition

Contributors will be recognized in the project README and release notes. Thank you for your contributions! 🎉
