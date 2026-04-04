import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const didChangeEmitter = new vscode.EventEmitter<void>();

	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider('ghostfree', {
			onDidChangeMcpServerDefinitions: didChangeEmitter.event,
			provideMcpServerDefinitions: async () => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceFolder) {
					return [];
				}
				return [
					new vscode.McpStdioServerDefinition(
						'GhostFree',
						'npx',
						['-y', 'ghostfree', '--repo-path', workspaceFolder]
					)
				];
			}
		})
	);
}

export function deactivate() {}
