/**
 * Better Thumbnails Plugin
 * 
 * Credits:
 * - Based on 'thumbnails' plugin by Rejetto (https://github.com/rejetto/thumbnails)
 * - FFmpeg integration inspired by 'videojs-player' and 'unsupported-videos'
 */

exports.version = 9;
exports.description = "High-performance thumbnails generation using FFmpeg. Generates static images to prevent frontend lag.";
exports.apiRequired = 12.0; // Access to api.misc
exports.repo = "hfs-other-plugins/better-thumbnails";
exports.depend = [{ "repo": "rejetto/sharp", "version": 1 }];
exports.frontend_js = 'main.js';

exports.config = {
    quality: {
        type: 'number',
        defaultValue: 60,
        min: 1, max: 100,
        helperText: "WebP Quality (1-100). Lower is smaller file size.",
        xs: 6,
    },
    pixels: {
        type: 'number',
        defaultValue: 256,
        min: 10, max: 2000,
        helperText: "Max width/height of the generated thumbnail (Bounding Box).",
        unit: 'pixels',
        xs: 6,
    },
    concurrency_limit: {
        type: 'number',
        defaultValue: 4,
        min: 1, max: 32,
        label: "Max Concurrent Generations",
        helperText: "Maximum number of parallel thumbnails to generate. Higher = more CPU usage.",
        xs: 6
    },
    ffmpeg_path: {
        type: 'real_path',
        fileMask: 'ffmpeg*',
        label: "FFmpeg Executable Path (Required)",
        helperText: "Path to ffmpeg binary (e.g. C:/ffmpeg/bin/ffmpeg.exe).",
        xs: 12
    },
    log: { type: 'boolean', defaultValue: false, label: "Log thumbnail generation" },
};

exports.init = async api => {
    const { createReadStream, createWriteStream, promises: fs } = api.require('fs');
    const path = api.require('path');
    const crypto = api.require('crypto'); // For MD5 hashing
    const { buffer } = api.require('node:stream/consumers');
    const { spawn } = api.require('child_process');

    const header = 'x-thumbnail';
    const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', 'm4v'];

    // Setup Cache Directory
    const cacheDir = path.join(api.storageDir, 'thumbnails');
    await fs.mkdir(cacheDir, { recursive: true }).catch(err => console.error("BetterThumbnails: Failed to create cache dir", err));

    // Concurrency Queue
    const queue = [];
    let active = 0;

    const runQueue = () => {
        const limit = api.getConfig('concurrency_limit') || 4;
        if (active >= limit || queue.length === 0) return;

        active++;
        const { task, resolve, reject } = queue.shift();

        task().then(resolve).catch(reject).finally(() => {
            active--;
            runQueue();
        });
    };

    const enqueue = (task) => new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        runQueue();
    });

    const isVideo = (ext) => VIDEO_EXTS.includes(ext);

    return {
        middleware(ctx) {
            if (ctx.query.get !== 'thumb') return;

            ctx.state.considerAsGui = true;
            ctx.state.download_counter_ignore = true;

            return async () => {
                if (!ctx.body && ctx.status !== 200) return; // Only process if file exists
                if (ctx.status === 304) return; // Not modified

                if (!api.getConfig('log')) ctx.state.dontLog = true;

                const { fileSource, fileStats } = ctx.state;
                if (!fileSource) return;

                const { size, mtimeMs: ts, birthtimeMs } = fileStats || {};
                const fileTs = ts || birthtimeMs;
                const quality = api.getConfig('quality');
                const pixels = api.getConfig('pixels');
                const w = Number(ctx.query.w) || pixels;
                const h = Number(ctx.query.h);

                // 1. Calculate Cache Key
                // MD5(FilePath + Timestamp + Width + Height + Quality)
                const cacheKeyStr = `${fileSource}|${fileTs}|${w}|${h}|${quality}`;
                const cacheHash = crypto.createHash('md5').update(cacheKeyStr).digest('hex');
                const cacheFile = path.join(cacheDir, cacheHash + '.webp');

                // 2. Check Cache File
                try {
                    const stats = await fs.stat(cacheFile);
                    if (stats.size > 0) {
                        ctx.set(header, 'cache-file');
                        ctx.type = 'image/webp';
                        ctx.body = createReadStream(cacheFile);
                        return;
                    }
                } catch (e) { /* Missing cache is normal */ }

                // 3. Fallback: Check other plugins (Optional integration)
                // (Skipping detailed implementation here to keep it clean, focusing on FFmpeg/Sharp)

                // 4. Generate (Queued)
                const ext = path.extname(fileSource).replace('.', '').toLowerCase();

                try {
                    // Enqueue the heavy lifting
                    const outputBuffer = await enqueue(async () => {
                        let sourceBuffer;

                        if (isVideo(ext)) {
                            // Video -> FFmpeg
                            ctx.set(header, 'ffmpeg-generated');
                            sourceBuffer = await generateVideoThumbnail(fileSource);
                        } else {
                            // Image -> Sharp (Limit size)
                            if (size > 100 * 1024 * 1024) throw new Error("Image too large (>100MB)");
                            sourceBuffer = await buffer(ctx.body);
                            ctx.set(header, 'image-generated');
                        }

                        if (!sourceBuffer || sourceBuffer.length === 0) throw new Error("Empty buffer");

                        const sharp = api.customApiCall('sharp', sourceBuffer)[0];
                        if (!sharp) throw new Error('Sharp plugin not active');

                        // Resize & Convert to WebP
                        return await sharp.resize(w, h || w, { fit: 'inside' })
                            .rotate()
                            .webp({ quality })
                            .toBuffer();
                    });

                    // 5. Save to Cache & Serve
                    await fs.writeFile(cacheFile, outputBuffer);

                    ctx.type = 'image/webp';
                    ctx.body = outputBuffer;

                } catch (e) {
                    console.error(`BetterThumbnails Error [${fileSource}]:`, e.message);
                    ctx.status = 500;
                    ctx.body = e.message;
                }
            };
        }
    };

    function generateVideoThumbnail(filePath) {
        return new Promise((resolve, reject) => {
            const ffmpegPath = api.getConfig('ffmpeg_path') || 'ffmpeg';
            // Fixed 1s seek for safety
            const seekTime = '00:00:01';

            const args = [
                '-ss', seekTime,
                '-i', filePath,
                '-frames:v', '1',
                '-q:v', '2',
                '-strict', 'unofficial',
                '-f', 'image2',
                '-c:v', 'mjpeg',
                'pipe:1'
            ];

            const proc = spawn(ffmpegPath, args);
            const chunks = [];
            const stderrChunks = [];

            proc.stdout.on('data', chunk => chunks.push(chunk));
            proc.stderr.on('data', chunk => stderrChunks.push(chunk));
            proc.on('error', err => reject(err));
            proc.on('exit', (code) => {
                if (code !== 0) {
                    const stderr = Buffer.concat(stderrChunks).toString();
                    return reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${stderr}`));
                }
                const fullBuffer = Buffer.concat(chunks);
                if (fullBuffer.length === 0) return reject(new Error("FFmpeg produced empty output"));
                resolve(fullBuffer);
            });
        });
    }
};
