import * as vscode from 'vscode';

export class TestPlaygroundProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'just-play.testPlayground';
	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((data) => {
			switch (data.type) {
				case 'copy':
					vscode.env.clipboard.writeText(data.content);
					vscode.window.showInformationMessage('Tests copied to clipboard');
					break;
				case 'clear':
					this.clear();
					break;
				case 'run':
					this.runTests(data.content);
					break;
			}
		});
	}

	public updateTests(tests: string, isLoading: boolean = false) {
		if (this._view) {
			this._view.show?.(true);
			this._view.webview.postMessage({
				type: 'updateTests',
				tests,
				isLoading
			});
		}
	}

	public showError(error: string) {
		if (this._view) {
			this._view.show?.(true);
			this._view.webview.postMessage({
				type: 'showError',
				error
			});
		}
	}

	public clear() {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'clear'
			});
		}
	}

	private async runTests(code: string) {
		const fs = require('fs');
		const path = require('path');
		const os = require('os');
		const { exec } = require('child_process');

		// Show running state
		this._view?.webview.postMessage({
			type: 'runningTests'
		});

		// Create temp file (use .ts extension for TypeScript support)
		const tempDir = os.tmpdir();
		const tempFile = path.join(tempDir, `just-play-test-${Date.now()}.ts`);
		
		try {
			fs.writeFileSync(tempFile, code);
			
			// First check if bun is available
			exec('which bun', (whichError: any) => {
				if (whichError) {
					// Bun not found - show helpful error
					this._view?.webview.postMessage({
						type: 'testResults',
						output: '',
						error: 'Bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash\n\nThen restart VSCode/Cursor.'
					});
					try {
						fs.unlinkSync(tempFile);
					} catch (e) {}
					return;
				}

				// Bun is available, run the tests
				exec(`bun "${tempFile}"`, { timeout: 10000 }, (error: any, stdout: string, stderr: string) => {
					const output = stdout + (stderr ? '\n' + stderr : '');
					
					this._view?.webview.postMessage({
						type: 'testResults',
						output: output || 'Tests completed with no output.',
						error: error ? error.message : null
					});

					// Clean up temp file
					try {
						fs.unlinkSync(tempFile);
					} catch (e) {
						// Ignore cleanup errors
					}
				});
			});
		} catch (error: any) {
			this._view?.webview.postMessage({
				type: 'testResults',
				output: '',
				error: `Failed to run tests: ${error.message}`
			});
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Test Playground</title>
	<style>
		* {
			box-sizing: border-box;
		}
		body {
			margin: 0;
			padding: 16px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		.container {
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.header {
			display: flex;
			gap: 8px;
			margin-bottom: 12px;
			flex-wrap: wrap;
		}
		button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 6px 12px;
			cursor: pointer;
			border-radius: 2px;
			font-size: 13px;
		}
		button:hover:not(:disabled) {
			background-color: var(--vscode-button-hoverBackground);
		}
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		button.primary {
			background-color: var(--vscode-button-background);
		}
		button.secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.content {
			flex: 1;
			overflow: auto;
		}
		.welcome {
			color: var(--vscode-descriptionForeground);
			text-align: center;
			padding: 40px 20px;
		}
		.welcome h3 {
			margin-top: 0;
		}
		.welcome p {
			margin: 8px 0;
		}
		.loading {
			text-align: center;
			padding: 20px;
			color: var(--vscode-descriptionForeground);
		}
		.error {
			background-color: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			color: var(--vscode-errorForeground);
			padding: 12px;
			border-radius: 4px;
			margin-bottom: 12px;
		}
		.editor {
			display: flex;
			flex-direction: column;
			gap: 12px;
			flex: 1;
		}
		.code-editor {
			width: 100%;
			min-height: 200px;
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 12px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			line-height: 1.6;
			resize: vertical;
			tab-size: 2;
			outline: none;
		}
		.code-editor:focus {
			border-color: var(--vscode-focusBorder);
		}
		.output-section {
			display: none;
		}
		.output-section.visible {
			display: block;
		}
		.output-header {
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--vscode-foreground);
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.output-content {
			background-color: var(--vscode-terminal-background, #1e1e1e);
			color: var(--vscode-terminal-foreground, #cccccc);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 12px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			line-height: 1.6;
			white-space: pre-wrap;
			word-wrap: break-word;
			max-height: 300px;
			overflow-y: auto;
		}
		.output-content.error {
			color: var(--vscode-errorForeground);
			background-color: var(--vscode-inputValidation-errorBackground);
		}
		.spinner {
			border: 3px solid var(--vscode-progressBar-background);
			border-top: 3px solid var(--vscode-button-background);
			border-radius: 50%;
			width: 30px;
			height: 30px;
			animation: spin 1s linear infinite;
			margin: 20px auto;
		}
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<button id="runBtn" class="primary" disabled>▶ Run Tests</button>
			<button id="copyBtn" class="secondary" disabled>Copy</button>
			<button id="clearBtn" class="secondary" disabled>Clear</button>
		</div>
		<div class="content" id="content">
			<div class="welcome">
				<h3>Test Playground</h3>
				<p>Select code in your editor and right-click to generate demonstrative tests.</p>
				<p>Tests will help you understand how the code works and build a mental model.</p>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const content = document.getElementById('content');
		const copyBtn = document.getElementById('copyBtn');
		const clearBtn = document.getElementById('clearBtn');
		const runBtn = document.getElementById('runBtn');
		
		let currentTests = '';
		let editor = null;

		runBtn.addEventListener('click', () => {
			const code = editor ? editor.value : currentTests;
			vscode.postMessage({ type: 'run', content: code });
		});

		copyBtn.addEventListener('click', () => {
			const code = editor ? editor.value : currentTests;
			vscode.postMessage({ type: 'copy', content: code });
		});

		clearBtn.addEventListener('click', () => {
			vscode.postMessage({ type: 'clear' });
		});

		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.type) {
				case 'updateTests':
					if (message.isLoading) {
						content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Generating tests...</p></div>';
						copyBtn.disabled = true;
						clearBtn.disabled = true;
						runBtn.disabled = true;
						editor = null;
					} else {
						currentTests = message.tests;
						content.innerHTML = 
							'<div class="editor">' +
							'<textarea class="code-editor" spellcheck="false"></textarea>' +
							'<div class="output-section" id="outputSection">' +
							'<div class="output-header">Output</div>' +
							'<div class="output-content" id="outputContent"></div>' +
							'</div>' +
							'</div>';
						editor = content.querySelector('.code-editor');
						editor.value = message.tests;
						
						// Handle tab key in textarea
						editor.addEventListener('keydown', (e) => {
							if (e.key === 'Tab') {
								e.preventDefault();
								const start = editor.selectionStart;
								const end = editor.selectionEnd;
								editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
								editor.selectionStart = editor.selectionEnd = start + 2;
							}
						});
						
						copyBtn.disabled = false;
						clearBtn.disabled = false;
						runBtn.disabled = false;
					}
					break;
				case 'showError':
					content.innerHTML = '<div class="error">' + escapeHtml(message.error) + '</div>';
					copyBtn.disabled = true;
					clearBtn.disabled = false;
					runBtn.disabled = true;
					editor = null;
					break;
				case 'clear':
					content.innerHTML = '<div class="welcome"><h3>Test Playground</h3><p>Select code in your editor and right-click to generate demonstrative tests.</p></div>';
					currentTests = '';
					copyBtn.disabled = true;
					clearBtn.disabled = true;
					runBtn.disabled = true;
					editor = null;
					break;
				case 'runningTests':
					const outputSection = document.getElementById('outputSection');
					const outputContent = document.getElementById('outputContent');
					if (outputSection && outputContent) {
						outputSection.classList.add('visible');
						outputContent.className = 'output-content';
						outputContent.textContent = 'Running tests...';
					}
					break;
				case 'testResults':
					const outSection = document.getElementById('outputSection');
					const outContent = document.getElementById('outputContent');
					if (outSection && outContent) {
						outSection.classList.add('visible');
						if (message.error) {
							outContent.className = 'output-content error';
							outContent.textContent = 'Error: ' + message.error;
						} else {
							outContent.className = 'output-content';
							outContent.textContent = message.output;
						}
					}
					break;
			}
		});

		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}
	</script>
</body>
</html>`;
	}
}

