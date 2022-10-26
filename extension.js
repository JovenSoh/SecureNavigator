// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

// Called when the activation event occurs (which is calling the command in this case)
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, detected JS file, activating...');

	// ID we will use for Activation Event, Contribution Point and below: "js.testCommand"
	// Activation Event: Events which activate the extension (else it sleeps)
	// Contribution Point: Adds it to the Command Pallete list
	// registerCommand() binds the following function to the command ID
	let disposable = vscode.commands.registerCommand('vulnCheck.runCheck', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Running Check!');
	});

	vscode.workspace.onDidChangeTextDocument(() => {

		const activeEditor = vscode.window.activeTextEditor
		if (activeEditor) {
			const contents = activeEditor.document.lineAt(activeEditor.selection.active.line)._text
			if (contents.indexOf("SELECT") !== -1) {
				let noError = true
				try {
					new Function(contents)
				}
				catch (e) {
					if (e.name !== "SyntaxError") {
						console.log(contents)
					}
					noError = false
				}

				if (noError) {
					console.log(contents)
				}
			}
		}
	})

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated (only when vscode shuts down)
function deactivate() {
	console.log("Deactivating")
}

module.exports = {
	activate,
	deactivate
}
