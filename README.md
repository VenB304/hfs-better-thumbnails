# Better Thumbnails

A high-performance thumbnail generator for HFS, designed to replace the standard `thumbnails` plugin for users with large video collections.

**Key Features:**
- **Zero Frontend Lag**: Uses static images for video thumbnails instead of loading heavy video players. (This addresses the main issue of the original plugin).
- **Server-Side FFmpeg**: Extracts frames efficiently on the server.
- **Caching**: Generated thumbnails are cached for instant loading on subsequent visits.
- **Format Support**: Supports all video formats FFmpeg supports (MP4, MKV, AVI, etc.).

## Credits
- Based on the original [thumbnails](https://github.com/rejetto/thumbnails) plugin by [rejetto](https://github.com/rejetto).
- Concept and FFmpeg logic inspired by [videojs-player](https://github.com/VenB304/videojs-player).

## Requirements
1.  **HFS** (Latest version recommended).
2.  **FFmpeg** installed on the server.
    - Windows: `ffmpeg.exe` available in PATH or configured in plugin settings.
    - Linux: `ffmpeg` package installed.
3.  **Sharp Plugin**: You must install the `sharp` plugin for HFS alongside this one (it handles the image resizing).

## Installation
1.  Download this folder.
2.  Place it in your HFS `plugins` folder.
3.  Ensure you have the `sharp` plugin also installed.

## Configuration
- **Quality**: JPEG quality of thumbnails.
- **Pixels**: Max size (width/height).
- **Video Seek**: (Coming Soon) Time to capture. Currently defaults to ~3 seconds to avoid black intro screens.
- **FFmpeg Path**: Set if not in system PATH.
