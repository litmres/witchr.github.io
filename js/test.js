/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */

'use strict';

(function( witchr, undefined ) {
	let de = true;
	let bug = console;

	let scene, camera, renderer;

	let geometry, material, cube;
	
	let Canvas, Player, Key, Keyboard;

	init();
	render();

	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	// init scene, camera, renderer
	function init() {
		
		// init all enums that will be used from here on out
		initEnums();

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
		document.body.appendChild( renderer.domElement );

		// init objects in scene, in this case just the cube
		geometry = new THREE.BoxGeometry( 1, 1, 1 );
		material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
		cube = new THREE.Mesh( geometry, material );
		scene.add( cube );

		// setup the scene, move the camera 5 units back in z so we can see cube
		camera.position.z = 5;

		// add all event listeners
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );
		
		document.addEventListener( 'mousedown', onDocumentMouseDown, false );
	}

	function onWindowResize() {
		renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
	}


	/*********************************************************
	 * render gameloop 
	 *********************************************************
	 */
	function render() {
		requestAnimationFrame( render );

		// spin the cube
		cube.rotation.x += 0.01;
		cube.rotation.y += 0.01;

		// handle keyboard input
		handleKeyboard(Keyboard.keys);

		renderer.render( scene, camera );
	}
	

	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	function handleKeyboard(keys) {
		if ( keys[Key.LEFT] || keys[Key.A] ) {
			camera.position.x -= Player.MOVE_SPEED;
		}
		if ( keys[Key.UP] || keys[Key.W] ) {
			camera.position.z -= Player.MOVE_SPEED;
		}
		if ( keys[Key.RIGHT] || keys[Key.D] ) {
			camera.position.x += Player.MOVE_SPEED;
		}
		if ( keys[Key.DOWN] || keys[Key.S] ) {
			camera.position.z += Player.MOVE_SPEED;
		}
		if ( keys[Key.SPACE] ) {
			de&&bug.log('spacebar pressed.');
		}
		if ( keys[Key.CTRL] ) {
			de&&bug.log('ctrl pressed.');
		}
	}

	// handle mouse input
	function onDocumentMouseDown(e) {
		e.preventDefault();
		// document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		

	}

	function initEnums() {
		
		// init canvas to not take up so much space (scrollbars appear) 
		Canvas = {
			SIZE: 0.99
		}; 

		// init player properties
		Player = {
			MOVE_SPEED: 0.05,
			ROTATE_SPEED: 0.01
		};

		// init keyboard input keycodes
		Key = {
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

		// init handle keyboard input
		Keyboard = {
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
		};
	}

}( window.witchr = window.witchr || {} ));