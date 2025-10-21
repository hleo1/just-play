# Quick Setup Guide

## 1. Install Bun Runtime

The extension uses Bun to run TypeScript tests directly.

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, restart your terminal and VSCode/Cursor.

## 2. Install Extension Dependencies

```bash
cd just-play
npm install
```

## 3. Test the Extension

Press **F5** in VSCode to launch the Extension Development Host.

## 4. Configure API Key

In the Extension Development Host window:
1. Open Settings (Cmd+,)
2. Search for "Just Play"
3. Enter your Anthropic API key

Get an API key at: https://console.anthropic.com/

## 5. Try It Out

1. Create a test file with some TypeScript/JavaScript code
2. Select a function or block of code
3. Right-click → "Generate Tests"
4. View results in the "Just Play" sidebar (activity bar icon)

## Extension Structure

```
just-play/
├── package.json              # Extension manifest
├── src/
│   ├── extension.ts          # Main entry point
│   ├── aiService.ts          # Anthropic API integration
│   └── testPlaygroundProvider.ts  # Sidebar webview
├── resources/
│   └── icon.svg             # Activity bar icon
└── out/                     # Compiled JavaScript (generated)
```

## Key Concepts

**Activation**: Extension activates when VSCode starts (no specific activation events needed).

**Webview Provider**: Custom sidebar view that displays generated tests.

**Commands**: 
- `just-play.generateTests` - Generate tests from selection
- `just-play.clearPlayground` - Clear the playground

**Configuration**: Settings stored in VSCode settings, accessible via `vscode.workspace.getConfiguration()`.

