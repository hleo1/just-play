import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';

export interface TestGenerationResult {
	tests: string;
	error?: string;
}

export async function generateTests(
	code: string,
	context: string,
	includeContext: boolean
): Promise<TestGenerationResult> {
	const config = vscode.workspace.getConfiguration('just-play');
	const apiKey = config.get<string>('apiKey');
	const model = config.get<string>('model') || 'claude-3-5-haiku-20241022';

	if (!apiKey) {
		return {
			tests: '',
			error: 'API key not configured. Please set your Anthropic API key in settings.'
		};
	}

	try {
		const anthropic = new Anthropic({ apiKey });

		const fullCode = includeContext ? `${context}\n\n${code}` : code;

		const prompt = `Generate a self-contained, runnable test file for this code:

\`\`\`typescript
${fullCode}
\`\`\`

Rules:
1. Copy the selected code EXACTLY at the top
2. Only add minimal code needed to make it runnable (e.g., missing variables/types)
3. Add 2-3 simple test examples showing how the code works
4. Use console.log() for output - NO test framework imports
5. Must run with: bun file.ts (zero dependencies)

Format:
- First: the code being tested
- Insert a comment: // Test Scenarios
- Then: 2-3 test calls with console.log showing inputs → outputs
- Keep it minimal and demonstrative

Output only executable code. No markdown, no explanations.`;

		const message = await anthropic.messages.create({
			model,
			max_tokens: 1024,  // Reduced since we only need 2-3 simple tests
			messages: [
				{
					role: 'user',
					content: prompt
				}
			]
		});

		let responseText = message.content
			.filter((block) => block.type === 'text')
			.map((block) => (block as Anthropic.TextBlock).text)
			.join('\n');

		// Strip markdown code blocks
		responseText = responseText.replace(/```(?:typescript|javascript|ts|js)?\n/g, '');
		responseText = responseText.replace(/```\n?$/g, '');
		responseText = responseText.trim();

		return { tests: responseText };
	} catch (error: any) {
		return {
			tests: '',
			error: `Failed to generate tests: ${error.message}`
		};
	}
}

