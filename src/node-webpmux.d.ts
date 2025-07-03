declare module 'node-webpmux' {
    export interface Frame {
        delay: number;
        [key: string]: any;
    }

    export interface GenerateFrameOptions {
        path?: string;
        buffer?: Buffer;
        img?: Image;
        delay?: number;
    }

    export interface SaveOptions {
        frames?: Frame[];
        width?: number;
        height?: number;
    }

    export class Image {
        frames: Frame[];

        constructor();

        convertToAnim(): Promise<void>;
        load(buffer: Buffer): Promise<void>;
        save(path: string | null, options?: SaveOptions): Promise<Buffer>;

        static generateFrame(options: GenerateFrameOptions): Promise<Frame>;
        static save(path: string | null, options: SaveOptions): Promise<Buffer>;
    }

    const webpmux: {
        Image: typeof Image;
        TYPE_LOSSY: number;
        TYPE_LOSSLESS: number;
        TYPE_EXTENDED: number;
        encodeResults: any;
        hints: any;
        presets: any;
    };

    export default webpmux;
}
