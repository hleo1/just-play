import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';

export interface TestGenerationResult {
	tests: string;
	error?: string;
}

export interface RepositoryAnalysisResult {
	analysis: string;
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

// export async function analyzeRepository(): Promise<RepositoryAnalysisResult> {
// 	const config = vscode.workspace.getConfiguration('just-play');
// 	const apiKey = process.env.ANTHROPIC_API_KEY || config.get<string>('apiKey');
// 	const model = config.get<string>('model') || 'claude-3-5-haiku-20241022';

// 	if (!apiKey) {
// 		return {
// 			analysis: '',
// 			error: 'API key not configured. Please set ANTHROPIC_API_KEY in .env file or in VS Code settings.'
// 		};
// 	}

// 	try {
// 		// Get all workspace files
// 		const workspaceFolders = vscode.workspace.workspaceFolders;
// 		if (!workspaceFolders || workspaceFolders.length === 0) {
// 			return {
// 				analysis: '',
// 				error: 'No workspace folder open'
// 			};
// 		}

// 		// Only analyze source files in src/ directory
// 		const files = await vscode.workspace.findFiles(
// 			'src/**/*.{ts,tsx,js,jsx}'
// 		);

// 		if (files.length === 0) {
// 			return {
// 				analysis: '',
// 				error: 'No TypeScript/JavaScript files found in workspace'
// 			};
// 		}

// 		console.log('=== REPOSITORY ANALYSIS ===');
// 		console.log(`Total files found: ${files.length}`);
// 		console.log('Files to be analyzed:');

// 		// Read all file contents
// 		let allCode = '';
// 		let totalBytes = 0;
// 		for (const file of files) {
// 			const document = await vscode.workspace.openTextDocument(file);
// 			const relativePath = vscode.workspace.asRelativePath(file);
// 			const fileContent = document.getText();
// 			const fileSize = fileContent.length;
			
// 			console.log(`  - ${relativePath} (${fileSize} bytes, ${document.lineCount} lines)`);
			
// 			allCode += `\n\n// File: ${relativePath}\n`;
// 			allCode += fileContent;
// 			totalBytes += fileSize;
// 		}

// 		console.log(`Total bytes to send: ${totalBytes} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
// 		console.log('=========================');

// 		const prompt = `# Repository Learning Map: Topic-Based Bottom-Up Analysis

// ## Objective
// Analyze this codebase to create a learning path organized by **semantic topics**, where each topic progresses from foundational (no dependencies) to complex (full dependencies).

// ## Phase 1: Topic Identification

// Identify natural **topics/modules/features** in the codebase. Topics represent cohesive functionality:

// **Examples of Topics:**
// - "Configuration & Initialization" (env vars, constants, setup)
// - "Data Models" (types, interfaces, classes representing domain objects)
// - "API Client" (HTTP requests, endpoints, auth)
// - "UI Components" (React components, views)
// - "Business Logic" (core algorithms, processing)
// - "Event System" (event emitters, handlers, pub-sub)
// - "File I/O" (reading, writing, parsing files)
// - "Utilities" (helpers, formatters, validators)

// **Topic Identification Rules:**
// - Group by functional cohesion (does code work together toward one goal?)
// - Consider file structure hints (directories, naming)
// - Separate concerns (UI vs logic vs data)
// - Each topic should be understandable semi-independently
// - Typical repo has 3-10 topics

// For each topic, provide:
// 1. **ID**: Short kebab-case identifier
// 2. **Name**: Human-readable name
// 3. **Description**: 1-2 sentences explaining purpose
// 4. **Difficulty**: 
//    - **Easy**: Foundational, minimal logic (config, types, simple utils)
//    - **Medium**: Core features, moderate complexity
//    - **Hard**: Advanced features, orchestration, complex state
// 5. **Topic Dependencies**: Other topics this topic builds upon

// ## Phase 2: Block Inventory & Assignment

// List all meaningful code blocks (functions, classes, methods, constants, types, etc.) and **assign each to exactly one topic**.

// For each block:
// - Standard fields (id, type, name, file, lines, signature, description)
// - **topic_id**: Which topic this belongs to
// - **dependencies**: Other block IDs it uses (within or across topics)
// - **external_deps**: Library/built-in APIs
// - **complexity_score**: 0-10

// ## Phase 3: Intra-Topic Dependency Levels

// For each topic, create a **learning path** with levels:
// - **Level 0**: Blocks with no dependencies (or only external deps)
// - **Level N**: Blocks depending only on levels 0 to N-1 within this topic

// **Cross-topic dependencies**: If block in Topic B depends on block in Topic A:
// - Topic B should depend on Topic A (in \`depends_on_topics\`)
// - In learning order, Topic A comes before Topic B
// - Within Topic B, treat Topic A's blocks as "already learned"

// ## Phase 4: Topic Difficulty Assessment

// Assign each topic a difficulty:
// - **Easy**: <3 average complexity, mostly data/config, <5 blocks
// - **Medium**: 3-6 average complexity, core logic, substantial but contained
// - **Hard**: >6 average complexity, many dependencies, orchestrates other topics

// ## Phase 5: Global Learning Order

// Sort topics by:
// 1. **Dependency order**: Topics with no topic-deps first
// 2. **Within same dependency level**: Easy → Medium → Hard
// 3. **Within each topic**: Level 0 → Level N (bottom-up)

// ## Output Format

// Return valid JSON with this structure:

// {
//   "repository": "string",
//   "topics": [
//     {
//       "id": "string",
//       "name": "string",
//       "description": "string",
//       "difficulty": "easy|medium|hard",
//       "depends_on_topics": ["topic-id"],
//       "blocks": ["block-id"],
//       "learning_path": [
//         {"level": 0, "blocks": ["id1", "id2"], "summary": "Foundational pieces"},
//         {"level": 1, "blocks": ["id3"], "summary": "Builds on level 0"}
//       ],
//       "avg_complexity": number
//     }
//   ],
//   "blocks": [
//     {
//       "id": "string",
//       "topic_id": "string",
//       "type": "string",
//       "name": "string",
//       "file": "string",
//       "lines": [number, number],
//       "signature": "string",
//       "dependencies": ["string"],
//       "external_deps": ["string"],
//       "complexity_score": number,
//       "description": "string"
//     }
//   ],
//   "learning_order": {
//     "by_topic": [
//       {
//         "topic_id": "string",
//         "topic_name": "string",
//         "difficulty": "easy",
//         "prerequisite_topics": ["topic-id"],
//         "path": [
//           {"level": 0, "blocks": ["id"], "summary": "what you'll learn"},
//           {"level": 1, "blocks": ["id"], "summary": "next step"}
//         ]
//       }
//     ]
//   },
//   "statistics": {
//     "total_topics": number,
//     "total_blocks": number,
//     "topic_difficulty_distribution": {"easy": 2, "medium": 3, "hard": 1}
//   }
// }

// ## Begin Analysis

// Analyze the following repository files and return ONLY the JSON structure above:

// ${allCode}`;

// 		const anthropic = new Anthropic({ apiKey });

// 		const message = await anthropic.messages.create({
// 			model,
// 			max_tokens: 4096,
// 			messages: [
// 				{
// 					role: 'user',
// 					content: prompt
// 				}
// 			]
// 		});

// 		let responseText = message.content
// 			.filter((block) => block.type === 'text')
// 			.map((block) => (block as Anthropic.TextBlock).text)
// 			.join('\n');

// 		// Strip markdown code blocks if present
// 		responseText = responseText.replace(/```(?:json)?\n/g, '');
// 		responseText = responseText.replace(/```\n?$/g, '');
// 		responseText = responseText.trim();

// 		return { analysis: responseText };
// 	} catch (error: any) {
// 		return {
// 			analysis: '',
// 			error: `Failed to analyze repository: ${error.message}`
// 		};
// 	}
// }


let exampleResult = `
{
  "repository": "Tic Tac Toe Web Game",
  "topics": [
    {
      "id": "server-setup",
      "name": "Server Configuration",
      "description": "Express and Socket.IO server initialization and configuration",
      "difficulty": "easy",
      "depends_on_topics": [],
      "blocks": [
        "server-init",
        "cors-config",
        "port-setup"
      ],
      "learning_path": [
        {
          "level": 0,
          "blocks": [
            "port-setup",
            "cors-config"
          ],
          "summary": "Basic server configuration"
        },
        {
          "level": 1,
          "blocks": [
            "server-init"
          ],
          "summary": "Create HTTP and Socket.IO servers"
        }
      ],
      "avg_complexity": 2
    },
    {
      "id": "game-models",
      "name": "Game State Management",
      "description": "Core game logic and state representation for Tic Tac Toe",
      "difficulty": "medium",
      "depends_on_topics": [],
      "blocks": [
        "game-state-class",
        "board-management",
        "game-logic"
      ],
      "learning_path": [
        {
          "level": 0,
          "blocks": [
            "game-state-class"
          ],
          "summary": "Basic game state initialization"
        },
        {
          "level": 1,
          "blocks": [
            "board-management"
          ],
          "summary": "Board manipulation methods"
        },
        {
          "level": 2,
          "blocks": [
            "game-logic"
          ],
          "summary": "Win condition and game progression logic"
        }
      ],
      "avg_complexity": 5
    },
    {
      "id": "api-routes",
      "name": "Game API Endpoints",
      "description": "HTTP routes for game management and interactions",
      "difficulty": "medium",
      "depends_on_topics": [
        "server-setup",
        "game-models"
      ],
      "blocks": [
        "new-game-route",
        "game-move-route",
        "game-reset-route"
      ],
      "learning_path": [
        {
          "level": 0,
          "blocks": [
            "new-game-route"
          ],
          "summary": "Create new game endpoint"
        },
        {
          "level": 1,
          "blocks": [
            "game-move-route",
            "game-reset-route"
          ],
          "summary": "Game interaction routes"
        }
      ],
      "avg_complexity": 4
    },
    {
      "id": "websocket-management",
      "name": "Real-time Game Communication",
      "description": "Socket.IO event handling for multiplayer game interactions",
      "difficulty": "hard",
      "depends_on_topics": [
        "server-setup",
        "game-models"
      ],
      "blocks": [
        "socket-connection",
        "game-join-event",
        "game-state-sync"
      ],
      "learning_path": [
        {
          "level": 0,
          "blocks": [
            "socket-connection"
          ],
          "summary": "Initial socket connection handling"
        },
        {
          "level": 1,
          "blocks": [
            "game-join-event"
          ],
          "summary": "Game room and player joining"
        },
        {
          "level": 2,
          "blocks": [
            "game-state-sync"
          ],
          "summary": "Real-time game state synchronization"
        }
      ],
      "avg_complexity": 7
    }
  ],
  "blocks": [
    {
      "id": "server-init",
      "topic_id": "server-setup",
      "type": "function",
      "name": "Server Initialization",
      "file": "src/index.ts",
      "lines": [
        5,
        12
      ],
      "signature": "const server = http.createServer(app)",
      "dependencies": [],
      "external_deps": [
        "express",
        "http",
        "socket.io"
      ],
      "complexity_score": 2,
      "description": "Initialize Express and HTTP server"
    },
    {
      "id": "game-state-class",
      "topic_id": "game-models",
      "type": "class",
      "name": "GameState",
      "file": "src/game.ts",
      "lines": [
        4,
        30
      ],
      "signature": "export class GameState",
      "dependencies": [],
      "external_deps": [],
      "complexity_score": 4,
      "description": "Represents the state and logic of a Tic Tac Toe game"
    },
    {
      "id": "new-game-route",
      "topic_id": "api-routes",
      "type": "route",
      "name": "Create New Game Endpoint",
      "file": "src/index.ts",
      "lines": [
        20,
        26
      ],
      "signature": "app.get('/new-game', (req, res) => { ... })",
      "dependencies": [
        "game-state-class"
      ],
      "external_deps": [
        "express"
      ],
      "complexity_score": 3,
      "description": "HTTP route to create a new game instance"
    },
    {
      "id": "socket-connection",
      "topic_id": "websocket-management",
      "type": "event-handler",
      "name": "Socket Connection Handler",
      "file": "src/index.ts",
      "lines": [
        50,
        73
      ],
      "signature": "io.on('connection', (socket) => { ... })",
      "dependencies": [
        "game-state-class"
      ],
      "external_deps": [
        "socket.io"
      ],
      "complexity_score": 6,
      "description": "Manage WebSocket connections and game-related events"
    }
  ],
  "learning_order": {
    "by_topic": [
      {
        "topic_id": "server-setup",
        "topic_name": "Server Configuration",
        "difficulty": "easy",
        "prerequisite_topics": [],
        "path": [
          {
            "level": 0,
            "blocks": [
              "port-setup"
            ],
            "summary": "Understand server configuration basics"
          }
        ]
      },
      {
        "topic_id": "game-models",
        "topic_name": "Game State Management",
        "difficulty": "medium",
        "prerequisite_topics": [
          "server-setup"
        ],
        "path": [
          {
            "level": 0,
            "blocks": [
              "game-state-class"
            ],
            "summary": "Learn game state representation"
          }
        ]
      }
    ]
  },
  "statistics": {
    "total_topics": 4,
    "total_blocks": 4,
    "topic_difficulty_distribution": {
      "easy": 1,
      "medium": 2,
      "hard": 1
    }
  }
}


`

export async function analyzeRepository(): Promise<RepositoryAnalysisResult> {
	return {
		analysis: exampleResult
	}
}
