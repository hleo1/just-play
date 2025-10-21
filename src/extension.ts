import * as vscode from 'vscode';
import { TestPlaygroundProvider } from './testPlaygroundProvider';
import { generateTests } from './aiService';
import * as dotenv from 'dotenv';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	// Load environment variables from .env file in extension directory
	const envPath = path.join(context.extensionPath, '.env');
	dotenv.config({ path: envPath });
	console.log('Loading .env from:', envPath);
	
	console.log('Extension "just-play" is now active!');
	console.log('Extension URI:', context.extensionUri.toString());

	// Register the webview provider
	const provider = new TestPlaygroundProvider(context.extensionUri);
	console.log('Registering webview provider for:', TestPlaygroundProvider.viewType);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TestPlaygroundProvider.viewType,
			provider
		)
	);
	
	console.log('Webview provider registered successfully');

	// Register the generate tests command
	const generateTestsCmd = vscode.commands.registerCommand(
		'just-play.generateTests',
		async () => {
			console.log('Generate Tests command triggered!');
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor');
				console.log('No active editor found');
				return;
			}
			console.log('Active editor found:', editor.document.fileName);

			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);

			if (!selectedText) {
				vscode.window.showErrorMessage('Please select some code first');
				console.log('No text selected');
				return;
			}
			console.log('Selected text length:', selectedText.length);

			// Get surrounding context if enabled
			const config = vscode.workspace.getConfiguration('just-play');
			const includeContext = config.get<boolean>('includeContext', true);

			let contextText = '';
			if (includeContext) {
				// Get code before selection and filter to relevant context
				const documentStart = new vscode.Position(0, 0);
				const beforeRange = new vscode.Range(documentStart, selection.start);
				const fullContext = editor.document.getText(beforeRange);
				
				// Extract only imports, types, interfaces, and class/function signatures
				// This prevents the AI from seeing unrelated function implementations
				const lines = fullContext.split('\n');
				const relevantLines: string[] = [];
				let inMultilineComment = false;
				let braceDepth = 0;
				let captureUntilBraceClose = false;
				
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimmed = line.trim();
					
					// Track multiline comments
					if (trimmed.includes('/*')) inMultilineComment = true;
					if (trimmed.includes('*/')) {
						inMultilineComment = false;
						continue;
					}
					if (inMultilineComment) continue;
					
					// Always include: imports, exports, type/interface definitions
					if (
						trimmed.startsWith('import ') ||
						trimmed.startsWith('export type ') ||
						trimmed.startsWith('export interface ') ||
						trimmed.startsWith('type ') ||
						trimmed.startsWith('interface ') ||
						trimmed.startsWith('enum ') ||
						trimmed.startsWith('export enum ') ||
						trimmed.startsWith('const ') && trimmed.includes(':') && !trimmed.includes('=') // type annotations only
					) {
						relevantLines.push(line);
						// Track if we need to capture until closing brace for interface/type
						if (trimmed.includes('{') && !trimmed.includes('}')) {
							captureUntilBraceClose = true;
							braceDepth = 1;
						}
					} else if (captureUntilBraceClose) {
						// Continue capturing multiline type/interface definitions
						relevantLines.push(line);
						braceDepth += (line.match(/{/g) || []).length;
						braceDepth -= (line.match(/}/g) || []).length;
						if (braceDepth === 0) {
							captureUntilBraceClose = false;
						}
					}
				}
				
				contextText = relevantLines.join('\n');
			}

			// Show loading state
			provider.updateTests('', true);

			// Generate tests
			const result = await generateTests(selectedText, contextText, includeContext);

			if (result.error) {
				provider.showError(result.error);
			} else {
				provider.updateTests(result.tests, false);
			}
		}
	);

	// Register clear playground command
	const clearPlaygroundCmd = vscode.commands.registerCommand(
		'just-play.clearPlayground',
		() => {
			provider.clear();
		}
	);

	context.subscriptions.push(generateTestsCmd, clearPlaygroundCmd);
}

export function deactivate() {}

