import * as vscode from "vscode"; 
import { ExtensionContext, languages, commands, Disposable } from "vscode";
import { CodelensProvider } from "./CodelensProvider";
 

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

export function deactivate() {
  if (disposables) {
    disposables.forEach((item) => item.dispose());
  }
  disposables = [];
}
