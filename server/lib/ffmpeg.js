// Class to handle child process used for running FFmpeg
const { Readable } = require('stream');
const child_process = require('child_process');
const { EventEmitter } = require('events');

const { createSdpText } = require('./sdp');

const RECORD_FILE_LOCATION_PATH = process.env.RECORD_FILE_LOCATION_PATH || './files';

module.exports = class FFmpeg {
  constructor (id, rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._id = id;
    
    const sdpString = createSdpText(this._rtpParameters);

    console.log('createProcess() [sdpString:%s]', sdpString);
    this._createProcess();
  }

  _createProcess () {
    const sdpString = createSdpText(this._rtpParameters);
    const sdpStream = convertStringToStream(sdpString);

    console.log('createProcess() [sdpString:%s]', sdpString);

    this._process = child_process.spawn('ffmpeg', this._commandArgs);
    console.log('createProcess() [_commandArgs:%s]', this._commandArgs);

    // disable ffmpeg message: obsrtc.com-1
    if (true && this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.on('data', data =>
        console.log('ffmpeg::process::data [data:%o]', data)
      );
    }

    // disable ffmpeg message: obsrtc.com-2
    if (true && this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.on('data', data => 
        console.log('ffmpeg::process::data [data:%o]', data)
      );
    }

    this._process.on('message', message =>!!
      console.log('ffmpeg::process::message [message:%o]', message)
    );

    this._process.on('error', error =>
      console.error('ffmpeg::process::error [error:%o]', error)
    );

    this._process.once('close', () => {
      console.log('ffmpeg::process::close');
      this._observer.emit('process-close');
    });

    sdpStream.on('error', error =>
      console.error('sdpStream::error [error:%o]', error)
    );

    // Pipe sdp stream to the ffmpeg process
    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  }

  kill () {
    console.log('kill() [pid:%d]', this._process.pid);
    this._process.kill('SIGINT');
  }

  get _commandArgs () {
    let commandArgs = [
      '-loglevel',
      'info',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      'nobuffer',
      '-fflags',
      '+genpts+igndts',
      '-f',
      'sdp',
      '-i',
      'pipe:0'
    ];

    commandArgs = commandArgs.concat(this._videoArgs);
    commandArgs = commandArgs.concat(this._audioArgs);

    commandArgs = commandArgs.concat([
      '-f',
      'flv',
      //'rtmp://39.106.175.239/live/' + this._id
      //'rtmp://49.233.136.247/live/' + this._id
      'rtmp://ktla.fakecn.com/relay/' + this._id
    ]);
    console.log('!!!!!!!!!!!!!!!!!!! => ', this._id);

    // commandArgs = commandArgs.concat([
    //   '-flags',
    //   '+global_header',
    //   `/mnt/d/${this._id}.webm`
    // ]);

    console.log('commandArgs:%o', commandArgs);

    return commandArgs;
  }

  get _videoArgs () {
    //return [
    //  '-vcodec',
    //  'libx264',
    //  '-profile:v',
    //  'baseline',
    //  '-x264opts',
    //  'sliced-threads=1:threads=1:rc-lookahead=0',
    //  '-preset',
    //  'veryfast',
    //  '-tune',
    //  'zerolatency',
    //  '-b:v',
    //  '1000k',
    //  '-r',
    //  '15',
    //  '-g',
    //  '60'
    //];
    return [
      '-vcodec',
      'copy'
    ];
  }

  get _audioArgs () {
    return [
      '-acodec',
      'aac'
    ];
  }
}
  
const convertStringToStream = (stringToConvert) => {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(stringToConvert);
  stream.push(null);

  return stream;
};
