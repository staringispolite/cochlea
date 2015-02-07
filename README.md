# Cochlea
## A configurable spectrum-band and beat-detection visualizer [[Live Demo Here]](http://staringispolite.github.io/cochlea/)


**The cochlea _/ˈkɒk.lɪə/_** is the auditory portion of the inner ear. ![](http://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Cochlea.svg/490px-Cochlea.svg.png)

Cochlea takes as its main arguments:
* The URL of an audio file that HTML5 audio supports
* A frequency band ID to listen on [0-15], which evenly divide the audio spectrum from high to low
* A threshold value, which acts as a sensitivity setting [0-255]

Given these inputs (Javascript globals at the moment), loading index.html does the following:
* Immediately downloads and plays the MP3, breaking it up live into 16 frequency bands, and displaying the volume of each band in a Graphic Equalizer style
* Visually identifies which frequency band it's using for beat detection, and the threshold value it's listening for
* If volume in that frequency band rises above the threshold value, it registers a beat
* When it registers a beat, it swaps the background color, and waits for the volume to go back below the threshold before "listening" again (thereby preventing what is lovingly referred to as "seizure mode").

The [cochlea](http://en.wikipedia.org/wiki/Cochlea) is a portion of the inner ear that looks like a snail shell (cochlea is Greek for snail.) The cochlea is filled with a watery liquid, the perilymph, which moves in response to the vibrations coming from the middle ear via the oval window. 

Thousands of hair cells sense the motion via their stereocilia, and convert that motion to electrical signals that are communicated via neurotransmitters to many thousands of nerve cells. These transform the signals into electrochemical impulses which travel along the auditory nerve to structures in the brainstem for further processing.

Because of [how the ear works](http://www.soundonsound.com/sos/mar11/articles/how-the-ear-works.htm), the average person's ears can detect sounds in frequency bands from 20Hz - 20kHz+, but our the frequency response in the inner ear is tuned for three octaves: 500Hz - 4kHz. Not coincidentally, most instruments operate mostly in this range. Frequency response drops drastically below 500 Hz, and above 4kHz it decreases slowly but steadily. This means while bass is "shaped" by the lowest frequencies, most of the "character" of beats is determined between 500Hz and 4kHz.
