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
	// Check if testingDisplay is enabled
	if (process.env.testingDisplay === 'true' || process.env.testingDisplay === 'True') {
		const testCode = `type Player = "X" | "O"
type Cell = Player | undefined;

export class GameState {
    id: number;
    playerTurn: Player;
    board: Cell[];
    gameDone: boolean;
    winner: Cell;
    tie: boolean;

    constructor(id: number, playerTurn: Player = "X") {
        this.id = id;
        this.playerTurn = playerTurn;
        this.board = new Array(9).fill(undefined);
        this.gameDone = false;
        this.winner = undefined;
        this.tie = false;
    }
}

// Test Scenarios
const game1 = new GameState(1);
console.log("Game 1 Initial State:", game1);

const game2 = new GameState(2, "O");
console.log("Game 2 Initial State:", game2);`;

		return { tests: testCode };
	}

	const config = vscode.workspace.getConfiguration('just-play');
	// Try environment variable first, then fall back to VS Code settings
	const apiKey = process.env.ANTHROPIC_API_KEY || config.get<string>('apiKey');
	const model = config.get<string>('model') || 'claude-3-5-haiku-20241022';

	if (!apiKey) {
		return {
			tests: '',
			error: 'API key not configured. Please set ANTHROPIC_API_KEY in .env file or in VS Code settings.'
		};
	}

	try {
		const anthropic = new Anthropic({ apiKey });

		let prompt: string;
		
		if (includeContext && context.trim()) {
			// Separate selected code from context to make it crystal clear what to test
			prompt = `You are generating tests for ONLY the selected code block below.

CONTEXT (for reference only - DO NOT test or copy this):
\`\`\`typescript
${context}
\`\`\`

SELECTED CODE TO TEST (test ONLY this):
\`\`\`typescript
${code}
\`\`\`

CRITICAL RULES:
1. Test ONLY the selected code above - nothing from the context
2. Copy the SELECTED code EXACTLY at the top of your output
3. Use context only to understand types/imports - do not copy or test context code
4. Add 2-3 simple test examples showing how the SELECTED code works
5. Use console.log() for output - NO test framework imports
6. Must run with: bun file.ts (zero dependencies)

Output Format:
- First: Copy the selected code being tested
- Then: Comment "// Test Scenarios"
- Then: 2-3 test calls with console.log showing inputs → outputs

Output only executable code. No markdown, no explanations.`;
		} else {
			// No context - just test the selected code
			prompt = `Generate a self-contained, runnable test file for the selected code below:

\`\`\`typescript
${code}
\`\`\`

Rules:
1. Copy the selected code EXACTLY at the top
2. Add any minimal imports/types needed to make it runnable
3. Add 2-3 simple test examples showing how the code works
4. Use console.log() for output - NO test framework imports
5. Must run with: bun file.ts (zero dependencies)

Output Format:
- First: The code being tested
- Then: Comment "// Test Scenarios"  
- Then: 2-3 test calls with console.log showing inputs → outputs

Output only executable code. No markdown, no explanations.`;
		}

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

