import path = require("path");
import * as vscode from "vscode";
import { ViewColumn } from "vscode";

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    return this.provideCodeLensesAsync(document, token);
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens;
  }

  private async provideCodeLensesAsync(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    if (!document.fileName.endsWith(".cs")) {
      return codeLenses;
    }

    const [basename] = path.basename(document.fileName).split(".", 2);

    const directoryPath = path.dirname(
      vscode.workspace.asRelativePath(document.uri)
    );
    const snapshotsPattern = `${directoryPath}/__snapshots__/${basename}*.snap`;
    const missmatchPattern = `${directoryPath}/__snapshots__/__mismatch__/${basename}*.snap`;

    const snapshots = await this._readMethodsOfFile(snapshotsPattern);
    if (snapshots && snapshots.length > 0) {
      const missmatches = new Set(
        await this._readMethodsOfFile(missmatchPattern)
      );
      const text = document.getText();
      for (const methodName of snapshots) {
        const methodNameRegex = new RegExp(`${methodName}\\(`);
        let matches = methodNameRegex.exec(text);
        if (matches) {
          const line = document.lineAt(document.positionAt(matches.index).line);
          const indexOf = line.text.indexOf(matches[0]);
          const position = new vscode.Position(line.lineNumber, indexOf);
          const range = document.getWordRangeAtPosition(position);
          if (range) {
            const hasMissmatch = missmatches.has(methodName);
            const fullPath = path.dirname(document.uri.path);
            const snapshotFile = `${fullPath}/__snapshots__/${basename}.${methodName}.snap`;
            const missmatchFile = `${fullPath}/__snapshots__/__mismatch__/${basename}.${methodName}.snap`;

            codeLenses.push(
              this._createPeekCodeLens(range, document, position, snapshotFile)
            );
            if (hasMissmatch) {
              codeLenses.push(
                ...[
                  this._createDiffCodeLens(range, snapshotFile, missmatchFile),
                  this._createAcceptCodeLens(
                    range,
                    missmatchFile,
                    snapshotFile
                  ),
                ]
              );
            }
          }
        }
      }
    }

    return codeLenses;
  }

  private async _readMethodsOfFile(pattern: string): Promise<string[]> {
    const snapshotFiles = await vscode.workspace.findFiles(pattern);
    return snapshotFiles.map((x) => {
      const [_, methodName] = path
        .basename(path.basename(x.path))
        .split(".", 3);
      return methodName;
    });
  }

  private _createPeekCodeLens(
    range: vscode.Range,
    document: vscode.TextDocument,
    position: vscode.Position,
    snapshotFile: string
  ) {
    console.log({ snapshotFile });
    let codeLens = new vscode.CodeLens(range);
    codeLens.command = {
      title: "$(eye) Peek",
      command: "editor.action.peekLocations",
      arguments: [
        document.uri,
        position,
        [
          new vscode.Location(
            vscode.Uri.file(snapshotFile),
            new vscode.Range(
              new vscode.Position(0, 0),
              new vscode.Position(0, 0)
            )
          ),
        ],
        "peek",
      ],
    };
    return codeLens;
  }

  private _createAcceptCodeLens(
    range: vscode.Range,
    missmatchFile: string,
    snapshotFile: string
  ) {
    console.log({ missmatchFile, snapshotFile });
    let accept = new vscode.CodeLens(range);
    accept.command = {
      title: "$(check) Accept",
      command: "snapshooter.accept",
      arguments: [
        vscode.Uri.file(missmatchFile),
        vscode.Uri.file(snapshotFile),
        this._onDidChangeCodeLenses,
      ],
    };
    return accept;
  }

  private _createDiffCodeLens(
    range: vscode.Range,
    snapshotFile: string,
    missmatchFile: string
  ) {
    let diffCodeLens = new vscode.CodeLens(range);
    diffCodeLens.command = {
      title: "$(compare-changes) Diff",
      command: "vscode.diff",
      arguments: [
        vscode.Uri.file(snapshotFile),
        vscode.Uri.file(missmatchFile),
        "Snapshot Diff",
        {
          preserveFocus: true,
          preview: true,
          viewColumn: ViewColumn.Beside,
        },
      ],
    };
    return diffCodeLens;
  }
}
