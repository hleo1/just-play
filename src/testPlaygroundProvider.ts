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
	<link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" rel="stylesheet" />
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
		button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 4px 10px;
			cursor: pointer;
			border-radius: 2px;
			font-size: 11px;
			font-weight: 600;
		}
		button:hover:not(:disabled) {
			background-color: var(--vscode-button-hoverBackground);
		}
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
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
			background-color: #282c34 !important;
			color: #abb2bf;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 12px !important;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
			font-size: 13px !important;
			line-height: 1.6 !important;
			overflow: auto;
			tab-size: 2;
			outline: none;
			white-space: pre;
			margin: 0 !important;
		}
		.code-editor:focus {
			border-color: var(--vscode-focusBorder);
		}
		.code-editor code {
			font-family: inherit !important;
			font-size: inherit !important;
			background: transparent !important;
		}
		.hljs {
			background: transparent !important;
			padding: 0 !important;
		}
		.split-section {
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-bottom: 12px;
		}
		.section-label {
			font-weight: 600;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground);
		}
		.split-section:first-of-type .code-editor {
			max-height: 200px;
			min-height: 150px;
		}
		.split-section:nth-of-type(2) .code-editor {
			height: 100px;
			min-height: 100px;
			max-height: 100px;
		}
		.output-section {
			margin-top: 12px;
		}
		.output-header {
			font-weight: 600;
			margin-bottom: 8px;
			color: #9cdcfe;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.output-header-text {
			flex: 0 0 auto;
		}
		.output-header-text::before {
			content: '▶';
			font-size: 10px;
			color: #6a9955;
			margin-right: 6px;
		}
		.output-content {
			background-color: #282c34;
			color: #abb2bf;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			padding: 12px;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			font-size: 13px;
			line-height: 1.6;
			height: 200px;
			max-height: 200px;
			overflow-y: auto;
			white-space: pre-wrap;
			word-wrap: break-word;
			display: none;
		}
		.output-content.visible {
			display: block;
		}
		.output-content .hljs {
			background: transparent !important;
			padding: 0 !important;
		}
		.output-content.error {
			color: #f48771;
			background-color: #3d1f1f;
			white-space: pre-wrap;
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
		
		let currentTests = '';
		let editor = null;
		let editor1 = null;
		let editor2 = null;
		let runBtn = null;

		function getEditorText(ed) {
			return ed.textContent || '';
		}

		function runTests() {
			let code;
			if (editor1 && editor2) {
				code = getEditorText(editor1) + '\\n\\n// Test Scenarios\\n' + getEditorText(editor2);
			} else if (editor) {
				code = getEditorText(editor);
			} else {
				code = currentTests;
			}
			vscode.postMessage({ type: 'run', content: code });
		}

		window.addEventListener('message', event => {
			const message = event.data;
			
			switch (message.type) {
				case 'updateTests':
					if (message.isLoading) {
						content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Generating tests...</p></div>';
						editor = null;
						editor1 = null;
						editor2 = null;
						runBtn = null;
					} else {
						currentTests = message.tests;
						
						// Check if content should be split
						const splitMarker = '// Test Scenarios';
						const splitIndex = message.tests.indexOf(splitMarker);
						
						if (splitIndex !== -1) {
							// Split view
							const part1 = message.tests.substring(0, splitIndex).trim();
							const part2 = message.tests.substring(splitIndex + splitMarker.length).trim();
							
							content.innerHTML = 
								'<div class="editor">' +
								'<div class="split-section">' +
								'<div class="section-label">Code to Test, with AI Modifications</div>' +
								'<pre class="code-editor language-typescript" id="editor1" contenteditable="true" spellcheck="false"><code class="language-typescript"></code></pre>' +
								'</div>' +
								'<div class="split-section">' +
								'<div class="section-label">Test Scenarios</div>' +
								'<pre class="code-editor language-typescript" id="editor2" contenteditable="true" spellcheck="false"><code class="language-typescript"></code></pre>' +
								'</div>' +
								'<div class="output-section" id="outputSection">' +
								'<div class="output-header">' +
								'<span class="output-header-text">Output</span>' +
								'<button id="runBtn">▶ Run Tests</button>' +
								'</div>' +
								'<div class="output-content" id="outputContent"></div>' +
								'</div>' +
								'</div>';
							
							editor1 = document.getElementById('editor1');
							editor2 = document.getElementById('editor2');
							runBtn = document.getElementById('runBtn');
							editor1.querySelector('code').textContent = part1;
							editor2.querySelector('code').textContent = part2;
							hljs.highlightElement(editor1.querySelector('code'));
							hljs.highlightElement(editor2.querySelector('code'));
							editor = null;
							
							runBtn.addEventListener('click', runTests);
							
							// Setup syntax highlighting on input
							function setupEditor(ed) {
								ed.addEventListener('input', () => {
									const code = ed.querySelector('code');
									const text = code.textContent;
									const selection = window.getSelection();
									const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
									const startOffset = range ? range.startOffset : 0;
									
									code.textContent = text;
									hljs.highlightElement(code);
									
									// Restore cursor position
									if (range) {
										try {
											const newRange = document.createRange();
											const textNode = code.firstChild || code;
											newRange.setStart(textNode, Math.min(startOffset, textNode.length || 0));
											newRange.collapse(true);
											selection.removeAllRanges();
											selection.addRange(newRange);
										} catch (e) {}
									}
								});
								
								// Handle tab key
								ed.addEventListener('keydown', (e) => {
									if (e.key === 'Tab') {
										e.preventDefault();
										document.execCommand('insertText', false, '  ');
									}
								});
							}
							
							setupEditor(editor1);
							setupEditor(editor2);
						} else {
							// Single view
							content.innerHTML = 
								'<div class="editor">' +
								'<pre class="code-editor language-typescript" id="editor" contenteditable="true" spellcheck="false"><code class="language-typescript"></code></pre>' +
								'<div class="output-section" id="outputSection">' +
								'<div class="output-header">' +
								'<span class="output-header-text">Output</span>' +
								'<button id="runBtn">▶ Run Tests</button>' +
								'</div>' +
								'<div class="output-content" id="outputContent"></div>' +
								'</div>' +
								'</div>';
							editor = document.getElementById('editor');
							runBtn = document.getElementById('runBtn');
							editor.querySelector('code').textContent = message.tests;
							hljs.highlightElement(editor.querySelector('code'));
							editor1 = null;
							editor2 = null;
							
							runBtn.addEventListener('click', runTests);
							
							// Setup syntax highlighting on input
							editor.addEventListener('input', () => {
								const code = editor.querySelector('code');
								const text = code.textContent;
								const selection = window.getSelection();
								const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
								const startOffset = range ? range.startOffset : 0;
								
								code.textContent = text;
								hljs.highlightElement(code);
								
								// Restore cursor position
								if (range) {
									try {
										const newRange = document.createRange();
										const textNode = code.firstChild || code;
										newRange.setStart(textNode, Math.min(startOffset, textNode.length || 0));
										newRange.collapse(true);
										selection.removeAllRanges();
										selection.addRange(newRange);
									} catch (e) {}
								}
							});
							
							// Handle tab key
							editor.addEventListener('keydown', (e) => {
								if (e.key === 'Tab') {
									e.preventDefault();
									document.execCommand('insertText', false, '  ');
								}
							});
						}
					}
					break;
				case 'showError':
					content.innerHTML = '<div class="error">' + escapeHtml(message.error) + '</div>';
					editor = null;
					editor1 = null;
					editor2 = null;
					runBtn = null;
					break;
				case 'clear':
					content.innerHTML = '<div class="welcome"><h3>Test Playground</h3><p>Select code in your editor and right-click to generate demonstrative tests.</p></div>';
					currentTests = '';
					editor = null;
					editor1 = null;
					editor2 = null;
					runBtn = null;
					break;
				case 'runningTests':
					const outputContent = document.getElementById('outputContent');
					if (outputContent) {
						outputContent.className = 'output-content visible';
						outputContent.textContent = 'Running tests...';
					}
					break;
				case 'testResults':
					const outContent = document.getElementById('outputContent');
					if (outContent) {
						if (message.error) {
							outContent.className = 'output-content visible error';
							outContent.textContent = 'Error: ' + message.error;
						} else {
							outContent.className = 'output-content visible';
							outContent.innerHTML = formatOutput(message.output);
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

		function formatOutput(text) {
			// Use highlight.js for syntax highlighting
			try {
				const highlighted = hljs.highlight(text, { language: 'javascript' }).value;
				return highlighted;
			} catch (e) {
				// Fallback: just escape and return
				return escapeHtml(text);
			}
		}
	</script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</body>
</html>`;
	}
}

