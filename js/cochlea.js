var ellipses = [];
var numCircles = 30;
var canvasSizeX = 1300;
var canvasSizeY = 750;
if (document && document.documentElement) {
  canvasSizeX = document.documentElement.clientWidth;
  canvasSizeY = document.documentElement.clientHeight;
}
var gravityWell = {
  x: canvasSizeX / 3,
  y: canvasSizeY / 3
};
var hueBase = 0;
var originalOpacity = 40;

// For controlling the background response.
var BG_STYLE_COLORS = 0;
var BG_STYLE_GIFS = 1;
var BG_STYLE_CIRCLES = 2;
var bgStyle = BG_STYLE_CIRCLES;
var gifSet = [];
var activeBgGifIndex = 0;

function circleFactory() {
  // Basic variables.
  var diameterBase = (canvasSizeX + canvasSizeY) / 2;
  var diameterJitter = diameterBase;
  var locationJitter = diameterBase * 3 / 12;
  var bwColorBase = 100;
  var bwColorJitter = 50;
  var colorBase = 70;
  var hueJitter = 25;
  var strokeBase = 50;
  var strokeJitter = strokeBase - 1;
  var chanceOfMaskCircle = 20;

  // Black and white random color.
  //var color = bwColorBase + random(bwColorJitter);

  // Slowly rotate hues.
  hueBase += 2;
  if (hueBase > 100) {
    hueBase = hueBase % 100;
  }
  if (hueBase > 15 && hueBase < 55) {
    hueBase = 35; // Skip this muddy range.
  }

  // HSB random color.
  var thisStrokeWeight = strokeBase + random(strokeJitter) - (strokeBase / 2);
  var thisH = hueBase + random(hueJitter);
  var thisS = 100;
  var thisB = 80;
  var thisA = 70;

  // Some will randomly be the background color.
  if (random(100) < chanceOfMaskCircle) {
    thisS = 0;
    thisB = 100;
    thisA = 100;
    thisStrokeWeight = thisStrokeWeight * 2;
  }

  // Random rotation direction and speed.
  var rotationSpeed = 300.0 * (random(2) > 1 ? 1 : -1);

  // random size and location.
  var thisDiameter = diameterBase + random(diameterJitter);
  var thisX = (width / 2) + (random(locationJitter) - (locationJitter / 2));
  var thisY = (height / 2) + (random(locationJitter) - (locationJitter / 2));

  return {
    x: thisX,
    y: thisY,
    sizeX: thisDiameter,
    sizeY: thisDiameter,
    strokeWeight: thisStrokeWeight,
    h: thisH,
    s: thisS,
    b: thisB,
    a: thisA,
    rotationSpeed: rotationSpeed,
    born: frameCount
  };
}

