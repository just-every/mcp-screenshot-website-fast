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

export interface ScreencastOptions {
    url: string;
    duration: number; // Duration in seconds
    interval: number; // Interval between screenshots in seconds
    viewport?: {
        width: number;
        height: number;
    };
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    waitFor?: number;
    jsEvaluate?: string | string[]; // JavaScript code to execute - string or array of instructions
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

export interface ScreencastResult {
    url: string;
    frames: {
        screenshot: Buffer;
        timestamp: Date;
        index: number;
    }[];
    startTime: Date;
    endTime: Date;
    duration: number;
    interval: number;
    viewport: {
        width: number;
        height: number;
    };
    format: 'png';
}

export interface ConsoleMessage {
    type: 'log' | 'error' | 'warn' | 'info' | 'debug';
    text: string;
    timestamp: Date;
    args?: any[];
}

export interface ConsoleCaptureOptions {
    url: string;
    jsCommand?: string;
    duration?: number; // Duration in seconds, default 4
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

export interface ConsoleCaptureResult {
    url: string;
    messages: ConsoleMessage[];
    startTime: Date;
    endTime: Date;
    duration: number;
    executedCommand?: string;
}
