import EventEmitter from 'events';
import readline from 'readline';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

class Output extends EventEmitter {
  constructor(track, outputFile) {
    super();

    this.track = track;
    this.outputFile = outputFile;
    this.size = 0;
    this.totalSize = 0;

    this.readline = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.renderThrottle = 100;
    this.lastRenderTime = performance.now();

    this.on('setTotalSize', this.setTotalSize);
    this.on('start', this.start);
    this.on('progress', this.progress);
    this.on('error', this.error);
    this.on('end', this.end);
  }

  setTotalSize(totalSize) {
    this.totalSize = totalSize;
  }

  start() {
    this.readline.write(
      chalk`🎵  Start downloading {green.bold ${this.track.title}}\n`
    );
  }

  progress(size) {
    this.size += size;

    if (performance.now() - this.lastRenderTime < this.renderThrottle) {
      if (this.totalSize && this.size < this.totalSize) {
        return;
      }
    }

    let progress = `${this.size} KB`;

    // if support total size then display percent
    if (this.totalSize) {
      progress = `${Math.ceil(this.size / this.totalSize * 100)} %`;
    }

    readline.cursorTo(this.readline, 0);
    readline.clearLine(this.readline, 1);
    this.readline.write(chalk`⬇️  Downloaded {bold ${progress}}...`);

    this.lastRenderTime = performance.now();
  }

  error(err) {
    console.error(err);

    this.readline.close();
  }

  end() {
    this.readline.write(
      chalk`\n🎉  Finished downloaded to {magenta.underline ${
        this.outputFile
      }}!\n`
    );

    this.readline.close();
  }
}

export default Output;
