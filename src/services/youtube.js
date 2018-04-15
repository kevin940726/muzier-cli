import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import filenamify from 'filenamify';
import fetch from 'node-fetch';
import Output from './Output';

const getTrackInfo = stream => {
  let dataString = '';
  let trackInfo = null;

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      dataString += chunk.toString();

      try {
        trackInfo = JSON.parse(dataString);

        resolve(trackInfo);
      } catch (err) {}
    });

    stream.on('error', err => {
      reject(err);
    });
  });
};

const saveThumbnail = async (track, outputDirectory) => {
  const res = await fetch(track.thumbnail);
  const filePath = path.join(outputDirectory, `${filenamify(track.title)}.jpg`);

  const writeStream = fs.createWriteStream(filePath);

  res.body.pipe(writeStream);

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      resolve(filePath);
    });

    writeStream.on('error', err => {
      reject(err);
    });
  });
};

const youtube = async (track, outputDirectory = process.cwd()) => {
  // create a folder to save the temporary files
  const tempDir = fs.mkdtempSync(
    // The os.tmpdir() built-in doesn't return the real path. See git.io/vpvel
    path.join(fs.realpathSync(os.tmpdir()), `${track.id}-`)
  );
  const fileName = `${filenamify(track.title)}.mp3`;

  const outputFilePath = path.join(outputDirectory, fileName);
  const tempOutputFilePath = path.join(tempDir, fileName);

  const tempWriteStream = fs.createWriteStream(tempOutputFilePath);

  const output = new Output(track, outputFilePath);
  // write thumbnail to temp folder
  const thumbnail = await saveThumbnail(track, tempDir);

  const downloader = spawn(
    'youtube-dl',
    [
      '--no-mtime',
      '--print-json',
      ...['-f', 'bestaudio'],
      ...['-o', '-'],
      track.url,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  // get track info and store the total file size as soon as possible
  getTrackInfo(downloader.stderr).then(trackInfo => {
    const { formats, format_id } = trackInfo;

    const selected = formats.find(
      format => format.format_id === format_id && format.filesize
    );

    output.setTotalSize(selected.filesize);
  });

  downloader.stdout.on('data', chunk => {
    output.emit('progress', chunk.length);
  });

  const writeMetaDataToFile = () => {
    // write cover thumbnail to mp3 file
    ffmpeg()
      .input(tempOutputFilePath)
      .input(thumbnail)
      .outputOptions([
        '-c copy',
        '-map 0',
        '-map 1',
        '-metadata:s:v title="Album cover"',
        '-metadata:s:v comment="Cover (Front)"',
      ])
      .on('end', () => {
        output.emit('end');
      })
      .save(outputFilePath);
  };

  ffmpeg(downloader.stdout)
    .format('mp3')
    .audioQuality(0)
    .on('start', () => {
      output.emit('start');
    })
    .on('error', err => {
      output.emit('error', err);
    })
    .on('end', () => {
      writeMetaDataToFile();
    })
    .output(tempWriteStream)
    .run();

  return new Promise((resolve, reject) => {
    output.on('end', () => {
      resolve(outputFilePath);
    });

    output.on('error', err => {
      reject(err);
    });
  });
};

export default youtube;
