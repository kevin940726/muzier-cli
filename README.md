# muzier-cli

> The muzier command line interface to download mp3 from Youtube.

## Dependency

You need to have [youtube-dl](https://github.com/rg3/youtube-dl) and [ffmpeg](https://ffmpeg.org/download.html) installed.

## Installation

```bash
yarn global add muzier-cli
```

## Usage

```bash
muzier [-y] [-dry]
```

The command will prompt you to answer some questions, like output directory, youtube api key and youtube playlist ID. Then it will simply start downloading.

Note that when there are already some of the tracks downloaded in the output directory (like when you want to download more a few days later), the program will just download the newly added tracks by the exact order in your playlist.

* `-y`: Use default for all configuration questions. It will still prompt if there is no data being set.
* `-dry`: Dry run to just display the list to be downloaded. Useful when confirming the files going to be downloaded.

## Author

Kai Hao

## License

[MIT](LICENSE)
