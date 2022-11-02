// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

 class Emojizer {

	static providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];


	provideCodeActions(document, range) {
		// It seems like this function is called inside the provider whenever a dianostics problem is raised
		// the range and document are passed from the diagnostics 
		const fix = new vscode.CodeAction(`Fix SQLi!`, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();
		fix.edit.replace(document.uri, range, 'hello world!');

		return [
			fix
		];
	}


}

// Called when the activation event occurs (which is calling the command in this case)
function activate(context) {

	const SQLiRegex = /(SELECT|INSERT).*(?=\+|(\${))/

	try {
		// Use the console to output diagnostic information (console.log) and errors (console.error)
		// This line of code will only be executed once when your extension is activated
		console.log('Detected JS file, activating...');

		const SQLWarningDecorationType = vscode.window.createTextEditorDecorationType({

			borderStyle: 'solid',
			light: {
				// this color will be used in light color themes
				borderColor: 'darkblue',
				backgroundColor: 'rgba(149, 0, 0, 0.61)'
			},
			dark: {
				// this color will be used in dark color themes
				borderColor: 'lightblue',
				backgroundColor: 'rgba(229, 0, 0, 0.61)'
			}
		})

		const collection = vscode.languages.createDiagnosticCollection('sqli-detector');
		context.subscriptions.push(collection)

		vscode.workspace.onDidChangeTextDocument(() => {

			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const currentLine = activeEditor.selection.active.line
				const contents = activeEditor.document.lineAt(currentLine)._text


				// Detected possible SQLi
				if (SQLiRegex.test(contents)) {

					const range = new vscode.Range(new vscode.Position(currentLine, 0), new vscode.Position(currentLine, contents.length))
					const decorator = [{ range: range }]
					let noError = true
					try {
						new Function(contents)
					}
					catch (e) {
						if (e.name !== "SyntaxError") {
							activeEditor.setDecorations(SQLWarningDecorationType, decorator)

							collection.set(activeEditor.document.uri, [{
								code: '',
								message: 'Possible SQLi detected',
								range: range,
								severity: vscode.DiagnosticSeverity.Warning,
								source: '',
								relatedInformation: [
									new vscode.DiagnosticRelatedInformation(new vscode.Location(activeEditor.document.uri, range), ' has a possible SQLi')
								]
							}]);
						}
						noError = false
					}

					if (noError) {
						activeEditor.setDecorations(SQLWarningDecorationType, decorator)

						collection.set(activeEditor.document.uri, [{
							code: 'vulncheck_codeaction',
							message: 'Possible SQLi detected',
							range: range,
							severity: vscode.DiagnosticSeverity.Warning,
							source: '',
							relatedInformation: [
								new vscode.DiagnosticRelatedInformation(new vscode.Location(activeEditor.document.uri, range), ' has a possible SQLi')
							]
						}]);
					}
				}
				else {
					collection.clear()
					activeEditor.setDecorations(SQLWarningDecorationType, [{ range: null }])
				}
			}
		})

		context.subscriptions.push(
			vscode.languages.registerCodeActionsProvider('javascript', new Emojizer(), {
				providedCodeActionKinds: Emojizer.providedCodeActionKinds
			})
		);
	}
	catch (e) {
		console.log(e)
	}
}

// This method is called when your extension is deactivated (only when vscode shuts down)
function deactivate() {
	console.log("Deactivating")
}



module.exports = {
	activate,
	deactivate
}
