# CLAUDE.md — PersonalMedia

## Project Overview

PersonalMedia is a personal media management application. The repository is in its early stages with project scaffolding in place but no source code committed yet.

- **Author**: mwmoseley (Mark Moseley)
- **Primary stack**: .NET (C#) — inferred from the Visual Studio .gitignore template
- **Repository**: `mwmoseley/PersonalMedia`

## Repository Structure

```
PersonalMedia/
├── .gitignore          # Visual Studio / .NET comprehensive gitignore
├── README.md           # Project title only
└── CLAUDE.md           # This file
```

No source code, solution files, or project files have been added yet.

## Expected Technology Stack

Based on the .gitignore configuration, this project is set up for:

| Layer | Technology |
|-------|-----------|
| Language | C# (.NET) |
| IDE | Visual Studio / VS Code |
| Build | MSBuild |
| Packages | NuGet |
| Testing | MSTest / NUnit (both patterns present in .gitignore) |
| Coverage | Coverlet, OpenCover |
| Cloud | Azure and/or AWS (publish patterns and SAM artifacts ignored) |
| Secondary | Node.js (node_modules ignored), Python (PTVS support) |

## Build & Run Commands

_No build system configured yet._ When .NET projects are added, expect:

```bash
# Restore dependencies
dotnet restore

# Build
dotnet build

# Run tests
dotnet test

# Run the application
dotnet run --project <ProjectName>
```

## Development Workflow

### Git Conventions

- Single `main` branch with one initial commit
- Feature branches should follow the pattern: `claude/<description>-<id>`
- Commit messages should be clear and descriptive

### Environment Files

- `.env` files are gitignored — never commit secrets or connection strings
- `.pubxml` and Azure publish settings are gitignored for security
- Strong name key files (`.snk`) are commented out in .gitignore — evaluate on a case-by-case basis

### VS Code Integration

The .gitignore allows these VS Code files to be committed:
- `.vscode/settings.json`
- `.vscode/tasks.json`
- `.vscode/launch.json`
- `.vscode/extensions.json`
- `.vscode/*.code-snippets`

## Conventions for AI Assistants

### When adding new code

1. Follow standard .NET project conventions (solution file at root, projects in subdirectories)
2. Use the existing .gitignore — it is comprehensive for .NET development
3. Never commit build artifacts (`bin/`, `obj/`, `Debug/`, `Release/`)
4. Never commit secrets, connection strings, or `.env` files
5. Keep NuGet packages restored via `dotnet restore`, not checked in

### When setting up the project structure

A typical .NET project layout for this repo would be:

```
PersonalMedia/
├── PersonalMedia.sln
├── src/
│   └── PersonalMedia/
│       ├── PersonalMedia.csproj
│       └── Program.cs
├── tests/
│   └── PersonalMedia.Tests/
│       ├── PersonalMedia.Tests.csproj
│       └── ...
├── .gitignore
├── README.md
└── CLAUDE.md
```

### Code style

- Follow standard C# naming conventions (PascalCase for public members, camelCase for locals)
- Use file-scoped namespaces where possible (.NET 6+)
- Prefer `var` when the type is apparent from the right side of the assignment
- Keep methods focused and small

### Testing

- Place tests in a parallel `tests/` directory structure
- Name test projects `<ProjectName>.Tests`
- Use descriptive test method names: `MethodName_Condition_ExpectedResult`

### Security

- Never commit `.env`, `.pfx`, publish profiles, or credential files
- Validate all external input at system boundaries
- Follow OWASP guidelines for any web-facing components
