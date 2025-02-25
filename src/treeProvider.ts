import { Event, EventEmitter, Position, ProviderResult, TreeDataProvider, TreeItem, TreeItemCollapsibleState, window, workspace } from "vscode";
import { AnalyzerError, AnalyzerResult, Location, ParagraphError, ResultType, runAnalysis } from "./analyzer";
import * as path from 'path';

export default class TreeProvider implements TreeDataProvider<ResultsTreeItem> {
    private _onDidChangeTreeData: EventEmitter<ResultsTreeItem | undefined | null | void> = new EventEmitter<ResultsTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ResultsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    public results: AnalyzerResult[];

    constructor() {
        this.results = [];
    }

    public refresh(){
        this.analyze();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Finding): TreeItem {
        return element;
    }
    getChildren(element?: Finding): ProviderResult<ResultsTreeItem[]> {
        if(!element) {
            const frontmatter = new HeaderItem('Frontmatter', this, TreeItemCollapsibleState.Expanded);
            const body = new HeaderItem('Body', this, TreeItemCollapsibleState.Expanded);
            return Promise.resolve([frontmatter, body]);
        }
        else if(element.label === 'Frontmatter') {
            return Promise.resolve(this.results.filter(r => r.resultType === ResultType.frontmatter).map(result => {
                return new Finding(result.title, result.message, this, TreeItemCollapsibleState.None);
            }));
        }
        else if(element.label === 'Body') {
            return Promise.resolve(
                this.generateBodyErrors()
            );
        }
        else if(element.label === 'Paragraph') {
            return Promise.resolve(
                this.generateParagraphErrors(<ParagraphFinding> element)
            );
        }
        else {
            return Promise.resolve([]);
        }
    }

    generateParagraphErrors(element: ParagraphFinding): FindingWithPosition[] {

        const startLocationToString = (loc: Location) => (
            `Line:Column ${element.paragraph.loc.start.line}:${element.paragraph.loc.start.column}`
        );
        const endLocationToString = (loc: Location) => (
            `Line:Column ${element.paragraph.loc.end.line}:${element.paragraph.loc.end.column}`
        );

        return [
            new FindingWithPosition(
                "Start",
                startLocationToString(element.paragraph.loc),
                element.paragraph.loc,
                this,
                TreeItemCollapsibleState.None
            ),
            new FindingWithPosition(
                "End",
                endLocationToString(element.paragraph.loc),
                element.paragraph.loc,
                this,
                TreeItemCollapsibleState.None
            )
        ];
    }

    private generateBodyErrors(): Finding[] | PromiseLike<Finding[]> {
        return this.results.filter(r => r.resultType === ResultType.body).map(result => {
            return this.generateBodyError(result);
        });
    }

    private generateBodyError(result: AnalyzerResult): Finding {
        if (result instanceof ParagraphError) {
            return new ParagraphFinding(result.title, result.message, result, this, TreeItemCollapsibleState.Collapsed);
        } else {
            return new Finding(result.title, result.message, this, TreeItemCollapsibleState.None);
        }
    }

    private static get titleAttribute() : string {
        const configuration = workspace.getConfiguration('betterseo');
        const title :string = <string> configuration.get('frontmatter.titleAttribute')!;
        return title;
    }

    private static get descriptionAttribute() : string {
        const configuration = workspace.getConfiguration('betterseo');
        const description :string = <string> configuration.get('frontmatter.descriptionAttribute')!;
        return description;
    }

    private analyze() {
        const fileNameSplit = window.activeTextEditor?.document.fileName.split('.');
        const fileExtension = fileNameSplit?.[fileNameSplit.length - 1];
        if(fileExtension && !['md', 'mdx'].includes(fileExtension)) {
            window.showErrorMessage("Better SEO: Current file is not a Markdown file");
            return;
        }

        const currentFile = window.activeTextEditor?.document.getText();
        if(!currentFile) {
            return;
        }

        const markdownFile = currentFile.toString();
        const frontmatterConfig = {
            titleField: TreeProvider.titleAttribute,
            descriptionField: TreeProvider.descriptionAttribute
        };

        this.results = runAnalysis(markdownFile, frontmatterConfig);
    }
}

export abstract class ResultsTreeItem extends TreeItem {
    constructor(
        public readonly label: string,
        public provider: TreeProvider,
        public readonly collapsibleState: TreeItemCollapsibleState
        ) {
            super(label, collapsibleState);
        }
}

export class HeaderItem extends ResultsTreeItem {
        iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'betterseo-view-icon-light.svg'),
            dark: path.join(__filename, '..', '..', 'resources',  'betterseo-view-icon-light.svg')
        };
}

export class Finding extends ResultsTreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public provider: TreeProvider,
        public readonly collapsibleState: TreeItemCollapsibleState
        ) {
            super(label, provider, collapsibleState);
        }
    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'error icon.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'error icon.svg')
    };
}

export class ParagraphFinding extends Finding {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly paragraph: ParagraphError,
        public provider: TreeProvider,
        public readonly collapsibleState: TreeItemCollapsibleState
        ) {
            super(label, description, provider, collapsibleState);
        }
}

export class FindingWithPosition extends Finding {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly location: Location,
        public provider: TreeProvider,
        public readonly collapsibleState: TreeItemCollapsibleState
        ) {
            super(label, description, provider, collapsibleState);
        }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'text-icon-light.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'text-icon-dark.svg')
    };
}