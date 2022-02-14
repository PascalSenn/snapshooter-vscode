import { readFile, readFileSync } from "fs";
import * as vscode from "vscode";

export class FailedSnapshotReporter {
  private static readonly _tag = new vscode.TestTag("snapshot");
  constructor(private readonly _controller: vscode.TestController) {}

  public async reportError(error: ReportTestItem) {
    const { snapshotFile, missmatchFile, testFileRange, methodName, testFile } =
      error;

    const testItem = this._controller.createTestItem(
      snapshotFile,
      methodName,
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
  }

  dispose() {
    this._controller.dispose();
  }
}

interface ReportTestItem {
  snapshotFile: string;
  missmatchFile: string;
  testFile: string;
  methodName: string;
  testFileRange: vscode.Range;
}