// Wait until DOM is loaded to start
$(document).ready(function() {
    // jQuery logic for handling button groups
    $(".js-button-group button").click(function() {
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
    var useMicrophone = false;
    var timeData = {
      startTime: 0,     // Starting time of playback
      beatTimecodes: [] // Array of [beatTime-startTime]
    };

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
    var beatDetectBand = 10;       // 3rd-to-last band we see out of 16.
    var beatDetectThreshold = 150; // Out of 255. Eyeballed this.
    var beatSamplingRate = 60;     // Default to 100% of beat events.
    var beat_detected = true;
    beatDetector.setFrequencyBand(beatDetectBand);
    beatDetector.setThreshold(beatDetectThreshold);
    beatDetector.onBeatDetected(onBeatDetected);

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

    // Slightly less ugly to simulate pageviews with symbolic constants.
    var URL_BUTTON_COLOR    = '/click/bg-color/';
    var URL_BUTTON_GIF      = '/click/bg-gif/';
    var URL_BUTTON_CIRCLE  = '/click/bg-circle/';
    var URL_BUTTON_FILE     = '/click/source/file/';
    var URL_BUTTON_MIC      = '/click/source/mic/';
    var URL_BUTTON_PLAY     = '/click/file/play/';
    var URL_BUTTON_STOP     = '/click/file/stop/';
    var URL_BUTTON_NEXT     = '/click/file/next/';
    var URL_RANGE_BAND      = '/click/range/band/';
    var URL_RANGE_SAMPLING  = '/click/range/beat-sampling-rate/';
    var URL_RANGE_THRESHOLD = '/click/range/threshold/';
    var URL_SEARCH_GIPHY    = '/search/giphy/';

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
    $('#bg-circle').click(toCircleBackground);
    $('#source-mic').click(toAudioSourceMicrophone);
    $('#source-mp3').click(toAudioSourceFile);
    $('#playback').click(startPlayback);
    $('#stop-playback').click(stopPlayback);
    $('#next').click(nextSound);
    $('#giphy-search-form').submit(onGiphyFormSubmit);
    $('#beat-detect-threshold').change(onChangeThresholdSlider);
    $('#beat-detect-band').change(onChangeBandSlider);
    $('#beat-sampling-rate').change(onChangeBeatSamplingSlider);

    // Pre-load party GIFs so there's something there if user switches to GIFs
    // without using the text box.
    giphySearch('party');
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
      timeData.startTime = Date.now(); // As close to playing file as possible.
      sourceNode.start(0);
      // Update UI.
      $('#playback').addClass('playing');
      updateUI();  // Called in start/stopPlayback, but this call happens
                   // in parallel, updates audioPlaying=true too late.
    }

    function stopSound() {
      audioPlaying = false;
      sourceNode.stop(0);
      $('#playback').removeClass('playing');
    }

    function toGifBackground() {
      if (bgStyle != BG_STYLE_GIFS) {
        _triggerPageview(URL_BUTTON_GIF);
        // Set to gifs
        bgStyle = BG_STYLE_GIFS;
        // Update UI.
        updateUI();
      }
    }

    function toCircleBackground() {
      if (bgStyle != BG_STYLE_CIRCLES) {
        _triggerPageview(URL_BUTTON_CIRCLE);
        // Set to circles
        bgStyle = BG_STYLE_CIRCLES;
        // Update UI.
        updateUI();
      }
    }

    // TODO: separate button clicks from the main handler so GA doesn't
    // double count, eg, giphy search?
    function toColorBackground() {
      if (bgStyle != BG_STYLE_COLORS) {
        _triggerPageview(URL_BUTTON_COLOR);
        // Set to colors
        bgStyle = BG_STYLE_COLORS;
        // Update UI.
        updateUI();
      }
    }

    function onGiphyFormSubmit(event) {
      var query = $.trim($('#giphy-search-query').val());
      _triggerPageview(_buildURL(URL_SEARCH_GIPHY, query));

      // Some basic validation.
      if ((query !== undefined) && (query != "")) {
        // Automatically switch to GIF background.
        toGifBackground();
        // Get images from Giphy.
        giphySearch(query);
      }
      // Don't let form submit refresh the page.
      event.preventDefault();
    }

    // From Giphy's API reference: https://github.com/Giphy/GiphyAPI
    // and RaveRobot: https://github.com/simplecasual/raverobot.com
    function giphySearch(query) {
      var xhr = $.get("https://api.giphy.com/v1/gifs/search?q=" + query + "&api_key=dc6zaTOxFJmzC&limit=20");
      xhr.done(function(data) { 
        var loading = [];
        var gifURL = "";
        for (var i = 0; i < data.data.length; i++) {
          gifURL = "https://media2.giphy.com/media/" + data.data[i].id + "/giphy.gif"
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

    function startPlayback() {
      // Playback controls disabled in microphone mode.
      if (!useMicrophone) {
        _triggerPageview(URL_BUTTON_PLAY);
        // Only start playing if we're not already.
        if (!audioPlaying) {
          // Start playing from audio file. Can't unpause an
          // AudioBufferSourceNode so we have to load from scratch :(
          loadSound(TRACKLIST[activeTrackID]); 

          updateUI();
        }
      }
    }

    function stopPlayback() {
      // Playback controls disabled in microphone mode.
      if (!useMicrophone) {
        _triggerPageview(URL_BUTTON_STOP);
        // Only stop playing if we're already playing.
        if (audioPlaying) {
          // Stop playing from audio file.
          stopSound();
          printBeatsDetected();

          updateUI();
        }
      }
    }

    function toAudioSourceFile() {
      // Only do this if we're not already sourcing audio from files.
      if (useMicrophone) {
        _triggerPageview(URL_BUTTON_FILE);
        // Turn off microphone.
        microphoneStream.disconnect();
        printBeatsDetected();

        // Update UI.
        useMicrophone = false;
        updateUI();
      }
    }

    function toAudioSourceMicrophone() {
      // Only do this if we're not already sourcing audio from the mic.
      if (!useMicrophone) {
        _triggerPageview(URL_BUTTON_MIC);
        // Stop playback if it's happening.
        if (audioPlaying) {
          stopPlayback();
        }

        // Set up to record beats immediately.
        // (Is there a better time to start?) Seems like people will need to
        // adjust manually no matter what, might as well start when they click 'Mic'.
        resetBeatsDetected();
        timeData.startTime = Date.now();

        // Turn on microphone.
        setupAudioNodes();
        setupMicrophoneBuffer();

        // Update UI.
        useMicrophone = true;
        updateUI();
      }
    }

    function onChangeThresholdSlider(event) {
      var newThreshold = $('#beat-detect-threshold').val();
      _triggerPageview(_buildURL(URL_RANGE_THRESHOLD, newThreshold));

      beatDetectThreshold = newThreshold;
      beatDetector.setThreshold(beatDetectThreshold);
      $('#threshold-range-value').val(newThreshold);
    }

    function onChangeBandSlider(event) {
      var newBand = $('#beat-detect-band').val();
      _triggerPageview(_buildURL(URL_RANGE_BAND, newBand));

      beatDetectBand = newBand;
      beatDetector.setFrequencyBand(beatDetectBand);
      $('#band-range-value').val(newBand);
    }

    function onChangeBeatSamplingSlider(event) {
      var newSamplingRate = $('#beat-sampling-rate').val();
      _triggerPageview(_buildURL(URL_RANGE_SAMPLING, newSamplingRate));
      beatSamplingRate = newSamplingRate;
      $('#beat-sampling-value').val(newSamplingRate + '%');
    }

    function nextSound() {
      // Playback controls disabled in microphone mode.
      if (!useMicrophone) {
        _triggerPageview(URL_BUTTON_NEXT);

        //var newURL = prompt("Enter URL of a new song to play");
        //if (newURL !== undefined) {
        //  songURL = newURL;
        //}
        if (audioPlaying) {
          // Only stop first if already playing.
          stopPlayback();
        }
        // Increment track.
        activeTrackID = (activeTrackID + 1) % TRACKLIST.length;
        // Now play (which will load newly-updated songURL).
        startPlayback();
      }
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
      // Odd numbers -> corresponding even ones, since we're only showing half.
      var displayBand = beatDetectBand;
      if ((displayBand % 2) != 0) {
        displayBand++;
      }
      // Draw the frequency bands.
      for ( var i = 0; i < (array.length); i+=2 ){
        if (i == displayBand) {
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

    // Called when Dendrite detects a beat.
    function onBeatDetected(array, beatTime) {
      var roll = Math.random()*100;  // Random roll out of 100%.
      if (roll < beatSamplingRate) {
        swapBackground(array, beatTime);
        registerBeatDetected(array, beatTime);
      }
    }

    /**
     * Redraw the background color in response to the beat detection.
     */
    function swapBackground(array, timestamp) {
      if ((bgStyle == BG_STYLE_COLORS) || (bgStyle == BG_STYLE_CIRCLES)) {
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
      // Playback controls are disabled in microphone mode. Hide them.
      if (useMicrophone) {
        $('#playback').attr('disabled','true');
        $('#stop-playback').attr('disabled','true');
        $('#next').attr('disabled','true');
      } else {
        $('#playback').removeAttr('disabled');
        $('#stop-playback').removeAttr('disabled');
        $('#next').removeAttr('disabled');
      }
    }

    /**
     * Register simulated pageviews with GA
     * https://developers.google.com/analytics/devguides/collection/analyticsjs/pages
     *
     * @param page,String -- Relative URL for the page to log a view on.
     *                       eg. '/my-overridden-page?id=1'
     * @param title,String -- HTML title of simulated page (optional)
     *                       eg. 'My overridden Page'
     */
    function _triggerPageview(page, title) {
      ga('send', 'pageview', {
        'page': page,
        'title': title
      });
    }

    /*
     * Returns full GA URL for URLs that need a param appended.
     */
    function _buildURL(page, queryParam) {
      return page + queryParam;
    }
});

// p5.js
var cnv;

function resizeP5Canvas() {
  // It's a child of the visualization section, so (0, 0).
  var x = 0;
  var y = 0;
  cnv.position(x, y);

  // Fill up the rest of the screen.
  // The way they do width/height, CSS can't control size.
  // (col-2 is 16.6666664%).
  var sidebarWidth = windowWidth * .166666666666664;
  var sizeX = windowWidth - sidebarWidth;
  var sizeY = windowHeight;
  cnv.size(sizeX, sizeY);
}

function setup() {
  cnv = createCanvas(400, 325);
  cnv.parent('p5container');

  // Set up the canvas
  resizeP5Canvas();
  colorMode(HSB, 100);
  background(0, 0, 100, 0);
  hueBase = random(100);
  noFill();

  // Start with something on screen.
  for (var i = 0; i < 7; i++) {
    ellipses.push(circleFactory());
  }
}

function windowResized() {
  resizeP5Canvas();
}

function draw() {
  // Can draw whatever in here
  if (bgStyle == BG_STYLE_CIRCLES) {
    var chanceOfCircleSpawn = 1;

    // Clear the frame.
    clear();
    background(0, 0, 100, 0);

    // Draw circles we have so far.
    ellipses.forEach(function(el) {
      push();
      translate(gravityWell.x, gravityWell.y);
      rotate(frameCount / el.rotationSpeed);

      // "Age" the circle.
      age = frameCount - el.born;
      distanceFade = Math.sqrt(age*2) / 20.0;
      el.sizeX = el.sizeX - distanceFade;
      el.sizeY = el.sizeY - distanceFade;
      el.a = originalOpacity * (el.sizeX / canvasSizeX);
      var percentOfLife = el.a / 100;
      var distX = el.x - gravityWell.x;
      var distY = el.y - gravityWell.y;
      el.x = el.x - (distX * percentOfLife) / 1000;
      el.y = el.y - (distY * percentOfLife) / 1000;

      // Draw circle
      strokeWeight(el.strokeWeight);
      var currentOpacity = fadeIn(frameCount - el.born, 30, el.a)
      stroke(el.h, el.s, el.b, currentOpacity);
      ellipse(gravityWell.x - el.x, gravityWell.y - el.y, el.sizeX, el.sizeY);
      pop();
    });

    // If we have room for more circles, randomly create them.
    if (ellipses.length < numCircles) {
      if (random(100) < chanceOfCircleSpawn) {
        ellipses.push(circleFactory());
      }
    }

    // If any circle is too faded, restart it bigger
    for (var i = 0; i < ellipses.length; i++) {
      var el = ellipses[i];
      if ((el.a <= 0) || (el.sizeX < el.strokeWeight)) {
        ellipses[i] = circleFactory();
      }
    } 
  } else {
    clear(); // Hide p5 if another system's mode is active.
  }
}

function fadeIn(age, fadeInFrames, targetOpacity) {
  var currentOpacity = targetOpacity;
  if (age < fadeInFrames) {
    currentOpacity = age / fadeInFrames * targetOpacity;
  }
  return currentOpacity;
}
