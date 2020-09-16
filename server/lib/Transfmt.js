const config = require('../config');
const FFmpeg = require('./ffmpeg');
const {
  getPort,
  releasePort
} = require('./port');

let g_rtc_published = 0;

const publishRtpStream = async (router, peer, producer) => {
    console.log('publishRtpStream()');
  
    // Create the mediasoup RTP Transport used to send media to the GStreamer process
    const rtpTransportConfig = {
        //listenIp: '192.168.8.140',
        listenIp: '0.0.0.0',
        rtcpMux: true,
        comedia: false 
    }
  
    const rtpTransport = await router.createPlainTransport(rtpTransportConfig);
  
    // Set the receiver RTP ports
    let remoteRtpPort = await getPort();
    //remoteRtpPort = 20999;
    //remoteRtpPort = 24115;

    // Just for debug: only support one broadcaster, obsrtc.com
    if (peer.id === "obsrtc001" || g_rtc_published < 2) {
        if (producer.kind === "audio")
            remoteRtpPort = 24113;
        else if (producer.kind === "video")
            remoteRtpPort = 24115;
        g_rtc_published += 1;
    }
    console.log('remoteRtpPort = ', remoteRtpPort);
    
    // Connect the mediasoup RTP transport to the ports used by GStreamer
    await rtpTransport.connect({
      //ip: '127.0.0.1',
      ip: '154.13.28.95',
      //ip: '39.106.175.239',
      port: remoteRtpPort,
    });

    peer.data.transports.set(rtpTransport.id, rtpTransport);
   
    const codecs = [];
    // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
    const routerCodec = router.rtpCapabilities.codecs.find(
      codec => codec.kind === producer.kind 
    );
    codecs.push(routerCodec);
  
    const rtpCapabilities = {
      codecs,
      rtcpFeedback: []
    };

    console.log(rtpCapabilities);
    console.log(rtpTransport.tuple);
  
    // Start the consumer paused
    // Once the gstreamer process is ready to consume resume and send a keyframe
    const rtpConsumer = await rtpTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true 
    });

    peer.data.consumers.set(rtpConsumer.id, rtpConsumer);
  
    return {
      remoteRtpPort,
      localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
      rtpCapabilities,
      rtpParameters: rtpConsumer.rtpParameters
    };
  };

  module.exports.startRecord = async (router, peer, producer) => {
    let recordInfo = {};
  
    for (const producer of peer.data.producers.values()) {
      recordInfo[producer.kind] = await publishRtpStream(router, peer, producer);
    }
  
    // recordInfo.fileName = Date.now().toString();
  
    //peer.process = new FFmpeg(peer.id, recordInfo);
  
    setTimeout(async () => {
      for (const consumer of peer.data.consumers.values()) {
        // Sometimes the consumer gets resumed before the GStreamer process has fully started
        // so wait a couple of seconds
        await consumer.resume();
      }
    }, 1000);
  };
  
