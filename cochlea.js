//Waituntil DOM is loaded to start
$(document).ready(function() {
    // create the audio context (chrome only for now)
    if (! window.AudioContext) {
        if (! window.webkitAudioContext) {
            alert('no audiocontext found');
        }
        window.AudioContext = window.webkitAudioContext;
    }
    var context = new AudioContext();
    var audioBuffer;
    var sourceNode;
    var analyser;
    var javascriptNode;
    var audioPlaying = false;

    // get the context from the canvas to draw on
    var ctx = $("#canvas").get(0).getContext("2d");
    // create a gradient for the fill. Note the strange
    // offset, since the gradient is calculated based on
    // the canvas, not the specific element we draw
    var gradient = ctx.createLinearGradient(0,0,0,300);
    gradient.addColorStop(1,'#D7D7D7');
    gradient.addColorStop(0,'#FFFFFF');
    var beat_detect_gradient = ctx.createLinearGradient(0,0,0,300);
    beat_detect_gradient.addColorStop(1,'#C2C2C2');
    beat_detect_gradient.addColorStop(0,'#FFFFFF');

    // Beat detection variables
    var beat_detected = true; 
    var beat_detect_band = 10;       // 10 3rd-to-last band we see.
    var beat_detect_threshold = 150; // Out of 255;

    // Visualization globals
    var active_bg_color_idx = 0;
    var BG_COLORS = [
      "#F7977A",
      "#F9AD81",
      "#FDC68A",
      "#FFF79A",
      "#C4DF9B",
      "#A2D39C",
      "#82CA9D",
      "#7BCDC8",
      "#6ECFF6",
      "#7EA7D8",
      "#8493CA",
      "#8882BE",
      "#A187BE",
      "#BC8DBF",
      "#BC8DBF",
      "#F49AC2",
      "#F6989D"
    ];

    // track list.
    var activeTrackID = 0;
    var TRACKLIST = [
      "demo.mp3",
      "uptown.mp3"
    ];

    // load the sound
    setupAudioNodes();
    loadSound(TRACKLIST[activeTrackID], isPreload=true);

    // Set up click events.
    $('#playback').click(togglePlayback);
    $('#next').click(nextSound);

    function setupAudioNodes() {
        // setup a javascript node
        javascriptNode = context.createScriptProcessor(2048, 1, 1);
        // connect to destination, else it isn't called
        javascriptNode.connect(context.destination);
        // setup a analyzer
        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 32;
    }

    // load the specified sound
    function loadSound(url, isPreload) {
        // create a buffer source node
        sourceNode = context.createBufferSource();
        sourceNode.connect(analyser);
        analyser.connect(javascriptNode);
        sourceNode.connect(context.destination);

        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        // When loaded decode the data
        request.onload = function() {
            // decode the data
            context.decodeAudioData(request.response, function(buffer) {
                // when the audio is decoded play the sound
                console.log('success!')
                if (!isPreload) {
                  initSound(buffer);
                }
            }, onError);
        }
        request.send();
    }

    function initSound(buffer) {
      sourceNode.buffer = buffer;
      audioPlaying = true;
      sourceNode.start(0);
      $('#playback').addClass('playing');
    }

    function stopSound() {
      audioPlaying = false;
      sourceNode.stop(0);
      $('#playback').removeClass('playing');
    }

    function togglePlayback() {
      if (audioPlaying) {
        stopSound();
      } else {
        // Can't unpause a AudioBufferSourceNode :(
        loadSound(TRACKLIST[activeTrackID]); 
      }
    }

    function nextSound() {
      //var newURL = prompt("Enter URL of a new song to play");
      //if (newURL !== undefined) {
      //  songURL = newURL;
      //}
      activeTrackID = (activeTrackID + 1) % TRACKLIST.length;
      if (audioPlaying) {
        // Only stop first if already playing.
        togglePlayback();
      }
      // Now play (which will load newly-updated songURL.
      togglePlayback();
    }

    // log if an error occurs
    function onError(e) {
        console.log("Error!");
        console.log(e);
    }

    // when the javascript node is called
    // we use information from the analyzer node
    // to draw the volume
    javascriptNode.onaudioprocess = function() {
        // get the average for the first channel
        var array =  new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        // clear the current state
        ctx.clearRect(0, 0, 400, 325);
        drawSpectrum(array);
        if (detectBeat(array)) {
          swapBackground();
        }
    }

    function drawSpectrum(array) {
      for ( var i = 0; i < (array.length); i+=2 ){
        if (i == beat_detect_band) {
          // Set the beat detecting fill style.
          ctx.fillStyle = beat_detect_gradient;
        } else {
          // Set the fill style.
          ctx.fillStyle = gradient;
        }
        // Draw the EQ bar.
        var value = array[i];
        ctx.fillRect(i*25,325-value,20,325);
        //  console.log([i,value])
      }
      // Now draw a line to show the threshold value.
      var yVal = 325-beat_detect_threshold;
      ctx.fillRect(0, yVal, 400, 1);
    };

    /**
     * A "beat" is defined by volume of a particular band of spectrum
     * rising above a certain line. They're on 0-255 scale.
     * TODO: Figure out best band to use
     * TODO: Only swap on the "upswing", and ignore detection until after
     * it drops below that threshold again (otherwise seizure mode every frame
     * while the volume is above.
     * TODO: Need to do a moving average to smooth things out...?
     */
    function detectBeat(array) {
      var new_beat_this_frame = false;
      if (beat_detected) {
        // Wait for band to go below threshold and un-mark 
        if (array[beat_detect_band] < beat_detect_threshold) {
          beat_detected = false; 
        }
      } else {
        if (array[beat_detect_band] > beat_detect_threshold) {
          beat_detected = true; 
          new_beat_this_frame = true;
        }
      }
      return new_beat_this_frame;
    }

    function swapBackground() {
      active_bg_color_idx = (active_bg_color_idx + 2) % BG_COLORS.length;
      $('body').css('background-color', BG_COLORS[active_bg_color_idx]);
    }

});
