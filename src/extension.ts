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
				// Get imports and code before selection
				const documentStart = new vscode.Position(0, 0);
				const beforeRange = new vscode.Range(documentStart, selection.start);
				contextText = editor.document.getText(beforeRange);
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

