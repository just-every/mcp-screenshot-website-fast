export interface ChunkOptions {
    maxTokens?: number;
    maxChars?: number;
    splitOn?: 'heading' | 'paragraph' | 'sentence';
    overlap?: number;
}

export interface Chunk {
    content: string;
    index: number;
    tokens?: number;
    metadata?: {
        headings?: string[];
        startLine?: number;
        endLine?: number;
    };
}

export class MarkdownChunker {
    private options: Required<ChunkOptions>;

    constructor(options: ChunkOptions = {}) {
        this.options = {
            maxTokens: options.maxTokens ?? 0,
            maxChars: options.maxChars ?? 4000,
            splitOn: options.splitOn ?? 'heading',
            overlap: options.overlap ?? 200,
        };
    }

    chunk(markdown: string): Chunk[] {
        switch (this.options.splitOn) {
            case 'heading':
                return this.chunkByHeading(markdown);
            case 'paragraph':
                return this.chunkByParagraph(markdown);
            case 'sentence':
                return this.chunkBySentence(markdown);
            default:
                return this.chunkByHeading(markdown);
        }
    }

    private chunkByHeading(markdown: string): Chunk[] {
        const chunks: Chunk[] = [];
        const lines = markdown.split('\n');

        let currentChunk: string[] = [];
        let currentHeadings: string[] = [];
        let startLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isHeading = /^#+\s/.test(line);

            if (isHeading && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    content: currentChunk.join('\n').trim(),
                    index: chunks.length,
                    metadata: {
                        headings: [...currentHeadings],
                        startLine,
                        endLine: i - 1,
                    },
                });

                // Start new chunk with overlap
                const overlapLines = this.getOverlapLines(currentChunk);
                currentChunk = [...overlapLines, line];
                currentHeadings = [line];
                startLine = i - overlapLines.length;
            } else {
                currentChunk.push(line);
                if (isHeading) {
                    currentHeadings.push(line);
                }
            }

            // Check size limits
            const currentSize = currentChunk.join('\n').length;
            if (currentSize > this.options.maxChars) {
                chunks.push({
                    content: currentChunk.join('\n').trim(),
                    index: chunks.length,
                    metadata: {
                        headings: [...currentHeadings],
                        startLine,
                        endLine: i,
                    },
                });

                const overlapLines = this.getOverlapLines(currentChunk);
                currentChunk = [...overlapLines];
                currentHeadings = [];
                startLine = i - overlapLines.length + 1;
            }
        }

        // Don't forget the last chunk
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n').trim(),
                index: chunks.length,
                metadata: {
                    headings: currentHeadings,
                    startLine,
                    endLine: lines.length - 1,
                },
            });
        }

        return chunks;
    }

    private chunkByParagraph(markdown: string): Chunk[] {
        const chunks: Chunk[] = [];
        const paragraphs = markdown.split(/\n\n+/);

        let currentChunk: string[] = [];

        for (const paragraph of paragraphs) {
            const wouldExceedLimit =
                currentChunk.join('\n\n').length + paragraph.length >
                this.options.maxChars;

            if (wouldExceedLimit && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join('\n\n').trim(),
                    index: chunks.length,
                });
                currentChunk = [];
            }

            currentChunk.push(paragraph);
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n\n').trim(),
                index: chunks.length,
            });
        }

        return chunks;
    }

    private chunkBySentence(markdown: string): Chunk[] {
        const chunks: Chunk[] = [];
        const sentences = markdown.match(/[^.!?]+[.!?]+/g) || [markdown];

        let currentChunk: string[] = [];

        for (const sentence of sentences) {
            const wouldExceedLimit =
                currentChunk.join(' ').length + sentence.length >
                this.options.maxChars;

            if (wouldExceedLimit && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join(' ').trim(),
                    index: chunks.length,
                });
                currentChunk = [];
            }

            currentChunk.push(sentence.trim());
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join(' ').trim(),
                index: chunks.length,
            });
        }

        return chunks;
    }

    private getOverlapLines(lines: string[]): string[] {
        if (this.options.overlap <= 0) return [];

        let overlapChars = 0;
        const overlapLines: string[] = [];

        for (let i = lines.length - 1; i >= 0; i--) {
            overlapLines.unshift(lines[i]);
            overlapChars += lines[i].length + 1; // +1 for newline

            if (overlapChars >= this.options.overlap) {
                break;
            }
        }

        return overlapLines;
    }

    // Simple token estimation (roughly 4 chars per token)
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}
