// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const debounce = require('lodash.debounce')
const { createHash } = require('crypto');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */


let varTypes = ["let", "const", "var"]
let savedResponses = {}
class Emojizer {

	static providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];


	async provideCodeActions(document, range, context) {
		// This is called whenever a diagnostics issue is raised
		// the range, document, context and token are passed directly into this function
		// use context.diagnostics.code to serve as passing data/identifying the diagnostic issue

		// Call ML model here
		if (context.diagnostics.length > 0) {
			if (context.diagnostics[0].code) {
				const hashedInput = createHash('sha256').update(context.diagnostics[0].code).digest('hex')
				
				console.log("Received: " + context.diagnostics[0].code)
				let varType = "let "
				let generatedFix = ""

				if (hashedInput in savedResponses) {
					generatedFix = savedResponses[hashedInput]
				}
				else {
					const spawn = require("child_process").spawn;
					const pythonProcess = spawn('py', ["prediction.py", context.diagnostics[0].code], { cwd: __dirname });
	
					for (let i = 0; i < varTypes.length; i++) {
						if (varTypes[i] === context.diagnostics[0].code.slice(0, varTypes[i].length)) {
							varType = varTypes[i] + " "
							break
						}
					}
	
					pythonProcess.on("error", (err) => {
						console.log("Error occured in python script")
						console.error(err)
					})
	
	
					generatedFix = await new Promise((resolve, reject) => {
						let finalData = ""
						pythonProcess.stdout.on('data', (data) => {
							finalData += data.toString()
							//console.log("data: " + data)
						});
						pythonProcess.stderr.on('data', (data) => {
							//console.log("error: " + data) 
						});
						pythonProcess.stdout.on("end", (data) => {
							//console.log("end data: " + finalData)
							resolve(finalData)
						})
					});

					// Clear cache once size gets too large
					const size = Object.keys(savedResponses).length;
					if (size > 50) {
						savedResponses = {}
					}
					
					console.log("final output: " + generatedFix)
					savedResponses[hashedInput] = generatedFix
				}
				
				const fix = new vscode.CodeAction(`Fix SQLi!`, vscode.CodeActionKind.QuickFix);
				fix.edit = new vscode.WorkspaceEdit();

				fix.edit.replace(document.uri, range, varType + generatedFix);
				fix.isPreferred = true

				return [fix];
			}

		}

	}


}

const raiseSQLiError = async (SQLWarningDecorationType, range, activeEditor, collection, contents) => {
	activeEditor.setDecorations(SQLWarningDecorationType, [{ range: range }])

	console.log("Sending " + contents)
	collection.set(activeEditor.document.uri, [{
		code: contents,
		message: 'Possible SQLi detected',
		range: range,
		severity: vscode.DiagnosticSeverity.Warning,
		source: '',
		relatedInformation: [
			new vscode.DiagnosticRelatedInformation(new vscode.Location(activeEditor.document.uri, range), ' has a possible SQLi')
		]
	}]);
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

		const debouncedFunction = debounce(raiseSQLiError, 500)

		vscode.workspace.onDidChangeTextDocument(() => {

			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const currentLine = activeEditor.selection.active.line
				const contents = activeEditor.document.lineAt(currentLine)._text


				// Detected possible SQLi
				if (SQLiRegex.test(contents)) {

					const range = new vscode.Range(new vscode.Position(currentLine, 0), new vscode.Position(currentLine, contents.length))
					let noError = true
					try {
						new Function(contents)
					}
					catch (e) {
						if (e.name !== "SyntaxError") debouncedFunction(SQLWarningDecorationType, range, activeEditor, collection, contents)
						noError = false
					}

					if (noError) debouncedFunction(SQLWarningDecorationType, range, activeEditor, collection, contents)
				}
				else {
					// Clear if current line has no SQL error/no longer has it
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
