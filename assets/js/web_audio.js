<!-- hide script from old browsers   

	//-------
	//PubNub
	//-------

	var channel = 'sound';
	var audioStopped = [];
	var audioPlaying = [];
	var pubnub = PUBNUB.init({ 
		publish_key: 'pub-c-6687236f-6742-400f-b40f-a46d97b0a30b', 
		subscribe_key: 'sub-c-fb8dc442-450d-11e4-8971-02ee2ddab7fe' 
	});
	
	pubnub.subscribe({
		channel: channel,
		callback: playFromStream
	});	
	
	//-------------
	//PubNub Publish
	//--------------
	
	function publish(data) {
		pubnub.publish({
			channel: channel,
			message: data
		});
	}
   //--------------
    // Audio Object
    //--------------
    var audio = {
        buffer: {},
        compatibility: {},
        files: [
            '/assets/music/synth.wav',
            '/assets/music/beat.wav',
			'/assets/music/skyloop.wav',
            '/assets/music/AfricanTribalCircle.wav'
        ],
        proceed: true,
        source_loop: {},
        source_once: {},
		//volumeNode: null
    };

    //-----------------
    // Audio Functions
    //-----------------
    audio.findSync = function(n) {
        var first = 0,
            current = 0,
            offset = 0;

        // Find the audio source with the earliest startTime to sync all others to
        for (var i in audio.source_loop) {
            current = audio.source_loop[i]._startTime;
            if (current > 0) {
                if (current < first || first === 0) {
                    first = current;
                }
            }
        }

        if (audio.context.currentTime > first) {
            offset = (audio.context.currentTime - first) % audio.buffer[n].duration;
        }

        return offset;
    };

    audio.play = function(n) {
		
		if (audio.source_loop[n]._playing) {
            audio.stop(n);
        } else {
			audioPlaying.push(n);
            audio.source_loop[n] = audio.context.createBufferSource();
            audio.source_loop[n].buffer = audio.buffer[n];
            audio.source_loop[n].loop = true;
            audio.source_loop[n].connect(audio.context.destination);
			//audio.volumeNode = audio.context.createGainNode();
			//audio.volumeNode.gain.value = 100;
			//audio.source_loop[n].connect(volumeNode);
            //audio.volumeNode.connect(audio.context.destination);

            var offset = audio.findSync(n);
            audio.source_loop[n]._startTime = audio.context.currentTime;

            if (audio.compatibility.start === 'noteOn') {
                /*
                The depreciated noteOn() function does not support offsets.
                Compensate by using noteGrainOn() with an offset to play once and then schedule a noteOn() call to loop after that.
                */
                audio.source_once[n] = audio.context.createBufferSource();
                audio.source_once[n].buffer = audio.buffer[n];
                audio.source_once[n].connect(audio.context.destination);
                audio.source_once[n].noteGrainOn(0, offset, audio.buffer[n].duration - offset); // currentTime, offset, duration
                /*
                Note about the third parameter of noteGrainOn().
                If your sound is 10 seconds long, your offset 5 and duration 5 then you'll get what you expect.
                If your sound is 10 seconds long, your offset 5 and duration 10 then the sound will play from the start instead of the offset.
                */

                // Now queue up our looping sound to start immediatly after the source_once audio plays.
                audio.source_loop[n][audio.compatibility.start](audio.context.currentTime + (audio.buffer[n].duration - offset));
            } else {
                audio.source_loop[n][audio.compatibility.start](0, offset);
            }

            audio.source_loop[n]._playing = true;
			console.log("playing");
			for(a = 0; a < audioPlaying.length; a++) {
				console.log(audioPlaying[a]);
				var index = audioStopped.indexOf(n);
				if(index!=-1){
					audioStopped.splice(index, 1);
				}
			}
			
			publish({
				audioStopped: audioStopped,
				audioPlaying: audioPlaying
			});
			
			
        }
    };

    audio.stop = function(n) {
        if (audio.source_loop[n]._playing) {
            audio.source_loop[n][audio.compatibility.stop](0);
            audio.source_loop[n]._playing = false;
            audio.source_loop[n]._startTime = 0;
            if (audio.compatibility.start === 'noteOn') {
                audio.source_once[n][audio.compatibility.stop](0);
            }
			audioStopped.push(n);
			console.log("stopped");
			for(a = 0; a < audioStopped.length; a++) {
				console.log(audioStopped[a]);
				var index = audioPlaying.indexOf(n);
				if(index!=-1){
					audioPlaying.splice(index, 1);
				}
			}
			
			publish({
				audioStopped: audioStopped,
				audioPlaying: audioPlaying
			});
        }
    };
	
	function playFromStream(message) {
		if(!message) return;	
		for(a = 0; a < audioPlaying.length; a++)// {
			console.log('playing from stream:', message.audioPlaying[a]);
			audio.play(message.audioPlaying[a]);
		//}
		/**
		for(b = 0; b < audioStopped.length; b++) {
			console.log('playing from stream:', message.audioStopped[b]);
			audio.stop(message.audioStopped[b]);
		} **/
		//console.log(message.audioStopped.toString());
	}
	
	
    //-----------------------------
    // Check Web Audio API Support
    //-----------------------------
    try {
        // More info at http://caniuse.com/#feat=audio-api
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audio.context = new window.AudioContext();
    } catch(e) {
        audio.proceed = false;
        alert('Web Audio API not supported in this browser.');
    }

    if (audio.proceed) {
        //---------------
        // Compatibility
        //---------------
        (function() {
            var start = 'start',
                stop = 'stop',
                buffer = audio.context.createBufferSource();

            if (typeof buffer.start !== 'function') {
                start = 'noteOn';
            }
            audio.compatibility.start = start;

            if (typeof buffer.stop !== 'function') {
                stop = 'noteOff';
            }
            audio.compatibility.stop = stop;
        })();

        //-------------------------------
        // Setup Audio Files and Buttons
        //-------------------------------
        for (var a in audio.files) {
            (function() {
                var i = parseInt(a) + 1;
                var req = new XMLHttpRequest();
                req.open('GET', audio.files[i - 1], true); // array starts with 0 hence the -1
                req.responseType = 'arraybuffer';
                req.onload = function() {
                    audio.context.decodeAudioData(
                        req.response,
                        function(buffer) {
                            audio.buffer[i] = buffer;
                            audio.source_loop[i] = {};
                            var button = document.getElementById('button-loop-' + i);
                            button.addEventListener('click', function(e) {
                                e.preventDefault();
                                audio.play(this.value);
                            });
                        },
                        function() {
                            console.log('Error decoding audio "' + audio.files[i - 1] + '".');
                        }
                    );
                };
                req.send();
            })();
        }
    }
	
// end hiding script from old browsers -->	