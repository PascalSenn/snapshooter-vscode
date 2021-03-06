import path = require("path");
import * as vscode from "vscode";
import { ViewColumn } from "vscode";
import { commands } from "./commands";
import { FailedSnapshotReporter } from "./FailedSnapshotReporter";

export class CodelensProvider implements vscode.CodeLensProvider {
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(private readonly _reporter: FailedSnapshotReporter) {
    const notifyCodeLensChange = debounce((e: any) => {
      this._onDidChangeCodeLenses.fire();
    }, 100);

    const watchChange =
      vscode.workspace.onDidChangeConfiguration(notifyCodeLensChange);

    const snapshotWatcher =
      vscode.workspace.createFileSystemWatcher("**/*.snap");

    const snapshotChanged = snapshotWatcher.onDidChange(notifyCodeLensChange);
    const snapshotDeleted = snapshotWatcher.onDidDelete(notifyCodeLensChange);
    const snapshotCreated = snapshotWatcher.onDidCreate(notifyCodeLensChange);

    this._disposables.push(
      watchChange,
      snapshotWatcher,
      snapshotChanged,
      snapshotCreated,
      snapshotDeleted
    );
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

  public dispose() {
    this._disposables.forEach((x) => x.dispose());
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
    if (!snapshots || snapshots.length === 0) {
      return codeLenses;
    }

    const missmatches = new Set(
      await this._readMethodsOfFile(missmatchPattern)
    );

    const documentContent = document.getText();

    let isMissmatchStillThere = false;

    for (const methodName of snapshots) {
      const searchResult = await this._searchMethodInDocument(
        document,
        documentContent,
        methodName
      );
      if (searchResult) {
        const { range, position } = searchResult;
        const hasMissmatch = missmatches.has(methodName);
        const fullPath = path.dirname(document.uri.path);
        const snapshotFile = `${fullPath}/__snapshots__/${basename}.${methodName}.snap`;
        const missmatchFile = `${fullPath}/__snapshots__/__mismatch__/${basename}.${methodName}.snap`;

        if (hasMissmatch) {
          isMissmatchStillThere ||= this._reporter.isActiveTest(missmatchFile);
          codeLenses.push(
            this._createPeekDiffCodeLens(
              range,
              snapshotFile,
              document,
              missmatchFile
            ),
            this._createDiffCodeLens(range, snapshotFile, missmatchFile),
            this._createAcceptCodeLens(range, missmatchFile, snapshotFile)
          );
        } else {
          codeLenses.push(
            this._createPeekCodeLens(range, document, position, snapshotFile)
          );
        }
      }
    }

    if (!isMissmatchStillThere && this._reporter.isErrorReported()) {
      this._reporter.clear();
    }

    return codeLenses;
  }

  private async _searchMethodInDocument(
    document: vscode.TextDocument,
    content: string,
    methodName: string
  ) {
    const methodNameRegex = new RegExp(`${methodName}\\(`);
    let matches = methodNameRegex.exec(content);
    if (matches) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const indexOf = line.text.indexOf(matches[0]);
      const position = new vscode.Position(line.lineNumber, indexOf);
      const range = document.getWordRangeAtPosition(position);
      if (range) {
        return { range, position };
      }
    }
    return undefined;
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
    const codeLens = new vscode.CodeLens(range);
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
    const codeLens = new vscode.CodeLens(range);
    codeLens.command = {
      title: "$(check) Accept",
      command: commands.snapshooter.accept,
      arguments: [
        vscode.Uri.file(missmatchFile),
        vscode.Uri.file(snapshotFile),
        this._onDidChangeCodeLenses,
      ],
    };
    return codeLens;
  }

  private _createDiffCodeLens(
    range: vscode.Range,
    snapshotFile: string,
    missmatchFile: string
  ) {
    const codeLens = new vscode.CodeLens(range);
    codeLens.command = {
      title: "$(open-preview) Diff",
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
    return codeLens;
  }

  private _createPeekDiffCodeLens(
    range: vscode.Range,
    snapshotFile: string,
    testFile: vscode.TextDocument,
    missmatchFile: string
  ) {
    const codeLens = new vscode.CodeLens(range);
    codeLens.command = {
      title: "$(eye) Peek",
      command: commands.snapshooter.peekMissmatch,
      arguments: [
        {
          missmatchFile,
          snapshotFile,
          testFile: testFile.uri.path,
          testFileRange: range,
        },
      ],
    };
    return codeLens;
  }
}

const debounce = (func: Function, wait: number) => {
  let timeout: any;

  return function executedFunction(...args: any[]) {
    const later = () => {
      timeout = null;

      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
