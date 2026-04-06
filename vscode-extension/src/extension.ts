import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider('ghostfree', {
			provideMcpServerDefinitions: async () => {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceFolder) {
					return [];
				}
				return [
					new vscode.McpStdioServerDefinition(
						'ghostfree',
						'npx',
						['-y', 'ghostfree', '--repo-path', workspaceFolder]
					)
				];
			}
		})
	);
}

export function deactivate() {}
