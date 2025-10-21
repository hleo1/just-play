# Just Play

Generate demonstrative tests for your JavaScript/TypeScript code using AI. Build mental models by experimenting with auto-generated, educational test cases.

## Features

- **AI-Powered Test Generation**: Uses Claude to create comprehensive, demonstrative tests
- **Custom Sidebar**: Dedicated playground view in the activity bar
- **Context-Aware**: Optionally includes surrounding code context for better test generation
- **Educational Focus**: Tests are designed to help you understand how code works

## Setup

1. Install dependencies: `npm install`
2. Configure your Anthropic API key:
   - Open Settings (Cmd+,)
   - Search for "Just Play"
   - Enter your Anthropic API key

## Usage

1. Select code in your editor
2. Right-click and choose "Generate Tests"
3. View generated tests in the Just Play sidebar
4. Copy tests to experiment with them
5. Modify and run tests to build understanding

## Settings

- `just-play.apiKey` - Your Anthropic API key (required)
- `just-play.model` - Claude model to use (default: claude-3-5-sonnet-20241022)
- `just-play.includeContext` - Include surrounding code context (default: true)

## Development

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch for changes
- Press F5 to open a new VSCode window with your extension loaded

## Requirements

- VSCode 1.85.0 or higher
- Anthropic API key
- [Bun](https://bun.sh) runtime (for running TypeScript tests)

### Installing Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, restart VSCode/Cursor to ensure bun is in your PATH.

