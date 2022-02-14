import * as vscode from "vscode";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, languages, commands, Disposable } from "vscode";
import { CodelensProvider } from "./CodelensProvider";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let disposables: Disposable[] = [];

export function activate(context: ExtensionContext) {
  const codelensProvider = new CodelensProvider();
  languages.registerCodeLensProvider("csharp", codelensProvider);

  commands.registerCommand(
    "snapshooter.accept",
    async (from, to, eventEmitter) => {
      await vscode.workspace.fs.copy(from, to, { overwrite: true });
      await vscode.workspace.fs.delete(from);
      eventEmitter.fire();
    }
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (disposables) {
    disposables.forEach((item) => item.dispose());
  }
  disposables = [];
}
