import { readFile, readFileSync } from "fs";
import * as vscode from "vscode";

export class FailedSnapshotReporter {
  private static readonly _tag = new vscode.TestTag("snapshot");
  private _activeSnapshotFile: null | string = null;
  constructor(private readonly _controller: vscode.TestController) {}

  public isActiveTest(missmatchFile: string) {
    return this._activeSnapshotFile === missmatchFile;
  }

  public isErrorReported() {
    return this._activeSnapshotFile !== null;
  }

  public async reportError(error: ReportTestItem) {
    const { snapshotFile, missmatchFile, testFileRange, testFile } = error;

    const testItem = this._controller.createTestItem(
      snapshotFile,
      "Snapshot missmatch",
      vscode.Uri.file(testFile)
    );
    testItem.tags = [FailedSnapshotReporter._tag];
    testItem.range = testFileRange;
    this._controller.items.replace([testItem]);

    const run = this._controller.createTestRun(
      new vscode.TestRunRequest(),
      "Snapshot Report",
      false
    );

    const expected = await vscode.workspace.openTextDocument(snapshotFile);
    const actual = await vscode.workspace.openTextDocument(missmatchFile);
    const testMessage = new vscode.TestMessage("Snapshot missmatch");
    testMessage.expectedOutput = expected.getText();
    testMessage.actualOutput = actual.getText();
    run.failed(testItem, testMessage);
    run.end();

    this._activeSnapshotFile = missmatchFile;
  }

  public clear() {
    let items: vscode.TestItem[] = [];
    this._controller.items.forEach((x) => items.push(x));
    const run = this._controller.createTestRun(
      new vscode.TestRunRequest(),
      "Snapshot Report",
      false
    );
    items.forEach((x) => run.passed(x));
    run.end();
    this._activeSnapshotFile = null;
    this._controller.items.replace([]);
  }

  dispose() {
    this._controller.dispose();
  }
}

interface ReportTestItem {
  snapshotFile: string;
  missmatchFile: string;
  testFile: string;
  testFileRange: vscode.Range;
}
