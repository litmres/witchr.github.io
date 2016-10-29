/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */

'use strict';

(function( witchr, undefined ) {
	let de = true;
	let bug = console;
	
	// handle keyboard input
	let Key = {
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		A: 65,
		W: 87,
		D: 68,
		S: 83,
		SPACE: 32,
		CTRL: 17
	};
	let Keyboard = {
		keys: {},
		keyPress: function(e) {
			//e.preventDefault();
			if ( this.keys[e.keyCode] > 0 ) { return; }
			this.keys[e.keyCode] = e.timeStamp || (new Date()).getTime();
			e.stopPropagation();
		},
		keyRelease: function(e) {
			//e.preventDefault();
			this.keys[e.keyCode] = 0;
			e.stopPropagation();
		}
	}
	window.addEventListener('keydown', Keyboard.keyPress.bind(Keyboard));
	window.addEventListener('keyup', Keyboard.keyRelease.bind(Keyboard));
	let handleKeyboard = function(keys) {
		if ( keys[Key.LEFT] || keys[Key.A] ) {
			camera.position.x -= Player.SPEED;
		}
		if ( keys[Key.UP] || keys[Key.W] ) {
			camera.position.z -= Player.SPEED;
		}
		if ( keys[Key.RIGHT] || keys[Key.D] ) {
			camera.position.x += Player.SPEED;
		}
		if ( keys[Key.DOWN] || keys[Key.S] ) {
			camera.position.z += Player.SPEED;
		}
		if ( keys[Key.SPACE] ) {
			de&&bug.log('spacebar pressed.');
		}
		if ( keys[Key.CTRL] ) {
			de&&bug.log('ctrl pressed.');
		}
	};

	// player properties
	let Player = {
		SPEED: 0.05
	};

	// init scene, camera, renderer
	let Canvas = { SIZE: 0.99 }; // canvas takes up too much space 
	let scene = new THREE.Scene();
	let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	let renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
	window.addEventListener('resize', function() {
		renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
	}, false);
	document.body.appendChild( renderer.domElement );

	// init objects in scene, in this case just the cube
	let geometry = new THREE.BoxGeometry( 1, 1, 1 );
	let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
	let cube = new THREE.Mesh( geometry, material );
	scene.add( cube );

	// setup the scene, move the camera 5 units back in z so we can see cube
	camera.position.z = 5;

	function render() {
		requestAnimationFrame( render );

		// spin the cube
		cube.rotation.x += 0.01;
		cube.rotation.y += 0.01;

		// handle keyboard input
		handleKeyboard(Keyboard.keys);

		renderer.render( scene, camera );
	}
	render();
}( window.witchr = window.witchr || {} ));