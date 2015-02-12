/**
 * Dendrite.js
 * Beat detection brains
 * Takes in an array of frequency bands
 * Fires beat detection events user can subscribe to, in order to react to
 * the audio, based on configurable inputs.
 *
 * Events:
 * onBeatDetected: volume of desired frequency band rises above the threshold
 */
 
var Dendrite = function() {

  var onBeatDetectedCallbacks = [];
  var beatDetected = true; 
  var beatDetectBand = 10;       // 10 3rd-to-last band we see.
  var beatDetectThreshold = 150; // Out of 255;

  /**
   * When a beat is detected, trigger the callbacks
   */
  function triggerBeatDetected(array, timestamp) {
    for (i = 0; i < onBeatDetectedCallbacks.length; i++) {
      if (onBeatDetectedCallbacks[i] !== undefined) {
        onBeatDetectedCallbacks[i](array, timestamp);
      }
    }
  }
     
  var publicInterface = {

    setFrequencyBand: function(newBand) {
      beatDetectBand = newBand;
    },

    setThreshold: function(newThreshold) {
      beatDetectThreshold = newThreshold;
    },

    onBeatDetected: function(callback) {
      onBeatDetectedCallbacks.push(callback);
    },

    /**
     * A "beat" is defined by volume of a particular band of spectrum
     * rising above a certain line. They're on 0-255 scale.
     */
    process: function(array) {
      var new_beat_this_frame = false;
      if (beatDetected) {
        // Wait for band to go below threshold and un-mark 
        if (array[beatDetectBand] < beatDetectThreshold) {
          beatDetected = false; 
        }
      } else {
        if (array[beatDetectBand] > beatDetectThreshold) {
          beatDetected = true; 
          new_beat_this_frame = true;
          triggerBeatDetected(array, Date.now());
        }
      }
      return new_beat_this_frame;
    },

  };

  return publicInterface;
};
