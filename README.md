# muzier-cli

> The muzier command line interface to download mp3 from Youtube and SoundCloud.

## Dependency

You need to have [ffmpeg](https://ffmpeg.org/download.html) installed.

## Installation

```bash
yarn global add muzier-cli
```

## Usage

```bash
# first setup the keys
muzier setup youtube <api_key>
muzier setup soundcloud <client_id>

muzier youtube <playlist_id> [--out <output_dir>]
muzier soundcloud <playlist_url> [--out <output_dir>]
```

## Author

Kai Hao

## License

[MIT](LICENSE)
