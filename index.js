'use strict';
const prog = require('caporal');
const pkg = require('./package.json');
const Youtube = require('youtube-api');
const CREDENTIALS = require('./credentials.json');
const inquirer = require('inquirer');
const nyanProgress = require('nyan-progress');
const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const chalk = require('chalk');
const leftPad = require('left-pad');

Youtube.authenticate({
  type: 'key',
  key: CREDENTIALS.youtubeApiKey, // replace your api key here
});

const bindNodeCallback = (resolve, reject) => (err, res) => err ? reject(err) : resolve(res);
const getYoutubePlaylistApi = (options = {}) => new Promise((resolve, reject) => Youtube.playlistItems.list(options, bindNodeCallback(resolve, reject)));
const getYoutubeVideosListApi = (options = {}) => new Promise((resolve, reject) => Youtube.videos.list(options, bindNodeCallback(resolve, reject)));

const getYoutubePlaylist = (url, logger = console) => {
  const isUrl = /list=(\w+)/g.exec(url);
  const playlistId = isUrl ? isUrl[1] : url;

  return getYoutubePlaylistApi({
    part: 'snippet',
    maxResults: 10,
    playlistId,
  })
    .then(res => getYoutubeVideosListApi({
      part: 'snippet',
      id: res.items
        .map(v => v.snippet.resourceId.videoId)
        .join(','),
    }))
    .then(res => res.items.map((item, index) => ({
      index: index + 1,
      id: item.id,
      thumbnail: item.snippet.thumbnails.default.url,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      url: `http://www.youtube.com/watch?v=${item.id}`,
    })))
    .then(res => res.map(item => ({
      name: (`${chalk.bold(leftPad(item.index.toString(), 2))} ${chalk.green(item.title)} - ${chalk.dim(item.channelTitle)}`),
      value: item,
    })))
    .catch(err => logger.error(err));
};

const downloadYoutubeItem = progress => item => new Promise((resolve) => {
  const output = fs.createWriteStream(
    path.join(process.cwd(), 'downloads', `${item.title}.mp3`)
  );

  const video = ytdl(item.url);

  video.on('response', resolve);

  const converter = ffmpeg(video)
    .format('mp3')
    .audioQuality(0)
    .output(output);

  converter.run();
});

prog.version(pkg.version)
  .argument('<youtubeUrl>', 'youtube playlist url')
  .action((args, options, logger) => {
    const { youtubeUrl } = args;
    getYoutubePlaylist(youtubeUrl, logger)
      .then(playlist => inquirer.prompt([
        {
          type: 'checkbox',
          message: 'Select Youtube playlist items',
          name: 'playlistItems',
          choices: playlist,
          pageSize: playlist.length,
        },
      ]))
      .then(answers => {
        const progress = nyanProgress();
        
        return Promise.all(
          answers.playlistItems
            .map(downloadYoutubeItem(progress))
        )
          .then(res => {
            const totalSize = res.map(video => Number(video.headers['content-length']))
              .reduce((prev, cur) => prev + cur);
            
            Promise.all(res.map(video => new Promise((resolve, reject) => {
              video.on('data', (chunk) => {
                progress.tick(chunk.length);
              });
              video.on('end', resolve);
              video.on('error', reject);
            })))
              .then(() => progress.tick(Number.MAX_SAFE_INTEGER));

            return progress.start({ total: totalSize });
          })
          .catch(err => logger.error(err));
      })
      .then(() => {
        logger.info('Download Completed!');
      });
  });

prog.parse(process.argv);
