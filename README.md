# Better Thumbnails Plugin for HFS

Replace standard browser-based thumbnails with high-performance, server-side generated previews. Supports modern image formats (WebP) and live video frames.

## 🌟 Capabilities

This plugin solves the "loading lag" caused by generating thumbnails in the browser, especially for video files.

*   **⚡ Zero-Lag Frontend**: Generates **static images** on the server. Your browser downloads tiny WebP images instead of decoding massive video files.
*   **🎥 Video Frame Extraction**: Uses **FFmpeg** to extract a representative frame from valid video files (seeking past the intro black screen).
*   **🖼️ Smart Resizing**: Uses **Sharp** to create high-quality, aspect-ratio-preserved thumbnails that fit perfectly within your grid.
*   **🕸️ WebP Format**: Serves next-gen **WebP** images for ~30% smaller file sizes compared to JPEGs, saving bandwidth.
*   **🔒 Concurrency Control**: Built-in **Task Queue** limits the number of parallel FFmpeg processes to prevent server CPU overload (Configurable).
*   **💾 File-Based Caching**: Persists generated thumbnails to `~/.hfs/plugins/better-thumbnails/storage`, keeping the main database clean and improving load speeds.
*   **🔌 Instant Integration**: Works automatically with **Instant-Show** and standard HFS file lists (Grid/List/Tiles).

---

## 🚀 Installation

### Option 1: Automatic (Recommended)
1.  Go to your **HFS Admin Panel**.
2.  Navigate to **Plugins** -> **Search online**.
3.  Search for **`better-thumbnails`**.
4.  Click **Install**.

### Option 2: Manual
1.  Download the repository.
2.  Place the folder inside your HFS `plugins` directory.
3.  Ensure the folder is named `better-thumbnails` (or similar).
4.  Reload the plugins page.

---

## ⚙️ Configuration Guide

Settings are available in **Admin Panel > Plugins > better-thumbnails**.

### 1. General Settings
| Setting | Description | Default |
| :--- | :--- | :--- |
| **Pixels** | Maximum dimension (width/height) of the generated image. Images are resized to fit inside this box while preserving aspect ratio. | `256` |
| **Quality** | WebP Compression Quality (1-100). Lower values reduce file size but may artifact. | `60` |

### 2. Performance & System
| Setting | Description | Default |
| :--- | :--- | :--- |
| **Max Concurrent Generations** | Maximum number of simultaneous FFmpeg/Sharp processes. Use `2` or `4` to prevent high CPU usage when browsing large folders. | `4` |
| **FFmpeg Executable Path** | Full path to your `ffmpeg` binary. Required for video thumbnails. (e.g., `C:/ffmpeg/bin/ffmpeg.exe`). | *Empty* |
| **Log Generation** | Print a console message every time a thumbnail is generated. | `Off` |

---

## 🛠️ Troubleshooting

### 1. Thumbnails are Broken / Not Showing
*   **Check FFmpeg Path**: Ensure you have installed [FFmpeg](https://ffmpeg.org/download.html) and set the correct path in the plugin config.
*   **Check Browser Console**: Open F12 > Network. If you see `500 Internal Server Error`, check the server console for details.
*   **Clear Cache**: If you see old/wrong images, you can manually delete the contents of the `plugins/better-thumbnails/storage/thumbnails` folder.

### 2. "Server Error" on Videos
*   **Missing Codec**: FFmpeg must support the video format. Try running `ffmpeg -i video.mp4` manually to verify.
*   **Log Output**: Enable **Log Generation** in settings to see the exact error output from FFmpeg.

### 3. High CPU Usage
*   **Reduce Concurrency**: Lower **Max Concurrent Generations** to `1` or `2`.
*   **Initial Load**: The first time you visit good folder, CPU usage is expected as it generates the cache. Subsequent visits will be instant (served from disk).

---

## 👨‍💻 Technical Details

### Architecture
1.  **Request**: Browser requests `file.mp4?get=thumb`.
2.  **Middleware**: Plugin intercepts this request.
3.  **Cache Check**:
    *   Calculates MD5 Hash: `MD5(path + modified_time + width + height + quality)`.
    *   Checks `storage/thumbnails/[HASH].webp`.
    *   **Hit**: Streams file directly from disk (Zero CPU).
    *   **Miss**: Adds generation task to **FIFO Queue**.
4.  **Generation (Worker)**:
    *   **Images**: Streams source -> `Sharp` -> Resize -> WebP Buffer.
    *   **Videos**: Spawns `FFmpeg` -> Seeks 1s -> Pipes screenshot -> `Sharp` -> Resize -> WebP Buffer.
5.  **Response**: Streams buffer to client and saves to disk cache for next time.

### Why WebP?
WebP supports lossy compression similar to JPEG but with superior efficiency. This is critical for thumbnail grids where a user might load 100+ images at once.

### File-Based Cache vs Database
Previous versions stored Base64 strings in the HFS database. This bloated the database file (reducing performance). Version 9+ stores thumbnails as standard files in the `storage` directory, which is the HFS-recommended best practice for large binary data.

---

## 🏆 Credits

*   **@rejetto**: Based on the original **[hfs-thumbnails](https://github.com/rejetto/thumbnails)** plugin. This version expands upon it with FFmpeg video support, WebP compression, and concurrency management.
