import * as vscode from "vscode";
import { ExtensionContext, languages, commands, Disposable } from "vscode";
import { CodelensProvider } from "./CodelensProvider";
import { FailedSnapshotReporter } from "./FailedSnapshotReporter";

let disposables: Disposable[] = [];
export function activate(context: ExtensionContext) {
  const controller = vscode.tests.createTestController(
    "snapshooter-vscode",
    "Failed Snapshots"
  );

  const reporter = new FailedSnapshotReporter(controller);
  disposables.push(vscode.Disposable.from(reporter));

  const codelensProvider = new CodelensProvider(reporter);
  disposables.push(
    languages.registerCodeLensProvider("csharp", codelensProvider)
  );

  disposables.push(controller);

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
