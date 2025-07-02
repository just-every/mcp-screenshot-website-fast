export interface ScreenshotOptions {
    url: string;
    viewport?: {
        width: number;
        height: number;
    };
    fullPage?: boolean;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    waitFor?: number;
}

export interface ScreenshotResult {
    url: string;
    screenshot: Buffer;
    timestamp: Date;
    viewport: {
        width: number;
        height: number;
    };
    format: 'png';
}

export interface TiledScreenshotResult {
    url: string;
    tiles: {
        screenshot: Buffer;
        index: number;
        row: number;
        col: number;
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
    timestamp: Date;
    fullWidth: number;
    fullHeight: number;
    tileSize: number;
    format: 'png';
}
