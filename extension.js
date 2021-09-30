// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { isMarkdown, formatMarkdown } = require('./handlers');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let format = vscode.commands.registerCommand('markdown-format.format', function (params) {
    console.log(params)
    const path = params.fsPath;
    const isMD = isMarkdown(path);
    if(!isMD) {
      vscode.window.showErrorMessage('你选择的并不是markdown文件');
      return;
    }
    const success = formatMarkdown(path);
    if(success) {
      vscode.window.showInformationMessage('格式化成功');
    } else {
      vscode.window.showErrorMessage('格式化失败');
    }
		
	});
	context.subscriptions.push(format);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
