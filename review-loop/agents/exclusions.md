# File Exclusion Patterns

## Universal Exclusions (always exclude from diff)

```
*.md              # Documentation (unless reviewing docs)
*.txt             # Plain text files
*.lock            # Generic lock files
.gitignore        # Git configuration
.gitattributes    # Git attributes
LICENSE*          # License files
CHANGELOG*        # Changelog files
*.log             # Log files
```

## Stack-Specific Exclusions

Detect project stack and apply relevant exclusions:

| Stack Indicator | Exclusions |
|-----------------|------------|
| `package.json` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `node_modules/` |
| `Cargo.toml` | `Cargo.lock`, `target/` |
| `go.mod` | `go.sum`, `vendor/` |
| `flake.nix` | `flake.lock`, `result/` |
| `pyproject.toml` / `setup.py` | `poetry.lock`, `Pipfile.lock`, `*.pyc`, `__pycache__/`, `.venv/` |
| `Gemfile` | `Gemfile.lock` |
| `composer.json` | `composer.lock` |
| `*.csproj` / `*.sln` | `packages.lock.json` |

## Other Common Exclusions

```
.env*             # Environment files (security)
*.min.js          # Minified files
*.min.css
*.map             # Source maps
dist/             # Build outputs
build/
.DS_Store         # OS files
Thumbs.db
```

## Diff Command Template

```bash
git diff <TARGET_BRANCH>...HEAD -- . \
  ':!*.md' ':!*.txt' ':!*.lock' ':!LICENSE*' ':!CHANGELOG*' \
  ':!<stack-specific-exclusions>' \
  ':!*.log' ':!.gitignore' ':!dist/' ':!build/'
```
