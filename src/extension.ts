import * as vscode from "vscode";
import { CodelensProvider } from "./CodelensProvider";
import { commands } from "./commands";
import { FailedSnapshotReporter } from "./FailedSnapshotReporter";

let disposables: vscode.Disposable[] = [];
export function activate(context: vscode.ExtensionContext) {
  const controller = vscode.tests.createTestController(
    "snapshooter-vscode",
    "Failed Snapshots"
  );
  const reporter = new FailedSnapshotReporter(controller);
  const codelensProvider = new CodelensProvider();
  const snapshooterAccept = vscode.commands.registerCommand(
    commands.snapshooter.accept,
    async (from, to, eventEmitter) => {
      await vscode.workspace.fs.copy(from, to, { overwrite: true });
      await vscode.workspace.fs.delete(from);
      eventEmitter.fire();
    }
  );
  const snapshooterPeekMissmatch = vscode.commands.registerCommand(
    commands.snapshooter.peekMissmatch,
    async (error) => {
      reporter.reportError(error);
    }
  );

  disposables.push(
    vscode.Disposable.from(reporter),
    vscode.languages.registerCodeLensProvider("csharp", codelensProvider),
    controller,
    snapshooterAccept,
    snapshooterPeekMissmatch
  );
}

export function deactivate() {
  if (disposables) {
    disposables.forEach((item) => item.dispose());
  }
  disposables = [];
}
