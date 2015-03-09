// Wait until DOM is loaded to start
$(document).ready(function() {
    // jQuery logic for handling button groups
    $( ".js-button-group button" ).click(function() {
      $(".js-button-group button").removeClass("bg-darken-4");
      $(".js-button-group button").addClass("gray");

      $(this).addClass("bg-darken-4");
      $(this).removeClass("gray");
    });

    // create the audio context (chrome only for now)
    if (! window.AudioContext) {
      if (! window.webkitAudioContext) {
          alert('no audiocontext found');
      }
      window.AudioContext = window.webkitAudioContext;
    }
    var context;
    var audioBuffer;
    var sourceNode;
    var analyser;
    var javascriptNode;
    var microphoneStream = null;
    var gainNode = null;
    var audioPlaying = false;
    var audioNodesSetUp = false;
    var use_mic = false;
    var timeData = {
      startTime: 0,     // Starting time of playback
      beatTimecodes: [] // Array of [beatTime-startTime]
    };

    // For controlling the background response.
    var BG_STYLE_COLORS = 0;
    var BG_STYLE_GIFS = 1;
    var bgStyle = BG_STYLE_COLORS;
    var gifSet = [];
    var activeBgGifIndex = 0;

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

    // Beat detection with Dendrite.
    var beatDetector = new Dendrite();
    var beatDetectBand = 10;       // 3rd-to-last band we see.
    var beatDetectThreshold = 150; // Out of 255. Eyeballed this.
    beatDetector.setFrequencyBand(beatDetectBand);
    beatDetector.setThreshold(beatDetectThreshold);
    beatDetector.onBeatDetected(swapBackground);
    beatDetector.onBeatDetected(registerBeatDetected);
    var beat_detected = true; 

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
      "audio/demo.mp3",
      "audio/uptown.mp3"
    ];

    // load the sound
    loadSound(TRACKLIST[activeTrackID], isPreload=true);

    // Set up click events.
    $('#bg-gif').click(toGifBackground);
    $('#bg-color').click(toColorBackground);
    $('#source-mic').click(toAudioSourceMicrophone);
    $('#source-mp3').click(toAudioSourceFile);
    $('#playback').click(togglePlayback);
    $('#stop-playback').click(togglePlayback);
    $('#next').click(nextSound);
    updateUI();

    // TODO: Clean up creation of AudioNodes (either singletons or
    // garbage collect them). If you swap back and forth between
    // microphone and mp3 analysis, you get ghosting from multiple
    // nodes drawing almost-identical graphs.
    function setupAudioNodes() {
      if (!audioNodesSetUp) {
        // Hack to get load audio contexts from USER event not WINDOW event
        // because of restriction in mobile Safari/iOS.
        context = new AudioContext();

        // setup a javascript node
        javascriptNode = context.createScriptProcessor(2048, 1, 1);
        // connect to destination, else it isn't called
        javascriptNode.connect(context.destination);
        // setup a analyzer
        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 32;

        // When the javascript node is called
        // we use information from the analyzer node
        // to draw the volume
        javascriptNode.onaudioprocess = function() {
          // get the average for the first channel
          var array =  new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(array);
          // clear the current state
          ctx.clearRect(0, 0, 400, 325);
          drawSpectrum(array);
          beatDetector.process(array);
        };

        // Mark as done (via first user event). Don't need to do again.
        audioNodesSetUp = true;
      }
    }
 
    /**
     * Microphone code adapted from StackOverflow.
     * http://stackoverflow.com/questions/26532328/how-do-i-get-audio-data-from-my-microphone-using-audiocontext-html5
     */
    function setupMicrophoneBuffer() {
      if (!navigator.getUserMedia) {
        navigator.getUserMedia =
            navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia;
      }

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          {audio:true},
          function(stream) {
            startMicrophone(stream);
          },
          function(e) {
            alert('Error capturing audio.');
          }
        );
      } else {
        alert('getUserMedia not supported in this browser.');
      };
    }

    function startMicrophone(stream){
      var BUFF_SIZE = 16384;
      microphoneStream = context.createMediaStreamSource(stream);

      // Comment out to disconnect output speakers. Everything else will
      // work OK this eliminates possibility of feedback squealing or
      // leave it in and turn down the volume.
      gainNode = context.createGain();
      //microphoneStream.connect(gainNode);

      // --- setup FFT
      javascriptNode = context.createScriptProcessor(2048, 1, 1);
      analyser = context.createAnalyser();
      analyser.smoothingTimeConstant = 0;
      analyser.fftSize = 32;

      gainNode.connect(context.destination);
      javascriptNode.connect(gainNode);
      analyser.connect(javascriptNode);
      microphoneStream.connect(analyser);

      javascriptNode.onaudioprocess = function() {  // FFT in frequency domain
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);

        // Draw the spectrum.
        ctx.clearRect(0, 0, 400, 325);
        drawSpectrum(array);
        beatDetector.process(array);
      }
    }

    /**
     * End microphone code from Stackoverflow.
     */

    // load the specified sound
    function loadSound(url, isPreload) {
      setupAudioNodes();

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
      resetBeatsDetected();
      timeData.startTime = Date.now();
      sourceNode.start(0);
      // Update UI.
      $('#playback').addClass('playing');
      updateUI();  // Called in togglePlayback, but this call happens
                   // in parallel, updates audioPlaying=true too late.
    }

    function stopSound() {
      audioPlaying = false;
      sourceNode.stop(0);
      $('#playback').removeClass('playing');
      printBeatsDetected();
    }

    function toGifBackground() {
      if (bgStyle != BG_STYLE_GIFS) {
        // Set to gifs
        bgStyle = BG_STYLE_GIFS;
        // TODO: User provides query for gif search
        giphySearch('party');
        // Update UI.
        updateUI();
      }
    }

    function toColorBackground() {
      if (bgStyle != BG_STYLE_COLORS) {
        // Set to colors
        bgStyle = BG_STYLE_COLORS;
        // Update UI.
        updateUI();
      }
    }

    // From Giphy's API reference: https://github.com/Giphy/GiphyAPI
    // and RaveRobot: https://github.com/simplecasual/raverobot.com
    function giphySearch(query) {
      var xhr = $.get("https://api.giphy.com/v1/gifs/search?q=" + query + "&api_key=dc6zaTOxFJmzC&limit=200");
      xhr.done(function(data) { 
        var loading = [];
        var gifURL = "";
        for (var i = 0; i < data.data.length; i++) {
          gifURL = "https://media2.giphy.com/media/" + data.data[i].id + "/giphy.gif"
          //console.log(gifURL);
          loading.push(gifURL); 
        }
        var numLoaded = 0;
        var nextGifset = [];
        $(loading).each(function (i, uri) {
          var img = new Image();
          img.src = uri;
          nextGifset.push(uri);
          $(img).load(function() {
            if (numLoaded == 0) {
              gifSet = nextGifset;
            }
            numLoaded++;
          });
        });
      });
    }

    //TODO: Disable playback controls in mic mode.
    function togglePlayback() {
      if (audioPlaying) {
        // Stop playing from audio file.
        stopSound();
      } else {
        // Start playing from audio file. Can't unpause an
        // AudioBufferSourceNode so we have to load from scratch :(
        loadSound(TRACKLIST[activeTrackID]); 
      }
      updateUI();
    }

    function toAudioSourceFile() {
      // Only do this if we're not already sourcing audio from files.
      if (use_mic) {
        // Turn off microphone.
        microphoneStream.disconnect();

        // Update UI.
        use_mic = false;
        updateUI();
      }
    }

    function toAudioSourceMicrophone() {
      // Only do this if we're not already sourcing audio from the mic.
      if (!use_mic) {
        // Stop playback if it's happening.
        if (audioPlaying) {
          togglePlayback();
        }

        // Turn on microphone.
        setupAudioNodes();
        setupMicrophoneBuffer();

        // Update UI.
        use_mic = true;
        updateUI();
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
      // Now play (which will load newly-updated songURL).
      togglePlayback();
    }

    // log if an error occurs
    function onError(e) {
      console.log("Error!");
      console.log(e);
    }

    /**
     * Callback to store array of beats detected.
     */
    function registerBeatDetected(array, beatTime) {
      var timeCode = beatTime - timeData.startTime;
      //console.log('beat detected at ' + timeCode);
      timeData.beatTimecodes.push(timeCode);
    }

    function resetBeatsDetected() {
      timeData.beatTimecodes = [];
    }

    function printBeatsDetected() {
      console.log('beats detected at the following ms offsets: ' +
          timeData.beatTimecodes);
    }

    /**
     * Draw the EQ spectrum lines, given one frame of audio.
     */
    function drawSpectrum(array) {
      for ( var i = 0; i < (array.length); i+=2 ){
        if (i == beatDetectBand) {
          // Set the beat detecting fill style.
          ctx.fillStyle = beat_detect_gradient;
        } else {
          // Set the fill style.
          ctx.fillStyle = gradient;
        }
        // Draw the EQ bar.
        var value = array[i];
        ctx.fillRect(i*25,325-value,20,325);
      }
      // Now draw a line to show the threshold value.
      var yVal = 325-beatDetectThreshold;
      ctx.fillRect(0, yVal, 400, 1);
    };

    /**
     * Redraw the background color in response to the beat detection.
     */
    function swapBackground(array, timestamp) {
      if (bgStyle == BG_STYLE_COLORS) {
        // Clear any existing background image.
        $('.js-background').css('background-image', '');
        // Increment color ID by two. This gives more visual change per swap, and
        // there's an odd number in the array, so 2nd time through is different.
        active_bg_color_idx = (active_bg_color_idx + 2) % BG_COLORS.length;
        $('.js-background').css('background-color', BG_COLORS[active_bg_color_idx]);
      } else {
        // Don't start gifSet lookups before the data comes back.
        if (gifSet && (gifSet.length > 0)) {
          // Increment to next gif.
          activeBgGifIndex = (activeBgGifIndex + 1) % gifSet.length;
          $('.js-background').css('background-image', 'url(\'' + gifSet[activeBgGifIndex] + '\')');
        }
      }
    }

    /**
     * Called whenever we need to update the UI.
     * Keeps all UI-specific logic in one place.
     */
    function updateUI() {
      // Set play/pause button.
      if (audioPlaying) {
        $('#playback').addClass('display-none');
        $('#stop-playback').removeClass('display-none');
      } else {
        $('#playback').removeClass('display-none');
        $('#stop-playback').addClass('display-none');
      }
    }
});
