import { readFile, readFileSync } from "fs";
import * as vscode from "vscode";

export class FailedSnapshotReporter {
  private static readonly _tag = new vscode.TestTag("snapshot");
  constructor(private readonly controller: vscode.TestController) {}

  public async reportErrors(errors: ReportTestItem[]) {
    const start = Date.now();
    let items = errors.map((x) => {
      const testItem = this.controller.createTestItem(
        x.snapshotFile,
        x.methodName,
        vscode.Uri.file(x.testFile)
      );
      testItem.tags = [FailedSnapshotReporter._tag];
      testItem.range = x.testFileRange;
      return {
        testItem,
        missmatchFile: x.missmatchFile,
        snapshotFile: x.snapshotFile,
      };
    });
    this.controller.items.replace(items.map((x) => x.testItem));
    const run = this.controller.createTestRun(
      new vscode.TestRunRequest(),
      "Snapshot Report",
      false
    );
    await Promise.all(
      items.map(async (x) => {
        const expected = await vscode.workspace.openTextDocument(
          x.snapshotFile
        );
        const actual = await vscode.workspace.openTextDocument(x.missmatchFile);
        const testMessage = new vscode.TestMessage("Snapshot missmatch");
        testMessage.expectedOutput = expected.getText();
        testMessage.actualOutput = actual.getText();
        run.failed(x.testItem, testMessage);
      })
    );
    run.end();
    console.log({ took: Date.now() - start });
  }

  dispose() {
    this.controller.dispose();
  }
}

export interface ReportTestItem {
  snapshotFile: string;
  missmatchFile: string;
  testFile: string;
  methodName: string;
  testFileRange: vscode.Range;
}
